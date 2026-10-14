/** RecordAdvanceModal — form to record an advance payment against an order */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { X } from 'lucide-react'
import { useRecordAdvance } from '../hooks/useRecordAdvance'
import { ADVANCE_METHODS } from '../custom-orders.constants'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/context/LanguageContext'
import { Heading } from '@/components/ui/Heading'

interface RecordAdvanceModalProps {
  orderId: string
  orderTitle: string
  onClose: () => void
}

export function RecordAdvanceModal({ orderId, orderTitle, onClose }: RecordAdvanceModalProps) {
  const { t } = useLanguage()
  const METHOD_LABELS: Record<string, string> = {
    cash:   t.coMethodCash,
    upi:    t.coMethodUpi,
    bank:   t.coMethodBank,
    cheque: t.coMethodCheque,
    card:   t.coMethodCard,
    other:  t.coMethodOther,
  }
  const [amountRs, setAmountRs] = useState('')
  const [method, setMethod] = useState<string>('cash')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const { mutate, isPending } = useRecordAdvance()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(amountRs)
    if (!amountRs || isNaN(amt) || amt <= 0) {
      setError(t.coErrValidAmount)
      return
    }
    const amountPaise = Math.round(amt * 100)
    mutate(
      {
        orderId,
        title: orderTitle,
        data: {
          amountPaise,
          method: method as 'cash' | 'upi' | 'bank' | 'cheque' | 'card' | 'other',
          reference: reference.trim() || null,
          notes: notes.trim() || null,
        },
      },
      { onSuccess: onClose },
    )
  }

  return (
    <div
      role="dialog"
      aria-label={t.coRecordAdvanceAria}
      aria-modal="true"
      className="fixed inset-0 z-[var(--z-modal)] flex items-end bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[480px] mx-auto bg-[var(--color-surface)] rounded-t-2xl p-5 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <Heading level={2} className="m-0 text-base font-bold text-[var(--color-text)]">
            {t.coRecordAdvance}
          </Heading>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label={t.close} className="min-h-[44px] min-w-[44px]">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="adv-amount">{t.coAmountRequired} *</label>
            <Input
              id="adv-amount"
              type="number"
              className="input"
              value={amountRs}
              onChange={(e) => { setAmountRs(e.target.value); setError('') }}
              placeholder="0.00"
              min="0"
              step="0.01"
              aria-required="true"
              aria-invalid={Boolean(error)}
            />
            {error && <span className="field-error" role="alert">{error}</span>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="adv-method">{t.coPaymentMethod}</label>
            <Select value={method} onValueChange={setMethod} ariaLabel={t.coPaymentMethod}>
              {ADVANCE_METHODS.map((m) => (
                <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="adv-ref">{t.coReference}</label>
            <Input
              id="adv-ref"
              type="text"
              className="input"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={t.coReferencePlaceholder}
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label" htmlFor="adv-notes">{t.coNotesOptional}</label>
            <Input
              id="adv-notes"
              type="text"
              className="input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
            />
          </div>

          <Button
            type="submit"
            variant="primary" size="lg"
            disabled={isPending}
            className="min-h-[48px] w-full"
          >
            {isPending ? t.coRecording : t.coRecordAdvance}
          </Button>
        </form>
      </div>
    </div>
  )
}
