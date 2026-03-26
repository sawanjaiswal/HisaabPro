import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import {
  CHEQUE_STATUS_LABELS,
  CHEQUE_STATUS_COLORS,
  CHEQUE_STATUS_BG,
  CHEQUE_TYPE_LABELS,
} from '../cheque.constants'
import type { Cheque, ChequeStatus } from '../cheque.types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ChequeCardProps {
  cheque: Cheque
  onStatusUpdate: (id: string, status: ChequeStatus) => void
}

export function ChequeCard({ cheque, onStatusUpdate }: ChequeCardProps) {
  const { t } = useLanguage()

  return (
    <div className="cheque-card" role="article" aria-label={`${t.chequeAriaLabel} #${cheque.chequeNumber}`}>
      <div className="cheque-card__header">
        <div>
          <div className="cheque-card__number">
            #{cheque.chequeNumber}
            <span className="cheque-card__type-badge cheque-card__type-badge--inline">
              {CHEQUE_TYPE_LABELS[cheque.type]}
            </span>
          </div>
          <div className="cheque-card__bank">{cheque.bankName}</div>
        </div>
        <span
          className="cheque-card__status-badge"
          style={{ background: CHEQUE_STATUS_BG[cheque.status], color: CHEQUE_STATUS_COLORS[cheque.status] }}
        >
          {CHEQUE_STATUS_LABELS[cheque.status]}
        </span>
      </div>
      <div className="cheque-card__footer">
        <span className="cheque-card__party">{cheque.partyName ?? '—'}</span>
        <div className="cheque-card__amount-col">
          <span className="cheque-card__amount">{formatPaise(cheque.amount)}</span>
          <span className="cheque-card__date">{formatDate(cheque.chequeDate)}</span>
        </div>
      </div>
      {cheque.status === 'PENDING' && (
        <div className="cheque-card__actions">
          <button
            type="button"
            className="cheque-card__action-btn"
            onClick={() => onStatusUpdate(cheque.id, 'CLEARED')}
            aria-label={t.markChequeCleared}
          >
            {t.markCleared}
          </button>
          <button
            type="button"
            className="cheque-card__action-btn cheque-card__action-btn--danger"
            onClick={() => onStatusUpdate(cheque.id, 'BOUNCED')}
            aria-label={t.markChequeBounced}
          >
            {t.markBounced}
          </button>
        </div>
      )}
    </div>
  )
}
