/** RecurringTemplateCard — Single recurring template row with edit/delete actions */

import { useState } from 'react'
import { Repeat, Edit2, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { deleteTemplate } from '../services/recurring.service'
import { formatPaise } from '@/lib/format'
import type { RecurringTemplate } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'
import { Button } from '@/components/ui/Button'

interface RecurringTemplateCardProps {
  template: RecurringTemplate
  onEdit: (t: RecurringTemplate) => void
  onDeleted: () => void
}

const FREQ_LABELS: Record<string, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
}

export function RecurringTemplateCard({ template, onEdit, onDeleted }: RecurringTemplateCardProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [deleting, setDeleting] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  const label = template.notes ?? template.categoryName ?? 'Expense'

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteTemplate(template.id, label)
      toast.success('Recurring expense deleted')
      onDeleted()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not delete'
      toast.error(msg)
      setConfirmDel(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <article className="recurring-card" aria-label={`Recurring: ${label}`}>
      <div className="recurring-card__icon" aria-hidden="true">
        <Repeat size={18} />
      </div>
      <div className="recurring-card__info">
        <p className="recurring-card__name">{label}</p>
        <p className="recurring-card__meta">
          {FREQ_LABELS[template.frequency] ?? template.frequency}
          {' · '}
          Next: {new Date(template.nextRunDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
        {template.categoryName && (
          <p className="recurring-card__category">{template.categoryName}</p>
        )}
      </div>
      <div className="recurring-card__right">
        <p className="recurring-card__amount">{formatPaise(template.amountPaise)}</p>
        <div className="recurring-card__actions">
          <Button variant="none"
            type="button"
            className="recurring-card__btn recurring-card__btn--edit"
            onClick={() => onEdit(template)}
            aria-label={`Edit ${label}`}
          >
            <Edit2 size={14} />
          </Button>
          {confirmDel ? (
            <Button variant="none"
              type="button"
              className="recurring-card__btn recurring-card__btn--danger"
              onClick={handleDelete}
              disabled={deleting}
              aria-busy={deleting}
              aria-label="Confirm delete"
            >
              {deleting ? '…' : <Trash2 size={14} />}
            </Button>
          ) : (
            <Button variant="none"
              type="button"
              className="recurring-card__btn recurring-card__btn--del"
              onClick={() => setConfirmDel(true)}
              aria-label={`Delete ${label}`}
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
      {confirmDel && !deleting && (
        <div className="recurring-card__confirm-bar" role="status">
          <span>Delete this recurring expense?</span>
          <Button variant="none" type="button" className="btn-ghost-sm" onClick={() => setConfirmDel(false)}>
            {t.cancel ?? 'Cancel'}
          </Button>
        </div>
      )}
    </article>
  )
}

export function RecurringCardSkeleton() {
  return (
    <div className="recurring-card recurring-card--skeleton" aria-busy="true">
      <div className="recurring-card__icon recurring-card__skel-circle" />
      <div className="recurring-card__info">
        <div className="recurring-card__skel-line" style={{ width: '8rem' }} />
        <div className="recurring-card__skel-line" style={{ width: '6rem', marginTop: '0.25rem' }} />
      </div>
      <div className="recurring-card__right">
        <div className="recurring-card__skel-line" style={{ width: '4rem' }} />
      </div>
    </div>
  )
}
