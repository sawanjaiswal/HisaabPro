import { ROUTES } from '@/config/routes.config'

export interface MoreMenuItem {
  id: string
  label: string
  description: string
  icon: string
  route: string
  color: string
  group: string
}

export interface MoreMenuGroup {
  id: string
  label: string
  emoji: string
}

export const MORE_MENU_GROUPS: MoreMenuGroup[] = [
  { id: 'efficiency', label: 'Efficiency', emoji: '\u26A1' },
  { id: 'money', label: 'Money & Payments', emoji: '\uD83D\uDCB0' },
  { id: 'accounting', label: 'Accounting & Tax', emoji: '\uD83D\uDCCA' },
  { id: 'marketing', label: 'Marketing & CRM', emoji: '\uD83D\uDCE3' },
  { id: 'tools', label: 'Tools & Settings', emoji: '\u2699\uFE0F' },
]

export const MORE_MENU_ITEMS: MoreMenuItem[] = [
  // Efficiency — save time, do more
  { id: 'bill-scan', label: 'Scan Bill', description: 'OCR scan to invoice', icon: 'Camera', route: ROUTES.BILL_SCAN, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'recurring', label: 'Recurring', description: 'Auto-repeat invoices', icon: 'Repeat', route: ROUTES.RECURRING, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'templates', label: 'Templates', description: 'Invoice designs', icon: 'FileText', route: ROUTES.TEMPLATES, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'data-import', label: 'Import Data', description: 'From Vyapar, Tally', icon: 'Upload', route: ROUTES.DATA_IMPORT, color: 'var(--color-secondary-50)', group: 'efficiency' },
  { id: 'items-library', label: 'Items Library', description: '67+ ready items', icon: 'BookOpen', route: ROUTES.ITEMS_LIBRARY, color: 'var(--color-primary-50)', group: 'efficiency' },

  // Money & Payments
  { id: 'payments', label: 'Payments', description: 'Record & track', icon: 'Banknote', route: ROUTES.PAYMENTS, color: 'var(--color-success-50)', group: 'money' },
  { id: 'outstanding', label: 'Outstanding', description: 'Who owes what', icon: 'Clock', route: ROUTES.OUTSTANDING, color: 'var(--color-warning-50)', group: 'money' },
  { id: 'expenses', label: 'Expenses', description: 'Track spending', icon: 'Receipt', route: ROUTES.EXPENSES, color: 'var(--color-error-50)', group: 'money' },
  { id: 'other-income', label: 'Income', description: 'Non-sales income', icon: 'PiggyBank', route: ROUTES.OTHER_INCOME, color: 'var(--color-success-50)', group: 'money' },
  { id: 'loans', label: 'Loans', description: 'Given & taken', icon: 'HandCoins', route: ROUTES.LOANS, color: 'var(--color-secondary-50)', group: 'money' },
  { id: 'cheques', label: 'Cheques', description: 'Track cheques', icon: 'FileCheck', route: ROUTES.CHEQUES, color: 'var(--color-warning-50)', group: 'money' },
  { id: 'bank', label: 'Bank', description: 'Bank accounts', icon: 'Landmark', route: ROUTES.BANK_ACCOUNTS, color: 'var(--color-primary-50)', group: 'money' },

  // Accounting & Tax
  { id: 'reports', label: 'Reports', description: 'Sales, stock, P&L', icon: 'BarChart3', route: ROUTES.REPORTS, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'accounting', label: 'Accounts', description: 'Chart of accounts', icon: 'BookOpen', route: ROUTES.CHART_OF_ACCOUNTS, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'gst', label: 'GST', description: 'Reconciliation', icon: 'IndianRupee', route: ROUTES.GST_RECONCILIATION, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'products', label: 'Items', description: 'Inventory & stock', icon: 'Package', route: ROUTES.PRODUCTS, color: 'var(--color-primary-50)', group: 'accounting' },

  // Marketing & CRM
  { id: 'greetings', label: 'Greetings', description: 'Festival wishes', icon: 'MessageCircleHeart', route: ROUTES.SMART_GREETINGS, color: 'var(--color-secondary-50)', group: 'marketing' },
  { id: 'bulk-import', label: 'Import Parties', description: 'From contacts/CSV', icon: 'Users', route: ROUTES.BULK_IMPORT_PARTIES, color: 'var(--color-primary-50)', group: 'marketing' },

  // Tools & Settings
  { id: 'settings', label: 'Settings', description: 'App preferences', icon: 'Settings', route: ROUTES.SETTINGS, color: 'var(--color-gray-100)', group: 'tools' },
]
