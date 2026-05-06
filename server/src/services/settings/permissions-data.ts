/**
 * Permission matrix and system role definitions.
 * Kept separate to stay under the 250-line file limit.
 */

export const PERMISSION_MATRIX = [
  {
    key: 'invoicing', label: 'Invoicing',
    actions: [
      { key: 'view', label: 'View Invoices' },
      { key: 'create', label: 'Create Invoices' },
      { key: 'edit', label: 'Edit Invoices' },
      { key: 'delete', label: 'Delete Invoices' },
      { key: 'share', label: 'Share Invoices' },
      { key: 'export', label: 'Export Invoices' },
    ],
  },
  {
    key: 'inventory', label: 'Inventory',
    actions: [
      { key: 'view', label: 'View Products' },
      { key: 'create', label: 'Create Products' },
      { key: 'edit', label: 'Edit Products' },
      { key: 'delete', label: 'Delete Products' },
      { key: 'adjustStock', label: 'Adjust Stock' },
    ],
  },
  {
    key: 'payments', label: 'Payments',
    actions: [
      { key: 'view', label: 'View Payments' },
      { key: 'record', label: 'Record Payments' },
      { key: 'edit', label: 'Edit Payments' },
      { key: 'delete', label: 'Delete Payments' },
    ],
  },
  {
    key: 'parties', label: 'Parties',
    actions: [
      { key: 'view', label: 'View Parties' },
      { key: 'create', label: 'Create Parties' },
      { key: 'edit', label: 'Edit Parties' },
      { key: 'delete', label: 'Delete Parties' },
    ],
  },
  {
    key: 'expenses', label: 'Expenses',
    actions: [
      { key: 'view', label: 'View Expenses' },
      { key: 'create', label: 'Create Expenses' },
      { key: 'edit', label: 'Edit Expenses' },
      { key: 'delete', label: 'Delete Expenses' },
    ],
  },
  {
    key: 'banking', label: 'Banking',
    actions: [
      { key: 'view', label: 'View Bank Accounts' },
      { key: 'create', label: 'Create Bank Account' },
      { key: 'edit', label: 'Edit Bank Account' },
      { key: 'manageCheques', label: 'Manage Cheques' },
      { key: 'manageLoans', label: 'Manage Loans' },
    ],
  },
  {
    key: 'accounting', label: 'Accounting',
    actions: [
      { key: 'view', label: 'View Accounting' },
      { key: 'create', label: 'Create Entries' },
      { key: 'edit', label: 'Edit Entries' },
      { key: 'delete', label: 'Delete Entries' },
    ],
  },
  {
    key: 'godowns', label: 'Godowns',
    actions: [
      { key: 'view', label: 'View Godowns' },
      { key: 'create', label: 'Create Godown' },
      { key: 'edit', label: 'Edit Godown' },
      { key: 'transfer', label: 'Transfer Stock' },
    ],
  },
  {
    key: 'batches', label: 'Batch Tracking',
    actions: [
      { key: 'view', label: 'View Batches' },
      { key: 'create', label: 'Create Batch' },
      { key: 'edit', label: 'Edit Batch' },
    ],
  },
  {
    key: 'serials', label: 'Serial Numbers',
    actions: [
      { key: 'view', label: 'View Serials' },
      { key: 'create', label: 'Create Serial' },
      { key: 'edit', label: 'Edit Serial' },
    ],
  },
  {
    key: 'templates', label: 'Templates',
    actions: [
      { key: 'view', label: 'View Templates' },
      { key: 'create', label: 'Create Template' },
      { key: 'edit', label: 'Edit Template' },
    ],
  },
  {
    key: 'reports', label: 'Reports',
    actions: [
      { key: 'view', label: 'View Reports' },
      { key: 'download', label: 'Download Reports' },
      { key: 'export', label: 'Export Data' },
    ],
  },
  {
    key: 'settings', label: 'Settings',
    actions: [
      { key: 'view', label: 'View Settings' },
      { key: 'modify', label: 'Modify Settings' },
      { key: 'manageStaff', label: 'Manage Staff' },
      { key: 'manageRoles', label: 'Manage Roles' },
    ],
  },
  {
    key: 'fields', label: 'Sensitive Fields',
    actions: [
      { key: 'viewPurchasePrice', label: 'View Purchase Price' },
      { key: 'viewProfitMargin', label: 'View Profit Margin' },
      { key: 'viewPartyPhone', label: 'View Party Phone' },
      { key: 'viewPartyOutstanding', label: 'View Party Outstanding' },
    ],
  },
  // Phase 3 — Jobs (services vertical)
  {
    key: 'jobs', label: 'Jobs',
    actions: [
      { key: 'view',   label: 'View Jobs' },
      { key: 'create', label: 'Create Jobs' },
      { key: 'edit',   label: 'Edit Jobs' },
      { key: 'delete', label: 'Delete Jobs' },
    ],
  },
  // Phase 4 — Custom Orders (bakery / tailor vertical)
  {
    key: 'orders', label: 'Custom Orders',
    actions: [
      { key: 'view',   label: 'View Custom Orders' },
      { key: 'create', label: 'Create Custom Orders' },
      { key: 'edit',   label: 'Edit Custom Orders' },
      { key: 'delete', label: 'Delete Custom Orders' },
    ],
  },
  // Payments & Collections Hub
  {
    key: 'collections', label: 'Collections',
    actions: [
      { key: 'view',    label: 'View Collections Dashboard' },
      { key: 'remind',  label: 'Send Payment Reminders' },
      { key: 'collect', label: 'Create/Manage Payment Links' },
      { key: 'ptp',     label: 'Record and Track Payment Promises' },
    ],
  },
  // Recurring Invoices
  {
    key: 'recurring', label: 'Recurring Invoices',
    actions: [
      { key: 'view',   label: 'View Recurring Schedules' },
      { key: 'manage', label: 'Create/Edit/Delete Recurring Schedules' },
      { key: 'pause',  label: 'Pause and Resume Recurring Schedules' },
    ],
  },
]

export const ALL_PERMISSIONS = PERMISSION_MATRIX.flatMap(m =>
  m.actions.map(a => `${m.key}.${a.key}`)
)

export const VALID_PERMISSIONS = new Set(ALL_PERMISSIONS)

export const SYSTEM_ROLES: Array<{
  name: string; isSystem: boolean; priority: number
  permissions: string[]; isDefault?: boolean
}> = [
  { name: 'Owner', isSystem: true, priority: 100, permissions: ALL_PERMISSIONS },
  {
    name: 'Partner', isSystem: true, priority: 90,
    permissions: ALL_PERMISSIONS.filter(p => p !== 'settings.manageStaff'),
  },
  {
    name: 'Manager', isSystem: true, priority: 70,
    permissions: ALL_PERMISSIONS.filter(p =>
      !['settings.manageStaff', 'settings.modify', 'settings.manageRoles'].includes(p)
    ),
  },
  {
    name: 'Salesman', isSystem: true, priority: 50,
    permissions: [
      'invoicing.view', 'invoicing.create', 'invoicing.edit', 'invoicing.share',
      'parties.view', 'payments.view', 'payments.record',
      'reports.view', 'templates.view', 'fields.viewPartyPhone',
      'jobs.view', 'jobs.create', 'jobs.edit',
      // Collections: view + remind + ptp (NOT collect — no payment links)
      'collections.view', 'collections.remind', 'collections.ptp',
      // Recurring: view only
      'recurring.view',
    ],
  },
  {
    name: 'Cashier', isSystem: true, priority: 40,
    permissions: [
      'payments.view', 'payments.record', 'parties.view', 'invoicing.view',
      'fields.viewPartyPhone', 'fields.viewPartyOutstanding',
      'jobs.view',
    ],
  },
  {
    name: 'Stock Manager', isSystem: true, priority: 50,
    permissions: [
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjustStock',
      'invoicing.view', 'parties.view', 'reports.view',
      'godowns.view', 'godowns.transfer',
      'batches.view', 'batches.create', 'batches.edit',
      'serials.view', 'serials.create', 'fields.viewPurchasePrice',
    ],
  },
  {
    name: 'Delivery Boy', isSystem: true, priority: 30,
    permissions: [
      'invoicing.view', 'invoicing.share', 'parties.view',
      'payments.view', 'payments.record', 'fields.viewPartyPhone',
      'jobs.view',
    ],
  },
  {
    name: 'Accountant', isSystem: true, isDefault: true, priority: 60,
    permissions: [
      'invoicing.view', 'inventory.view', 'payments.view', 'parties.view',
      'expenses.view', 'expenses.create', 'expenses.edit',
      'banking.view', 'banking.manageCheques', 'banking.manageLoans',
      'reports.view', 'reports.download', 'reports.export',
      'accounting.view', 'accounting.create', 'accounting.edit',
      'fields.viewPurchasePrice', 'fields.viewProfitMargin', 'fields.viewPartyOutstanding',
      'jobs.view',
      // Recurring: view only
      'recurring.view',
    ],
  },
]
