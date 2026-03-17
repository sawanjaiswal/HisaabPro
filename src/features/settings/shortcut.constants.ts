import type { ShortcutConfig, ShortcutGroup } from './settings.types'

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
