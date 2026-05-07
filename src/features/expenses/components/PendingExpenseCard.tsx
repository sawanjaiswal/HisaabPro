/** PendingExpenseCard — Confirm or skip a recurring-generated pending expense */

import { useState } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { confirmExpense, skipExpense } from '../expense.service'
import { formatPaise } from '@/lib/format'
import type { PendingExpenseItem } from '../expense.types'
import { useLanguage } from '@/hooks/useLanguage'

interface PendingExpenseCardProps {
  item: PendingExpenseItem
  onDone: () => void
}

export function PendingExpenseCard({ item, onDone }: PendingExpenseCardProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const busy = confirming || skipping

  const label = item.notes ?? item.categoryName ?? 'Expense'

  async function handleConfirm() {
    if (busy) return
    setConfirming(true)
    try {
      await confirmExpense(item.id, label)
      toast.success(t.expensesPendingConfirmAction ?? 'Expense confirmed')
      onDone()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not confirm. Try again.'
      toast.error(msg)
    } finally {
      setConfirming(false)
    }
  }

  async function handleSkip() {
    if (busy) return
    setSkipping(true)
    try {
      await skipExpense(item.id, label)
      toast.success(t.expensesPendingSkipAction ?? 'Expense skipped')
      onDone()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not skip. Try again.'
      toast.error(msg)
    } finally {
      setSkipping(false)
    }
  }

  return (
    <article className="pending-card" aria-label={`Pending expense: ${label}`}>
      <div className="pending-card__icon" aria-hidden="true">
        <Clock size={18} />
      </div>
      <div className="pending-card__info">
        <p className="pending-card__name">{item.categoryName ?? 'Uncategorised'}</p>
        {item.notes && <p className="pending-card__notes">{item.notes}</p>}
        <p className="pending-card__date">{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
      </div>
      <div className="pending-card__right">
        <p className="pending-card__amount">{formatPaise(item.amount)}</p>
        <div className="pending-card__actions">
          <button
            type="button"
            className="pending-card__btn pending-card__btn--confirm"
            onClick={handleConfirm}
            disabled={busy}
            aria-busy={confirming}
            aria-label={t.expensesPendingConfirmAction ?? 'Confirm'}
          >
            {confirming ? '…' : <Check size={14} />}
          </button>
          <button
            type="button"
            className="pending-card__btn pending-card__btn--skip"
            onClick={handleSkip}
            disabled={busy}
            aria-busy={skipping}
            aria-label={t.expensesPendingSkipAction ?? 'Skip'}
          >
            {skipping ? '…' : <X size={14} />}
          </button>
        </div>
      </div>
    </article>
  )
}

export function PendingCardSkeleton() {
  return (
    <div className="pending-card pending-card--skeleton" aria-busy="true" aria-label="Loading pending expense">
      <div className="pending-card__icon pending-card__skel-block pending-card__skel-circle" />
      <div className="pending-card__info">
        <div className="pending-card__skel-block" style={{ width: '7rem', height: '0.875rem' }} />
        <div className="pending-card__skel-block" style={{ width: '5rem', height: '0.75rem', marginTop: '0.25rem' }} />
      </div>
      <div className="pending-card__right">
        <div className="pending-card__skel-block" style={{ width: '4rem', height: '1rem' }} />
      </div>
    </div>
  )
}
