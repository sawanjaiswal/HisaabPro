/** Aging report — one party row (<md).
 *
 * Mockup #66: avatar · name over the oldest-bucket caption · total on the
 * right with a status pill under it. The bucket grid takes over at ≥md.
 */

import { Badge } from '@/components/ui/Badge'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '@/lib/format'
import type { AgingRow as AgingRowData } from '../../finance.types'
import type { RealAgingBucket } from '../aging.types'
import { BUCKET_BADGE } from '../aging.types'
import { bucketAmount, worstBucket } from '../aging.utils'

interface AgingRowProps {
  row: AgingRowData
  /** Bucket labels, already translated, keyed by bucket. */
  bucketLabels: Record<RealAgingBucket, string>
  onClick?: () => void
}

export function AgingRow({ row, bucketLabels, onClick }: AgingRowProps) {
  const oldest = worstBucket(row)

  return (
    <Button
      variant="none"
      type="button"
      className="aging-row"
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${row.partyName} ${formatPaise(row.total)}`}
    >
      <PartyAvatar name={row.partyName} size="sm" />

      <span className="aging-row__info">
        <span className="aging-row__name">{row.partyName}</span>
        {oldest && (
          <span className="aging-row__sub tabular-nums">
            {bucketLabels[oldest]} · {formatPaise(bucketAmount(row, oldest))}
          </span>
        )}
      </span>

      <span className="aging-row__right">
        <span className="aging-row__amount tabular-nums">{formatPaise(row.total)}</span>
        {oldest && (
          <Badge variant={BUCKET_BADGE[oldest]} className="aging-row__badge">
            {bucketLabels[oldest]}
          </Badge>
        )}
      </span>
    </Button>
  )
}
