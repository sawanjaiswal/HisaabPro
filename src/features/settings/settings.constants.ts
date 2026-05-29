import { ROUTES } from '@/config/routes.config'
import type { DateFormat, SettingsSection } from './settings.types'

// ─── Date Format Labels ───────────────────────────────────────────────────────

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  'DD/MM/YYYY': '14/03/2026',
  'MM/DD/YYYY': '03/14/2026',
  'YYYY-MM-DD': '2026-03-14',
}

export const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

// ─── Lock + PIN (re-exported from peer files) ──────────────────────────────
export { LOCK_PERIOD_OPTIONS } from './settings-lock.constants'
export {
  PIN_MIN_LENGTH,
  PIN_MAX_LENGTH,
  PIN_MAX_ATTEMPTS,
  PIN_LOCKOUT_MINUTES,
  WEAK_PINS,
} from './settings-pin.constants'

// ─── Settings Hub Sections ────────────────────────────────────────────────────

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'security',
    title: 'Security',
    items: [
      {
        id: 'pin',
        label: 'App PIN',
        description: 'Require a PIN when opening the app',
        icon: 'Lock',
        type: 'toggle',
      },
      {
        id: 'biometric',
        label: 'Biometric Auth',
        description: 'Use fingerprint or face ID to unlock',
        icon: 'Fingerprint',
        type: 'toggle',
      },
      {
        id: 'change-pin',
        label: 'Change App PIN',
        description: 'Update your 4–6 digit app unlock PIN',
        icon: 'Key',
        route: ROUTES.SETTINGS_PIN_SETUP,
        type: 'navigation',
      },
      {
        id: 'operation-pin',
        label: 'Operation PIN',
        description: 'Separate PIN required for sensitive actions',
        icon: 'ShieldCheck',
        type: 'toggle',
      },
    ],
  },
  {
    id: 'staff',
    title: 'Staff & Roles',
    items: [
      {
        id: 'manage-staff',
        label: 'Manage Staff',
        description: 'View, suspend or remove staff members',
        icon: 'Users',
        route: ROUTES.SETTINGS_STAFF,
        type: 'navigation',
      },
      {
        id: 'manage-roles',
        label: 'Manage Roles',
        description: 'Create and edit custom permission roles',
        icon: 'Shield',
        route: ROUTES.SETTINGS_ROLES,
        type: 'navigation',
      },
      {
        id: 'invite-staff',
        label: 'Invite Staff',
        description: 'Send a WhatsApp invite to a new staff member',
        icon: 'UserPlus',
        route: ROUTES.SETTINGS_STAFF_INVITE,
        type: 'navigation',
      },
    ],
  },
  {
    id: 'gst',
    title: 'GST & Tax',
    items: [
      {
        id: 'gst-settings',
        label: 'GST Settings',
        description: 'GSTIN, state code, composition scheme',
        icon: 'Receipt',
        route: ROUTES.SETTINGS_GST,
        type: 'navigation',
      },
      {
        id: 'tax-rates',
        label: 'Tax Rates',
        description: 'Manage GST rate categories',
        icon: 'Percent',
        route: ROUTES.SETTINGS_TAX_RATES,
        type: 'navigation',
      },
    ],
  },
  {
    id: 'business',
    title: 'Business',
    items: [
      {
        id: 'business-type',
        label: 'Business Type',
        description: 'Switch between retail, services, restaurant, bakery and more',
        icon: 'Briefcase',
        route: ROUTES.BUSINESS_TYPE,
        type: 'navigation',
      },
      {
        id: 'units',
        label: 'Units',
        description: 'Manage measurement units (kg, pcs, box, etc.)',
        icon: 'Ruler',
        route: ROUTES.SETTINGS_UNITS,
        type: 'navigation',
      },
      {
        id: 'inventory',
        label: 'Inventory',
        description: 'Expiry alerts and expired batch policy',
        icon: 'Package',
        route: ROUTES.SETTINGS_INVENTORY,
        type: 'navigation',
        requiresStock: true,
      },
      {
        id: 'loyalty',
        label: 'Loyalty Program',
        description: 'Reward repeat customers with redeemable points',
        icon: 'Sparkles',
        route: ROUTES.SETTINGS_LOYALTY,
        type: 'navigation',
      },
      { id: 'commission', label: 'Commission', description: 'Reward staff with commission on every sale', icon: 'Trophy', route: ROUTES.SETTINGS_COMMISSION, type: 'navigation' },
      {
        id: 'document-custom-fields',
        label: 'Custom Fields',
        description: 'Add custom fields to invoices, estimates, orders, challans',
        icon: 'ClipboardList',
        route: ROUTES.SETTINGS_DOC_CUSTOM_FIELDS,
        type: 'navigation',
      },
      { id: 'price-lists', label: 'Price Lists', description: 'Custom pricing tiers for parties or bulk quantities', icon: 'Tag', route: ROUTES.PRICE_LISTS, type: 'navigation' },
      { id: 'storefront', label: 'Online Store', description: 'Share your product catalogue via a public store link', icon: 'Store', route: ROUTES.STOREFRONT_SETTINGS, type: 'navigation' },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    items: [
      {
        id: 'active-sessions',
        label: 'Active Sessions',
        description: 'View and revoke logins from other devices',
        icon: 'ShieldCheck',
        route: ROUTES.SETTINGS_SESSIONS,
        type: 'navigation',
      },
      { id: 'backup', label: 'Backup & Restore', description: 'Back up your data to Google Drive', icon: 'Cloud', route: ROUTES.SETTINGS_BACKUP, type: 'navigation' },
    ],
  },
  {
    id: 'transaction-controls',
    title: 'Transaction Controls',
    items: [
      {
        id: 'lock-settings',
        label: 'Lock & Approval Settings',
        description: 'Prevent edits to old transactions, require approvals',
        icon: 'ShieldAlert',
        route: ROUTES.SETTINGS_TRANSACTION_CONTROLS,
        type: 'navigation',
      },
      {
        id: 'audit-log',
        label: 'Audit Log',
        description: 'Full history of who changed what and when',
        icon: 'ClipboardList',
        route: ROUTES.SETTINGS_AUDIT_LOG,
        type: 'navigation',
      },
    ],
  },
  {
    id: 'display',
    title: 'Display',
    items: [
      {
        id: 'theme',
        label: 'Dark Mode',
        description: 'Switch between light and dark appearance',
        icon: 'Moon',
        type: 'toggle',
      },
      {
        id: 'language',
        label: 'Language',
        description: 'Switch between English and Hindi',
        icon: 'Languages',
        type: 'select',
      },
      {
        id: 'date-format',
        label: 'Date Format',
        description: 'How dates are shown throughout the app',
        icon: 'Calendar',
        type: 'select',
      },
      { id: 'theme-variant', label: 'Theme', description: 'Pick a colour theme — Classic, Modern or Minimal', icon: 'Palette', route: ROUTES.SETTINGS_THEME, type: 'navigation' },
      {
        id: 'shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'Speed up billing on tablet and desktop',
        icon: 'Keyboard',
        route: ROUTES.SETTINGS_SHORTCUTS,
        type: 'navigation',
      },
      {
        id: 'calculator-position',
        label: 'Calculator Position',
        description: 'Where the floating calculator button appears',
        icon: 'Calculator',
        type: 'select',
      },
    ],
  },
]

// ─── Defaults (moved to settings-inventory.constants.ts) ──────────────────────
export { DEFAULT_APP_SETTINGS, DEFAULT_TRANSACTION_LOCK_CONFIG } from './settings-inventory.constants'
