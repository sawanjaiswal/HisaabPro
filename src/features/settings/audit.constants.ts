import type { AuditAction } from './audit.types'

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
  // Phase 6 PR4
  SUSPEND_FIRM:      'Firm Suspended',
  REACTIVATE_FIRM:   'Firm Reactivated',
  FINALIZE:          'Finalized',
  REVERSE:           'Reversed',
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
  SUSPEND_FIRM:      'Pause',
  REACTIVATE_FIRM:   'Play',
  FINALIZE:          'CheckCircle2',
  REVERSE:           'Undo2',
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
  SUSPEND_FIRM:      'var(--color-warning-600)',
  REACTIVATE_FIRM:   'var(--color-success-600)',
  FINALIZE:          'var(--color-primary-600)',
  REVERSE:           'var(--color-error-500)',
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  INVOICE:  'Invoice',
  PAYMENT:  'Payment',
  PRODUCT:  'Product',
  PARTY:    'Party',
  ROLE:     'Role',
  SETTING:  'Setting',
  // Phase 6 PR4 — entity types written by suspend/reactivate/payroll flows
  Business: 'Business',
  Payroll:  'Payroll',
  Employee: 'Employee',
  PinSetup: 'PIN Setup',
}

/** Default page size for cursor-paginated search. Server caps at 100. */
export const AUDIT_PAGE_SIZE = 20

/** Debounce delay (ms) for the search-query text input. */
export const AUDIT_SEARCH_DEBOUNCE_MS = 300
