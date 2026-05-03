import type { LogoResult } from '../types/scraper'

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

function LogoCard({
  result,
  onDownloadSvg,
  onDownloadPng,
}: {
  result: LogoResult
  onDownloadSvg: (r: LogoResult) => void
  onDownloadPng: (r: LogoResult) => void
}) {
  const hasSvg = result.format === 'svg' || !!result.convertedSvg
  
  // 优先展示 SVG（转换后的或原始的），不展示 PNG
  let previewUrl: string
  if (result.convertedSvg) {
    // PNG 转换后的 SVG
    previewUrl = `data:image/svg+xml;base64,${btoa(result.convertedSvg)}`
  } else if (result.format === 'svg' && result.dataUrl) {
    // 原始 SVG
    previewUrl = result.dataUrl
  } else if (result.dataUrl) {
    // 只有 PNG，展示 PNG（用于下载，但不作为主要展示）
    previewUrl = result.dataUrl
  } else {
    previewUrl = result.url
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
          background: 'var(--bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
          position: 'relative',
        }}
      >
        <img
          src={previewUrl}
          alt={result.title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
          }}
        />
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
            <>
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
