import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark'

/** Brand-hue variant — orthogonal to light/dark. Classic = base tokens (no override). */
export type ThemeVariant = 'classic' | 'modern' | 'minimal'

const THEME_VARIANTS: ThemeVariant[] = ['classic', 'modern', 'minimal']

/** Meta theme-color for mobile browser chrome, keyed by theme */
const THEME_META_COLORS: Record<Theme, string> = {
  dark: '#0B0F15',
  light: '#F8F7F4',
}

const VARIANT_KEY = 'theme-variant'

interface ThemeContextType {
  theme: Theme
  variant: ThemeVariant
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  setVariant: (variant: ThemeVariant) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return 'light'
}

function getInitialVariant(): ThemeVariant {
  if (typeof window === 'undefined') return 'classic'
  const saved = localStorage.getItem(VARIANT_KEY)
  if (saved && (THEME_VARIANTS as string[]).includes(saved)) return saved as ThemeVariant
  return 'classic'
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  // Update meta theme-color for mobile browser chrome
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', THEME_META_COLORS[theme])
  }
}

function applyVariant(variant: ThemeVariant) {
  // Classic = base tokens; no attribute keeps the cascade clean.
  if (variant === 'classic') {
    document.documentElement.removeAttribute('data-variant')
  } else {
    document.documentElement.setAttribute('data-variant', variant)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [variant, setVariantState] = useState<ThemeVariant>(getInitialVariant)

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem('theme', t)
    setThemeState(t)
    applyTheme(t)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const setVariant = useCallback((v: ThemeVariant) => {
    localStorage.setItem(VARIANT_KEY, v)
    setVariantState(v)
    applyVariant(v)
  }, [])

  // Apply on mount + whenever theme/variant change
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    applyVariant(variant)
  }, [variant])

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue)
        applyTheme(e.newValue)
      }
      if (e.key === VARIANT_KEY && e.newValue && (THEME_VARIANTS as string[]).includes(e.newValue)) {
        setVariantState(e.newValue as ThemeVariant)
        applyVariant(e.newValue as ThemeVariant)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo(
    () => ({ theme, variant, setTheme, toggleTheme, setVariant }),
    [theme, variant, setTheme, toggleTheme, setVariant]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
