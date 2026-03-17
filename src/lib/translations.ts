// ─── HisaabPro Translations — Barrel ─────────────────────────────────────────
// Custom i18n — no external library. ~160 keys covering MVP features.
// Usage: import { translations } from '@/lib/translations'
// Access via LanguageContext: const { t } = useLanguage()

import { en } from './translations.en'
import { hi } from './translations.hi'

const translations = { en, hi } as const

export { translations }
export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations.en
