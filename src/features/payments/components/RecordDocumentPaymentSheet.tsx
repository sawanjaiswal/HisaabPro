/** Record Document Payment — TaskFrame bottom sheet for in-place payment logging.
 *
 * Level 6 Axiom: Sub-Task Containment.
 * Mounts directly inside InvoiceDetailPage / PurchaseDetailPage without navigating away.
 * Records partial or full payment in integer paise and links the PaymentAllocation row.
 */

import React, { useState, useEffect, useId } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/hooks/useToast'
import { useLanguage } from '@/hooks/useLanguage'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { createPayment } from '../payment-crud.service'
import { formatPaise } from '@/lib/format'
import { invalidatePartyLists } from '@/features/parties/party-cache'
import { PaymentModeSelector } from './PaymentModeSelector'
import type { PaymentMode, PaymentType } from '../payment.types'

interface Props {
  open: boolean
  onClose: () => void
  documentId: string
  documentNumber: string
  party: { id: string; name: string; phone?: string | null }
  balanceDue: number // in integer paise
  grandTotal?: number // in integer paise
  type?: PaymentType // 'PAYMENT_IN' | 'PAYMENT_OUT'
  onSuccess?: () => void
}

export function RecordDocumentPaymentSheet({
  open,
  onClose,
  documentId,
  documentNumber,
  party,
  balanceDue,
  type = 'PAYMENT_IN',
  onSuccess,
}: Props) {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const amountInputId = useId()
  const refInputId = useId()

  const [amountRupees, setAmountRupees] = useState('')
  const [mode, setMode] = useState<PaymentMode>('CASH')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [referenceNumber, setReferenceNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setAmountRupees(balanceDue > 0 ? (balanceDue / 100).toString() : '0')
      setMode('CASH')
      setDate(new Date().toISOString().split('T')[0])
      setReferenceNumber('')
      setNotes('')
      setError(null)
      setIsSubmitting(false)
    }
  }, [open, balanceDue])

  const amountPaise = Math.round((parseFloat(amountRupees) || 0) * 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (amountPaise <= 0) {
      setError('Please enter a valid payment amount greater than zero.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await createPayment({
        type,
        partyId: party.id,
        amount: amountPaise,
        date,
        mode,
        referenceNumber: referenceNumber.trim(),
        notes: notes.trim(),
        allocations: [{
          invoiceId: documentId,
          invoiceNumber: documentNumber,
          invoiceDue: balanceDue,
          amount: amountPaise,
          selected: true,
        }],
        discount: null,
      })

      // Level 6 Cache Invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(documentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      invalidatePartyLists(queryClient)

      toast.success(
        type === 'PAYMENT_IN'
          ? `Received ${formatPaise(amountPaise)} for #${documentNumber}`
          : `Paid ${formatPaise(amountPaise)} for #${documentNumber}`,
      )

      onSuccess?.()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = type === 'PAYMENT_IN' ? t.recordPayment || 'Record Payment In' : 'Record Payment Out'

  return (
    <Drawer open={open} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="space-y-4 p-4">
        {/* Document & Party Header Summary */}
        <div className="bg-[var(--color-surface-subtle,#F8FAFC)] dark:bg-[var(--color-gray-100,#1E293B)] p-3 rounded-xl border border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="text-xs text-[var(--color-text-muted)] font-medium">Invoice #{documentNumber}</div>
            <div className="text-sm font-bold text-[var(--color-text-primary)]">{party.name}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--color-text-muted)] font-medium">Balance Due</div>
            <div className="text-sm font-bold text-[var(--color-error-600,#DC2626)]">{formatPaise(balanceDue)}</div>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor={amountInputId} className="input-label">
            Payment Amount (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-[var(--color-text-muted)]">₹</span>
            <Input
              id={amountInputId}
              type="number"
              step="any"
              min="0.01"
              value={amountRupees}
              onChange={(e) => {
                setAmountRupees(e.target.value)
                setError(null)
              }}
              className="pl-8 text-lg font-bold"
              placeholder="0.00"
              required
              autoFocus
            />
          </div>
          {amountPaise > balanceDue && (
            <div className="text-xs text-[var(--color-warning-600)] mt-1 font-medium">
              Note: Entered amount ({formatPaise(amountPaise)}) exceeds balance due ({formatPaise(balanceDue)}).
            </div>
          )}
        </div>

        {/* Payment Mode Selector & Quick Chips */}
        <PaymentModeSelector
          mode={mode}
          onSelectMode={setMode}
          balanceDue={balanceDue}
          onSetAmount={setAmountRupees}
        />

        {/* Date Field */}
        <DateField
          label="Payment Date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />

        {/* Reference Number */}
        <div>
          <label htmlFor={refInputId} className="input-label">Reference / Transaction No. (Optional)</label>
          <Input
            id={refInputId}
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. UPI Ref / UTR / Cheque No."
          />
        </div>

        {/* Notes */}
        <Textarea
          label="Notes / Remarks (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add payment notes..."
          rows={2}
        />

        {error && (
          <div className="text-xs text-[var(--color-error-600)] bg-[var(--color-error-50,#FEF2F2)] p-2.5 rounded-lg border border-[var(--color-error-200)]">
            {error}
          </div>
        )}

        {/* Action CTA */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="none"
            loading={isSubmitting}
            disabled={isSubmitting || amountPaise <= 0}
            className="w-full bg-[#026F39] hover:bg-[#014D27] active:scale-[0.99] text-white font-bold py-3 rounded-xl shadow-md text-base transition-all flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Recording Payment...' : `Record ${formatPaise(amountPaise)} Payment`}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}
