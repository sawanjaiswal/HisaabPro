// Re-export from context — consumers import from this hook file
// keeping the import path stable if the context location ever moves
export { useLanguage } from '@/context/LanguageContext'
export type { Language, TranslationKey } from '@/lib/translations'
