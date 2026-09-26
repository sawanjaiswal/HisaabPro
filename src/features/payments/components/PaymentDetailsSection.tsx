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
  FileCheck,
  ArrowLeftRight,
  CreditCard,
  MoreHorizontal,
  Calendar,
  Hash,
  FileText,
  Calculator,
  IdCard,
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
  'CREDIT_CARD',
  'NEFT_RTGS_IMPS',
  'OTHER',
]

const MODE_ICONS: Record<PaymentMode, React.ComponentType<{ className?: string }>> = {
  CASH: Wallet,
  UPI: QrCode,
  BANK_TRANSFER: Building2,
  CHEQUE: FileCheck,
  CREDIT_CARD: CreditCard,
  NEFT_RTGS_IMPS: ArrowLeftRight,
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
      {/* ── 1. Party Identity Card ─────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-3 shadow-xs">
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} showLabel={false} />
      </div>

      {/* ── 2. Amount Card ─────────────────────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <label
            htmlFor="payment-amount"
            className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]"
          >
            <span className="text-emerald-700 font-bold">₹</span>
            <span>{t.amount || 'Amount'}</span>
            <span className="text-red-500">*</span>
          </label>
          <Button
            type="button"
            variant="none"
            className="p-1 rounded-lg hover:bg-[var(--color-gray-100)] text-[var(--text-secondary)] transition-colors cursor-pointer"
            aria-label="Calculator"
          >
            <Calculator className="w-4 h-4" />
          </Button>
        </div>

        {/* Center Hero Display */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span className="text-4xl font-bold text-[var(--text-primary)] select-none">
            ₹
          </span>
          <div className="relative inline-flex items-center">
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0"
              variant="seamless"
              className="w-48 sm:w-64 bg-transparent border-0 text-left text-5xl font-black focus-visible:ring-0 focus:outline-none tabular-nums p-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-[var(--text-primary)]"
              style={{
                fontFamily: 'var(--font-primary)',
                letterSpacing: '-0.03em',
              }}
              value={amount > 0 ? (amount / 100).toFixed(2) : ''}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value || '0')
                const paise = Math.round(parsed * 100)
                onAmountChange(isNaN(paise) ? 0 : paise)
              }}
              aria-label={t.paymentAmountRupees}
            />
            {amount === 0 && (
              <span className="inline-block w-0.5 h-10 bg-emerald-500 animate-pulse -ml-44 sm:-ml-60 pointer-events-none" />
            )}
          </div>
        </div>

        {/* Quick Amount Suggestion Chips */}
        <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
          {quickAmounts.map((q) => (
            <Button
              key={q}
              type="button"
              variant="none"
              onClick={() => onAmountChange(q * 100)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-gray-100)] hover:bg-[var(--color-gray-200)] text-[var(--text-primary)] border border-[var(--color-gray-200)] transition-all active:scale-95 cursor-pointer shadow-2xs"
            >
              +{formatRupees(q * 100)}
            </Button>
          ))}
        </div>

        {errors.amount && (
          <span className="block text-xs font-medium text-center text-[var(--color-error-600)]" role="alert">
            {errors.amount}
          </span>
        )}
      </div>

      {/* ── 3. Payment Mode & Details Card ─────────────────────────────── */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 shadow-xs space-y-5">
        {/* Payment Mode */}
        <div className="space-y-3">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
            <IdCard className="w-4 h-4 text-emerald-700" />
            <span>{t.paymentModeLabel || 'Payment Mode'}</span>
            <span className="text-red-500">*</span>
          </label>

          {/* Row 1: 4 columns */}
          <div className="grid grid-cols-4 gap-2">
            {PAYMENT_MODES.slice(0, 4).map((m) => {
              const isSelected = mode === m
              const Icon = MODE_ICONS[m]
              return (
                <Button
                  key={m}
                  type="button"
                  variant="none"
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-xl transition-all text-center min-h-[58px] cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'border-2 border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-2xs'
                      : 'border border-[var(--color-border)] bg-[var(--color-gray-50)]/50 hover:bg-[var(--color-gray-100)] text-[var(--text-secondary)] font-medium'
                  }`}
                  onClick={() => onModeChange(m)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={PAYMENT_MODE_LABELS[m]}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                  <span className="text-[11px] truncate max-w-full leading-tight">
                    {PAYMENT_MODE_LABELS[m]}
                  </span>
                </Button>
              )
            })}
          </div>

          {/* Row 2: 3 columns */}
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_MODES.slice(4).map((m) => {
              const isSelected = mode === m
              const Icon = MODE_ICONS[m]
              return (
                <Button
                  key={m}
                  type="button"
                  variant="none"
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1.5 rounded-xl transition-all text-center min-h-[58px] cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'border-2 border-emerald-600 bg-emerald-50/60 text-emerald-800 font-bold shadow-2xs'
                      : 'border border-[var(--color-border)] bg-[var(--color-gray-50)]/50 hover:bg-[var(--color-gray-100)] text-[var(--text-secondary)] font-medium'
                  }`}
                  onClick={() => onModeChange(m)}
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={PAYMENT_MODE_LABELS[m]}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-700' : 'text-gray-500'}`} />
                  <span className="text-[11px] truncate max-w-full leading-tight">
                    {PAYMENT_MODE_LABELS[m]}
                  </span>
                </Button>
              )
            })}
          </div>

          {errors.mode && (
            <span className="block text-xs font-medium text-[var(--color-error-600)]" role="alert">
              {errors.mode}
            </span>
          )}
        </div>

        {/* Date Row */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]/60">
          <label
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
            htmlFor="payment-date"
          >
            <Calendar className="w-4 h-4 text-emerald-700" />
            <span>{t.dateRequired || 'Date'}</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="w-48">
            <DateField
              id="payment-date"
              type="date"
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] shadow-2xs focus:ring-2 focus:ring-emerald-500/20"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
              aria-label={t.paymentDate2}
            />
          </div>
        </div>

        {/* Reference Row (when mode requires reference) */}
        {showReference && (
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]/60">
            <label
              className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
              htmlFor="payment-ref"
            >
              <Hash className="w-4 h-4 text-emerald-700" />
              <span>{t.referenceNumberLabel || 'Reference'}</span>
            </label>
            <div className="w-48">
              <Input
                id="payment-ref"
                type="text"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2 text-sm text-right"
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
        <div className="space-y-2 pt-2 border-t border-[var(--color-border)]/60">
          <label
            className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"
            htmlFor="payment-notes"
          >
            <FileText className="w-4 h-4 text-emerald-700" />
            <span>{t.notesLabel || 'Notes'}</span>
          </label>
          <Textarea
            id="payment-notes"
            className="w-full text-sm bg-[var(--color-gray-50)]/60 border border-[var(--color-border)] rounded-xl p-3 focus:bg-[var(--color-surface)] focus:border-emerald-600 resize-none transition-all"
            rows={2}
            placeholder="Add a note (optional)..."
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
