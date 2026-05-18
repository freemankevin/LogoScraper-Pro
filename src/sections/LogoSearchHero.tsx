import { useRef, useEffect, useState } from 'react'
import type { ScrapeMode } from '../types/scraper'

interface LogoSearchHeroProps {
  onSearch: (query: string) => void
  isRunning: boolean
  mode: ScrapeMode
  onModeChange: (mode: ScrapeMode) => void
}

export default function LogoSearchHero({ onSearch, isRunning, mode, onModeChange }: LogoSearchHeroProps) {
  const [query, setQuery] = useState('')
  const titleRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t1 = titleRef.current
    const s1 = subRef.current
    const f1 = formRef.current
    if (!t1 || !s1 || !f1) return

    const keyframes = [
      { opacity: 0, transform: 'translateY(30px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ]
    const opts = { duration: 800, fill: 'forwards' as const, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }

    t1.animate(keyframes, { ...opts, delay: 300 })
    s1.animate(keyframes, { ...opts, delay: 500 })
    f1.animate(keyframes, { ...opts, delay: 700 })
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed && !isRunning) {
      onSearch(trimmed)
    }
  }

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
        padding: '2rem 4vw',
      }}
    >
      {/* Brand */}
      <nav
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem 4vw',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)' }}>
          <img src="/logo.svg" alt="" width="18" height="18" style={{ display: 'block' }} />
          LogoScraper
        </span>
        <a
          href="/api"
          style={{
            color: 'rgba(255,255,255,0.6)',
            textDecoration: 'none',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-cyan)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
        >
          API
        </a>
      </nav>

      <div style={{ textAlign: 'center', maxWidth: 780, width: '100%' }}>
        {/* Title — clean, english, unified with the tech aesthetic below */}
        <div ref={titleRef} style={{ opacity: 0 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.8rem, 7vw, 5rem)',
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              color: '#ffffff',
              margin: 0,
              textWrap: 'balance',
              textShadow: '0 0 40px rgba(0, 229, 255, 0.25), 0 0 80px rgba(0, 229, 255, 0.1)',
            }}
          >
            Logo<span style={{ color: 'var(--accent-cyan)' }}>Scraper</span>
          </h1>
        </div>

        <p
          ref={subRef}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(0.75rem, 1vw, 0.88rem)',
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '0.03em',
            color: 'rgba(255,255,255,0.45)',
            marginTop: '1rem',
            marginBottom: '2rem',
            maxWidth: '60ch',
            marginLeft: 'auto',
            marginRight: 'auto',
            opacity: 0,
            textWrap: 'balance',
          }}
        >
          Enter any domain. Get PNG / ICO favicons instantly.
        </p>

        {/* Search Form */}
        <div ref={formRef} style={{ opacity: 0 }}>
          {/* Mode Toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '1.25rem',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.25rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                gap: '0.15rem',
              }}
            >
              <ModePill active={mode === 'direct'} onClick={() => onModeChange('direct')}>
                Direct
              </ModePill>
              <ModePill active={mode === 'api'} onClick={() => onModeChange('api')}>
                Cloud
              </ModePill>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '0.75rem',
              maxWidth: 560,
              margin: '0 auto',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 280,
                position: 'relative',
              }}
            >
              {/* Search Icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  position: 'absolute',
                  left: '1.1rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  zIndex: 2,
                  transition: 'stroke 0.2s',
                }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. github.com or notion.so"
                disabled={isRunning}
                style={{
                  width: '100%',
                  padding: '0.95rem 1.25rem 0.95rem 2.75rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#ffffff',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 229, 255, 0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={isRunning || !query.trim()}
              style={{
                padding: '0.95rem 2rem',
                borderRadius: '10px',
                border: 'none',
                background: isRunning ? 'var(--bg-tertiary)' : 'var(--accent-cyan)',
                color: '#0a0a0f',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isRunning ? (
                <>
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      border: '2px solid var(--text-muted)',
                      borderTopColor: 'var(--accent-cyan)',
                      borderRadius: '50%',
                      animation: 'spin 0.6s linear infinite',
                    }}
                  />
                  Scraping...
                </>
              ) : (
                'Scrape'
              )}
            </button>
          </form>

          {/* Quick tags — 常用域名 */}
          <div
            className="no-scrollbar"
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '0.35rem',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              paddingBottom: '0.25rem',
            }}
          >
            {['code.visualstudio.com', 'github.com', 'docker.com', 'react.dev', 'vuejs.org', 'angular.io', 'tailwindcss.com', 'figma.com', 'notion.so', 'postman.com', 'kubernetes.io', 'vercel.com', 'netlify.com', 'nodejs.org', 'python.org', 'gitlab.com', 'slack.com', 'discord.com', 'redis.io', 'mysql.com', 'postgresql.org', 'nginx.org', 'grafana.com', 'cloudflare.com', 'obsidian.md'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => { setQuery(tag); onSearch(tag) }}
                disabled={isRunning}
                style={{
                  flexShrink: 0,
                  padding: '0.3rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'rgba(255,255,255,0.3)',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isRunning) {
                    e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.25)'
                    e.currentTarget.style.color = 'rgba(0, 229, 255, 0.8)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.3)'
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </section>
  )
}

function ModePill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.35rem 0.9rem',
        borderRadius: '999px',
        border: 'none',
        background: active ? 'rgba(0, 229, 255, 0.15)' : 'transparent',
        color: active ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.35)',
        fontSize: '0.7rem',
        fontFamily: 'var(--font-mono)',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'rgba(255,255,255,0.6)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'rgba(255,255,255,0.35)'
        }
      }}
    >
      {children}
    </button>
  )
}
