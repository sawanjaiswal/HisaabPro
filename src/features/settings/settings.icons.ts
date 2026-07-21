/** The one icon map for settings rows.
 *
 * `SETTINGS_SECTIONS` stores icons as string keys so the constants stay
 * serialisable; this resolves them to lucide components. There used to be two
 * maps — one live in `SettingsSection`, one dead in `SettingsPage` — and the
 * live one was missing six names the constants ask for, so Backup & Restore,
 * Inventory, What's New, Business Profile, Tags and Rewards each rendered an
 * empty tinted square. `settings.icons.test.ts` walks the constants and fails
 * if a new row ever asks for a name that is not here.
 */

import type React from 'react'
import {
  Briefcase, Calculator, Calendar, ClipboardList, Cloud, Fingerprint, Key,
  Keyboard, Languages, Lock, Moon, Package, Palette, Percent, Receipt, Ruler,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Store, Tag, Trophy, UserPlus,
  Users,
} from 'lucide-react'
import type { LucideProps } from 'lucide-react'

export type IconComponent = React.FC<LucideProps>

export const SETTINGS_ICONS: Record<string, IconComponent> = {
  Briefcase, Calculator, Calendar, ClipboardList, Cloud, Fingerprint, Key,
  Keyboard, Languages, Lock, Moon, Package, Palette, Percent, Receipt, Ruler,
  Shield, ShieldAlert, ShieldCheck, Sparkles, Store, Tag, Trophy, UserPlus,
  Users,
}
