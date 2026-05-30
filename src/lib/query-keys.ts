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
    ledger: (id: string, params: Filters) => ['parties', 'ledger', id, params] as const,
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
    customFieldDefs: (docType: string) => ['invoices', 'custom-field-defs', docType] as const,
    customFieldValues: (id: string) => ['invoices', 'custom-field-values', id] as const,
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
    pending: () => ['expenses', 'pending'] as const,
    templates: () => ['expenses', 'templates'] as const,
    budgets: (month: string) => ['expenses', 'budgets', month] as const,
    trend: (months: number) => ['expenses', 'trend', months] as const,
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
    detail: (id: string) => ['recurring', 'detail', id] as const,
    runs: (id: string, cursor?: string) => ['recurring', 'runs', id, cursor] as const,
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
    documents: () => ['settings', 'documents'] as const,
    documentCustomFields: () => ['settings', 'document-custom-fields'] as const,
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
  stockAlerts: {
    all: () => ['stock-alerts'] as const,
    list: (status?: string) => ['stock-alerts', 'list', status ?? 'OPEN'] as const,
  },
  stockValueReport: {
    list: (filters?: Record<string, string>) => ['stock-value-report', filters] as const,
  },
  pos: {
    products: (filters: Filters) => ['pos-products', filters] as const,
    sales:    (filters: Filters) => ['pos-sales',    filters] as const,
    sale:     (id: string)       => ['pos-sale-detail', id]  as const,
  },
  // Epic D / CRM #127 — tag aggregate + follow-up queue (architecture §3.5)
  crm: {
    all: () => ['crm'] as const,
    tags: () => ['crm', 'tags'] as const,
    followUps: (filters: Filters) => ['crm', 'follow-ups', filters] as const,
  },
  // Epic D / Loyalty #125 — program (tenant-singleton) + per-party balance/ledger
  loyalty: {
    all: () => ['loyalty'] as const,
    program: () => ['loyalty', 'program'] as const,
    balance: (partyId: string) => ['loyalty', 'balance', partyId] as const,
    ledger: (partyId: string) => ['loyalty', 'ledger', partyId] as const,
  },
  // V2 Appointments — calendar list (by date range) + per-id detail.
  // Reads are network-only; no `cacheReads`. Mutations invalidate `all`.
  appointments: {
    all: () => ['appointments'] as const,
    list: (filters: Filters) => ['appointments', 'list', filters] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
  },
  // Epic D / Commission #128 — rules, per-staff ledger, monthly leaderboard
  commission: {
    all: () => ['commission'] as const,
    rules: (filters: Filters) => ['commission', 'rules', filters] as const,
    rule: (id: string) => ['commission', 'rule', id] as const,
    ledger: (filters: Filters) => ['commission', 'ledger', filters] as const,
    leaderboard: (filters: Filters) => ['commission', 'leaderboard', filters] as const,
  },
} as const
