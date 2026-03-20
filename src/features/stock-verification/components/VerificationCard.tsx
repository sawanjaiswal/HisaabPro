import { ClipboardCheck } from 'lucide-react'
import type { StockVerification } from '../stock-verification.types'
import { STATUS_LABELS } from '../stock-verification.constants'
import { getVerificationProgress, getStatusBadgeStyle } from '../stock-verification.utils'
import { ProgressBar } from './ProgressBar'

interface VerificationCardProps {
  verification: StockVerification
  onClick: () => void
}

export function VerificationCard({ verification, onClick }: VerificationCardProps) {
  const { percentage, label } = getVerificationProgress(verification.totalItems, verification.countedItems)
  const badgeStyle = getStatusBadgeStyle(verification.status)
  const dateStr = new Date(verification.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <button type="button" className="sv-card" onClick={onClick} aria-label={`Verification from ${dateStr}`}>
      <div className="sv-card__header">
        <div className="sv-card__icon">
          <ClipboardCheck size={18} aria-hidden="true" />
        </div>
        <span className="sv-card__badge" style={badgeStyle}>
          {STATUS_LABELS[verification.status]}
        </span>
      </div>
      <div className="sv-card__date">{dateStr}</div>
      {verification.status !== 'DRAFT' && (
        <ProgressBar percentage={percentage} label={label} />
      )}
      <div className="sv-card__stats">
        <span>{verification.totalItems} items</span>
        <span className="sv-card__dot" aria-hidden="true" />
        <span>{verification.discrepancies} discrepancies</span>
      </div>
    </button>
  )
}
