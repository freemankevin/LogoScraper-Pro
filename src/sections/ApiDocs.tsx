import { useState } from 'react'

export default function ApiDocs() {
  const [activeTab, setActiveTab] = useState<'overview' | 'endpoints' | 'limits'>('overview')
  const [copied, setCopied] = useState(false)

  const apiKey = typeof window !== 'undefined'
    ? localStorage.getItem('ls_api_key') || 'ls-demo-key-xxxxxxxx'
    : 'ls-demo-key-xxxxxxxx'

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const regenerateKey = () => {
    const newKey = `ls-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36).slice(-6)}`
    localStorage.setItem('ls_api_key', newKey)
    window.location.reload()
  }

  const tabs = [
    { key: 'overview' as const, label: 'Overview', icon: '◎' },
    { key: 'endpoints' as const, label: 'Endpoints', icon: '◈' },
    { key: 'limits' as const, label: 'Limits', icon: '◉' },
  ]

  return (
    <div
      style={{
        marginTop: '4rem',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255,255,255,0.02)',
        position: 'relative',
      }}
    >
      {/* Top accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, var(--accent-cyan) 20%, var(--accent-purple) 50%, var(--accent-cyan) 80%, transparent 100%)',
          opacity: 0.6,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.25rem',
            borderRadius: '10px',
            background: 'var(--bg-terminal)',
            border: '1px solid var(--border-color)',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: '7px',
                  border: 'none',
                  background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-secondary)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.5rem' }}>
        {activeTab === 'overview' && (
          <div>
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '1.5rem',
                fontFamily: 'var(--font-sans)',
              }}
            >
              LogoScraper provides an HTTP API service for querying software logos.
              All endpoints return JSON with CORS enabled.
            </div>

            {/* API Key */}
            <div
              style={{
                background: 'var(--bg-terminal)',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                Your API Key
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <code
                  style={{
                    flex: 1,
                    fontSize: '0.8rem',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '0.65rem 0.9rem',
                    borderRadius: '8px',
                    wordBreak: 'break-all',
                    border: '1px solid rgba(0,229,255,0.1)',
                    fontFamily: 'var(--font-mono)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {apiKey}
                </code>
                <ActionButton onClick={copyKey} active={copied}>
                  {copied ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Copied
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy
                    </>
                  )}
                </ActionButton>
                <ActionButton onClick={regenerateKey}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                  Regenerate
                </ActionButton>
              </div>
            </div>

            <div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span style={{ color: 'var(--accent-cyan)' }}>◈</span>
                Usage
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <UsageRow step="1" label="Pass in request header" code="X-API-Key: your-key" />
                <UsageRow step="2" label="Or as URL parameter" code="?apiKey=your-key" />
                <UsageRow step="3" label="All requests should use POST method" code="/api/scrape" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <EndpointBlock
              method="POST"
              path="/api/scrape"
              description="Scrape logo for specified software"
              request={`{\n  "query": "vscode",\n  "formats": ["svg", "png"]\n}`}
              response={`{\n  "success": true,\n  "query": "vscode",\n  "results": [\n    {\n      "id": "res-xxx",\n      "source": "Clearbit (code.visualstudio.com)",\n      "format": "png",\n      "url": "https://logo.clearbit.com/..."\n    }\n  ],\n  "meta": {\n    "sourcesChecked": 5,\n    "resultsFound": 1,\n    "elapsedMs": 1200\n  }\n}`}
            />

            <EndpointBlock
              method="GET"
              path="/api/health"
              description="Service health check"
              request="// No request body"
              response={`{\n  "success": true,\n  "name": "LogoScraper API",\n  "version": "2.2.0",\n  "status": "healthy"\n}`}
            />
          </div>
        )}

        {activeTab === 'limits' && (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: 'var(--font-sans)' }}>
            <LimitRow label="Free tier (no API key)" value="10 / min" />
            <LimitRow label="Authenticated (with API key)" value="60 / min" />
            <LimitRow label="Concurrent sources per request" value="Up to 3" />
            <LimitRow label="Function timeout" value="10 sec" />
            <LimitRow label="Function memory limit" value="512 MB" />

            <div
              style={{
                marginTop: '1.25rem',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                background: 'rgba(255, 179, 0, 0.06)',
                border: '1px solid rgba(255, 179, 0, 0.15)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.6rem',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>⚠️</span>
              <span>
                Deployed on Vercel Hobby plan with daily execution unit limits.
                Upgrade to Vercel Pro or self-host for higher concurrency and longer timeouts.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.55rem 0.85rem',
        borderRadius: '8px',
        border: active ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
        background: active ? 'rgba(0, 230, 118, 0.1)' : 'transparent',
        color: active ? 'var(--accent-green)' : 'var(--text-secondary)',
        fontSize: '0.75rem',
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontFamily: 'var(--font-mono)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--accent-cyan)'
          e.currentTarget.style.color = 'var(--accent-cyan)'
          e.currentTarget.style.background = 'rgba(0, 229, 255, 0.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = 'var(--border-color)'
          e.currentTarget.style.color = 'var(--text-secondary)'
          e.currentTarget.style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

function UsageRow({ step, label, code }: { step: string; label: string; code: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(0,229,255,0.1)',
          color: 'var(--accent-cyan)',
          fontSize: '0.65rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: '1px solid rgba(0,229,255,0.15)',
        }}
      >
        {step}
      </span>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <code
        style={{
          color: 'var(--accent-cyan)',
          background: 'rgba(0,0,0,0.2)',
          padding: '0.2rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.72rem',
          border: '1px solid rgba(0,229,255,0.1)',
        }}
      >
        {code}
      </code>
    </div>
  )
}

function EndpointBlock({
  method,
  path,
  description,
  request,
  response,
}: {
  method: string
  path: string
  description: string
  request: string
  response: string
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--bg-terminal)',
      }}
    >
      <div
        style={{
          padding: '0.85rem 1rem',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <span
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            padding: '0.25rem 0.55rem',
            borderRadius: '6px',
            background: method === 'GET' ? 'rgba(0, 230, 118, 0.12)' : 'rgba(0, 229, 255, 0.12)',
            color: method === 'GET' ? 'var(--accent-green)' : 'var(--accent-cyan)',
            border: `1px solid ${method === 'GET' ? 'rgba(0, 230, 118, 0.2)' : 'rgba(0, 229, 255, 0.2)'}`,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {method}
        </span>
        <span
          style={{
            fontSize: '0.8rem',
            color: 'var(--text-primary)',
            fontWeight: 600,
          }}
        >
          {path}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{description}</span>
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <CodeBlock label="Request" code={request} />
        <CodeBlock label="Response" code={response} />
      </div>
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          fontSize: '0.65rem',
          color: 'var(--text-muted)',
          marginBottom: '0.4rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {label}
        <button
          onClick={handleCopy}
          style={{
            padding: '0.2rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: copied ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255,255,255,0.04)',
            color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
            fontSize: '0.6rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.borderColor = 'var(--accent-cyan)'
              e.currentTarget.style.color = 'var(--accent-cyan)'
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'var(--text-muted)'
            }
          }}
        >
          {copied ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: '0.75rem 1rem',
          background: 'rgba(0,0,0,0.3)',
          borderRadius: '8px',
          fontSize: '0.72rem',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          lineHeight: 1.6,
          border: '1px solid rgba(255,255,255,0.04)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        {code}
      </pre>
    </div>
  )
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.65rem 0',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span
        style={{
          color: 'var(--text-primary)',
          fontWeight: 600,
          fontSize: '0.75rem',
          fontFamily: 'var(--font-mono)',
          background: 'rgba(0,229,255,0.05)',
          padding: '0.25rem 0.6rem',
          borderRadius: '6px',
          border: '1px solid rgba(0,229,255,0.08)',
        }}
      >
        {value}
      </span>
    </div>
  )
}
