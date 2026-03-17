import type { PermissionModule } from './settings.types'

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
