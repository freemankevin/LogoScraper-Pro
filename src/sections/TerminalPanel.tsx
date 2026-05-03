import { useEffect, useRef, useState, useCallback } from 'react'
import type { ScraperLog, ScraperProgress } from '../types/scraper'
import { downloadCacheAsJson, getCacheStats } from '../lib/logo-cache'
import { isSupabaseConfigured, getCloudStats, setSupabaseCredentials } from '../lib/supabase-client'

interface TerminalPanelProps {
  logs: ScraperLog[]
  progress: ScraperProgress[]
  isRunning: boolean
}

export default function TerminalPanel({ logs, progress, isRunning }: TerminalPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const [cacheStats, setCacheStats] = useState({ resultsCount: 0, softwareCount: 0 })
  const [cloudStats, setCloudStats] = useState({ logoCount: 0, softwareCount: 0 })
  const [showCloudConfig, setShowCloudConfig] = useState(false)

  useEffect(() => {
    getCacheStats().then(setCacheStats).catch(() => {})
    if (isSupabaseConfigured()) {
      getCloudStats().then(setCloudStats).catch(() => {})
    }
  }, [logs]) // 每次有新日志时刷新缓存统计

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  const getLevelClass = (level: ScraperLog['level']) => {
    switch (level) {
      case 'info': return 'level-info'
      case 'success': return 'level-success'
      case 'warn': return 'level-warn'
      case 'error': return 'level-error'
      case 'debug': return 'level-debug'
      default: return ''
    }
  }

  const getProgressColor = (status: ScraperProgress['status']) => {
    switch (status) {
      case 'completed': return '#00e676'
      case 'running': return '#00e5ff'
      case 'error': return '#ff5252'
      default: return '#555570'
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-terminal)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Terminal Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-panel)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5252' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffb300' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#00e676' }} />
          <span
            style={{
              marginLeft: '0.75rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontWeight: 500,
            }}
          >
            scraper-engine — zsh
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#00e5ff',
                  animation: 'pulse 1s infinite',
                }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>RUNNING</span>
            </div>
          )}
          {isSupabaseConfigured() && (
            <span
              style={{
                fontSize: '0.65rem',
                color: '#00e5ff',
                fontFamily: 'var(--font-mono)',
                marginRight: '0.25rem',
              }}
              title="云端缓存统计"
            >
              ☁ {cloudStats.logoCount}
            </span>
          )}
          {(cacheStats.resultsCount > 0 || cacheStats.softwareCount > 0) && (
            <span
              style={{
                fontSize: '0.65rem',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                marginRight: '0.25rem',
              }}
              title="本地缓存统计"
            >
              缓存: {cacheStats.resultsCount}结果 / {cacheStats.softwareCount}软件
            </span>
          )}
          <CloudConfigButton
            configured={isSupabaseConfigured()}
            showPanel={showCloudConfig}
            setShowPanel={setShowCloudConfig}
          />
          <ExportCacheButton />
          <CopyButton logs={logs} copied={copied} setCopied={setCopied} />
        </div>
      </div>

      {/* Progress Bars */}
      <div
        style={{
          padding: '1rem',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-panel)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        {progress.map((p) => (
          <div key={p.stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span
              style={{
                width: 100,
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                flexShrink: 0,
                textAlign: 'right',
              }}
            >
              {p.label}
            </span>
            <div className="progress-bar-track" style={{ flex: 1 }}>
              <div
                className="progress-bar-fill"
                style={{
                  width: `${p.percent}%`,
                  background: getProgressColor(p.status),
                  boxShadow: p.status === 'running' ? `0 0 8px ${getProgressColor(p.status)}` : 'none',
                }}
              />
            </div>
            <span
              style={{
                width: 36,
                fontSize: '0.7rem',
                color: getProgressColor(p.status),
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {p.percent}%
            </span>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div
        ref={scrollRef}
        style={{
          padding: '1rem',
          maxHeight: '320px',
          overflowY: 'auto',
          fontSize: '0.78rem',
          lineHeight: 1.7,
          background: 'var(--bg-terminal)',
        }}
      >
        {logs.length === 0 ? (
          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            等待任务启动... 输入软件名称并点击搜索
          </span>
        ) : (
          logs.map((log) => (
            <div key={log.id} style={{ display: 'flex', gap: '0.5rem' }}>
              <span className="timestamp">{log.timestamp}</span>
              <span className={getLevelClass(log.level)} style={{ fontWeight: 600, flexShrink: 0 }}>
                [{log.level.toUpperCase()}]
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{log.message}</span>
            </div>
          ))
        )}
        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{nowTime()}</span>
            <span style={{ color: 'var(--accent-cyan)' }}>_</span>
            <span
              style={{
                width: 8,
                height: 14,
                background: 'var(--accent-cyan)',
                display: 'inline-block',
                animation: 'blink 1s step-end infinite',
              }}
            />
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

function ExportCacheButton() {
  const [exported, setExported] = useState(false)

  const handleExport = useCallback(async () => {
    try {
      await downloadCacheAsJson()
      setExported(true)
      setTimeout(() => setExported(false), 1500)
    } catch {
      // ignore
    }
  }, [])

  return (
    <button
      onClick={handleExport}
      title="导出缓存数据为 JSON"
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        const s = e.currentTarget.style
        s.background = 'rgba(255,255,255,0.12)'
        s.borderColor = 'rgba(255,255,255,0.25)'
        s.boxShadow = '0 0 10px rgba(255,255,255,0.08)'
      }}
      onMouseLeave={(e) => {
        const s = e.currentTarget.style
        s.background = 'rgba(255,255,255,0.06)'
        s.borderColor = 'rgba(255,255,255,0.08)'
        s.boxShadow = 'none'
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={exported ? '#00e676' : '#c0c0d0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }}>
        {exported ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </>
        )}
      </svg>
    </button>
  )
}

function CloudConfigButton({
  configured,
  showPanel,
  setShowPanel,
}: {
  configured: boolean
  showPanel: boolean
  setShowPanel: (v: boolean) => void
}) {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    if (!url.trim() || !key.trim()) return
    setSupabaseCredentials(url.trim(), key.trim())
    setSaved(true)
    setTimeout(() => { setSaved(false); setShowPanel(false) }, 800)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setShowPanel(!showPanel)}
        title={configured ? 'Supabase 已连接' : '配置 Supabase 云端存储'}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: configured ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.08)',
          background: configured ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          cursor: 'pointer',
          transition: 'all 0.25s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          const s = e.currentTarget.style
          s.background = configured ? 'rgba(0,229,255,0.15)' : 'rgba(255,255,255,0.12)'
          s.borderColor = configured ? '#00e5ff' : 'rgba(255,255,255,0.25)'
          s.boxShadow = '0 0 10px rgba(255,255,255,0.08)'
        }}
        onMouseLeave={(e) => {
          const s = e.currentTarget.style
          s.background = configured ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.06)'
          s.borderColor = configured ? '#00e5ff' : 'rgba(255,255,255,0.08)'
          s.boxShadow = 'none'
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={configured ? '#00e5ff' : '#c0c0d0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
        </svg>
      </button>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            top: 34,
            right: 0,
            width: 280,
            background: 'rgba(15,15,20,0.95)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '0.75rem',
            zIndex: 100,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <div style={{ fontSize: '0.7rem', color: 'var(--text-primary)', marginBottom: '0.5rem', fontWeight: 600 }}>
            Supabase 云端配置
          </div>
          <input
            type="text"
            placeholder="Project URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '0.35rem 0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              marginBottom: '0.4rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <input
            type="password"
            placeholder="Anon Key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: 4,
              padding: '0.35rem 0.5rem',
              color: 'var(--text-secondary)',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              marginBottom: '0.5rem',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            onClick={handleSave}
            style={{
              width: '100%',
              padding: '0.35rem',
              borderRadius: 4,
              border: 'none',
              background: saved ? '#00e676' : 'var(--accent-cyan)',
              color: '#0a0a0f',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {saved ? '✓ 已保存' : '保存并连接'}
          </button>
        </div>
      )}
    </div>
  )
}

function CopyButton({ logs, copied, setCopied }: { logs: ScraperLog[]; copied: boolean; setCopied: (v: boolean) => void }) {
  const handleCopy = useCallback(async () => {
    if (logs.length === 0) return
    const text = logs
      .map((log) => `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [logs, setCopied])

  return (
    <button
      onClick={handleCopy}
      disabled={logs.length === 0}
      title="复制全部日志"
      style={{
        width: 26,
        height: 26,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.08)',
        background: logs.length === 0
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: logs.length === 0 ? 'not-allowed' : 'pointer',
        opacity: logs.length === 0 ? 0.3 : 1,
        transition: 'all 0.25s ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (logs.length === 0) return
        const s = e.currentTarget.style
        s.background = 'rgba(255,255,255,0.12)'
        s.borderColor = 'rgba(255,255,255,0.25)'
        s.boxShadow = '0 0 10px rgba(255,255,255,0.08)'
      }}
      onMouseLeave={(e) => {
        const s = e.currentTarget.style
        s.background = 'rgba(255,255,255,0.06)'
        s.borderColor = 'rgba(255,255,255,0.08)'
        s.boxShadow = 'none'
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={copied ? '#00e676' : '#c0c0d0'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.2s' }}>
        {copied ? (
          <>
            <polyline points="20 6 9 17 4 12" />
          </>
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  )
}

function nowTime() {
  const d = new Date()
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}
