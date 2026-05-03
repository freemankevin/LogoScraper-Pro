import { useCallback } from 'react'
import VoidShader from './sections/VoidShader'
import LogoSearchHero from './sections/LogoSearchHero'
import TerminalPanel from './sections/TerminalPanel'
import LogoResults from './sections/LogoResults'
import ApiDocs from './sections/ApiDocs'
import { useScraper } from './hooks/useScraper'

export default function App() {
  const { state, runScraper, downloadAsSvg, downloadAsPng, setMode } = useScraper()

  const handleSearch = useCallback((query: string) => {
    if (state.isRunning) return
    runScraper(query)
  }, [state.isRunning, runScraper])

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      {/* Hero with Void Shader Background */}
      <div style={{ position: 'relative', minHeight: '100vh' }}>
        <VoidShader />
        <LogoSearchHero
          onSearch={handleSearch}
          isRunning={state.isRunning}
          mode={state.mode}
          onModeChange={setMode}
        />
      </div>

      {/* Terminal & Results */}
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 4vw 6rem',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <TerminalPanel
          logs={state.logs}
          progress={state.progress}
          isRunning={state.isRunning}
        />

        {state.results.length > 0 && (
          <LogoResults
            results={state.results}
            onDownloadSvg={downloadAsSvg}
            onDownloadPng={downloadAsPng}
          />
        )}

        {state.error && (
          <div
            style={{
              marginTop: '2rem',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--accent-red)',
              background: 'rgba(255, 82, 82, 0.08)',
              color: 'var(--accent-red)',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
            }}
          >
            [ERROR] {state.error}
          </div>
        )}

        <ApiDocs />
      </div>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '2rem 4vw',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <div style={{ marginBottom: '0.5rem' }}>
          LogoScraper Pro — 纯前端软件 Logo 智能爬取工具
        </div>
        <div>
          Rust Toolkit · Clearbit · IconHorse · Wikipedia · GitHub · ImageTracerJS
        </div>
      </footer>
    </div>
  )
}
