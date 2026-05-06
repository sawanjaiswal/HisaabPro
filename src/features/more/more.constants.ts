import { ROUTES } from '@/config/routes.config'
import type { NavKey } from '@/config/verticals.config'

export interface MoreMenuItem {
  id: string
  /** Stable navigation key used by useVertical() to filter per-business-type. */
  navKey: NavKey
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
  // Services vertical — Jobs (only shown for service verticals via isNavVisible)
  { id: 'jobs', navKey: 'jobs', label: 'Jobs', description: 'Work orders & tracking', icon: 'Briefcase', route: ROUTES.JOBS, color: 'var(--color-primary-50)', group: 'efficiency' },

  // Bakery / tailor vertical — Custom Orders (only shown for those verticals via isNavVisible)
  { id: 'orders', navKey: 'orders', label: 'Custom Orders', description: 'Track orders & advances', icon: 'ShoppingBag', route: ROUTES.ORDERS, color: 'var(--color-secondary-50)', group: 'efficiency' },

  // Efficiency — save time, do more
  { id: 'bill-scan', navKey: 'bill-scan', label: 'Scan Bill', description: 'OCR scan to invoice', icon: 'Camera', route: ROUTES.BILL_SCAN, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'recurring', navKey: 'recurring', label: 'Recurring', description: 'Auto-repeat invoices', icon: 'Repeat', route: ROUTES.RECURRING, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'templates', navKey: 'templates', label: 'Templates', description: 'Invoice designs', icon: 'FileText', route: ROUTES.TEMPLATES, color: 'var(--color-primary-50)', group: 'efficiency' },
  { id: 'data-import', navKey: 'data-import', label: 'Import Data', description: 'From Vyapar, Tally', icon: 'Upload', route: ROUTES.DATA_IMPORT, color: 'var(--color-secondary-50)', group: 'efficiency' },
  { id: 'items-library', navKey: 'items-library', label: 'Items Library', description: '67+ ready items', icon: 'BookOpen', route: ROUTES.ITEMS_LIBRARY, color: 'var(--color-primary-50)', group: 'efficiency' },

  // Money & Payments
  { id: 'payments', navKey: 'payments', label: 'Payments', description: 'Record & track', icon: 'Banknote', route: ROUTES.PAYMENTS, color: 'var(--color-success-50)', group: 'money' },
  { id: 'outstanding', navKey: 'outstanding', label: 'Outstanding', description: 'Who owes what', icon: 'Clock', route: ROUTES.OUTSTANDING, color: 'var(--color-warning-50)', group: 'money' },
  { id: 'expenses', navKey: 'expenses', label: 'Expenses', description: 'Track spending', icon: 'Receipt', route: ROUTES.EXPENSES, color: 'var(--color-error-50)', group: 'money' },
  { id: 'other-income', navKey: 'other-income', label: 'Income', description: 'Non-sales income', icon: 'PiggyBank', route: ROUTES.OTHER_INCOME, color: 'var(--color-success-50)', group: 'money' },
  { id: 'loans', navKey: 'loans', label: 'Loans', description: 'Given & taken', icon: 'HandCoins', route: ROUTES.LOANS, color: 'var(--color-secondary-50)', group: 'money' },
  { id: 'cheques', navKey: 'cheques', label: 'Cheques', description: 'Track cheques', icon: 'FileCheck', route: ROUTES.CHEQUES, color: 'var(--color-warning-50)', group: 'money' },
  { id: 'bank', navKey: 'bank', label: 'Bank', description: 'Bank accounts', icon: 'Landmark', route: ROUTES.BANK_ACCOUNTS, color: 'var(--color-primary-50)', group: 'money' },

  // Accounting & Tax
  { id: 'reports', navKey: 'reports', label: 'Reports', description: 'Sales, stock, P&L', icon: 'BarChart3', route: ROUTES.REPORTS, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'accounting', navKey: 'accounting', label: 'Accounts', description: 'Chart of accounts', icon: 'BookOpen', route: ROUTES.CHART_OF_ACCOUNTS, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'gst', navKey: 'gst', label: 'GST', description: 'Reconciliation', icon: 'IndianRupee', route: ROUTES.GST_RECONCILIATION, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'products', navKey: 'products', label: 'Items', description: 'Inventory & stock', icon: 'Package', route: ROUTES.PRODUCTS, color: 'var(--color-primary-50)', group: 'accounting' },
  { id: 'stock-count', navKey: 'stock-count', label: 'Stock Count', description: 'Count & verify physical stock', icon: 'Boxes', route: ROUTES.INVENTORY_VERIFY, color: 'var(--color-secondary-50)', group: 'accounting' },
  { id: 'stock-value-report', navKey: 'stock-value-report', label: 'Stock Value', description: 'Total stock value at cost', icon: 'TrendingUp', route: ROUTES.STOCK_VALUE_REPORT, color: 'var(--color-success-50)', group: 'accounting' },

  // Marketing & CRM
  { id: 'greetings', navKey: 'greetings', label: 'Greetings', description: 'Festival wishes', icon: 'MessageCircleHeart', route: ROUTES.SMART_GREETINGS, color: 'var(--color-secondary-50)', group: 'marketing' },
  { id: 'bulk-import', navKey: 'bulk-import', label: 'Import Parties', description: 'From contacts/CSV', icon: 'Users', route: ROUTES.BULK_IMPORT_PARTIES, color: 'var(--color-primary-50)', group: 'marketing' },

  // Tools & Settings
  { id: 'settings', navKey: 'settings', label: 'Settings', description: 'App preferences', icon: 'Settings', route: ROUTES.SETTINGS, color: 'var(--color-gray-100)', group: 'tools' },
]
