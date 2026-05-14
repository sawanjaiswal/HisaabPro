/**
 * usePublicLang — language toggle for /p/* public pages.
 *
 * Reads `?lang=hi|en` query param first, persists in sessionStorage
 * (key: public-lang) so a refresh keeps the choice without touching
 * the authenticated user's localStorage language preference.
 *
 * The existing useLanguage() hook is auth-coupled (reads user prefs from
 * LanguageContext which reads localStorage 'language'). Public pages use
 * this narrow hook instead — no LanguageContext dependency needed.
 */

import { useState, useCallback, useEffect } from 'react'

export type PublicLang = 'en' | 'hi'

const STORAGE_KEY = 'public-lang'

function readStoredLang(): PublicLang {
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)
    if (v === 'en' || v === 'hi') return v
  } catch {
    // sessionStorage blocked (private browsing edge case)
  }
  return 'en'
}

function readQueryLang(): PublicLang | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const v = params.get('lang')
    if (v === 'en' || v === 'hi') return v
  } catch {
    // window not available (SSR guard)
  }
  return null
}

export function usePublicLang() {
  const [lang, setLangState] = useState<PublicLang>(() => {
    const queryLang = readQueryLang()
    if (queryLang) return queryLang
    return readStoredLang()
  })

  // Sync query param into state on mount (handles direct URL navigation)
  useEffect(() => {
    const queryLang = readQueryLang()
    if (queryLang && queryLang !== lang) {
      setLangState(queryLang)
      try { sessionStorage.setItem(STORAGE_KEY, queryLang) } catch { /* noop */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLang = useCallback((next: PublicLang) => {
    setLangState(next)
    try { sessionStorage.setItem(STORAGE_KEY, next) } catch { /* noop */ }

    // Update query param in URL without full navigation
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.history.replaceState(null, '', url.toString())
  }, [])

  return { lang, setLang }
}
