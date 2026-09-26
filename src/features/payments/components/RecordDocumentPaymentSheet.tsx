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
import { formatPaise } from '@/utils/currency'
import type { PaymentMode, PaymentType } from '../payment.types'
import { Banknote, QrCode, Building2, FileCheck } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  documentId: string
  documentNumber: string
  party: { id: string; name: string; phone?: string | null }
  balanceDue: number // in integer paise
  grandTotal: number // in integer paise
  type?: PaymentType // 'PAYMENT_IN' | 'PAYMENT_OUT'
  onSuccess?: () => void
}

const PAYMENT_MODES: Array<{ mode: PaymentMode; label: string; icon: React.ComponentType<{ size: number }> }> = [
  { mode: 'CASH', label: 'Cash', icon: Banknote },
  { mode: 'UPI', label: 'UPI / QR', icon: QrCode },
  { mode: 'BANK_TRANSFER', label: 'Bank', icon: Building2 },
  { mode: 'CHEQUE', label: 'Cheque', icon: FileCheck },
]

export function RecordDocumentPaymentSheet({
  open,
  onClose,
  documentId,
  documentNumber,
  party,
  balanceDue,
  grandTotal,
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
      // Default to the full remaining balance in standard rupee units
      const defaultAmount = balanceDue > 0 ? (balanceDue / 100).toString() : '0'
      setAmountRupees(defaultAmount)
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
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: [
          {
            invoiceId: documentId,
            amount: amountPaise,
          },
        ],
      })

      // Level 6 Cache Invalidation
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(documentId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.payments.all() })
      queryClient.invalidateQueries({ queryKey: queryKeys.parties.detail(party.id) }) // ssot-allow: reconcile party react-query cache after a mutation

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
            <div className="text-xs text-[var(--color-text-muted)] font-medium">
              Invoice #{documentNumber}
            </div>
            <div className="text-sm font-bold text-[var(--color-text-primary)]">
              {party.name}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--color-text-muted)] font-medium">
              Balance Due
            </div>
            <div className="text-sm font-bold text-[var(--color-error-600,#DC2626)]">
              {formatPaise(balanceDue)}
            </div>
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label htmlFor={amountInputId} className="input-label">
            Payment Amount (₹) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-[var(--color-text-muted)]">
              ₹
            </span>
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

        {/* Quick Amount Chips */}
        {balanceDue > 0 && (
          <div className="flex gap-2">
            <Button
              type="button"
              variant="none"
              className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] font-medium"
              onClick={() => setAmountRupees((balanceDue / 100).toString())}
            >
              Full Balance ({formatPaise(balanceDue)})
            </Button>
            {balanceDue >= 200 && (
              <Button
                type="button"
                variant="none"
                className="text-xs px-2.5 py-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] font-medium"
                onClick={() => setAmountRupees((Math.round(balanceDue / 200)).toString())}
              >
                50% ({formatPaise(Math.round(balanceDue / 2))})
              </Button>
            )}
          </div>
        )}

        {/* Payment Mode Selection */}
        <div>
          <label className="input-label">Payment Mode</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {PAYMENT_MODES.map((item) => {
              const isSelected = mode === item.mode
              const Icon = item.icon
              return (
                <button
                  key={item.mode}
                  type="button"
                  onClick={() => setMode(item.mode)}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[#026F39] bg-[#026F39]/10 text-[#026F39] font-bold shadow-sm'
                      : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="text-xs mt-1">{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Date Field */}
        <div>
          <DateField
            label="Payment Date"
            value={date}
            onChange={(val) => setDate(val)}
            required
          />
        </div>

        {/* Reference Number */}
        <div>
          <label htmlFor={refInputId} className="input-label">
            Reference / Transaction No. (Optional)
          </label>
          <Input
            id={refInputId}
            type="text"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            placeholder="e.g. UPI Ref / UTR / Cheque No."
          />
        </div>

        {/* Notes */}
        <div>
          <Textarea
            label="Notes / Remarks (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add payment notes..."
            rows={2}
          />
        </div>

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
