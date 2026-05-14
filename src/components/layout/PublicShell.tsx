/**
 * PublicShell — layout wrapper for all /p/* public-facing pages.
 *
 * NOT AppShell. No BottomNav, no auth Header, no Settings drawer.
 * Renders: wordmark top-bar, lang toggle, max-w-md content area, footer.
 *
 * Platform-shell rules (PLATFORM_SHELL.md):
 *  - C5: safe-area consumed here (padding-top/bottom on .public-shell)
 *        — feature pages inside never reference insets directly.
 *  - C6: no fixed-bottom elements; shell is not a platform primitive.
 *  - C10: no --header-height token used (public shell manages its own top).
 */

import { Outlet, useLocation } from 'react-router-dom'
import { usePublicLang } from '@/features/public/hooks/usePublicLang'
import './public-shell.css'

const MARKETING_SITE = '/'

export function PublicShell() {
  const { lang, setLang } = usePublicLang()
  const location = useLocation()

  const poweredBy = lang === 'hi'
    ? 'हिसाबप्रो द्वारा संचालित'
    : 'Powered by HisaabPro'

  const termsLabel = lang === 'hi' ? 'नियम' : 'Terms'
  const privacyLabel = lang === 'hi' ? 'गोपनीयता' : 'Privacy'

  return (
    <div className="public-shell" lang={lang === 'hi' ? 'hi' : 'en'}>
      {/* Top bar */}
      <header className="public-shell__topbar" role="banner">
        <a
          className="public-shell__wordmark"
          href={MARKETING_SITE}
          aria-label="HisaabPro — go to home"
        >
          HisaabPro
        </a>

        <nav
          className="public-shell__lang-toggle"
          aria-label="Language switcher"
        >
          <button
            type="button"
            className={`public-shell__lang-btn${lang === 'en' ? ' public-shell__lang-btn--active' : ''}`}
            aria-pressed={lang === 'en'}
            aria-label="Switch to English"
            onClick={() => setLang('en')}
          >
            EN
          </button>
          <button
            type="button"
            className={`public-shell__lang-btn${lang === 'hi' ? ' public-shell__lang-btn--active' : ''}`}
            aria-pressed={lang === 'hi'}
            aria-label="हिंदी में बदलें"
            onClick={() => setLang('hi')}
          >
            HI
          </button>
        </nav>
      </header>

      {/* Feature page content */}
      <main className="public-shell__content" id="main-content">
        <div className="public-shell__container">
          <Outlet context={{ lang, location }} />
        </div>
      </main>

      {/* Footer */}
      <footer className="public-shell__footer" role="contentinfo">
        <span className="public-shell__footer-brand">{poweredBy}</span>
        <nav className="public-shell__footer-links" aria-label="Legal links">
          <a href="/terms" rel="noopener noreferrer">{termsLabel}</a>
          <a href="/privacy" rel="noopener noreferrer">{privacyLabel}</a>
        </nav>
      </footer>
    </div>
  )
}
