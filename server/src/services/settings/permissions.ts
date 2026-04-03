/**
 * Permissions — PERMISSION_MATRIX, system roles, ensureSystemRoles
 */

import { prisma } from '../../lib/prisma.js'

// === Permission Matrix (static) ===

const PERMISSION_MATRIX = [
  {
    key: 'invoicing', label: 'Invoicing',
    actions: [
      { key: 'view', label: 'View Invoices' },
      { key: 'create', label: 'Create Invoices' },
      { key: 'edit', label: 'Edit Invoices' },
      { key: 'delete', label: 'Delete Invoices' },
      { key: 'share', label: 'Share Invoices' },
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
    key: 'reports', label: 'Reports',
    actions: [
      { key: 'view', label: 'View Reports' },
      { key: 'download', label: 'Download Reports' },
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
    key: 'settings', label: 'Settings',
    actions: [
      { key: 'view', label: 'View Settings' },
      { key: 'modify', label: 'Modify Settings' },
      { key: 'manageStaff', label: 'Manage Staff' },
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
]

export function getPermissionMatrix() {
  return { modules: PERMISSION_MATRIX }
}

// === System Roles (lazy-seeded per business) ===

export const ALL_PERMISSIONS = PERMISSION_MATRIX.flatMap(m =>
  m.actions.map(a => `${m.key}.${a.key}`)
)

export const VALID_PERMISSIONS = new Set(ALL_PERMISSIONS)

const SYSTEM_ROLES: Array<{
  name: string; isSystem: boolean; priority: number
  permissions: string[]; isDefault?: boolean
}> = [
  {
    name: 'Owner',
    isSystem: true,
    priority: 100,
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Partner',
    isSystem: true,
    priority: 90,
    permissions: ALL_PERMISSIONS.filter(p => p !== 'settings.manageStaff'),
  },
  {
    name: 'Manager',
    isSystem: true,
    priority: 70,
    permissions: ALL_PERMISSIONS.filter(p =>
      !['settings.manageStaff', 'settings.modify'].includes(p)
    ),
  },
  {
    name: 'Salesman',
    isSystem: true,
    priority: 50,
    permissions: [
      'invoicing.view', 'invoicing.create', 'invoicing.edit', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'reports.view',
      'fields.viewPartyPhone',
    ],
  },
  {
    name: 'Cashier',
    isSystem: true,
    priority: 40,
    permissions: [
      'payments.view', 'payments.record',
      'parties.view',
      'invoicing.view',
      'fields.viewPartyPhone', 'fields.viewPartyOutstanding',
    ],
  },
  {
    name: 'Stock Manager',
    isSystem: true,
    priority: 50,
    permissions: [
      'inventory.view', 'inventory.create', 'inventory.edit', 'inventory.adjustStock',
      'invoicing.view',
      'parties.view',
      'reports.view',
      'fields.viewPurchasePrice',
    ],
  },
  {
    name: 'Delivery Boy',
    isSystem: true,
    priority: 30,
    permissions: [
      'invoicing.view', 'invoicing.share',
      'parties.view',
      'payments.view', 'payments.record',
      'fields.viewPartyPhone',
    ],
  },
  {
    name: 'Accountant',
    isSystem: true,
    isDefault: true,
    priority: 60,
    permissions: [
      'invoicing.view',
      'inventory.view',
      'payments.view',
      'parties.view',
      'reports.view', 'reports.download',
      'accounting.view', 'accounting.create', 'accounting.edit',
      'fields.viewPurchasePrice', 'fields.viewProfitMargin',
      'fields.viewPartyOutstanding',
    ],
  },
]

export async function ensureSystemRoles(businessId: string) {
  const existing = await prisma.role.count({ where: { businessId, isSystem: true } })
  if (existing >= SYSTEM_ROLES.length) return

  for (const role of SYSTEM_ROLES) {
    await prisma.role.upsert({
      where: { businessId_name: { businessId, name: role.name } },
      create: {
        businessId,
        name: role.name,
        isSystem: true,
        isDefault: role.isDefault ?? false,
        priority: role.priority,
        permissions: role.permissions,
      },
      update: {},
    })
  }
}
