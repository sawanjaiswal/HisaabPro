import { describe, it, expect } from 'vitest'
import {
  formatPermissionKey,
  parsePermissionKey,
  getPermissionCount,
} from '../settings-permission.utils'

// ─── formatPermissionKey ──────────────────────────────────────────────────────

describe('formatPermissionKey', () => {
  it('builds dot-separated key', () => {
    expect(formatPermissionKey('invoicing', 'view')).toBe('invoicing.view')
  })

  it('handles multi-word module', () => {
    expect(formatPermissionKey('party-management', 'create')).toBe('party-management.create')
  })
})

// ─── parsePermissionKey ───────────────────────────────────────────────────────

describe('parsePermissionKey', () => {
  it('splits dot-separated key', () => {
    expect(parsePermissionKey('invoicing.view')).toEqual({ module: 'invoicing', action: 'view' })
  })

  it('handles key without dot', () => {
    expect(parsePermissionKey('invoicing')).toEqual({ module: 'invoicing', action: '' })
  })

  it('handles multiple dots (only splits on first)', () => {
    expect(parsePermissionKey('a.b.c')).toEqual({ module: 'a', action: 'b.c' })
  })
})

// ─── getPermissionCount ───────────────────────────────────────────────────────

describe('getPermissionCount', () => {
  it('counts granted permissions for a module', () => {
    const permissions = ['invoicing.view', 'invoicing.create', 'payments.view']
    expect(getPermissionCount(permissions, 'invoicing', 4)).toEqual({ granted: 2, total: 4 })
  })

  it('returns 0 granted when no matching permissions', () => {
    expect(getPermissionCount([], 'invoicing', 4)).toEqual({ granted: 0, total: 4 })
  })

  it('does not count partial module name matches', () => {
    const permissions = ['invoice.view', 'invoicing.view']
    expect(getPermissionCount(permissions, 'invoicing', 4)).toEqual({ granted: 1, total: 4 })
  })
})
