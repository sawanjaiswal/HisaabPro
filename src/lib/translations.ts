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
import { enExt11 } from './translations.en.ext11'
import { enExt12 } from './translations.en.ext12'
import { enExt13 } from './translations.en.ext13'
import { enExt14 } from './translations.en.ext14'
import { enExt15 } from './translations.en.ext15'
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
import { hiExt11 } from './translations.hi.ext11'
import { hiExt12 } from './translations.hi.ext12'
import { hiExt13 } from './translations.hi.ext13'
import { hiExt14 } from './translations.hi.ext14'
import { hiExt15 } from './translations.hi.ext15'
import { enExt16 } from './translations.en.ext16'
import { hiExt16 } from './translations.hi.ext16'
import { enExt17 } from './translations.en.ext17'
import { hiExt17 } from './translations.hi.ext17'
import { enExt18 } from './translations.en.ext18'
import { hiExt18 } from './translations.hi.ext18'
import { enExt19 } from './translations.en.ext19'
import { hiExt19 } from './translations.hi.ext19'
import { enExt20 } from './translations.en.ext20'
import { hiExt20 } from './translations.hi.ext20'
import { enExt21 } from './translations.en.ext21'
import { hiExt21 } from './translations.hi.ext21'

const en = { ...enBase, ...enExt1, ...enExt2, ...enExt3, ...enExt4, ...enExt5, ...enExt6, ...enExt7, ...enExt8, ...enExt9, ...enExt10, ...enExt11, ...enExt12, ...enExt13, ...enExt14, ...enExt15, ...enExt16, ...enExt17, ...enExt18, ...enExt19, ...enExt20, ...enExt21 } as const
const hi = { ...hiBase, ...hiExt1, ...hiExt2, ...hiExt3, ...hiExt4, ...hiExt5, ...hiExt6, ...hiExt7, ...hiExt8, ...hiExt9, ...hiExt10, ...hiExt11, ...hiExt12, ...hiExt13, ...hiExt14, ...hiExt15, ...hiExt16, ...hiExt17, ...hiExt18, ...hiExt19, ...hiExt20, ...hiExt21 } as const

const translations = { en, hi } as const

export { translations }
export type Language = keyof typeof translations
export type TranslationKey = keyof typeof translations.en
