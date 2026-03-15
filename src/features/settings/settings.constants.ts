import { ROUTES } from '@/config/routes.config'
import type {
  ApprovalStatus,
  ApprovalType,
  AuditAction,
  DateFormat,
  PermissionModule,
  SettingsSection,
  ShortcutConfig,
  ShortcutGroup,
  StaffStatus,
} from './settings.types'

// ─── Permission Modules (matches PRD §4B — 7 modules) ────────────────────────

export const PERMISSION_MODULES: PermissionModule[] = [
  {
    key: 'invoicing',
    label: 'Invoicing',
    actions: [
      { key: 'view',   label: 'View Invoices',   description: 'See invoice list and details' },
      { key: 'create', label: 'Create Invoices',  description: 'Create new sale/purchase invoices' },
      { key: 'edit',   label: 'Edit Invoices',    description: 'Modify saved invoices' },
      { key: 'delete', label: 'Delete Invoices',  description: 'Delete invoices permanently' },
      { key: 'share',  label: 'Share Invoices',   description: 'Share via WhatsApp / email / print' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory',
    actions: [
      { key: 'view',         label: 'View Stock',      description: 'See product list and stock levels' },
      { key: 'create',       label: 'Add Products',    description: 'Create new products' },
      { key: 'edit',         label: 'Edit Products',   description: 'Modify product details and pricing' },
      { key: 'delete',       label: 'Delete Products', description: 'Remove products from inventory' },
      { key: 'adjustStock',  label: 'Adjust Stock',    description: 'Manual stock in / stock out entries' },
    ],
  },
  {
    key: 'payments',
    label: 'Payments',
    actions: [
      { key: 'view',   label: 'View Payments',    description: 'See payment history and outstanding' },
      { key: 'record', label: 'Record Payment',   description: 'Add incoming or outgoing payments' },
      { key: 'edit',   label: 'Edit Payment',     description: 'Modify saved payment records' },
      { key: 'delete', label: 'Delete Payment',   description: 'Remove payment records' },
    ],
  },
  {
    key: 'parties',
    label: 'Parties',
    actions: [
      { key: 'view',    label: 'View Parties',       description: 'See customer and supplier list' },
      { key: 'create',  label: 'Add Parties',         description: 'Create new customers or suppliers' },
      { key: 'edit',    label: 'Edit Parties',        description: 'Modify party details' },
      { key: 'delete',  label: 'Delete Parties',      description: 'Remove parties' },
      { key: 'import',  label: 'Import Contacts',     description: 'Bulk import from phone contacts' },
    ],
  },
  {
    key: 'reports',
    label: 'Reports',
    actions: [
      { key: 'view',     label: 'View Reports',      description: 'Access sales, purchase and stock reports' },
      { key: 'download', label: 'Download Reports',  description: 'Export reports as PDF or Excel' },
      { key: 'share',    label: 'Share Reports',     description: 'Share reports via WhatsApp / email' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    actions: [
      { key: 'view',        label: 'View Settings',    description: 'See app and business settings' },
      { key: 'modify',      label: 'Modify Settings',  description: 'Change app and business configuration' },
      { key: 'manageStaff', label: 'Manage Staff',     description: 'Invite, suspend or remove staff members' },
    ],
  },
  {
    key: 'fields',
    label: 'Sensitive Fields',
    actions: [
      { key: 'viewPurchasePrice',   label: 'View Purchase Price',    description: 'See cost price of products' },
      { key: 'viewProfitMargin',    label: 'View Profit Margin',     description: 'See gross margin on sales' },
      { key: 'viewPartyPhone',      label: 'View Party Phone',       description: 'See customer / supplier phone numbers' },
      { key: 'viewPartyOutstanding',label: 'View Party Outstanding', description: 'See how much a party owes or is owed' },
    ],
  },
]

// ─── System Roles ─────────────────────────────────────────────────────────────

export const SYSTEM_ROLE_NAMES = ['Owner', 'Manager', 'Billing Staff', 'Viewer'] as const

export type SystemRoleName = (typeof SYSTEM_ROLE_NAMES)[number]

// ─── Approval Type Labels ─────────────────────────────────────────────────────

export const APPROVAL_TYPE_LABELS: Record<ApprovalType, string> = {
  EDIT_LOCKED_TRANSACTION: 'Edit Locked Transaction',
  DELETE_TRANSACTION:      'Delete Transaction',
  PRICE_OVERRIDE:          'Price Override',
  DISCOUNT_OVERRIDE:       'Discount Override',
}

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING:  'Pending',
  APPROVED: 'Approved',
  DENIED:   'Denied',
  EXPIRED:  'Expired',
}

export const APPROVAL_STATUS_COLORS: Record<ApprovalStatus, string> = {
  PENDING:  'var(--color-warning-600)',
  APPROVED: 'var(--color-success-600)',
  DENIED:   'var(--color-error-600)',
  EXPIRED:  'var(--color-neutral-400)',
}

// ─── Audit Log Labels ─────────────────────────────────────────────────────────

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  CREATE:            'Created',
  UPDATE:            'Updated',
  DELETE:            'Deleted',
  RESTORE:           'Restored',
  LOCK_OVERRIDE:     'Lock Overridden',
  PIN_RESET:         'PIN Reset',
  ROLE_CHANGE:       'Role Changed',
  APPROVAL_REQUEST:  'Approval Requested',
  APPROVAL_RESPONSE: 'Approval Responded',
}

export const AUDIT_ACTION_ICONS: Record<AuditAction, string> = {
  CREATE:            'Plus',
  UPDATE:            'Pencil',
  DELETE:            'Trash2',
  RESTORE:           'RotateCcw',
  LOCK_OVERRIDE:     'LockOpen',
  PIN_RESET:         'KeyRound',
  ROLE_CHANGE:       'UserCog',
  APPROVAL_REQUEST:  'ClipboardCheck',
  APPROVAL_RESPONSE: 'MessageSquare',
}

export const AUDIT_ACTION_COLORS: Record<AuditAction, string> = {
  CREATE:            'var(--color-success-600)',
  UPDATE:            'var(--color-primary-600)',
  DELETE:            'var(--color-error-600)',
  RESTORE:           'var(--color-success-500)',
  LOCK_OVERRIDE:     'var(--color-warning-600)',
  PIN_RESET:         'var(--color-warning-500)',
  ROLE_CHANGE:       'var(--color-primary-500)',
  APPROVAL_REQUEST:  'var(--color-neutral-600)',
  APPROVAL_RESPONSE: 'var(--color-neutral-500)',
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  INVOICE: 'Invoice',
  PAYMENT: 'Payment',
  PRODUCT: 'Product',
  PARTY:   'Party',
  ROLE:    'Role',
  SETTING: 'Setting',
}

// ─── Date Format Labels ───────────────────────────────────────────────────────

export const DATE_FORMAT_LABELS: Record<DateFormat, string> = {
  'DD/MM/YYYY': '14/03/2026',
  'MM/DD/YYYY': '03/14/2026',
  'YYYY-MM-DD': '2026-03-14',
}

export const DATE_FORMATS: DateFormat[] = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']

// ─── Staff Status Labels ──────────────────────────────────────────────────────

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  ACTIVE:    'Active',
  SUSPENDED: 'Suspended',
  PENDING:   'Pending',
}

export const STAFF_STATUS_COLORS: Record<StaffStatus, string> = {
  ACTIVE:    'var(--color-success-600)',
  SUSPENDED: 'var(--color-error-600)',
  PENDING:   'var(--color-warning-600)',
}

// ─── Lock Period Options ──────────────────────────────────────────────────────

export const LOCK_PERIOD_OPTIONS = [
  { value: null, label: 'Never' },
  { value: 7,    label: '7 days' },
  { value: 15,   label: '15 days' },
  { value: 30,   label: '30 days' },
] as const

// ─── PIN Constants ────────────────────────────────────────────────────────────

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 6
export const PIN_MAX_ATTEMPTS = 5
export const PIN_LOCKOUT_MINUTES = 30

/** Common weak PINs rejected on entry */
export const WEAK_PINS: string[] = [
  '1234', '0000', '1111', '2222', '3333',
  '4444', '5555', '6666', '7777', '8888',
  '9999', '4321', '1122', '2580',
]

// ─── Calculator ───────────────────────────────────────────────────────────────

export const GST_RATES = [5, 12, 18, 28] as const

export type GstRate = (typeof GST_RATES)[number]

export const CALCULATOR_MAX_DIGITS = 15
export const CALCULATOR_MAX_HISTORY = 10

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

export const DEFAULT_SHORTCUTS: Record<string, ShortcutConfig> = {
  'billing.newInvoice':   { key: 'n',      ctrl: true,  label: 'New Invoice' },
  'billing.save':         { key: 's',      ctrl: true,  label: 'Save' },
  'billing.print':        { key: 'p',      ctrl: true,  label: 'Print' },
  'billing.addLineItem':  { key: 'Enter',               label: 'Add Line Item' },
  'billing.nextField':    { key: 'Tab',                 label: 'Next Field' },
  'billing.cancel':       { key: 'Escape',              label: 'Cancel / Close' },
  'global.search':        { key: 'k',      ctrl: true,  label: 'Search' },
  'global.calculator':    { key: '.',      ctrl: true,  label: 'Toggle Calculator' },
  'navigation.dashboard': { key: '1',      alt: true,   label: 'Go to Dashboard' },
  'navigation.invoices':  { key: '2',      alt: true,   label: 'Go to Invoices' },
  'navigation.parties':   { key: '3',      alt: true,   label: 'Go to Parties' },
  'navigation.inventory': { key: '4',      alt: true,   label: 'Go to Inventory' },
  'navigation.reports':   { key: '5',      alt: true,   label: 'Go to Reports' },
}

export const SHORTCUT_GROUPS: { id: ShortcutGroup; label: string }[] = [
  { id: 'billing',    label: 'Billing' },
  { id: 'navigation', label: 'Navigation' },
]

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
        id: 'date-format',
        label: 'Date Format',
        description: 'How dates are shown throughout the app',
        icon: 'Calendar',
        type: 'select',
      },
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

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_APP_SETTINGS = {
  dateFormat:          'DD/MM/YYYY' as const,
  pinEnabled:          false,
  biometricEnabled:    false,
  operationPinSet:     false,
  calculatorPosition:  'BOTTOM_RIGHT' as const,
  language:            'en',
  theme:               'light' as const,
}

export const DEFAULT_TRANSACTION_LOCK_CONFIG = {
  lockAfterDays:                 null,
  requireApprovalForEdit:        false,
  requireApprovalForDelete:      false,
  priceChangeThresholdPercent:   null,
  discountThresholdPercent:      null,
  operationPinSet:               false,
}
