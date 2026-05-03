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
    <div style={{ marginTop: '4rem' }}>
      {/* Section Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          paddingBottom: '1rem',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-cyan)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: '0.5rem',
            }}
          >
            Search Results
          </div>
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
        </div>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          共 <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>{results.length}</span> 个资源
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '1.5rem',
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
  const hasSvg = true
  const [urlIndex, setUrlIndex] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

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
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isHovered
          ? '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(0, 229, 255, 0.15), 0 0 30px rgba(0, 229, 255, 0.08)'
          : '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.02)',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview */}
      <div
        style={{
          height: 200,
          background: `
            linear-gradient(135deg, rgba(0,229,255,0.03) 0%, transparent 50%),
            linear-gradient(225deg, rgba(179,136,255,0.02) 0%, transparent 50%),
            var(--bg-secondary)
          `,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.4,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
        {/* Corner accents */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '1px',
            background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)',
            opacity: isHovered ? 0.5 : 0.2,
            transition: 'opacity 0.35s',
          }}
        />

        {loadFailed || !currentUrl ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              gap: '0.5rem',
              position: 'relative',
              zIndex: 1,
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
              position: 'relative',
              zIndex: 1,
              filter: isHovered ? 'brightness(1.05)' : 'brightness(1)',
              transition: 'filter 0.35s',
            }}
          />
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '1.25rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.35rem',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {result.title}
          </div>
          <FormatBadge format={result.format} />
        </div>
        <div
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: result.format === 'svg' ? 'var(--accent-green)' : 'var(--accent-amber)',
              display: 'inline-block',
            }}
          />
          {result.source}
          {result.width && result.height ? ` · ${result.width}x${result.height}px` : ''}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          {hasSvg && (
            <button
              onClick={() => onDownloadSvg(result)}
              style={{
                flex: 1,
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--accent-cyan)',
                color: '#0a0a0f',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9'
                e.currentTarget.style.transform = 'scale(1.02)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1'
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              下载 SVG
            </button>
          )}
          <button
            onClick={() => onDownloadPng(result)}
            style={{
              flex: 1,
              padding: '0.6rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)'
              e.currentTarget.style.color = 'var(--accent-cyan)'
              e.currentTarget.style.background = 'rgba(0, 229, 255, 0.05)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)'
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            下载 PNG
          </button>
        </div>
      </div>
    </div>
  )
}

function FormatBadge({ format }: { format: string }) {
  const isSvg = format === 'svg'
  return (
    <span
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        fontFamily: 'var(--font-mono)',
        padding: '0.2rem 0.5rem',
        borderRadius: '4px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: isSvg ? 'rgba(0, 230, 118, 0.12)' : 'rgba(255, 179, 0, 0.12)',
        color: isSvg ? 'var(--accent-green)' : 'var(--accent-amber)',
        border: `1px solid ${isSvg ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 179, 0, 0.2)'}`,
      }}
    >
      {format}
    </span>
  )
}
