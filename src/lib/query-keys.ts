/**
 * Query key factory -- SSOT for cache keys.
 * Business switch does full page reload, so no businessId scoping needed.
 */

/** Accept any object as filter key -- avoids TS2345 with typed filter interfaces */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Filters = Record<string, any>

export const queryKeys = {
  parties: {
    all: () => ['parties'] as const,
    list: (filters: Filters) => ['parties', 'list', filters] as const,
    detail: (id: string) => ['parties', 'detail', id] as const,
    groups: () => ['parties', 'groups'] as const,
    customFields: () => ['parties', 'custom-fields'] as const,
    transactions: (id: string, filters: Filters) => ['parties', 'transactions', id, filters] as const,
  },
  products: {
    all: () => ['products'] as const,
    list: (filters: Filters) => ['products', 'list', filters] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    categories: () => ['products', 'categories'] as const,
  },
  invoices: {
    all: () => ['invoices'] as const,
    list: (filters: Filters) => ['invoices', 'list', filters] as const,
    detail: (id: string) => ['invoices', 'detail', id] as const,
    nextNumber: (type: string) => ['invoices', 'next-number', type] as const,
  },
  payments: {
    all: () => ['payments'] as const,
    list: (filters: Filters) => ['payments', 'list', filters] as const,
    detail: (id: string) => ['payments', 'detail', id] as const,
    outstanding: (partyId?: string) => ['payments', 'outstanding', partyId] as const,
    reminders: (filters: Filters) => ['payments', 'reminders', filters] as const,
  },
  expenses: {
    all: () => ['expenses'] as const,
    list: (filters: Filters) => ['expenses', 'list', filters] as const,
    categories: () => ['expenses', 'categories'] as const,
  },
  units: {
    all: () => ['units'] as const,
    list: () => ['units', 'list'] as const,
    conversions: () => ['units', 'conversions'] as const,
  },
  batches: {
    all: () => ['batches'] as const,
    list: (filters: Filters) => ['batches', 'list', filters] as const,
  },
  serialNumbers: {
    all: () => ['serial-numbers'] as const,
    list: (filters: Filters) => ['serial-numbers', 'list', filters] as const,
    lookup: (serial: string) => ['serial-numbers', 'lookup', serial] as const,
  },
  godowns: {
    all: () => ['godowns'] as const,
    list: () => ['godowns', 'list'] as const,
    stock: (id: string) => ['godowns', 'stock', id] as const,
  },
  stockVerification: {
    all: () => ['stock-verification'] as const,
    list: () => ['stock-verification', 'list'] as const,
    detail: (id: string) => ['stock-verification', 'detail', id] as const,
  },
  accounting: {
    all: () => ['accounting'] as const,
    chart: () => ['accounting', 'chart'] as const,
    journals: (filters: Filters) => ['accounting', 'journals', filters] as const,
    trialBalance: (filters: Filters) => ['accounting', 'trial-balance', filters] as const,
  },
  bankAccounts: {
    all: () => ['bank-accounts'] as const,
    list: () => ['bank-accounts', 'list'] as const,
  },
  cheques: {
    all: () => ['cheques'] as const,
    list: (filters: Filters) => ['cheques', 'list', filters] as const,
  },
  loans: {
    all: () => ['loans'] as const,
    list: (filters: Filters) => ['loans', 'list', filters] as const,
  },
  otherIncome: {
    all: () => ['other-income'] as const,
    list: (filters: Filters) => ['other-income', 'list', filters] as const,
  },
  recurring: {
    all: () => ['recurring'] as const,
    list: (filters: Filters) => ['recurring', 'list', filters] as const,
  },
  templates: {
    all: () => ['templates'] as const,
    list: () => ['templates', 'list'] as const,
  },
  reports: {
    dayBook: (filters: Filters) => ['reports', 'day-book', filters] as const,
    stockSummary: (filters: Filters) => ['reports', 'stock-summary', filters] as const,
    partyStatement: (partyId: string, filters: Filters) => ['reports', 'party-statement', partyId, filters] as const,
    gstReturns: (filters: Filters) => ['reports', 'gst-returns', filters] as const,
    taxSummary: (filters: Filters) => ['reports', 'tax-summary', filters] as const,
    invoiceReport: (filters: Filters) => ['reports', 'invoice-report', filters] as const,
    paymentHistory: (filters: Filters) => ['reports', 'payment-history', filters] as const,
    tdsTcs: (filters: Filters) => ['reports', 'tds-tcs', filters] as const,
  },
  dashboard: {
    all: () => ['dashboard'] as const,
    summary: () => ['dashboard', 'summary'] as const,
  },
  settings: {
    all: () => ['settings'] as const,
    roles: () => ['settings', 'roles'] as const,
    staff: () => ['settings', 'staff'] as const,
    auditLog: (filters: Filters) => ['settings', 'audit-log', filters] as const,
    app: () => ['settings', 'app'] as const,
    currency: () => ['settings', 'currency'] as const,
    transactionControls: () => ['settings', 'transaction-controls'] as const,
  },
  tax: {
    all: () => ['tax'] as const,
    categories: () => ['tax', 'categories'] as const,
    detail: (id: string) => ['tax', 'detail', id] as const,
    hsn: (query: string) => ['tax', 'hsn', query] as const,
  },
  gstReconciliation: {
    all: () => ['gst-reconciliation'] as const,
    list: (filters: Filters) => ['gst-reconciliation', 'list', filters] as const,
    detail: (id: string) => ['gst-reconciliation', 'detail', id] as const,
  },
  itemsLibrary: {
    list: (filters: Filters) => ['items-library', 'list', filters] as const,
  },
  coupons: {
    all: () => ['coupons'] as const,
    list: (filters: Filters) => ['coupons', 'list', filters] as const,
  },
  user: {
    me: () => ['user', 'me'] as const,
    businesses: () => ['user', 'businesses'] as const,
  },
} as const
