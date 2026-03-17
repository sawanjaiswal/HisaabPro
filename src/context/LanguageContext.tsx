import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { translations } from '@/lib/translations'
import type { Language } from '@/lib/translations'

// Widen the literal string types so both 'en' and 'hi' translation objects are assignable.
type TranslationMap = { readonly [K in keyof typeof translations.en]: string }

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationMap
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Initialize from localStorage, default to 'en'
    if (typeof window === 'undefined') return 'en'
    const saved = localStorage.getItem('language')
    return (saved === 'en' || saved === 'hi') ? saved : 'en'
  })

  // Keep localStorage in sync on every language change
  const setLanguage = useCallback((lang: Language) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang)
    }
    setLanguageState(lang)
  }, [])

  // Cross-tab sync: listen for storage events from other tabs/windows
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('language')
      if (saved === 'en' || saved === 'hi') {
        setLanguageState(saved)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const t: TranslationMap = translations[language]

  // Memoize to prevent unnecessary re-renders on unrelated parent updates
  const value = useMemo<LanguageContextType>(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
