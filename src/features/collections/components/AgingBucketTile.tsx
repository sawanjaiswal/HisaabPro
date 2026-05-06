/**
 * AgingBucketTile — severity-tier card for one aging bucket.
 * Colored accent bar on top edge, big tabular amount, hover lift.
 */

import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { formatPaise } from '@/lib/format'
import type { AgingBucket, BucketSummary } from '../collections.types'
import '../styles/aging.css'

interface Props {
  bucket: AgingBucket
  summary: BucketSummary
  drillDownPath: string
  partyLabel: string
  partiesLabel: string
}

const BUCKET_CLASS: Record<AgingBucket, string> = {
  current:   'aging-tile--current',
  bucket_31: 'aging-tile--31',
  bucket_61: 'aging-tile--61',
  bucket_91: 'aging-tile--91',
}

const PARAM_MAP: Record<AgingBucket, string> = {
  current:   'current',
  bucket_31: '31',
  bucket_61: '61',
  bucket_91: '91',
}

export function AgingBucketTile({ bucket, summary, drillDownPath, partyLabel, partiesLabel }: Props) {
  const navigate = useNavigate()
  const cls = BUCKET_CLASS[bucket]
  const param = PARAM_MAP[bucket]

  const handleClick = () => {
    navigate(drillDownPath.replace(':bucket', param))
  }

  const partyCount = summary.partyCount
  const partyText = partyCount === 1 ? partyLabel : partiesLabel

  return (
    <button
      type="button"
      className={`aging-tile ${cls}`}
      onClick={handleClick}
      aria-label={`${summary.label}: ${formatPaise(summary.totalAmount)}, ${partyCount} ${partyText}`}
    >
      <span className="aging-tile__label">{summary.label}</span>
      <span className="aging-tile__amount">{formatPaise(summary.totalAmount)}</span>
      <div className="aging-tile__footer">
        <span className="aging-tile__meta">
          {partyCount} {partyText}
        </span>
        <ChevronRight size={14} className="aging-tile__chevron" aria-hidden="true" />
      </div>
    </button>
  )
}
