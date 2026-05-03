import { useRef, useEffect, useState } from 'react'
import type { ScrapeMode } from '../types/scraper'
import { findSuggestions } from '../hooks/useScraper'
import { KNOWN_SOFTWARE } from '../data/software'

interface LogoSearchHeroProps {
  onSearch: (query: string) => void
  isRunning: boolean
  mode: ScrapeMode
  onModeChange: (mode: ScrapeMode) => void
}

export default function LogoSearchHero({ onSearch, isRunning, mode, onModeChange }: LogoSearchHeroProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (inputContainerRef.current && !inputContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (name: string) => {
    setQuery(name)
    setShowSuggestions(false)
    setActiveIndex(-1)
    if (!isRunning) {
      onSearch(name)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed && !isRunning) {
      setShowSuggestions(false)
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
        <span style={{ color: 'var(--accent-cyan)' }}>LogoScraper Pro</span>
        <span>v2.2.0</span>
      </nav>

      <div style={{ textAlign: 'center', maxWidth: 720, width: '100%' }}>
        <h1
          ref={titleRef}
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 7vw, 5rem)',
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            color: '#ffffff',
            margin: 0,
            opacity: 0,
            textWrap: 'balance',
          }}
        >
          软件 Logo
          <br />
          <span style={{ color: 'var(--accent-cyan)' }}>智能爬取引擎</span>
        </h1>

        <p
          ref={subRef}
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(0.85rem, 1.2vw, 1rem)',
            fontWeight: 400,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.45)',
            marginTop: '1.25rem',
            marginBottom: '2.5rem',
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
            opacity: 0,
          }}
        >
          输入任意软件名称，自动爬取官方网站 Logo。支持 SVG / PNG 多格式输出，
          内置 Rust 高性能矢量化引擎，一键下载高清品牌资源。
        </p>

        {/* Search Form */}
        <div ref={formRef} style={{ opacity: 0 }}>
          {/* Mode Toggle */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem',
              marginBottom: '1rem',
            }}
          >
            <ModeButton active={mode === 'direct'} onClick={() => onModeChange('direct')} label="Direct" desc="浏览器直连" />
            <ModeButton active={mode === 'api'} onClick={() => onModeChange('api')} label="API" desc="服务端聚合" />
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
              ref={inputContainerRef}
              style={{
                flex: 1,
                minWidth: 280,
                position: 'relative',
              }}
            >
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value
                  setQuery(val)
                  if (val.trim().length >= 2) {
                    setSuggestions(findSuggestions(val))
                    setShowSuggestions(true)
                    setActiveIndex(-1)
                  } else {
                    setSuggestions([])
                    setShowSuggestions(false)
                  }
                }}
                onKeyDown={(e) => {
                  if (!showSuggestions || suggestions.length === 0) return
                  if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActiveIndex((i) => Math.max(i - 1, -1))
                  } else if (e.key === 'Enter') {
                    if (activeIndex >= 0) {
                      e.preventDefault()
                      handleSelect(suggestions[activeIndex])
                    }
                  } else if (e.key === 'Escape') {
                    setShowSuggestions(false)
                  }
                }}
                placeholder="输入软件名称（如 vscode）或官网链接（如 https://typora.io）..."
                disabled={isRunning}
                style={{
                  width: '100%',
                  padding: '0.95rem 1.25rem',
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
                  if (query.trim().length >= 2) {
                    setSuggestions(findSuggestions(query))
                    setShowSuggestions(true)
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                autoComplete="off"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(10, 10, 15, 0.95)',
                    backdropFilter: 'blur(12px)',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  }}
                >
                  {suggestions.map((name, idx) => {
                    const info = KNOWN_SOFTWARE[name]
                    const host = info?.domains?.[0]?.split('/')[0] ?? ''
                    const isActive = idx === activeIndex
                    return (
                      <div
                        key={name}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleSelect(name)
                        }}
                        style={{
                          padding: '0.75rem 1.25rem',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-sans)',
                          color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)',
                          background: isActive ? 'rgba(0, 229, 255, 0.12)' : 'transparent',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'all 0.15s',
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{name}</span>
                        {host && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: 'rgba(255,255,255,0.35)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {host}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
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
                  爬取中...
                </>
              ) : (
                '开始爬取'
              )}
            </button>
          </form>

          {/* Quick tags */}
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              marginTop: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['vscode', 'github', 'docker', 'react', 'tailwind', 'aws'].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => { setQuery(tag); onSearch(tag) }}
                disabled={isRunning}
                style={{
                  padding: '0.35rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.75rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!isRunning) {
                    e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.3)'
                    e.currentTarget.style.color = 'var(--accent-cyan)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
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
      `}</style>
    </section>
  )
}

function ModeButton({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean
  onClick: () => void
  label: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.35rem 0.85rem',
        borderRadius: '6px',
        border: active ? '1px solid var(--accent-cyan)' : '1px solid rgba(255,255,255,0.08)',
        background: active ? 'rgba(0, 229, 255, 0.1)' : 'rgba(255,255,255,0.03)',
        color: active ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.4)',
        fontSize: '0.7rem',
        fontFamily: 'var(--font-mono)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
      }}
      title={desc}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: active ? 'var(--accent-cyan)' : 'transparent',
          border: active ? 'none' : '1px solid rgba(255,255,255,0.2)',
        }}
      />
      {label}
    </button>
  )
}
