/** 2026 Borderless Modern Fintech Transaction Screen
 *
 * Design:
 * - Fluid, borderless modern canvas (Apple Pay / Revolut / Stripe checkout)
 * - Zero nested boundary boxes
 * - Pure typographic Hero Amount floating directly on the surface
 * - Minimalist Party Identity row
 * - Clean Segmented Mode Dock
 * - Borderless iOS-style grouped metadata rows
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
import { CurrencyInput } from '@/components/ui/CurrencyInput'
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

  const quickAmounts = [500, 1000, 2000, 5000]

  return (
    <div className="space-y-6 max-w-md mx-auto pt-1">
      {/* ── 1. Party Identity Row (Borderless) ─────────────────────────── */}
      <div className="px-1">
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} />
      </div>

      {/* ── 2. Pure Typographic Hero Amount (Canonical CurrencyInput) ──── */}
      <CurrencyInput
        id="payment-amount"
        variant="hero"
        value={amount}
        onChange={onAmountChange}
        label={t.amountRequired}
        error={errors.amount}
        quickAmounts={quickAmounts}
      />

      {/* ── 3. Borderless Mode Selector Dock ───────────────────────────── */}
      <div className="space-y-2 px-1">
        <p
          className="text-xs font-bold uppercase tracking-wider select-none px-1"
          style={{ color: 'var(--text-muted)' }}
        >
          {t.paymentModeRequired}
        </p>

        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl" style={{ backgroundColor: 'var(--color-gray-100)' }}>
          {PAYMENT_MODES.map((m) => {
            const isSelected = mode === m
            const Icon = MODE_ICONS[m]
            return (
              <Button
                key={m}
                type="button"
                variant="none"
                className="flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-lg transition-all text-center min-h-[52px] cursor-pointer active:scale-95"
                style={{
                  backgroundColor: isSelected ? 'var(--color-surface)' : 'transparent',
                  color: isSelected ? 'var(--color-primary-700)' : 'var(--text-secondary)',
                  boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className="flex items-center justify-center w-6 h-6 rounded-full transition-all"
                  style={{
                    backgroundColor: isSelected ? 'var(--color-primary-500)' : 'transparent',
                    color: isSelected ? 'var(--color-gray-0)' : 'var(--color-gray-500)',
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
          <span className="block text-xs font-medium" style={{ color: 'var(--color-error-600)' }} role="alert">
            {errors.mode}
          </span>
        )}
      </div>

      {/* ── 4. Clean Grouped Meta Rows (iOS-style Clean Divider) ─────────── */}
      <div
        className="rounded-[var(--radius-2xl)] overflow-hidden divide-y"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Date Row */}
        <div className="flex items-center justify-between px-4 py-3">
          <label
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--text-secondary)' }}
            htmlFor="payment-date"
          >
            <Calendar className="w-4 h-4 text-primary-500" />
            {t.dateRequired}
          </label>
          <div className="w-44">
            <DateField
              id="payment-date"
              type="date"
              className="input w-full text-right text-sm font-medium bg-transparent border-0 focus:ring-0 p-0 shadow-none"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              aria-label={t.paymentDate2}
            />
          </div>
        </div>

        {/* Reference Row */}
        {showReference && (
          <div className="flex items-center justify-between px-4 py-3">
            <label
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: 'var(--text-secondary)' }}
              htmlFor="payment-ref"
            >
              <Hash className="w-4 h-4 text-primary-500" />
              {t.referenceNumberLabel}
            </label>
            <div className="w-44">
              <Input
                id="payment-ref"
                type="text"
                className="input w-full text-right text-sm bg-transparent border-0 focus:ring-0 p-0 shadow-none"
                placeholder={getReferencePlaceholder(mode)}
                value={referenceNumber}
                onChange={(e) => onReferenceChange(e.target.value)}
                aria-label={t.referenceNumberAria}
                maxLength={100}
              />
            </div>
          </div>
        )}

        {/* Notes Row */}
        <div className="px-4 py-3 space-y-1">
          <label
            className="flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--text-secondary)' }}
            htmlFor="payment-notes"
          >
            <FileText className="w-4 h-4 text-primary-500" />
            {t.notesLabel}
          </label>
          <Textarea
            id="payment-notes"
            className="input w-full text-sm bg-transparent border-0 focus:ring-0 p-0 shadow-none resize-none"
            rows={2}
            placeholder={t.addPaymentNote}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            aria-label={t.paymentNotesAria}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={errors.notes ? 'payment-notes-error' : undefined}
            maxLength={500}
          />
        </div>
      </div>
    </div>
  )
}
