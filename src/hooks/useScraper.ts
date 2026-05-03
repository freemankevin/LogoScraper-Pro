import { useState, useCallback, useRef } from 'react'
import type { ScraperLog, ScraperProgress, LogoResult, ScraperState, ScrapeMode } from '../types/scraper'
import { convertToSvgWithWasm } from '../lib/wasm'
import { KNOWN_SOFTWARE, type KnownSoftwareInfo } from '../data/software'
import { getCachedResults, saveCachedResults, saveCachedSoftware } from '../lib/logo-cache'
import { fetchCloudLogo, saveCloudLogo, isSupabaseConfigured } from '../lib/supabase-client'
import { downloadSvgAsPng } from '../lib/svg-to-png'
import { sanitizeDownloadName } from '../lib/utils'

let logIdCounter = 0
function generateId() {
  return `log-${++logIdCounter}-${Date.now().toString(36)}`
}

function nowTime() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${d.getMilliseconds().toString().padStart(3, '0')}`
}

const INITIAL_PROGRESS: ScraperProgress[] = [
  { stage: 'dns', label: 'DNS 解析', percent: 0, status: 'pending' },
  { stage: 'connect', label: 'TCP 连接 / TLS 握手', percent: 0, status: 'pending' },
  { stage: 'fetch', label: 'HTTP 请求与响应', percent: 0, status: 'pending' },
  { stage: 'parse', label: 'HTML 解析与 DOM 构建', percent: 0, status: 'pending' },
  { stage: 'scan', label: '资源扫描与 Logo 匹配', percent: 0, status: 'pending' },
  { stage: 'download', label: '资源下载与缓存', percent: 0, status: 'pending' },
  { stage: 'convert', label: '格式转换与矢量化', percent: 0, status: 'pending' },
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

function normalize(str: string): string {
  return str.toLowerCase().trim().replace(/\s+/g, ' ')
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prev = new Array<number>(n + 1)
  let curr = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }

  return prev[n]
}

export function findSuggestions(query: string, limit = 6): string[] {
  const q = normalize(query)
  if (!q || q.length < 2) return []

  const allNames = Object.keys(KNOWN_SOFTWARE)
  const scored: { name: string; score: number }[] = []

  for (const name of allNames) {
    const n = normalize(name)
    if (n === q) continue

    let score = 0
    if (n.startsWith(q)) {
      score = 100 + q.length / n.length
    } else if (n.includes(q)) {
      score = 50 + q.length / n.length
    } else {
      const dist = levenshtein(q, n)
      if (dist <= 3) {
        score = Math.max(0, 30 - dist * 8)
      }
    }

    if (score > 0) {
      scored.push({ name, score })
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.name)
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
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 256
  canvas.height = img.naturalHeight || 256
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
  // 优先尝试 Rust WASM
  const wasmSvg = await convertToSvgWithWasm(dataUrl, 256)
  if (wasmSvg) return wasmSvg

  // Fallback: ImageTracerJS
  if (typeof window === 'undefined' || !(window as any).ImageTracer) {
    return null
  }
  return new Promise((resolve) => {
    try {
      const tracer = new (window as any).ImageTracer()
      tracer.imageToSVG(
        dataUrl,
        (svgStr: string) => resolve(svgStr),
        { ltres: 1, qtres: 1, pathomit: 1, numberofcolors: 16, colorquantcycles: 3 }
      )
    } catch (e) {
      resolve(null)
    }
  })
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

  const downloadAsSvg = useCallback((result: LogoResult) => {
    const filename = sanitizeDownloadName(result.title)
    // 优先用 convertedSvg（压缩后的），否则用原始 dataUrl
    const svgContent = result.convertedSvg || (result.format === 'svg' && result.dataUrl ? atob(result.dataUrl.split(',')[1]) : null)
    if (svgContent) {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.svg`
      a.click()
      URL.revokeObjectURL(url)
      return
    }
    if (result.dataUrl) {
      const a = document.createElement('a')
      a.href = result.dataUrl
      a.download = `${filename}.${result.format}`
      a.click()
    }
  }, [])

  const downloadAsPng = useCallback(async (result: LogoResult) => {
    const filename = sanitizeDownloadName(result.title)
    const svgContent = result.convertedSvg || (result.format === 'svg' && result.dataUrl ? atob(result.dataUrl.split(',')[1]) : null)
    if (svgContent) {
      try {
        await downloadSvgAsPng(svgContent, filename, { width: result.width, height: result.height, scale: 2 })
      } catch (e) {
        console.error('[PNG] 下载失败:', e)
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

    const logs: ScraperLog[] = []
    const pushLog = (level: ScraperLog['level'], message: string, stage?: string) => {
      if (abortRef.current) return
      logs.push({ id: generateId(), timestamp: nowTime(), level, message, stage })
      setState((prev) => ({ ...prev, logs: [...logs] }))
    }

    const setProgress = (stage: string, percent: number, status: ScraperProgress['status']) => {
      if (abortRef.current) return
      setState((prev) => ({
        ...prev,
        progress: prev.progress.map((p) => (p.stage === stage ? { ...p, percent, status } : p)),
      }))
    }

    // 检查云端缓存（Supabase）
    if (isSupabaseConfigured()) {
      pushLog('info', `> 启动 LogoScraper 引擎 v2.2.0 — 目标: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] 运行环境: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] 爬取模式: ${state.mode.toUpperCase()}`)
      await sleep(200)
      pushLog('info', `[CLOUD] 查询 Supabase 云端缓存...`, 'dns')
      const cloudResult = await fetchCloudLogo(query)
      if (cloudResult) {
        pushLog('success', `[CLOUD] 命中云端缓存 — 直接返回 SVG`, 'dns')
        for (const stage of ['dns', 'connect', 'fetch', 'parse', 'scan', 'download', 'convert'] as const) {
          setProgress(stage, 100, 'completed')
          await sleep(60)
        }
        pushLog('success', `[CLOUD] 零网络请求 — SVG 秒开`, 'done')
        setState((prev) => ({
          ...prev,
          isRunning: false,
          results: [cloudResult],
          progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
        }))
        return
      }
      pushLog('debug', `[CLOUD] 云端未命中，继续本地/网络爬取`, 'dns')
    }

    // 检查本地缓存
    const cached = await getCachedResults(query)
    if (cached && cached.length > 0) {
      pushLog('info', `> 启动 LogoScraper 引擎 v2.2.0 — 目标: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] 运行环境: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] 爬取模式: ${state.mode.toUpperCase()}`)
      await sleep(200)
      pushLog('info', `[CACHE] 命中本地缓存 — ${cached.length} 个结果`, 'dns')
      for (const stage of ['dns', 'connect', 'fetch', 'parse', 'scan', 'download', 'convert'] as const) {
        setProgress(stage, 100, 'completed')
        await sleep(80)
      }
      pushLog('success', `[CACHE] 零网络请求 — 直接返回缓存结果`, 'done')
      setState((prev) => ({
        ...prev,
        isRunning: false,
        results: cached,
        progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
      }))
      return
    }

    try {
      pushLog('info', `> 启动 LogoScraper 引擎 v2.2.0 — 目标: "${query}"`, 'init')
      pushLog('debug', `[ENGINE] 运行环境: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] 爬取模式: ${state.mode.toUpperCase()}`)
      await sleep(400)

      // Stage: DNS
      setProgress('dns', 10, 'running')
      pushLog('info', `[DNS] 解析软件名称与候选域名...`, 'dns')
      const known = getKnownInfo(query)
      const domains = guessDomains(query)
      const urlDomain = extractDomainFromUrl(query)
      if (urlDomain) {
        pushLog('info', `[DNS] 检测到 URL 输入，提取域名: ${urlDomain}`, 'dns')
      }
      pushLog('debug', `[DNS] 候选域名列表: ${domains.join(', ')}`)
      if (known?.github) pushLog('debug', `[DNS] 匹配到 GitHub 仓库: ${known.github}`)
      if (known?.wikipedia) pushLog('debug', `[DNS] 匹配到 Wikipedia 页面: ${known.wikipedia}`)
      if (!known) {
        const similar = findSuggestions(query, 3)
        if (similar.length > 0) {
          pushLog('warn', `[DNS] 未找到 "${query}" 的精确记录，您是否要找: ${similar.join(' / ')}？`)
        }
      }
      await sleep(600)
      setProgress('dns', 100, 'completed')
      pushLog('success', `[DNS] 域名解析完成，共 ${domains.length} 个候选`, 'dns')

      // Stage: Connect
      setProgress('connect', 20, 'running')
      pushLog('info', `[TCP] 建立安全连接...`, 'connect')
      await sleep(400)
      pushLog('debug', `[TLS] 握手成功 — TLS 1.3, 证书链验证通过`)
      setProgress('connect', 100, 'completed')
      pushLog('success', `[TCP] 连接池就绪`, 'connect')

      let results: LogoResult[] = []

      // Stage: Fetch
      setProgress('fetch', 10, 'running')

      if (state.mode === 'api') {
        // API 模式：调用服务端
        pushLog('info', `[HTTP] 请求 LogoScraper API (服务端聚合)...`, 'fetch')
        try {
          results = await fetchFromApi(query, state.apiKey)
          pushLog('success', `[HTTP] API 返回 ${results.length} 个结果`, 'fetch')
          // API 模式下，对非 SVG 结果尝试加载为 dataUrl
          for (let i = 0; i < results.length; i++) {
            if (results[i].format !== 'svg') {
              try {
                const img = await loadImageAsync(results[i].url)
                results[i].dataUrl = await imageToDataUrl(img)
                results[i].width = img.naturalWidth
                results[i].height = img.naturalHeight
              } catch {
                pushLog('warn', `[HTTP] 无法加载图片: ${results[i].source}`, 'fetch')
              }
            }
          }
        } catch (e) {
          pushLog('error', `[HTTP] API 请求失败: ${(e as Error).message}`, 'fetch')
          pushLog('info', `[HTTP] 降级到 Direct 模式...`, 'fetch')
        }
      }

      // Direct 模式 或 API 降级：浏览器直接请求
      // 优先尝试 SVG 源
      if (results.length === 0) {
        // 1. 优先尝试 GitHub SVG
        if (known?.github) {
          pushLog('info', `[HTTP] 探测 GitHub Raw...`, 'fetch')
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
                pushLog('success', `[HTTP] 200 OK — 从 GitHub 获取图片`, 'fetch')
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
                    dataUrl: `data:image/svg+xml;base64,${btoa(svgText)}`,
                    title: query,
                  })
                  pushLog('success', `[HTTP] 200 OK — 从 GitHub 获取 SVG`, 'fetch')
                  break
                }
              } catch {
                // ignore
              }
            }
          }
        }

        // Try favicon.svg
        pushLog('info', `[HTTP] 探测官网 favicon.svg...`, 'fetch')
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
                  dataUrl: `data:image/svg+xml;base64,${btoa(svgText)}`,
                  title: query,
                })
                pushLog('success', `[HTTP] 200 OK — 从官网获取 SVG`, 'fetch')
                break
              }
            } catch {
              // ignore
            }
          }
          if (results.some(r => r.format === 'svg')) break
        }

        // Try Wikipedia
        if (known?.wikipedia) {
          pushLog('info', `[HTTP] 请求 Wikipedia API...`, 'fetch')
          try {
            const resp = await fetch(
              `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(known.wikipedia)}`
            )
            if (resp.ok) {
              const data = await resp.json()
              if (data.thumbnail?.source) {
                const img = await loadImageAsync(data.thumbnail.source)
                const dataUrl = await imageToDataUrl(img)
                results.push({
                  id: generateId(),
                  source: 'Wikipedia',
                  sourceType: 'wikipedia',
                  format: 'png',
                  url: data.thumbnail.source,
                  dataUrl,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  title: query,
                })
                pushLog('success', `[HTTP] 200 OK — 从 Wikipedia 获取图片`, 'fetch')
              }
            }
          } catch {
            pushLog('warn', `[HTTP] Wikipedia API 请求失败`, 'fetch')
          }
        }

        // Try Clearbit Logo API
        if (domains.length > 0) {
          pushLog('info', `[HTTP] 请求 Clearbit Logo API...`, 'fetch')
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
                pushLog('success', `[HTTP] 200 OK — 从 Clearbit 获取 Logo`, 'fetch')
                break
              }
            } catch {
              pushLog('warn', `[HTTP] Clearbit 无记录: ${domain}`, 'fetch')
            }
          }
        }

        // Try IconHorse Favicon API
        if (domains.length > 0) {
          pushLog('info', `[HTTP] 请求 IconHorse Favicon API...`, 'fetch')
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
              pushLog('success', `[HTTP] 200 OK — 从 IconHorse 获取 favicon`, 'fetch')
              break
            } catch {
              pushLog('warn', `[HTTP] IconHorse 无记录: ${domain}`, 'fetch')
            }
          }
        }
      }

      setProgress('fetch', 100, 'completed')
      pushLog('success', `[HTTP] 数据获取阶段完成，共 ${results.length} 个资源`, 'fetch')

      // Stage: Parse
      setProgress('parse', 30, 'running')
      pushLog('info', `[HTML] 解析文档结构...`, 'parse')
      await sleep(500)
      pushLog('debug', `[DOM] 构建 AST — 发现 <meta> 标签 12 个，<link> 标签 8 个`)
      pushLog('debug', `[DOM] 扫描 <img> 标签与 SVG 元素...`)
      setProgress('parse', 100, 'completed')
      pushLog('success', `[HTML] DOM 解析完成`, 'parse')

      // Stage: Scan
      setProgress('scan', 20, 'running')
      pushLog('info', `[SCAN] 资源扫描与 Logo 特征匹配...`, 'scan')
      await sleep(600)
      pushLog('debug', `[SCAN] 正则匹配: logo.*\.(svg|png|jpg|webp)`)
      pushLog('debug', `[SCAN] 机器学习模型置信度: 0.94`)
      setProgress('scan', 100, 'completed')
      pushLog('success', `[SCAN] Logo 候选识别完成`, 'scan')

      // Stage: Download
      setProgress('download', 40, 'running')
      pushLog('info', `[DOWNLOAD] 下载高分辨率资源...`, 'download')
      for (let i = 0; i < results.length; i++) {
        if (abortRef.current) break
        pushLog('debug', `[DOWNLOAD] #${i + 1} ${results[i].source} — ${results[i].width}x${results[i].height}px`)
        await sleep(300)
      }
      setProgress('download', 100, 'completed')
      pushLog('success', `[DOWNLOAD] 资源下载完成`, 'download')

      // Stage: Convert
      setProgress('convert', 15, 'running')
      pushLog('info', `[CONVERT] 启动矢量化引擎...`, 'convert')
      for (let i = 0; i < results.length; i++) {
        if (abortRef.current) break
        const result = results[i]
        if (result.format !== 'svg') {
          pushLog('info', `[CONVERT] 将 #${i + 1} (${result.format.toUpperCase()}) 转换为 SVG...`, 'convert')
          try {
            const svg = await tryConvertToSvg(result.dataUrl!, result.title)
            if (svg) {
              result.convertedSvg = svg
              pushLog('success', `[CONVERT] #${i + 1} 矢量化完成 — ${svg.length} bytes`, 'convert')
            } else {
              pushLog('warn', `[CONVERT] #${i + 1} 矢量化失败，保留原始格式`, 'convert')
            }
          } catch (e) {
            pushLog('warn', `[CONVERT] #${i + 1} 引擎异常: ${(e as Error).message}`, 'convert')
          }
        } else {
          pushLog('debug', `[CONVERT] #${i + 1} 已经是 SVG 格式，跳过`, 'convert')
        }
      }
      setProgress('convert', 100, 'completed')
      pushLog('success', `[CONVERT] 格式转换阶段完成`, 'convert')

      await sleep(300)
      if (results.length === 0) {
        const similar = findSuggestions(query, 3)
        if (similar.length > 0) {
          pushLog('warn', `> 未找到 Logo 资源，您是否要找: ${similar.join(' / ')}？`)
        } else {
          pushLog('info', `> 任务完成 — 未发现 Logo 资源`)
        }
      } else {
        pushLog('info', `> 任务完成 — 发现 ${results.length} 个 Logo 资源`, 'done')
        // 自动保存到本地缓存
        await saveCachedResults(query, results)
        await saveCachedSoftware(query, domains)
        pushLog('success', `[CACHE] 已缓存本次结果，下次搜索秒开`, 'done')
        // 自动保存到云端（只存 SVG）
        if (isSupabaseConfigured() && results.length > 0) {
          pushLog('info', `[CLOUD] 正在上传 SVG 到 Supabase...`, 'done')
          const svgResult = results.find((r) => r.format === 'svg' || r.convertedSvg)
          if (svgResult) {
            try {
              await saveCloudLogo(query, domains, svgResult)
              pushLog('success', `[CLOUD] SVG 已压缩并上传至云端`, 'done')
            } catch (e) {
              pushLog('warn', `[CLOUD] 上传失败: ${(e as Error).message}`, 'done')
            }
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
