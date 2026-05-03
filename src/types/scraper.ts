export type ScrapeMode = 'direct' | 'api'

export interface ScraperLog {
  id: string
  timestamp: string
  level: 'info' | 'success' | 'warn' | 'error' | 'debug'
  message: string
  stage?: string
}

export interface ScraperProgress {
  stage: string
  label: string
  percent: number
  status: 'pending' | 'running' | 'completed' | 'error'
}

export interface LogoFormatInfo {
  format: 'svg' | 'png' | 'jpg' | 'webp'
  dataUrl?: string
  converted?: boolean
}

export interface LogoResult {
  id: string
  source: string
  sourceType: 'clearbit' | 'github' | 'favicon' | 'wikipedia' | 'direct' | 'converted' | 'cloud'
  format: 'svg' | 'png' | 'jpg' | 'webp'
  url: string
  dataUrl?: string
  width?: number
  height?: number
  convertedSvg?: string
  title: string
}

export interface ScraperState {
  query: string
  isRunning: boolean
  mode: ScrapeMode
  apiKey: string | null
  logs: ScraperLog[]
  progress: ScraperProgress[]
  results: LogoResult[]
  error: string | null
}

export interface ApiResponse {
  success: boolean
  query: string
  results: ApiLogoResult[]
  meta: {
    sourcesChecked: number
    resultsFound: number
    elapsedMs: number
  }
}

export interface ApiLogoResult {
  id: string
  source: string
  sourceType: string
  format: string
  url: string
  width?: number
  height?: number
  title: string
}
