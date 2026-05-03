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

  return (
    <div
      style={{
        marginTop: '3rem',
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            LogoScraper Pro API
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            第三方开发者接口文档 — v2.2.0
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['overview', 'endpoints', 'limits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === tab ? 'var(--accent-cyan)' : 'transparent',
                color: activeTab === tab ? '#0a0a0f' : 'var(--text-secondary)',
                fontSize: '0.7rem',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {tab === 'overview' ? '概览' : tab === 'endpoints' ? '接口' : '限额'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '1.25rem' }}>
        {activeTab === 'overview' && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
              LogoScraper Pro 提供 HTTP API 服务，允许第三方应用通过接口查询软件 Logo。
              所有接口返回 JSON，支持 CORS。
            </div>

            {/* API Key */}
            <div
              style={{
                background: 'var(--bg-terminal)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                你的 API Key
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <code
                  style={{
                    flex: 1,
                    fontSize: '0.75rem',
                    color: 'var(--accent-cyan)',
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    wordBreak: 'break-all',
                  }}
                >
                  {apiKey}
                </code>
                <button
                  onClick={copyKey}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '已复制' : '复制'}
                </button>
                <button
                  onClick={regenerateKey}
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  重新生成
                </button>
              </div>
            </div>

            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <div style={{ marginBottom: '0.5rem' }}>📌 使用方式：</div>
              <div>1. 在请求头中携带 <code style={{ color: 'var(--accent-cyan)' }}>X-API-Key: your-key</code></div>
              <div>2. 或作为 URL 参数 <code style={{ color: 'var(--accent-cyan)' }}>?apiKey=your-key</code></div>
              <div>3. 所有请求建议使用 POST 方法访问 /api/scrape</div>
            </div>
          </div>
        )}

        {activeTab === 'endpoints' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Scrape Endpoint */}
            <EndpointBlock
              method="POST"
              path="/api/scrape"
              description="爬取指定软件的 Logo"
              request={`{\n  "query": "vscode",\n  "formats": ["svg", "png"]\n}`}
              response={`{\n  "success": true,\n  "query": "vscode",\n  "results": [\n    {\n      "id": "res-xxx",\n      "source": "Clearbit (code.visualstudio.com)",\n      "format": "png",\n      "url": "https://logo.clearbit.com/..."\n    }\n  ],\n  "meta": {\n    "sourcesChecked": 5,\n    "resultsFound": 1,\n    "elapsedMs": 1200\n  }\n}`}
            />

            {/* Health Endpoint */}
            <EndpointBlock
              method="GET"
              path="/api/health"
              description="服务健康检查"
              request="// 无需请求体"
              response={`{\n  "success": true,\n  "name": "LogoScraper Pro API",\n  "version": "2.2.0",\n  "status": "healthy"\n}`}
            />
          </div>
        )}

        {activeTab === 'limits' && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            <LimitRow label="免费用户（无 API Key）" value="10 次 / 分钟" />
            <LimitRow label="已认证用户（有 API Key）" value="60 次 / 分钟" />
            <LimitRow label="单次请求并发源数" value="最多 3 个" />
            <LimitRow label="函数超时时间" value="10 秒" />
            <LimitRow label="函数内存上限" value="512 MB" />

            <div
              style={{
                marginTop: '1rem',
                padding: '0.75rem',
                borderRadius: '6px',
                background: 'rgba(255, 179, 0, 0.08)',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
              }}
            >
              ⚠️ 当前部署在 Vercel Hobby 计划下，存在每日执行单元限额。
              如需更高并发和更长超时，建议升级到 Vercel Pro 或自行部署。
            </div>
          </div>
        )}
      </div>
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
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <div
        style={{
          padding: '0.6rem 0.75rem',
          background: 'var(--bg-terminal)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            background: method === 'GET' ? 'rgba(0, 230, 118, 0.15)' : 'rgba(0, 229, 255, 0.15)',
            color: method === 'GET' ? '#00e676' : 'var(--accent-cyan)',
          }}
        >
          {method}
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{path}</span>
        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>— {description}</span>
      </div>
      <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <CodeBlock label="Request" code={request} />
        <CodeBlock label="Response" code={response} />
      </div>
    </div>
  )
}

function CodeBlock({ label, code }: { label: string; code: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: '0.6rem 0.75rem',
          background: 'var(--bg-terminal)',
          borderRadius: '6px',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          overflowX: 'auto',
          lineHeight: 1.5,
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
        padding: '0.5rem 0',
        borderBottom: '1px solid var(--border-color)',
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{value}</span>
    </div>
  )
}
