import { useState } from 'react'
import type { LogoResult } from '../types/scraper'
import { isValidSvg } from '../lib/utils'

interface LogoResultsProps {
  results: LogoResult[]
  onDownloadSvg: (result: LogoResult) => void
  onDownloadPng: (result: LogoResult) => void
}

export default function LogoResults({ results, onDownloadSvg, onDownloadPng }: LogoResultsProps) {
  if (results.length === 0) return null

  return (
    <div style={{ marginTop: '3rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: 0,
          }}
        >
          爬取结果
        </h2>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          共 {results.length} 个资源
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        {results.map((result) => (
          <LogoCard
            key={result.id}
            result={result}
            onDownloadSvg={onDownloadSvg}
            onDownloadPng={onDownloadPng}
          />
        ))}
      </div>
    </div>
  )
}

function getPreviewUrls(result: LogoResult): string[] {
  const urls: string[] = []
  if (isValidSvg(result.convertedSvg)) {
    urls.push(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.convertedSvg!)}`)
  }
  if (result.format === 'svg' && result.dataUrl) {
    urls.push(result.dataUrl)
  } else if (result.dataUrl) {
    urls.push(result.dataUrl)
  }
  if (result.url) {
    urls.push(result.url)
  }
  return urls
}

function LogoCard({
  result,
  onDownloadSvg,
  onDownloadPng,
}: {
  result: LogoResult
  onDownloadSvg: (r: LogoResult) => void
  onDownloadPng: (r: LogoResult) => void
}) {
  const hasSvg = true // 始终显示：有现成 SVG 直接下载，否则现场从 PNG 转换
  const [urlIndex, setUrlIndex] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)

  const candidateUrls = getPreviewUrls(result)
  const currentUrl = candidateUrls[urlIndex] || ''

  const handleError = () => {
    console.error('[LogoResults] Image load failed:', {
      title: result.title,
      format: result.format,
      source: result.source,
      currentUrl: currentUrl?.substring(0, 120),
      urlIndex,
      totalCandidates: candidateUrls.length,
      hasDataUrl: !!result.dataUrl,
      dataUrlLength: result.dataUrl?.length,
      hasConvertedSvg: !!result.convertedSvg,
      convertedSvgPrefix: result.convertedSvg?.substring(0, 80),
    })
    if (urlIndex < candidateUrls.length - 1) {
      setUrlIndex(urlIndex + 1)
    } else {
      setLoadFailed(true)
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-cyan)'
        e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 229, 255, 0.1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      {/* Preview */}
      <div
        style={{
          height: 180,
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          position: 'relative',
        }}
      >
        {loadFailed || !currentUrl ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '0.75rem',
              gap: '0.5rem',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>图片加载失败</span>
          </div>
        ) : (
          <img
            key={currentUrl}
            src={currentUrl}
            alt={result.title}
            onError={handleError}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '1rem 1.25rem' }}>
        <div
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}
        >
          {result.title}
        </div>
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '0.75rem',
          }}
        >
          {result.source}
          {result.width && result.height ? ` · ${result.width}x${result.height}px` : ''}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasSvg && (
            <button
              onClick={() => onDownloadSvg(result)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--accent-cyan)',
                color: '#0a0a0f',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
            >
              下载 SVG
            </button>
          )}
          <button
            onClick={() => onDownloadPng(result)}
            style={{
              flex: 1,
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-secondary)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            下载 PNG
          </button>
        </div>
      </div>
    </div>
  )
}
