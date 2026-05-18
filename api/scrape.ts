import type { VercelRequest, VercelResponse } from '@vercel/node'

// LogoScraper Pro — 域名聚合抓取 API
// 服务端优势：无 CORS 限制、可高并发、直接获取图像数据

interface ScrapeBody {
  query: string
  formats?: ('png' | 'ico')[]
  apiKey?: string
}

interface LogoResult {
  id: string
  source: string
  sourceType: string
  format: 'png' | 'ico'
  url: string
  dataUrl?: string
  width?: number
  height?: number
  title: string
}

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
  if (trimmed.includes('.') && !trimmed.includes(' ') && trimmed.length > 3) {
    return trimmed.replace(/^www\./, '')
  }
  return null
}

function normalizeDomain(input: string): string {
  const domain = extractDomainFromUrl(input)
  if (domain) return domain
  const clean = input.trim().toLowerCase().replace(/\s+/g, '')
  if (clean && !clean.includes('.')) {
    return `${clean}.com`
  }
  return input.trim().toLowerCase()
}

function generateId(): string {
  return `res-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

// ---------- Source Implementations ----------

/** Google Favicon API（PNG，128x128） */
async function fetchGoogleFavicon(domain: string): Promise<LogoResult | null> {
  try {
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const blob = await resp.blob()
    if (blob.size < 100) return null
    const buffer = await blob.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return {
      id: generateId(),
      source: `Google Favicon (${domain})`,
      sourceType: 'favicon',
      format: 'png',
      url,
      dataUrl: `data:image/png;base64,${base64}`,
      width: 128,
      height: 128,
      title: domain,
    }
  } catch { /* ignore */ }
  return null
}

// ---------- Handler ----------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key')
    return res.status(204).end()
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed. Use POST.' })
  }

  const body = req.body as ScrapeBody
  const query = body?.query?.trim()

  if (!query || query.length < 1) {
    return res.status(400).json({ success: false, error: 'query is required' })
  }

  const startTime = Date.now()
  const domain = normalizeDomain(query)

  try {
    const results: LogoResult[] = []

    // 1. Google Favicon API
    const googleResult = await fetchGoogleFavicon(domain)
    if (googleResult) results.push(googleResult)

    return res.status(200).json({
      success: true,
      query,
      results,
      meta: {
        sourcesChecked: 1,
        resultsFound: results.length,
        elapsedMs: Date.now() - startTime,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ success: false, error: message })
  }
}
