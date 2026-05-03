import { Link } from 'react-router-dom'
import ApiDocs from '../sections/ApiDocs'

export default function ApiPage() {
  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Nav */}
      <nav
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem 4vw',
          fontFamily: 'var(--font-sans)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.6)',
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: 'none',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--accent-cyan)',
            textDecoration: 'none',
          }}
        >
          <img src="/logo.svg" alt="" width="18" height="18" style={{ display: 'block' }} />
          LogoScraper
        </Link>

      </nav>

      {/* Page Header */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '4rem 4vw 2rem',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2rem, 5vw, 3rem)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            color: '#ffffff',
            margin: 0,
            textWrap: 'balance',
            textShadow: '0 0 30px rgba(0, 229, 255, 0.15)',
          }}
        >
          API <span style={{ color: 'var(--accent-cyan)' }}>Documentation</span>
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(0.75rem, 1vw, 0.88rem)',
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '0.03em',
            color: 'rgba(255,255,255,0.4)',
            marginTop: '0.75rem',
            marginBottom: 0,
            textWrap: 'balance',
          }}
        >
          HTTP API for querying software logos. JSON responses, CORS enabled.
        </p>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 4vw 6rem',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <ApiDocs />
      </div>

      {/* Footer removed */}
    </div>
  )
}
