/** 2026 Ultra-Modern Fintech Payment Screen
 *
 * Design Language:
 * - Center-staged Hero Amount display (Apple Pay / Revolut / Linear style)
 * - Sleek floating Party Island with live balance pill
 * - Modern 2026 Segmented Mode Pill Chips with clean micro-icons
 * - iOS/macOS grouped metadata card (Date, Reference, Notes)
 * - Floating glass bottom action bar
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
import { formatRupees } from '@/lib/format'

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

  const quickAmounts = [500, 1000, 2000, 5000]

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* ── 1. Party Floating Card ─────────────────────────────────────── */}
      <div
        className="p-3.5 rounded-[var(--radius-xl)] border transition-all"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: errors.partyId ? 'var(--color-error-400)' : 'var(--color-border)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} />
      </div>

      {/* ── 2. 2026 Hero Amount Center Stage ───────────────────────────── */}
      <div
        className="py-6 px-4 rounded-[var(--radius-2xl)] border text-center transition-all relative overflow-hidden"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: errors.amount ? 'var(--color-error-400)' : 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Subtle Ambient Glow */}
        <div
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 rounded-full blur-2xl opacity-15 pointer-events-none"
          style={{ backgroundColor: 'var(--color-primary-500)' }}
        />

        <p
          className="text-[var(--fs-xs)] font-bold uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t.amountRequired}
        </p>

        {/* Center-staged Amount Display */}
        <div className="flex items-center justify-center gap-1.5 my-2">
          <span
            className="text-[2.5rem] sm:text-[3rem] font-bold select-none leading-none"
            style={{ color: 'var(--color-primary-600)' }}
          >
            ₹
          </span>
          <input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0"
            className="w-48 sm:w-64 bg-transparent border-0 text-center text-[2.75rem] sm:text-[3.25rem] font-black focus:outline-none tabular-nums p-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-primary)',
              letterSpacing: '-0.03em',
            }}
            value={amount > 0 ? (amount / 100).toFixed(2) : ''}
            onChange={(e) => {
              const parsed = parseFloat(e.target.value || '0')
              const paise = Math.round(parsed * 100)
              onAmountChange(paise)
            }}
            aria-label={t.paymentAmountRupees}
          />
        </div>

        {/* Quick Amount Suggestion Chips */}
        <div className="flex items-center justify-center gap-1.5 mt-3 flex-wrap">
          {quickAmounts.map((q) => (
            <Button
              key={q}
              type="button"
              variant="none"
              onClick={() => onAmountChange(q * 100)}
              className="px-2.5 py-1 rounded-full text-[var(--fs-xs)] font-semibold border transition-all hover:scale-105 active:scale-95 cursor-pointer"
              style={{
                backgroundColor: 'var(--color-gray-50)',
                borderColor: 'var(--color-gray-200)',
                color: 'var(--text-secondary)',
              }}
            >
              +{formatRupees(q * 100)}
            </Button>
          ))}
        </div>

        {errors.amount && (
          <span className="block text-[var(--fs-xs)] font-medium mt-2" style={{ color: 'var(--color-error-600)' }} role="alert">
            {errors.amount}
          </span>
        )}
      </div>

      {/* ── 3. Modern Segmented Payment Mode Pills ──────────────────────── */}
      <div
        className="p-3.5 rounded-[var(--radius-xl)] border space-y-2.5"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: errors.mode ? 'var(--color-error-400)' : 'var(--color-border)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <p
          className="text-[var(--fs-xs)] font-bold uppercase tracking-wider select-none px-0.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t.paymentModeRequired}
        </p>

        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label={t.paymentModeAriaLabel}>
          {PAYMENT_MODES.map((m) => {
            const isSelected = mode === m
            const Icon = MODE_ICONS[m]
            return (
              <Button
                key={m}
                type="button"
                variant="none"
                className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-[var(--radius-lg)] border transition-all text-center min-h-[58px] cursor-pointer active:scale-95"
                style={{
                  backgroundColor: isSelected ? 'var(--color-primary-bg-subtle)' : 'var(--color-gray-50)',
                  borderColor: isSelected ? 'var(--color-primary-500)' : 'transparent',
                  color: isSelected ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? '0 0 0 1px var(--color-primary-500)' : 'none',
                }}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-full transition-all"
                  style={{
                    backgroundColor: isSelected ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
                    color: isSelected ? 'var(--color-gray-0)' : 'var(--color-gray-700)',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold truncate max-w-full leading-tight">
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

      {/* ── 4. Compact Grouped Metadata Card ───────────────────────────── */}
      <div
        className="p-3.5 rounded-[var(--radius-xl)] border space-y-3"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-xs)',
        }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Date */}
          <div className="space-y-1">
            <label
              className="flex items-center gap-1.5 text-[var(--fs-xs)] font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
              htmlFor="payment-date"
            >
              <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
              {t.dateRequired}
            </label>
            <DateField id="payment-date" type="date" className="input w-full" value={date} onChange={(e) => onDateChange(e.target.value)} aria-label={t.paymentDate2} />
            {errors.date && <span className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">{errors.date}</span>}
          </div>

          {/* Reference */}
          {showReference && (
            <div className="space-y-1">
              <label
                className="flex items-center gap-1.5 text-[var(--fs-xs)] font-bold uppercase tracking-wider"
                style={{ color: 'var(--text-secondary)' }}
                htmlFor="payment-ref"
              >
                <Hash className="w-3.5 h-3.5 text-[var(--color-primary-500)]" />
                {t.referenceNumberLabel}
              </label>
              <Input id="payment-ref" type="text" className="input w-full" placeholder={getReferencePlaceholder(mode)} value={referenceNumber} onChange={(e) => onReferenceChange(e.target.value)} aria-label={t.referenceNumberAria} maxLength={100} />
              {errors.referenceNumber && <span className="block text-[var(--fs-xs)] font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">{errors.referenceNumber}</span>}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          <label
            className="flex items-center gap-1.5 text-[var(--fs-xs)] font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
            htmlFor="payment-notes"
          >
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
