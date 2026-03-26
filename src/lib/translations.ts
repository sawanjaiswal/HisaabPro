// ─── HisaabPro Translations — Barrel ─────────────────────────────────────────
// Custom i18n — no external library.
// Usage: import { translations } from '@/lib/translations'
// Access via LanguageContext: const { t } = useLanguage()

import { en as enBase } from './translations.en'
import { enExt1 } from './translations.en.ext1'
import { enExt2 } from './translations.en.ext2'
import { enExt3 } from './translations.en.ext3'
import { enExt4 } from './translations.en.ext4'
import { enExt5 } from './translations.en.ext5'
import { enExt6 } from './translations.en.ext6'
import { enExt7 } from './translations.en.ext7'
import { enExt8 } from './translations.en.ext8'
import { enExt9 } from './translations.en.ext9'
import { enExt10 } from './translations.en.ext10'
import { hi as hiBase } from './translations.hi'
import { hiExt1 } from './translations.hi.ext1'
import { hiExt2 } from './translations.hi.ext2'
import { hiExt3 } from './translations.hi.ext3'
import { hiExt4 } from './translations.hi.ext4'
import { hiExt5 } from './translations.hi.ext5'
import { hiExt6 } from './translations.hi.ext6'
import { hiExt7 } from './translations.hi.ext7'
import { hiExt8 } from './translations.hi.ext8'
import { hiExt9 } from './translations.hi.ext9'
import { hiExt10 } from './translations.hi.ext10'

const en = { ...enBase, ...enExt1, ...enExt2, ...enExt3, ...enExt4, ...enExt5, ...enExt6, ...enExt7, ...enExt8, ...enExt9, ...enExt10 } as const
const hi = { ...hiBase, ...hiExt1, ...hiExt2, ...hiExt3, ...hiExt4, ...hiExt5, ...hiExt6, ...hiExt7, ...hiExt8, ...hiExt9, ...hiExt10 } as const

const translations = { en, hi } as const

export { translations }
export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations.en
