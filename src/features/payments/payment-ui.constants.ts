/** Payment UI — aging bucket labels and CSS variable references. */

// ─── Aging bucket labels ──────────────────────────────────────────────────────

export const AGING_BUCKET_LABELS = {
  current:    'Current',
  days1to30:  '1–30 Days',
  days31to60: '31–60 Days',
  days61to90: '61–90 Days',
  days90plus: '90+ Days',
} as const

// ─── Aging bucket CSS variable references ────────────────────────────────────
// Defined as CSS variable strings so components never use raw hex.

export const AGING_BUCKET_COLORS = {
  current:    'var(--color-success-500)',
  days1to30:  'var(--color-secondary-300)',
  days31to60: 'var(--color-warning-500)',
  days61to90: 'var(--color-error-500)',
  days90plus: 'var(--color-error-700)',
} as const
