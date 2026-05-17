/**
 * Lock-period option list (split from settings.constants.ts).
 *
 * "Never" plus 7/15/30 days — used by the Transaction Lock setting card.
 */

export const LOCK_PERIOD_OPTIONS = [
  { value: null, label: 'Never' },
  { value: 7,    label: '7 days' },
  { value: 15,   label: '15 days' },
  { value: 30,   label: '30 days' },
] as const
