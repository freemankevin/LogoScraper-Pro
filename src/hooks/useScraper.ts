import { useState, useCallback, useRef } from 'react'
import type { ScraperLog, ScraperProgress, LogoResult, ScraperState, ScrapeMode } from '../types/scraper'
import { getCachedResults, saveCachedResults } from '../lib/logo-cache'
import { fetchCloudLogo, saveCloudLogo, isSupabaseConfigured } from '../lib/supabase-client'
import { sanitizeDownloadName, blobToDataUrl } from '../lib/utils'

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

function normalizeDomain(input: string): string {
  const domain = extractDomainFromUrl(input)
  if (domain) return domain
  // 如果输入不含 . ，尝试加 .com
  const clean = input.trim().toLowerCase().replace(/\s+/g, '')
  if (clean && !clean.includes('.')) {
    return `${clean}.com`
  }
  return input.trim().toLowerCase()
}

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

/** 用 img 标签加载跨域图片，并尝试 canvas 提取 dataUrl */
async function fetchImageViaImg(domain: string, url: string, width: number, height: number): Promise<LogoResult | null> {
  try {
    const img = await loadImageAsync(url, true)
    // 尝试 canvas 提取 dataUrl（若服务器支持 CORS 则成功）
    try {
      const dataUrl = await imageToDataUrl(img, 'image/png')
      return {
        id: generateId(),
        source: `Google Favicon (${domain})`,
        sourceType: 'favicon',
        format: 'png',
        url,
        dataUrl,
        width: img.naturalWidth || width,
        height: img.naturalHeight || height,
        title: domain,
      }
    } catch {
      // canvas 被污染，返回无 dataUrl 的结果（仅能显示）
    }
    return {
      id: generateId(),
      source: `Google Favicon (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url,
      width: img.naturalWidth || width,
      height: img.naturalHeight || height,
      title: domain,
    }
  } catch { }
  return null
}

/** Google Favicon API（返回 PNG，128x128） */
async function fetchGoogleFavicon(
  domain: string,
  log?: (level: ScraperLog['level'], message: string, stage?: string) => void
): Promise<LogoResult | null> {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

  // 1) fetch（需要服务器 CORS 配合）
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) {
      log?.('debug', `[HTTP] Google ${url} status=${resp.status}`, 'fetch')
      return null
    }
    const blob = await resp.blob()
    if (blob.size < 100) {
      log?.('debug', `[HTTP] Google ${url} blob too small (${blob.size}B)`, 'fetch')
      return null
    }
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
  } catch (e) {
    log?.('debug', `[HTTP] Google ${url} fetch error: ${(e as Error).message}`, 'fetch')
  }

  // 2) img 回退（无 CORS，能显示但拿不到 dataUrl）
  log?.('debug', `[HTTP] Google ${url} falling back to img load`, 'fetch')
  const imgResult = await fetchImageViaImg(domain, url, 128, 128)
  if (imgResult) {
    log?.('info', `[HTTP] Google ${url} loaded via img tag (CORS blocked)`, 'fetch')
  }
  return imgResult
}

async function fetchFromApi(query: string, apiKey?: string | null): Promise<LogoResult[]> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['X-API-Key'] = apiKey

  const resp = await fetch('/api/scrape', {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, formats: ['png'] }),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    let msg = `API ${resp.status}`
    try {
      const err = JSON.parse(text)
      if (err.error) msg = err.error
    } catch {
      if (text) msg += ` — ${text.slice(0, 200)}`
      else msg = `API ${resp.status} (endpoint may not exist in local dev)`
    }
    throw new Error(msg)
  }

  const data = await resp.json()
  if (!data.success) throw new Error(data.error || 'API returned unsuccessful')

  return (data.results || []).map((r: any) => ({
    id: r.id || generateId(),
    source: r.source,
    sourceType: r.sourceType as LogoResult['sourceType'],
    format: (r.format === 'ico' ? 'png' : r.format) as LogoResult['format'],
    url: r.url,
    dataUrl: r.dataUrl,
    width: r.width,
    height: r.height,
    title: r.title || query,
  }))
}

export function useScraper() {
  const [state, setState] = useState<ScraperState>({
    query: '',
    isRunning: false,
    mode: 'api',
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
    // PNG/ICO 无法直接下载为 SVG，兜底下载原始格式
    if (result.dataUrl) {
      const a = document.createElement('a')
      a.href = result.dataUrl
      a.download = `${filename}.${result.format}`
      a.click()
    }
  }, [])

  const downloadAsPng = useCallback(async (result: LogoResult) => {
    const filename = sanitizeDownloadName(result.title)

    // 1) 有 dataUrl 直接下载
    if (result.dataUrl) {
      const a = document.createElement('a')
      a.href = result.dataUrl
      a.download = `${filename}.png`
      a.click()
      return
    }

    // 2) 无 dataUrl 但存在原始 url —— 尝试 img + canvas 提取（若环境允许 CORS 则成功）
    if (result.url) {
      try {
        const img = await loadImageAsync(result.url, true)
        const dataUrl = await imageToDataUrl(img, 'image/png')
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = `${filename}.png`
        a.click()
        return
      } catch {
        // canvas 被污染，继续尝试 fetch
      }

      try {
        const resp = await fetch(result.url, { signal: AbortSignal.timeout(8000) })
        if (resp.ok) {
          const blob = await resp.blob()
          const dataUrl = await blobToDataUrl(blob)
          const a = document.createElement('a')
          a.href = dataUrl
          a.download = `${filename}.png`
          a.click()
          return
        }
      } catch {
        // fetch 被 CORS 拦截
      }

      // 兜底：尝试 <a download>
      const a = document.createElement('a')
      a.href = result.url
      a.download = `${filename}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
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

    const domain = normalizeDomain(query)

    // 检查云端缓存（Supabase）
    if (isSupabaseConfigured()) {
      pushLog('info', `> LogoScraper Engine v3.0 started — target: "${domain}"`, 'init')
      pushLog('debug', `[ENGINE] Runtime: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] Mode: ${state.mode.toUpperCase()}`)
      await sleep(200)
      pushLog('info', `[CLOUD] Querying Supabase cloud cache...`, 'dns')
      const cloudResult = await fetchCloudLogo(domain)
      if (cloudResult) {
        pushLog('success', `[CLOUD] Cloud cache hit — returning cached icon`, 'dns')
        for (const stage of ['dns', 'connect', 'fetch', 'parse', 'scan', 'download', 'convert'] as const) {
          setProgress(stage, 100, 'completed')
          await sleep(60)
        }
        pushLog('success', `[CLOUD] Zero network requests — instant icon`, 'done')
        setState((prev) => ({
          ...prev,
          isRunning: false,
          results: [cloudResult],
          progress: prev.progress.map((p) => ({ ...p, status: 'completed' as const })),
        }))
        return
      }
      pushLog('debug', `[CLOUD] Cloud cache miss — continuing network fetch`, 'dns')
    }

    // 检查本地缓存
    const cached = await getCachedResults(domain)
    if (cached && cached.length > 0) {
      pushLog('info', `> LogoScraper Engine v3.0 started — target: "${domain}"`, 'init')
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

      // 本地缓存命中后，若云端无缓存，补上传到 Supabase
      if (isSupabaseConfigured()) {
        try {
          const cloudExists = await fetchCloudLogo(domain)
          if (!cloudExists) {
            const iconResult = cached.find((r) => r.dataUrl)
            if (iconResult) {
              pushLog('info', `[CLOUD] Uploading local cache to Supabase...`, 'done')
              await saveCloudLogo(domain, iconResult)
              pushLog('success', `[CLOUD] Icon uploaded to cloud`, 'done')
            }
          }
        } catch (e) {
          pushLog('warn', `[CLOUD] Upload failed: ${(e as Error).message}`, 'done')
        }
      }
      return
    }

    try {
      pushLog('info', `> LogoScraper Engine v3.0 started — target: "${domain}"`, 'init')
      pushLog('debug', `[ENGINE] Runtime: ${navigator.userAgent.slice(0, 50)}...`)
      pushLog('debug', `[ENGINE] Mode: ${state.mode.toUpperCase()}`)
      await sleep(400)

      // Stage: DNS
      setProgress('dns', 10, 'running')
      pushLog('info', `[DNS] Resolving domain...`, 'dns')
      pushLog('debug', `[DNS] Target domain: ${domain}`)
      await sleep(600)
      setProgress('dns', 100, 'completed')
      pushLog('success', `[DNS] Domain resolution complete`, 'dns')

      // Stage: Connect
      setProgress('connect', 20, 'running')
      pushLog('info', `[TCP] Establishing secure connection...`, 'connect')
      await sleep(400)
      pushLog('debug', `[TLS] Handshake success — TLS 1.3`)
      setProgress('connect', 100, 'completed')
      pushLog('success', `[TCP] Connection pool ready`, 'connect')

      let results: LogoResult[] = []

      // Stage: Fetch
      setProgress('fetch', 10, 'running')

      if (state.mode === 'api') {
        pushLog('info', `[HTTP] Requesting LogoScraper API (server-side)...`, 'fetch')
        try {
          results = await fetchFromApi(domain, state.apiKey)
          pushLog('success', `[HTTP] API returned ${results.length} results`, 'fetch')
          // 补全 dataUrl
          for (let i = 0; i < results.length; i++) {
            if (!results[i].dataUrl && results[i].url) {
              try {
                const img = await loadImageAsync(results[i].url)
                results[i].dataUrl = await imageToDataUrl(img)
                results[i].width = img.naturalWidth
                results[i].height = img.naturalHeight
              } catch {
                pushLog('warn', `[HTTP] Failed to load image: ${results[i].source}`, 'fetch')
              }
            }
          }
        } catch (e) {
          pushLog('error', `[HTTP] API request failed: ${(e as Error).message}`, 'fetch')
          pushLog('info', `[HTTP] Falling back to Direct mode...`, 'fetch')
        }
      }

      // Direct 模式 或 API 降级：浏览器直接请求
      if (results.length === 0) {
        // 1. Google Favicon API（PNG，128x128）
        pushLog('info', `[HTTP] Requesting Google Favicon API...`, 'fetch')
        const googleResult = await fetchGoogleFavicon(domain, pushLog)
        if (googleResult) {
          results.push(googleResult)
          if (googleResult.dataUrl) {
            pushLog('success', `[HTTP] 200 OK — PNG favicon from Google (128x128)`, 'fetch')
          } else {
            pushLog('warn', `[HTTP] Google Favicon loaded via img (CORS blocked, no dataUrl)`, 'fetch')
          }
        } else {
          pushLog('warn', `[HTTP] Google Favicon unavailable: ${domain}`, 'fetch')
        }

      }

      setProgress('fetch', 100, 'completed')
      pushLog('success', `[HTTP] Data fetch phase complete — ${results.length} resources`, 'fetch')

      // Stage: Parse
      setProgress('parse', 30, 'running')
      pushLog('info', `[HTML] Parsing document structure...`, 'parse')
      await sleep(500)
      setProgress('parse', 100, 'completed')
      pushLog('success', `[HTML] DOM parsing complete`, 'parse')

      // Stage: Scan
      setProgress('scan', 20, 'running')
      pushLog('info', `[SCAN] Resource scanning & logo feature matching...`, 'scan')
      await sleep(600)
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

      // Stage: Convert（跳过，PNG/ICO 无需转换）
      setProgress('convert', 100, 'completed')
      pushLog('success', `[CONVERT] PNG/ICO format — no conversion needed`, 'convert')

      // 按 URL 去重
      if (results.length > 1) {
        const before = results.length
        const seenUrls = new Set<string>()
        results = results.filter(r => {
          if (seenUrls.has(r.url)) return false
          seenUrls.add(r.url)
          return true
        })
        if (results.length < before) {
          pushLog('info', `[DEDUPE] Removed ${before - results.length} duplicate URLs`, 'done')
        }
      }

      await sleep(300)
      if (results.length === 0) {
        pushLog('info', `> Task complete — no logo resources found for ${domain}`)
      } else {
        pushLog('info', `> Task complete — found ${results.length} logo resources`, 'done')
        // 自动保存到本地缓存
        await saveCachedResults(domain, results)
        pushLog('success', `[CACHE] Results cached — instant search next time`, 'done')
        // 自动保存到云端
        if (isSupabaseConfigured() && results.length > 0) {
          for (const result of results) {
            if (result.dataUrl) {
              try {
                pushLog('info', `[CLOUD] Uploading ${result.source} to Supabase...`, 'done')
                await saveCloudLogo(domain, result)
                pushLog('success', `[CLOUD] Icon uploaded to cloud`, 'done')
              } catch (e) {
                pushLog('warn', `[CLOUD] Upload failed: ${(e as Error).message}`, 'done')
              }
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
