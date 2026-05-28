/** #147 MatchRow — one staged bank line + its reconciliation actions. */
import { ArrowDownLeft, ArrowUpRight, Check, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { formatCurrency } from '@/lib/format'
import { confidenceColor } from '../bank-reconciliation.constants'
import type { ReconLine } from '../bank-reconciliation.types'

interface Props {
  line: ReconLine
  onConfirm: (id: string) => void
  onIgnore: (id: string) => void
  onUnreconcile: (id: string) => void
}

export function MatchRow({ line, onConfirm, onIgnore, onUnreconcile }: Props) {
  const { t } = useLanguage()
  const isCredit = line.direction === 'CREDIT'
  const date = new Date(line.txnDate).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  })

  return (
    <div className="recon-row">
      <div className="recon-row__icon" data-dir={line.direction}>
        {isCredit ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
      </div>

      <div className="recon-row__body">
        <div className="recon-row__top">
          <span className="recon-row__desc">{line.description || (isCredit ? t.bankReconCredit : t.bankReconDebit)}</span>
          <span className="recon-row__amount tabular-nums" data-dir={line.direction}>
            {formatCurrency(line.amount)}
          </span>
        </div>
        <div className="recon-row__meta">
          <span>{date}</span>
          {line.referenceNumber && <span>· {line.referenceNumber}</span>}
          {line.status !== 'MATCHED' && line.confidence > 0 && (
            <span style={{ color: confidenceColor(line.confidence) }}>
              · {t.bankReconConfidence} {line.confidence}%
            </span>
          )}
        </div>
      </div>

      <div className="recon-row__actions">
        {line.status === 'SUGGESTED' && (
          <>
            <Button variant="primary" size="sm" onClick={() => onConfirm(line.id)} aria-label={t.bankReconConfirm}>
              <Check size={16} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onIgnore(line.id)} aria-label={t.bankReconIgnore}>
              <X size={16} />
            </Button>
          </>
        )}
        {line.status === 'UNMATCHED' && (
          <Button variant="ghost" size="sm" onClick={() => onIgnore(line.id)} aria-label={t.bankReconIgnore}>
            <X size={16} />
          </Button>
        )}
        {line.status === 'MATCHED' && (
          <Button variant="ghost" size="sm" onClick={() => onUnreconcile(line.id)} aria-label={t.bankReconUnreconcile}>
            <RotateCcw size={16} />
          </Button>
        )}
      </div>
    </div>
  )
}
