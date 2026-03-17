/** GSTR-1 Reconciliation — Constants */

import type { MatchStatus, ReconStatus, ReconType } from './reconciliation.types'

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  MATCHED:          'Matched',
  MISMATCHED:       'Mismatched',
  MISSING_IN_GSTR:  'Missing in GSTR',
  EXTRA_IN_GSTR:    'Extra in GSTR',
}

/** CSS modifier suffix — maps to .recon-badge--<value> */
export const MATCH_STATUS_COLORS: Record<MatchStatus, string> = {
  MATCHED:          'success',
  MISMATCHED:       'warning',
  MISSING_IN_GSTR:  'error',
  EXTRA_IN_GSTR:    'info',
}

export const RECON_STATUS_LABELS: Record<ReconStatus, string> = {
  PENDING:    'Pending',
  PROCESSING: 'Processing',
  COMPLETED:  'Completed',
  FAILED:     'Failed',
}

export const RECON_TYPE_LABELS: Record<ReconType, string> = {
  GSTR1_VS_BOOKS: 'GSTR-1 vs Books',
}

export const RECON_PAGE_LIMIT = 20

export const MATCH_STATUS_FILTER_OPTIONS: Array<{
  value: MatchStatus | 'ALL'
  label: string
}> = [
  { value: 'ALL',             label: 'All' },
  { value: 'MATCHED',         label: 'Matched' },
  { value: 'MISMATCHED',      label: 'Mismatched' },
  { value: 'MISSING_IN_GSTR', label: 'Missing in GSTR' },
  { value: 'EXTRA_IN_GSTR',   label: 'Extra in GSTR' },
]
