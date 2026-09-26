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

  // Local string state so user can type freely, delete decimals, etc. without .00 cursor locks
  const [displayAmount, setDisplayAmount] = React.useState<string>(() =>
    amount > 0 ? (amount % 100 === 0 ? String(amount / 100) : (amount / 100).toFixed(2)) : '',
  )

  const amountInputRef = React.useRef<HTMLInputElement>(null)

  // Auto-focus and select amount field on mount to immediately open keyboard
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (amountInputRef.current) {
        amountInputRef.current.focus()
        amountInputRef.current.select()
      }
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  // Sync with prop when changed externally (e.g. quick chips, invoice auto-allocate, props change)
  React.useEffect(() => {
    const currentPaise = displayAmount ? Math.round(parseFloat(displayAmount) * 100) : 0
    if (isNaN(currentPaise) || currentPaise !== amount) {
      if (amount <= 0) {
        setDisplayAmount('')
      } else {
        setDisplayAmount(amount % 100 === 0 ? String(amount / 100) : String(amount / 100))
      }
    }
  }, [amount])

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    // Prevent multiple dots
    const parts = raw.split('.')
    const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw
    setDisplayAmount(sanitized)

    if (sanitized === '' || sanitized === '.') {
      onAmountChange(0)
      return
    }
    const parsed = parseFloat(sanitized)
    if (!isNaN(parsed)) {
      onAmountChange(Math.round(parsed * 100))
    }
  }

  const handleAmountBlur = () => {
    if (!displayAmount || isNaN(parseFloat(displayAmount))) {
      setDisplayAmount('')
      onAmountChange(0)
    }
  }

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* ── 1. Party Identity ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)]">
          {t.customerSupplierLabel || 'CUSTOMER / SUPPLIER'}
        </div>
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} showLabel={false} />
      </div>

      {/* ── 2. Amount ─────────────────────────────────────────────────── */}
      <div className="space-y-3 text-center py-2">
        <label
          htmlFor="payment-amount"
          className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)] block"
        >
          {t.amount || 'AMOUNT'} <span className="text-red-500">*</span>
        </label>

        {/* Center Hero Display */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          <span className="text-3xl sm:text-4xl font-bold text-[var(--color-primary-600)] select-none">
            ₹
          </span>
          <div className="relative inline-flex items-center justify-center">
            <Input
              ref={amountInputRef}
              id="payment-amount"
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.]?[0-9]*"
              placeholder="0.00"
              autoFocus
              variant="seamless"
              className="w-48 sm:w-64 bg-transparent border-0 text-center text-5xl sm:text-6xl font-black focus-visible:ring-0 focus:outline-none tabular-nums p-0 shadow-none text-[var(--color-gray-900)]"
              style={{
                fontFamily: 'var(--font-primary)',
                letterSpacing: '-0.03em',
              }}
              value={displayAmount}
              onChange={handleAmountInputChange}
              onBlur={handleAmountBlur}
              aria-label={t.paymentAmountRupees}
            />
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
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[var(--color-gray-50)] hover:bg-[var(--color-gray-100)] text-[var(--color-gray-700)] border border-[var(--color-gray-200)] transition-all active:scale-95 cursor-pointer"
            >
              +{formatRupees(q * 100)}
            </Button>
          ))}
        </div>

        {errors.amount && (
          <span className="block text-xs font-medium text-center text-red-600" role="alert">
            {errors.amount}
          </span>
        )}
      </div>

      {/* ── 3. Payment Mode ───────────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)] block">
          {t.paymentModeLabel || 'PAYMENT MODE'} <span className="text-red-500">*</span>
        </label>

        {/* Minimal Icon Dock */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1 sm:gap-2">
          {PAYMENT_MODES.map((m) => {
            const isSelected = mode === m
            const Icon = MODE_ICONS[m]
            return (
              <Button
                key={m}
                type="button"
                variant="none"
                className={`flex flex-col items-center justify-center gap-1.5 py-2 px-1 rounded-xl transition-all text-center cursor-pointer active:scale-95 bg-transparent border-0 ${
                  isSelected
                    ? 'text-[var(--color-primary-600)]'
                    : 'text-[var(--color-gray-500)] hover:text-[var(--color-gray-900)]'
                }`}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[var(--color-primary-50)] text-[var(--color-primary-600)] shadow-xs scale-105'
                      : 'text-[var(--color-gray-500)] hover:bg-[var(--color-gray-50)]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span
                  className={`text-[11px] truncate max-w-full leading-tight transition-colors ${
                    isSelected ? 'font-bold text-[var(--color-primary-700)]' : 'font-medium text-[var(--color-gray-600)]'
                  }`}
                >
                  {PAYMENT_MODE_LABELS[m]}
                </span>
              </Button>
            )
          })}
        </div>

        {errors.mode && (
          <span className="block text-xs font-medium text-red-600" role="alert">
            {errors.mode}
          </span>
        )}
      </div>

      {/* ── 4. Date & Details ─────────────────────────────────────────── */}
      <div className="space-y-3.5">
        {/* Date Row */}
        <div>
          <label
            className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)] mb-1 flex items-center gap-1.5"
            htmlFor="payment-date"
          >
            <Calendar className="w-3.5 h-3.5 text-[var(--color-primary-600)]" />
            <span>{t.dateRequired || 'DATE'}</span>
            <span className="text-red-500">*</span>
          </label>
          <DateField
            id="payment-date"
            type="date"
            className="w-full bg-[var(--color-gray-50)] hover:bg-[var(--color-gray-100)] border border-[var(--color-gray-200)] rounded-[8px] px-3.5 py-2.5 text-sm font-medium text-[var(--color-gray-900)] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-500)]/20"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label={t.paymentDate2}
          />
        </div>

        {/* Reference Row (when mode requires reference) */}
        {showReference && (
          <div>
            <label
              className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)] mb-1 flex items-center gap-1.5"
              htmlFor="payment-ref"
            >
              <Hash className="w-3.5 h-3.5 text-[var(--color-primary-600)]" />
              <span>{t.referenceNumberLabel || 'REFERENCE NUMBER'}</span>
            </label>
            <Input
              id="payment-ref"
              type="text"
              className="w-full bg-[var(--color-gray-50)] hover:bg-[var(--color-gray-100)] border border-[var(--color-gray-200)] rounded-[8px] px-3.5 py-2.5 text-sm text-[var(--color-gray-900)] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-500)]/20"
              placeholder={getReferencePlaceholder(mode)}
              value={referenceNumber}
              onChange={(e) => onReferenceChange(e.target.value)}
              aria-label={t.referenceNumberAria}
              maxLength={100}
            />
          </div>
        )}

        {/* Notes Row */}
        <div>
          <label
            className="text-xs font-bold uppercase tracking-widest text-[var(--color-gray-500)] mb-1 flex items-center gap-1.5"
            htmlFor="payment-notes"
          >
            <FileText className="w-3.5 h-3.5 text-[var(--color-primary-600)]" />
            <span>{t.notesLabel || 'NOTES'}</span>
          </label>
          <Textarea
            id="payment-notes"
            className="w-full text-sm bg-[var(--color-gray-50)] hover:bg-[var(--color-gray-100)] border border-[var(--color-gray-200)] rounded-[8px] px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-[var(--color-primary-500)]/20 resize-none transition-all text-[var(--color-gray-900)] placeholder:text-[var(--color-gray-400)]"
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
