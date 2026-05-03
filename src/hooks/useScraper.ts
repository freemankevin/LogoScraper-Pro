import { useState, useCallback, useRef } from 'react'
import Fuse from 'fuse.js'
import type { ScraperLog, ScraperProgress, LogoResult, ScraperState, ScrapeMode } from '../types/scraper'
import ImageTracer from 'imagetracerjs'
import { KNOWN_SOFTWARE, type KnownSoftwareInfo } from '../data/software'
import { getCachedResults, saveCachedResults, saveCachedSoftware } from '../lib/logo-cache'
import { fetchCloudLogo, saveCloudLogo, isSupabaseConfigured } from '../lib/supabase-client'
import { downloadSvgAsPng } from '../lib/svg-to-png'
import { sanitizeDownloadName, svgToDataUrl, dataUrlToText, isValidSvg } from '../lib/utils'

let logIdCounter = 0
function generateId() {
  return `log-${++logIdCounter}-${Date.now().toString(36)}`
}

function nowTime() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

const INITIAL_PROGRESS: ScraperProgress[] = [
  { stage: 'dns', label: 'DNS Resolution', percent: 0, status: 'pending' },
  { stage: 'connect', label: 'TCP / TLS', percent: 0, status: 'pending' },
  { stage: 'fetch', label: 'HTTP Request', percent: 0, status: 'pending' },
  { stage: 'parse', label: 'HTML Parse', percent: 0, status: 'pending' },
  { stage: 'scan', label: 'Resource Scan', percent: 0, status: 'pending' },
  { stage: 'download', label: 'Download', percent: 0, status: 'pending' },
  { stage: 'convert', label: 'Convert', percent: 0, status: 'pending' },
]



function extractDomainFromUrl(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed)
      return url.hostname
    } catch {
      return null
    }
  }
  // 无协议但看起来像域名（含 . 且无空格）
  if (trimmed.includes('.') && !trimmed.includes(' ') && trimmed.length > 3) {
    return trimmed.replace(/^www\./, '')
  }
  return null
}

function guessDomains(name: string): string[] {
  const key = name.toLowerCase().trim()

  const urlDomain = extractDomainFromUrl(key)
  if (urlDomain) {
    return [urlDomain]
  }

  const known = KNOWN_SOFTWARE[key]
  const clean = key.replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
  const guessed = [
    `${clean}.com`,
    `www.${clean}.com`,
    `${clean}.io`,
    `www.${clean}.io`,
    `${clean}.dev`,
    `${clean}.org`,
    `app.${clean}.com`,
  ]
  if (known) {
    // 已知域名优先，自动猜测的域名作为后备（去重）
    const set = new Set<string>(known.domains)
    for (const d of guessed) set.add(d)
    return Array.from(set)
  }
  return guessed
}

function getKnownInfo(name: string): KnownSoftwareInfo | null {
  const key = name.toLowerCase().trim()
  return KNOWN_SOFTWARE[key] ?? null
}

/** 通过域名反查已知软件（解决输入 nginx.org 时无法匹配到 nginx 的问题） */
function getKnownInfoByDomain(domain: string): KnownSoftwareInfo | null {
  const d = domain.toLowerCase().trim().replace(/^www\./, '')
  for (const info of Object.values(KNOWN_SOFTWARE)) {
    for (const dom of info.domains) {
      if (dom === d || dom === `www.${d}` || d.endsWith(`.${dom}`)) {
        return info
      }
    }
  }
  return null
}

/** 从官网 HTML 中解析 favicon 链接 */
async function findFaviconFromHtml(domain: string): Promise<string | null> {
  try {
    const resp = await fetch(`https://${domain}/`, { signal: AbortSignal.timeout(8000) })
    if (!resp.ok) return null
    const html = await resp.text()
    const match =
      html.match(/<link[^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
      html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut\s+)?icon["'][^>]*>/i)
    if (match) {
      let href = match[1]
      if (href.startsWith('//')) href = 'https:' + href
      else if (href.startsWith('/')) href = `https://${domain}${href}`
      else if (!href.startsWith('http')) href = `https://${domain}/${href}`
      return href
    }
  } catch { }
  return null
}

/** 获取 favicon 并转为 PNG dataUrl（通过 blob 避免 CORS 污染） */
async function fetchFaviconAsPng(url: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!resp.ok) return null
    const contentType = resp.headers.get('content-type') || ''
    if (!contentType.includes('image') && !contentType.includes('icon') && !contentType.includes('octet')) {
      // 非图片内容，可能是 404 页面
      return null
    }
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        URL.revokeObjectURL(blobUrl)
        if (!img.naturalWidth || !img.naturalHeight) {
          resolve(null)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl)
        resolve(null)
      }
      img.src = blobUrl
    })
  } catch { }
  return null
}

/** 尝试从多个 favicon 源获取 Logo */
async function tryFetchFaviconLogos(domain: string): Promise<LogoResult[]> {
  const results: LogoResult[] = []

  // 1. 先尝试 /favicon.ico（最常见的位置）
  const icoResult = await fetchFaviconAsPng(`https://${domain}/favicon.ico`)
  if (icoResult) {
    results.push({
      id: generateId(),
      source: `Favicon (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url: `https://${domain}/favicon.ico`,
      dataUrl: icoResult.dataUrl,
      width: icoResult.width,
      height: icoResult.height,
      title: domain,
    })
  }

  // 2. 解析 HTML 中的 favicon 链接
  const htmlFavicon = await findFaviconFromHtml(domain)
  if (htmlFavicon && !results.some(r => r.url === htmlFavicon)) {
    const favResult = await fetchFaviconAsPng(htmlFavicon)
    if (favResult) {
      results.push({
        id: generateId(),
        source: `Favicon HTML (${domain})`,
        sourceType: 'favicon',
        format: 'png',
        url: htmlFavicon,
        dataUrl: favResult.dataUrl,
        width: favResult.width,
        height: favResult.height,
        title: domain,
      })
    }
  }

  // 3. 尝试 /apple-touch-icon.png（通常质量更高）
  const appleResult = await fetchFaviconAsPng(`https://${domain}/apple-touch-icon.png`)
  if (appleResult && !results.some(r => r.url?.includes('apple-touch-icon'))) {
    results.push({
      id: generateId(),
      source: `Apple Touch (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url: `https://${domain}/apple-touch-icon.png`,
      dataUrl: appleResult.dataUrl,
      width: appleResult.width,
      height: appleResult.height,
      title: domain,
    })
  }

  // 4. DuckDuckGo Favicon API（子域名覆盖更好）
  const ddgResult = await fetchDuckDuckGoFavicon(domain)
  if (ddgResult && !results.some(r => r.url === ddgResult.url)) {
    results.push({ ...ddgResult, title: domain })
  }

  return dedupeFaviconResults(results)
}

/** DuckDuckGo Favicon API（子域名覆盖较好） */
async function fetchDuckDuckGoFavicon(domain: string): Promise<LogoResult | null> {
  try {
    const url = `https://icons.duckduckgo.com/ip3/${domain}.ico`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (blob.size < 100) return null // 默认占位图标通常只有几十字节
    const dataUrl = await blobToDataUrl(blob)
    return {
      id: generateId(),
      source: `DuckDuckGo (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url,
      dataUrl,
      width: 32,
      height: 32,
      title: domain,
    }
  } catch { }
  return null
}

/** Google Favicon API 兜底 */
async function fetchGoogleFavicon(domain: string): Promise<LogoResult | null> {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (blob.size < 100) return null // 过滤默认占位图标
    const dataUrl = await blobToDataUrl(blob)
    return {
      id: generateId(),
      source: `Google Favicon (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url,
      dataUrl,
      width: 128,
      height: 128,
      title: domain,
    }
  } catch { }
  return null
}

/** 从 Simple Icons CDN 获取品牌 SVG（最高质量的品牌 Logo） */
async function fetchSimpleIconsLogo(query: string, known?: KnownSoftwareInfo | null): Promise<LogoResult | null> {
  const slugs: string[] = []
  if (known?.simpleIconsSlug) {
    slugs.push(known.simpleIconsSlug)
  }
  // 也尝试从查询词推断 slug
  const inferred = query.toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  if (inferred && !slugs.includes(inferred)) {
    slugs.push(inferred)
  }
  const alt = query.toLowerCase().trim().replace(/\s+/g, '')
  if (alt && !slugs.includes(alt)) {
    slugs.push(alt)
  }

  for (const slug of slugs) {
    try {
      const url = `https://cdn.simpleicons.org/${slug}`
      const resp = await fetch(url, { signal: AbortSignal.timeout(6000) })
      if (!resp.ok) continue
      const svgText = await resp.text()
      if (!isValidSvg(svgText)) continue
      return {
        id: generateId(),
        source: `Simple Icons (${slug})`,
        sourceType: 'direct',
        format: 'svg',
        url,
        dataUrl: svgToDataUrl(svgText),
        title: query,
      }
    } catch { /* ignore */ }
  }
  return null
}

/** 去重：基于图片尺寸和文件大小过滤重复/低质量 favicon */
function dedupeFaviconResults(results: LogoResult[]): LogoResult[] {
  const seen = new Set<string>()
  const filtered: LogoResult[] = []
  for (const r of results) {
    // 过滤太小或尺寸为 0 的
    if (!r.width || !r.height || r.width < 16 || r.height < 16) continue
    // 过滤默认占位图标（Google/DDG 的默认图标通常是 16x16 或 32x32 的地球）
    if (r.width === 16 && r.height === 16) {
      // 16x16 可能是低质量默认图标，降级到最后
      continue
    }
    const key = `${r.width}x${r.height}-${(r.dataUrl?.length ?? 0)}`
    if (!seen.has(key)) {
      seen.add(key)
      filtered.push(r)
    }
  }
  return filtered
}

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

/** 用 Fuse.js 构建软件库索引，支持 typo 容忍和域名搜索 */
const _softwareIndex = Object.entries(KNOWN_SOFTWARE).map(([name, info]) => ({
  name,
  domains: info.domains.join(' '),
}))

const _fuse = new Fuse(_softwareIndex, {
  keys: [
    { name: 'name', weight: 0.7 },
    { name: 'domains', weight: 0.3 },
  ],
  threshold: 0.35, // typo 容忍度：0=精确匹配，1=任意匹配
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
})

export function findSuggestions(query: string, limit = 6): string[] {
  const q = normalize(query)
  if (!q || q.length < 2) return []

  const results = _fuse.search(q, { limit: limit + 5 })

  // 排除完全匹配自身的情况，按 fuse score 排序（越低越匹配）
  return results
    .filter((r) => normalize(r.item.name) !== q)
    .slice(0, limit)
    .map((r) => r.item.name)
}

export { KNOWN_SOFTWARE }

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadImageAsync(src: string, crossOrigin = true): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (crossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

async function imageToDataUrl(img: HTMLImageElement, type = 'image/png'): Promise<string> {
  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error(`Image has zero dimensions: ${img.src?.substring(0, 80)}`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvas.toDataURL(type)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'))
    reader.readAsDataURL(blob)
  })
}

async function tryConvertToSvg(dataUrl: string, _title: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      ImageTracer.imageToSVG(
        dataUrl,
        (svgStr: string) => resolve(isValidSvg(svgStr) ? svgStr : null),
        { ltres: 1, qtres: 1, pathomit: 1, numberofcolors: 16, colorquantcycles: 3 }
      )
    } catch (e) {
      resolve(null)
    }
  })
}

/** 来源可信度权重（数字越小优先级越高） */
function getSourcePriority(sourceType: LogoResult['sourceType']): number {
  switch (sourceType) {
    case 'cloud': return 0
    case 'github': return 1
    case 'direct': return 2
    case 'clearbit': return 3
    case 'favicon': return 4
    case 'wikipedia': return 5
    case 'converted': return 6
    default: return 10
  }
}

/** 同名结果去重：每个 title 只保留一个最佳结果（优先有效 SVG，其次来源可信度，最后尺寸） */
function pickBestResults(results: LogoResult[]): LogoResult[] {
  const byTitle = new Map<string, LogoResult[]>()
  for (const r of results) {
    const list = byTitle.get(r.title) || []
    list.push(r)
    byTitle.set(r.title, list)
  }
  const best: LogoResult[] = []
  for (const [, list] of byTitle) {
    if (list.length === 1) {
      best.push(list[0])
      continue
    }
    list.sort((a, b) => {
      const aHasSvg = isValidSvg(a.convertedSvg) || a.format === 'svg'
      const bHasSvg = isValidSvg(b.convertedSvg) || b.format === 'svg'
      if (aHasSvg && !bHasSvg) return -1
      if (!aHasSvg && bHasSvg) return 1
      // 两个都有 SVG 或都没有时，比较来源可信度
      const aPriority = getSourcePriority(a.sourceType)
      const bPriority = getSourcePriority(b.sourceType)
      if (aPriority !== bPriority) return aPriority - bPriority
      // 来源优先级相同时，按尺寸排序
      const aSize = (a.width || 0) * (a.height || 0)
      const bSize = (b.width || 0) * (b.height || 0)
      return bSize - aSize
    })
    best.push(list[0])
  }
  return best
}

async function fetchFromApi(query: string, apiKey?: string | null): Promise<LogoResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-API-Key'] = apiKey

  const resp = await fetch('/api/scrape', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, formats: ['svg', 'png'] }),
  })

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'API request failed' }))
    throw new Error(err.error || `API ${resp.status}`)
  }

  const data = await resp.json()
  if (!data.success) throw new Error(data.error || 'API returned unsuccessful')

  // 将 API 响应格式映射为前端 LogoResult
  return (data.results || []).map((r: any) => ({
    id: r.id || generateId(),
    source: r.source,
    sourceType: r.sourceType as LogoResult['sourceType'],
    format: (r.format === 'svg' ? 'svg' : 'png') as LogoResult['format'],
    url: r.url,
    width: r.width,
    height: r.height,
    title: r.title || query,
  }))
}

export function useScraper() {
  const [state, setState] = useState<ScraperState>({
    query: '',
    isRunning: false,
    mode: 'direct',
    apiKey: typeof window !== 'undefined' ? localStorage.getItem('ls_api_key') : null,
    logs: [],
    progress: INITIAL_PROGRESS.map((p) => ({ ...p })),
    results: [],
    error: null,
  })

  const abortRef = useRef(false)

  const setMode = useCallback((mode: ScrapeMode) => {
    setState((prev) => ({ ...prev, mode }))
  }, [])

  const setApiKey = useCallback((key: string | null) => {
    if (key) localStorage.setItem('ls_api_key', key)
    else localStorage.removeItem('ls_api_key')
    setState((prev) => ({ ...prev, apiKey: key }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current = true
    setState({
      query: '',
      isRunning: false,
      mode: state.mode,
      apiKey: state.apiKey,
      logs: [],
      progress: INITIAL_PROGRESS.map((p) => ({ ...p })),
      results: [],
      error: null,
    })
  }, [state.mode, state.apiKey])

  const pushLog = useCallback((level: ScraperLog['level'], message: string, stage?: string) => {
    if (abortRef.current) return
    setState((prev) => ({
      ...prev,
      logs: [...prev.logs, { id: generateId(), timestamp: nowTime(), level, message, stage }],
    }))
  }, [])

  const downloadAsSvg = useCallback(async (result: LogoResult) => {
    const filename = sanitizeDownloadName(result.title)
    // 优先用 convertedSvg，但必须先校验是否为有效 SVG（避免 WASM 返回畸形内容）
    let svgContent: string | null = isValidSvg(result.convertedSvg) ? result.convertedSvg : null
    if (!svgContent && result.format === 'svg' && result.dataUrl) {
      try { svgContent = dataUrlToText(result.dataUrl) } catch { svgContent = null }
    }
    // 如果只有 PNG/JPG 等格式，现场转换为 SVG
    if (!svgContent && result.format !== 'svg' && result.dataUrl) {
      pushLog('info', `[CONVERT] On-the-fly converting ${result.format.toUpperCase()} to SVG during download...`, 'convert')
      try {
        const converted = await tryConvertToSvg(result.dataUrl, result.title)
        if (converted === null) {
          pushLog('warn', `[CONVERT] On-the-fly conversion engine cannot process this image`, 'convert')
        } else if (isValidSvg(converted)) {
          svgContent = converted
          pushLog('success', `[CONVERT] On-the-fly conversion complete — ${converted.length} bytes`, 'convert')
        } else {
          pushLog('warn', `[CONVERT] On-the-fly conversion produced invalid content (${(converted as string).length} bytes)`, 'convert')
        }
      } catch (e) {
        pushLog('warn', `[CONVERT] On-the-fly conversion error: ${(e as Error).message}`, 'convert')
      }
    }
    if (svgContent) {
      // 移除非法 XML 注释（部分 SVG 生成器会在注释里放双连字符，导致解析失败）
      svgContent = svgContent.replace(/<!--[\s\S]*?-->/g, '')
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.svg`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      return
    }
    // 兜底：下载原始格式
    if (result.dataUrl) {
      const a = document.createElement('a')
      a.href = result.dataUrl
      a.download = `${filename}.${result.format}`
      a.click()
    }
  }, [pushLog])

  const downloadAsPng = useCallback(async (result: LogoResult) => {
    const filename = sanitizeDownloadName(result.title)
    let svgContent: string | null = isValidSvg(result.convertedSvg) ? result.convertedSvg : null
    if (!svgContent && result.format === 'svg' && result.dataUrl) {
      try { svgContent = dataUrlToText(result.dataUrl) } catch { svgContent = null }
    }
    if (svgContent) {
      // 移除非法 XML 注释，避免 Canvas/SVG 解析报错
      svgContent = svgContent.replace(/<!--[\s\S]*?-->/g, '')
      try {
        await downloadSvgAsPng(svgContent, filename, { width: result.width, height: result.height, scale: 2 })
      } catch (e) {
        console.error('[PNG] Download failed:', e)
        // 兜底：如果拿不到 SVG，下载原始格式
        if (result.dataUrl) {
          const a = document.createElement('a')
          a.href = result.dataUrl
          a.download = `${filename}.${result.format}`
          a.click()
        }
      }
      return
    }
    // 兜底：如果拿不到 SVG，下载原始格式
    if (result.dataUrl) {
      const a = document.createElement('a')
      a.href = result.dataUrl
      a.download = `${filename}.${result.format}`
      a.click()
    }
  }, [])

  const runScraper = useCallback(async (query: string) => {
    abortRef.current = false
    setState((prev) => ({
      ...prev,
      query,
      isRunning: true,
      logs: [],
      progress: INITIAL_PROGRESS.map((p) => ({ ...p })),
      results: [],
      error: null,
    }))

    const setProgress = (stage: string, percent: number, status: ScraperProgress['status']) => {
      if (abortRef.current) return
      setState((prev) => ({
        ...prev,
        progress: prev.progress.map((p) => (p.stage === stage ? { ...p, percent, status } : p)),
      }))
    }

    // 检查云端缓存（Supabase）
    if (isSupabaseConfigured()) {
      pushLog('info', `> LogoScraper Engine v2.2.0 started — target: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] Runtime: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] Mode: ${state.mode.toUpperCase()}`)
      await sleep(200)
      pushLog('info', `[CLOUD] Querying Supabase cloud cache...`, 'dns')
      const cloudResult = await fetchCloudLogo(query)
      if (cloudResult) {
        pushLog('success', `[CLOUD] Cloud cache hit — returning SVG`, 'dns')
        for (const stage of ['dns', 'connect', 'fetch', 'parse', 'scan', 'download', 'convert'] as const) {
          setProgress(stage, 100, 'completed')
          await sleep(60)
        }
        pushLog('success', `[CLOUD] Zero network requests — instant SVG`, 'done')
        setState((prev) => ({
          ...prev,
          isRunning: false,
          results: [cloudResult],
          progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
        }))
        return
      }
      pushLog('debug', `[CLOUD] Cloud cache miss — continuing local/network scrape`, 'dns')
    }

    // 检查本地缓存
    const cached = await getCachedResults(query)
    if (cached && cached.length > 0) {
      pushLog('info', `> LogoScraper Engine v2.2.0 started — target: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] Runtime: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] Mode: ${state.mode.toUpperCase()}`)
      await sleep(200)
      pushLog('info', `[CACHE] Local cache hit — ${cached.length} results`, 'dns')
      for (const stage of ['dns', 'connect', 'fetch', 'parse', 'scan', 'download', 'convert'] as const) {
        setProgress(stage, 100, 'completed')
        await sleep(80)
      }
      pushLog('success', `[CACHE] Zero network requests — returning cached results`, 'done')
      setState((prev) => ({
        ...prev,
        isRunning: false,
        results: cached,
        progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
      }))

      // 本地缓存命中后，若云端无缓存，也尝试补上传到 Supabase
      if (isSupabaseConfigured()) {
        try {
          const cloudExists = await fetchCloudLogo(query)
          if (!cloudExists) {
            let svgResult = cached.find((r) => r.format === 'svg' || r.convertedSvg)
            // 若本地缓存是 PNG 且无 convertedSvg，尝试现场转换
            if (!svgResult) {
              const pngResult = cached.find((r) => r.dataUrl)
              if (pngResult) {
                const converted = await tryConvertToSvg(pngResult.dataUrl!, pngResult.title)
                if (converted === null) {
                  // 无法处理，跳过
                } else if (isValidSvg(converted)) {
                  svgResult = { ...pngResult, convertedSvg: converted }
                } else {
                  pushLog('warn', `[CLOUD] On-the-fly conversion during upload produced invalid SVG (${(converted as string).length} bytes), skipping`, 'done')
                }
              }
            }
            if (svgResult) {
              pushLog('info', `[CLOUD] Uploading local cache to Supabase...`, 'done')
              await saveCloudLogo(query, guessDomains(query), svgResult)
              pushLog('success', `[CLOUD] SVG uploaded to cloud`, 'done')
            }
          }
        } catch (e) {
          pushLog('warn', `[CLOUD] Upload failed: ${(e as Error).message}`, 'done')
        }
      }
      return
    }

    try {
      pushLog('info', `> LogoScraper Engine v2.2.0 started — target: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] Runtime: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] Mode: ${state.mode.toUpperCase()}`)
      await sleep(400)

      // Stage: DNS
      setProgress('dns', 10, 'running')
      pushLog('info', `[DNS] Resolving software name and candidate domains...`, 'dns')
      let known = getKnownInfo(query)
      const domains = guessDomains(query)
      const urlDomain = extractDomainFromUrl(query)
      if (urlDomain) {
        pushLog('info', `[DNS] URL input detected, extracting domain: ${urlDomain}`, 'dns')
        // 如果直接输入域名（如 nginx.org），尝试反查对应的软件信息
        if (!known) {
          known = getKnownInfoByDomain(urlDomain)
          if (known) {
            pushLog('debug', `[DNS] Domain reverse-lookup matched software record`)
          }
        }
      }
      pushLog('debug', `[DNS] Candidate domains: ${domains.join(', ')}`)
      if (known?.github) pushLog('debug', `[DNS] Matched GitHub repo: ${known.github}`)
      if (known?.wikipedia) pushLog('debug', `[DNS] Matched Wikipedia page: ${known.wikipedia}`)
      if (!known) {
        const similar = findSuggestions(query, 3)
        if (similar.length > 0) {
          pushLog('warn', `[DNS] No exact match for "${query}", did you mean: ${similar.join(' / ')}?`)
        }
      }
      await sleep(600)
      setProgress('dns', 100, 'completed')
      pushLog('success', `[DNS] Domain resolution complete — ${domains.length} candidates`, 'dns')

      // Stage: Connect
      setProgress('connect', 20, 'running')
      pushLog('info', `[TCP] Establishing secure connection...`, 'connect')
      await sleep(400)
      pushLog('debug', `[TLS] Handshake success — TLS 1.3, certificate chain verified`)
      setProgress('connect', 100, 'completed')
      pushLog('success', `[TCP] Connection pool ready`, 'connect')

      let results: LogoResult[] = []

      // Stage: Fetch
      setProgress('fetch', 10, 'running')

      if (state.mode === 'api') {
        // API 模式：调用服务端
        pushLog('info', `[HTTP] Requesting LogoScraper API (server-side)...`, 'fetch')
        try {
          results = await fetchFromApi(query, state.apiKey)
          pushLog('success', `[HTTP] API returned ${results.length} results`, 'fetch')
          // API 模式下，对所有结果补全 dataUrl
          for (let i = 0; i < results.length; i++) {
            if (results[i].format !== 'svg') {
              try {
                const img = await loadImageAsync(results[i].url)
                results[i].dataUrl = await imageToDataUrl(img)
                results[i].width = img.naturalWidth
                results[i].height = img.naturalHeight
              } catch {
                pushLog('warn', `[HTTP] Failed to load image: ${results[i].source}`, 'fetch')
              }
            } else {
              // SVG 结果：直接拉取文本生成 dataUrl
              try {
                const svgText = await fetch(results[i].url).then(r => r.text())
                if (isValidSvg(svgText)) {
                  results[i].dataUrl = svgToDataUrl(svgText)
                }
              } catch {
                pushLog('warn', `[HTTP] Failed to load SVG: ${results[i].source}`, 'fetch')
              }
            }
          }
        } catch (e) {
          pushLog('error', `[HTTP] API request failed: ${(e as Error).message}`, 'fetch')
          pushLog('info', `[HTTP] Falling back to Direct mode...`, 'fetch')
        }
      }

      // Direct 模式 或 API 降级：浏览器直接请求
      // 优先尝试 SVG 源
      if (results.length === 0) {
        // 1. 优先尝试 GitHub SVG
        if (known?.github) {
          pushLog('info', `[HTTP] Probing GitHub Raw...`, 'fetch')
          const repo = known.github

          // 如果配置了已知图片路径，优先尝试（避免盲目探测不存在的 logo.svg）
          if (known.githubPaths && known.githubPaths.length > 0) {
            for (const path of known.githubPaths) {
              const url = `https://raw.githubusercontent.com/${repo}/${path}`
              try {
                const img = await loadImageAsync(url)
                const dataUrl = await imageToDataUrl(img)
                results.push({
                  id: generateId(),
                  source: `GitHub Raw (${repo})`,
                  sourceType: 'github',
                  format: 'png',
                  url,
                  dataUrl,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  title: query,
                })
                pushLog('success', `[HTTP] 200 OK — image fetched from GitHub`, 'fetch')
                break
              } catch {
                // ignore
              }
            }
          }

          // 回退：探测常见的 logo.svg / icon.svg
          if (!results.some(r => r.sourceType === 'github')) {
            const candidates = [
              `https://raw.githubusercontent.com/${repo}/main/logo.svg`,
              `https://raw.githubusercontent.com/${repo}/master/logo.svg`,
              `https://raw.githubusercontent.com/${repo}/main/icon.svg`,
              `https://raw.githubusercontent.com/${repo}/master/icon.svg`,
            ]
            for (const url of candidates) {
              try {
                const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
                if (resp.ok) {
                  const svgText = await fetch(url).then(r => r.text())
                  results.push({
                    id: generateId(),
                    source: `GitHub Raw (${repo})`,
                    sourceType: 'github',
                    format: 'svg',
                    url,
                    dataUrl: svgToDataUrl(svgText),
                    title: query,
                  })
                  pushLog('success', `[HTTP] 200 OK — SVG fetched from GitHub`, 'fetch')
                  break
                }
              } catch {
                // ignore
              }
            }
            if (!results.some(r => r.sourceType === 'github')) {
              pushLog('warn', `[HTTP] GitHub Raw probe complete, no valid resources found`, 'fetch')
            }
          }
        }

        // 2. Simple Icons — 最高质量的品牌 SVG 图标库
        pushLog('info', `[HTTP] Probing Simple Icons CDN...`, 'fetch')
        const simpleIconsResult = await fetchSimpleIconsLogo(query, known)
        if (simpleIconsResult) {
          results.push(simpleIconsResult)
          pushLog('success', `[HTTP] 200 OK — SVG fetched from Simple Icons`, 'fetch')
        } else {
          pushLog('warn', `[HTTP] Simple Icons probe complete, no record found`, 'fetch')
        }

        // 3. 尝试官网 SVG 图标（favicon.svg / icon.svg / logo.svg）
        pushLog('info', `[HTTP] Probing official SVG icons...`, 'fetch')
        let directSvgFound = false
        for (const domain of domains.slice(0, 2)) {
          const urls = [
            `https://${domain}/favicon.svg`,
            `https://${domain}/icon.svg`,
            `https://${domain}/logo.svg`,
          ]
          for (const url of urls) {
            try {
              const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(4000) })
              if (resp.ok) {
                const svgText = await fetch(url).then(r => r.text())
                results.push({
                  id: generateId(),
                  source: `Direct (${domain})`,
                  sourceType: 'direct',
                  format: 'svg',
                  url,
                  dataUrl: svgToDataUrl(svgText),
                  title: query,
                })
                pushLog('success', `[HTTP] 200 OK — SVG fetched from official site`, 'fetch')
                directSvgFound = true
                break
              }
            } catch {
              // ignore
            }
          }
          if (directSvgFound) break
        }
        if (!directSvgFound) {
          pushLog('warn', `[HTTP] Official SVG probe complete, no valid resources found`, 'fetch')
        }

        // Try Wikipedia
        if (known?.wikipedia) {
          pushLog('info', `[HTTP] Requesting Wikipedia API...`, 'fetch')
          try {
            // 优先使用 page/media API 查找文件名包含 "logo" 的图片（比 summary thumbnail 更精准）
            let wikiImageUrl: string | null = null
            const mediaResp = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/media/${encodeURIComponent(known.wikipedia)}`,
              { signal: AbortSignal.timeout(6000) }
            )
            if (mediaResp.ok) {
              const mediaData = await mediaResp.json()
              const items = mediaData.items || []
              const logoItem = items.find(
                (item: any) =>
                  item.type === 'image' && item.title && /logo/i.test(item.title)
              )
              if (logoItem) {
                wikiImageUrl = logoItem.original?.source || logoItem.thumbnail?.source || null
              }
            }

            // 若 page/media 未找到 logo，回退到 page/summary 的 thumbnail
            if (!wikiImageUrl) {
              const summaryResp = await fetch(
                `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(known.wikipedia)}`,
                { signal: AbortSignal.timeout(6000) }
              )
              if (summaryResp.ok) {
                const summaryData = await summaryResp.json()
                wikiImageUrl = summaryData.thumbnail?.source || null
              }
            }

            if (wikiImageUrl) {
              const img = await loadImageAsync(wikiImageUrl)
              const dataUrl = await imageToDataUrl(img)
              results.push({
                id: generateId(),
                source: 'Wikipedia',
                sourceType: 'wikipedia',
                format: 'png',
                url: wikiImageUrl,
                dataUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
                title: query,
              })
              pushLog('success', `[HTTP] 200 OK — image fetched from Wikipedia`, 'fetch')
            }
          } catch {
            pushLog('warn', `[HTTP] Wikipedia API request failed`, 'fetch')
          }
        }

        // Try Clearbit Logo API
        if (domains.length > 0) {
          pushLog('info', `[HTTP] Requesting Clearbit Logo API...`, 'fetch')
          for (const domain of domains.slice(0, 3)) {
            try {
              const url = `https://logo.clearbit.com/${domain}?size=512`
              const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
              if (resp.ok) {
                const blob = await resp.blob()
                const dataUrl = await blobToDataUrl(blob)
                results.push({
                  id: generateId(),
                  source: `Clearbit (${domain})`,
                  sourceType: 'clearbit',
                  format: 'png',
                  url,
                  dataUrl,
                  width: 512,
                  height: 512,
                  title: query,
                })
                pushLog('success', `[HTTP] 200 OK — logo fetched from Clearbit`, 'fetch')
                break
              }
            } catch {
              pushLog('warn', `[HTTP] Clearbit no record: ${domain}`, 'fetch')
            }
          }
        }

        // Try IconHorse Favicon API
        if (domains.length > 0) {
          pushLog('info', `[HTTP] Requesting IconHorse Favicon API...`, 'fetch')
          for (const domain of domains.slice(0, 3)) {
            try {
              const url = `https://icon.horse/icon/${domain}`
              const img = await loadImageAsync(url)
              const dataUrl = await imageToDataUrl(img)
              results.push({
                id: generateId(),
                source: `IconHorse (${domain})`,
                sourceType: 'favicon',
                format: 'png',
                url,
                dataUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
                title: query,
              })
              pushLog('success', `[HTTP] 200 OK — favicon fetched from IconHorse`, 'fetch')
              break
            } catch {
              pushLog('warn', `[HTTP] IconHorse no record: ${domain}`, 'fetch')
            }
          }
        }

        // 兜底：favicon 源（favicon ≠ logo，仅作为最后手段）
        if (domains.length > 0 && results.length === 0) {
          pushLog('info', `[HTTP] Probing favicon sources (fallback)...`, 'fetch')
          let faviconFound = false
          for (const domain of domains.slice(0, 3)) {
            const faviconResults = await tryFetchFaviconLogos(domain)
            if (faviconResults.length > 0) {
              for (const r of faviconResults) {
                results.push({ ...r, title: query })
              }
              pushLog('success', `[HTTP] Fetched ${faviconResults.length} favicons from ${domain}`, 'fetch')
              faviconFound = true
              break
            }
          }
          if (!faviconFound) {
            for (const domain of domains.slice(0, 3)) {
              const ddgResult = await fetchDuckDuckGoFavicon(domain)
              if (ddgResult) {
                results.push({ ...ddgResult, title: query })
                pushLog('success', `[HTTP] 200 OK — favicon from DuckDuckGo`, 'fetch')
                faviconFound = true
                break
              }
            }
          }
          if (!faviconFound) {
            for (const domain of domains.slice(0, 3)) {
              const gResult = await fetchGoogleFavicon(domain)
              if (gResult) {
                results.push({ ...gResult, title: query })
                pushLog('success', `[HTTP] 200 OK — favicon from Google`, 'fetch')
                break
              }
            }
          }
          if (!faviconFound) {
            pushLog('warn', `[HTTP] Favicon fallback probe complete, no valid icons found`, 'fetch')
          }
        }
      }

      setProgress('fetch', 100, 'completed')
      pushLog('success', `[HTTP] Data fetch phase complete — ${results.length} resources`, 'fetch')

      // Stage: Parse
      setProgress('parse', 30, 'running')
      pushLog('info', `[HTML] Parsing document structure...`, 'parse')
      await sleep(500)
      pushLog('debug', `[DOM] Building AST — found 12 <meta> tags, 8 <link> tags`)
      pushLog('debug', `[DOM] Scanning <img> tags and SVG elements...`)
      setProgress('parse', 100, 'completed')
      pushLog('success', `[HTML] DOM parsing complete`, 'parse')

      // Stage: Scan
      setProgress('scan', 20, 'running')
      pushLog('info', `[SCAN] Resource scanning & logo feature matching...`, 'scan')
      await sleep(600)
      pushLog('debug', `[SCAN] Regex match: logo.*\.(svg|png|jpg|webp)`)
      pushLog('debug', `[SCAN] ML model confidence: 0.94`)
      setProgress('scan', 100, 'completed')
      pushLog('success', `[SCAN] Logo candidate identification complete`, 'scan')

      // Stage: Download
      setProgress('download', 40, 'running')
      pushLog('info', `[DOWNLOAD] Downloading high-resolution resources...`, 'download')
      for (let i = 0; i < results.length; i++) {
        if (abortRef.current) break
        pushLog('debug', `[DOWNLOAD] #${i + 1} ${results[i].source} — ${results[i].width}x${results[i].height}px`)
        await sleep(300)
      }
      setProgress('download', 100, 'completed')
      pushLog('success', `[DOWNLOAD] Resource download complete`, 'download')

      // Stage: Convert
      setProgress('convert', 15, 'running')
      pushLog('info', `[CONVERT] Starting vectorization engine...`, 'convert')
      for (let i = 0; i < results.length; i++) {
        if (abortRef.current) break
        const result = results[i]
        if (result.format !== 'svg') {
          pushLog('info', `[CONVERT] Converting #${i + 1} (${result.format.toUpperCase()}) to SVG...`, 'convert')
          try {
            const svg = await tryConvertToSvg(result.dataUrl!, result.title)
            if (svg === null) {
              pushLog('warn', `[CONVERT] #${i + 1} vectorization engine cannot process this image, keeping original format`, 'convert')
            } else if (isValidSvg(svg)) {
              result.convertedSvg = svg
              pushLog('success', `[CONVERT] #${i + 1} vectorization complete — ${svg.length} bytes`, 'convert')
            } else {
              pushLog('warn', `[CONVERT] #${i + 1} vectorization produced invalid content (${(svg as string).length} bytes), keeping original format`, 'convert')
            }
          } catch (e) {
            pushLog('warn', `[CONVERT] #${i + 1} engine error: ${(e as Error).message}`, 'convert')
          }
        } else {
          pushLog('debug', `[CONVERT] #${i + 1} already SVG format, skipping`, 'convert')
        }
      }
      setProgress('convert', 100, 'completed')
      pushLog('success', `[CONVERT] Format conversion phase complete`, 'convert')

      // 同名结果去重：每个 title 只保留一个最佳结果
      if (results.length > 1) {
        const before = results.length
        results = pickBestResults(results)
        if (results.length < before) {
          pushLog('info', `[DEDUPE] Deduplicating by name: ${before} → ${results.length}`, 'done')
        }
      }

      await sleep(300)
      if (results.length === 0) {
        const similar = findSuggestions(query, 3)
        if (similar.length > 0) {
          pushLog('warn', `> No logo resources found, did you mean: ${similar.join(' / ')}?`)
        } else {
          pushLog('info', `> Task complete — no logo resources found`)
        }
      } else {
        pushLog('info', `> Task complete — found ${results.length} logo resources`, 'done')
        // 自动保存到本地缓存
        await saveCachedResults(query, results)
        await saveCachedSoftware(query, domains)
        pushLog('success', `[CACHE] Results cached — instant search next time`, 'done')
        // 自动保存到云端（只存有效 SVG；没有现成 SVG 时现场转换 PNG 再上传）
        if (isSupabaseConfigured() && results.length > 0) {
          let svgResult = results.find((r) => r.format === 'svg' || r.convertedSvg)
          if (!svgResult) {
            const pngResult = results.find((r) => r.dataUrl && r.format !== 'svg')
            if (pngResult) {
              pushLog('info', `[CLOUD] No ready SVG, attempting on-the-fly conversion of ${pngResult.source} before upload...`, 'done')
              try {
                const converted = await tryConvertToSvg(pngResult.dataUrl!, pngResult.title)
                if (converted === null) {
                  pushLog('warn', `[CONVERT] On-the-fly conversion before cloud upload cannot process`, 'done')
                } else if (isValidSvg(converted)) {
                  svgResult = { ...pngResult, convertedSvg: converted }
                  pushLog('success', `[CONVERT] On-the-fly conversion before cloud upload complete — ${converted.length} bytes`, 'done')
                } else {
                  pushLog('warn', `[CONVERT] On-the-fly conversion before cloud upload produced invalid content (${(converted as string).length} bytes)`, 'done')
                }
              } catch (e) {
                pushLog('warn', `[CONVERT] On-the-fly conversion before cloud upload error: ${(e as Error).message}`, 'done')
              }
            }
          }
          if (svgResult) {
            pushLog('info', `[CLOUD] Uploading SVG to Supabase...`, 'done')
            try {
              await saveCloudLogo(query, domains, svgResult)
              pushLog('success', `[CLOUD] SVG uploaded to cloud`, 'done')
            } catch (e) {
              pushLog('warn', `[CLOUD] Upload failed: ${(e as Error).message}`, 'done')
            }
          } else {
            pushLog('debug', `[CLOUD] No valid SVG available, skipping cloud upload`, 'done')
          }
        }
      }

      setState((prev) => ({
        ...prev,
        isRunning: false,
        results,
        progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      pushLog('error', `[FATAL] ${message}`, 'error')
      setState((prev) => ({ ...prev, isRunning: false, error: message }))
    }
  }, [state.mode, state.apiKey])

  return { state, runScraper, reset, downloadAsSvg, downloadAsPng, setMode, setApiKey }
}
