/** Payment Details Section — shared between Record & Edit pages
 *
 * Level 6 HisaabPro Fintech Transaction Form:
 * - Rich Party Card with Avatar, Name & Live Balance
 * - Hero Currency Amount Card with prominent tabular digits
 * - Iconic 2x4 Payment Mode selector with emerald active state
 * - Clean Date, Reference & Notes cards with responsive touch targets
 */

import React from 'react'
import {
  Wallet,
  QrCode,
  Building2,
  CheckSquare,
  ArrowLeftRight,
  CreditCard,
  MoreHorizontal,
  Calendar,
  Hash,
  FileText,
  IndianRupee,
} from 'lucide-react'
import { PartySearchInput } from '@/components/ui/PartySearch'
import { useLanguage } from '@/hooks/useLanguage'
import { PAYMENT_MODE_LABELS, MODES_WITH_REFERENCE } from '../payment.constants'
import { getReferencePlaceholder } from '../payment.utils'
import type { PaymentMode } from '../payment.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { Button } from '@/components/ui/Button'

const PAYMENT_MODES: PaymentMode[] = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
]

const MODE_ICONS: Record<PaymentMode, React.ComponentType<{ className?: string }>> = {
  CASH: Wallet,
  UPI: QrCode,
  BANK_TRANSFER: Building2,
  CHEQUE: CheckSquare,
  NEFT_RTGS_IMPS: ArrowLeftRight,
  CREDIT_CARD: CreditCard,
  OTHER: MoreHorizontal,
}

interface PaymentDetailsSectionProps {
  partyId: string
  amount: number
  date: string
  mode: PaymentMode
  referenceNumber: string
  notes: string
  errors: Record<string, string>
  onPartyChange: (id: string) => void
  onAmountChange: (paise: number) => void
  onDateChange: (date: string) => void
  onModeChange: (mode: PaymentMode) => void
  onReferenceChange: (ref: string) => void
  onNotesChange: (notes: string) => void
}

export function PaymentDetailsSection({
  partyId,
  amount,
  date,
  mode,
  referenceNumber,
  notes,
  errors,
  onPartyChange,
  onAmountChange,
  onDateChange,
  onModeChange,
  onReferenceChange,
  onNotesChange,
}: PaymentDetailsSectionProps) {
  const { t } = useLanguage()
  const showReference = MODES_WITH_REFERENCE.includes(mode)

  return (
    <div className="space-y-4">
      {/* 1. Party Selector Card */}
      <div
        className="p-4 rounded-[var(--radius-xl)] border transition-all"
        style={{
          backgroundColor: 'var(--color-gray-0)',
          borderColor: errors.partyId ? 'var(--color-error-400)' : 'var(--color-gray-200)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} />
      </div>

      {/* 2. Hero Amount Card */}
      <div
        className="p-4 sm:p-5 rounded-[var(--radius-xl)] border transition-all space-y-2"
        style={{
          backgroundColor: 'var(--color-gray-0)',
          borderColor: errors.amount ? 'var(--color-error-400)' : 'var(--color-gray-200)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <label
          className="block text-[var(--fs-xs)] font-semibold uppercase tracking-wider select-none"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor="payment-amount"
        >
          {t.amountRequired}
        </label>

        <div
          className="flex items-center gap-3 px-4 py-2.5 rounded-[var(--radius-lg)] border transition-all"
          style={{ backgroundColor: 'var(--color-gray-50)', borderColor: 'var(--color-gray-200)' }}
        >
          <div
            className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] flex-shrink-0 select-none"
            style={{
              backgroundColor: 'var(--color-primary-bg-subtle)',
              color: 'var(--color-primary-600)',
            }}
          >
            <IndianRupee className="w-5 h-5" strokeWidth={2.5} />
          </div>

          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            className="w-full bg-transparent border-0 text-[var(--fs-3xl)] font-bold placeholder:text-[var(--color-gray-300)] focus:ring-0 focus:outline-none tabular-nums p-0 shadow-none"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-primary)' }}
            value={amount > 0 ? (amount / 100).toFixed(2) : ''}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value || '0')
              const paise = Math.round(parsed * 100)
              onAmountChange(paise)
            }}
            aria-label={t.paymentAmountRupees}
          />
        </div>

        {errors.amount && (
          <span className="block text-[var(--fs-xs)] font-medium mt-1" style={{ color: 'var(--color-error-600)' }} role="alert">
            {errors.amount}
          </span>
        )}
      </div>

      {/* 3. Payment Mode Selector Card */}
      <div
        className="p-4 rounded-[var(--radius-xl)] border transition-all space-y-3"
        style={{
          backgroundColor: 'var(--color-gray-0)',
          borderColor: errors.mode ? 'var(--color-error-400)' : 'var(--color-gray-200)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <label className="block text-[var(--fs-xs)] font-semibold uppercase tracking-wider select-none" style={{ color: 'var(--text-secondary)' }}>
          {t.paymentModeRequired}
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" role="radiogroup" aria-label={t.paymentModeAriaLabel}>
          {PAYMENT_MODES.map((m) => {
            const isSelected = mode === m
            const Icon = MODE_ICONS[m]
            return (
              <Button
                key={m}
                type="button"
                variant="none"
                className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-lg)] border transition-all text-left min-h-[48px] cursor-pointer"
                style={{
                  backgroundColor: isSelected ? 'var(--color-primary-bg-subtle)' : 'var(--color-gray-0)',
                  borderColor: isSelected ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
                  color: isSelected ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? '0 0 0 1px var(--color-primary-500)' : 'none',
                }}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-[var(--radius-md)] flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: isSelected ? 'var(--color-primary-500)' : 'var(--color-gray-100)',
                    color: isSelected ? 'var(--color-gray-0)' : 'var(--color-gray-600)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[var(--fs-xs)] font-semibold truncate leading-tight">
                  {PAYMENT_MODE_LABELS[m]}
                </span>
              </Button>
            )
          })}
        </div>

        {errors.mode && (
          <span className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">
            {errors.mode}
          </span>
        )}
      </div>

      {/* 4. Date & Reference Number Card */}
      <div
        className="p-4 rounded-[var(--radius-xl)] border transition-all space-y-3.5"
        style={{ backgroundColor: 'var(--color-gray-0)', borderColor: 'var(--color-gray-200)', boxShadow: 'var(--shadow-xs)' }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[var(--fs-xs)] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }} htmlFor="payment-date">
              <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
              {t.dateRequired}
            </label>
            <DateField id="payment-date" type="date" className="input w-full" value={date} onChange={(e) => onDateChange(e.target.value)} aria-label={t.paymentDate2} />
            {errors.date && <span className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">{errors.date}</span>}
          </div>

          {showReference && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[var(--fs-xs)] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }} htmlFor="payment-ref">
                <Hash className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
                {t.referenceNumberLabel}
              </label>
              <Input id="payment-ref" type="text" className="input w-full" placeholder={getReferencePlaceholder(mode)} value={referenceNumber} onChange={(e) => onReferenceChange(e.target.value)} aria-label={t.referenceNumberAria} maxLength={100} />
              {errors.referenceNumber && <span className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">{errors.referenceNumber}</span>}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-1.5 text-[var(--fs-xs)] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }} htmlFor="payment-notes">
            <FileText className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
            {t.notesLabel}
          </label>
          <Textarea id="payment-notes" className="input w-full" rows={2} placeholder={t.addPaymentNote} value={notes} onChange={(e) => onNotesChange(e.target.value)} aria-label={t.paymentNotesAria} aria-invalid={errors.notes ? true : undefined} aria-describedby={errors.notes ? 'payment-notes-error' : undefined} maxLength={500} />
          {errors.notes && <span id="payment-notes-error" className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">{errors.notes}</span>}
        </div>
      </div>
    </div>
  )
}
