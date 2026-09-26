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

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      {/* ── 1. Party Identity ─────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
          {t.customerSupplierLabel || 'CUSTOMER / SUPPLIER'}
        </div>
        <PartySearchInput value={partyId} onChange={onPartyChange} error={errors.partyId} showLabel={false} />
      </div>

      {/* ── 2. Amount ─────────────────────────────────────────────────── */}
      <div className="space-y-3 text-center py-2">
        <label
          htmlFor="payment-amount"
          className="text-xs font-bold uppercase tracking-widest text-slate-500 block"
        >
          {t.amount || 'AMOUNT'} <span className="text-red-500">*</span>
        </label>

        {/* Center Hero Display */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          <span className="text-3xl sm:text-4xl font-bold text-[#026F39] select-none">
            ₹
          </span>
          <div className="relative inline-flex items-center justify-center">
            <Input
              id="payment-amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              variant="seamless"
              className="w-48 sm:w-64 bg-transparent border-0 text-center text-5xl sm:text-6xl font-black focus-visible:ring-0 focus:outline-none tabular-nums p-0 shadow-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-slate-900"
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
              className="px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 cursor-pointer border-0"
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
      <div className="space-y-3">
        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 block">
          {t.paymentModeLabel || 'PAYMENT MODE'} <span className="text-red-500">*</span>
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
                className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-[8px] transition-all text-center min-h-[72px] cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#E8F5E9] border-2 border-[#026F39]'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 border-0'
                }`}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-[#026F39] text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[11px] truncate max-w-full leading-tight ${
                    isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                  }`}
                >
                  {PAYMENT_MODE_LABELS[m]}
                </span>
              </Button>
            )
          })}
        </div>

        {/* Row 2: 3 columns */}
        <div className="grid grid-cols-4 gap-2">
          {PAYMENT_MODES.slice(4).map((m) => {
            const isSelected = mode === m
            const Icon = MODE_ICONS[m]
            return (
              <Button
                key={m}
                type="button"
                variant="none"
                className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-[8px] transition-all text-center min-h-[72px] cursor-pointer active:scale-95 ${
                  isSelected
                    ? 'bg-[#E8F5E9] border-2 border-[#026F39]'
                    : 'bg-slate-100/90 hover:bg-slate-200/80 border-0'
                }`}
                onClick={() => onModeChange(m)}
                role="radio"
                aria-checked={isSelected}
                aria-label={PAYMENT_MODE_LABELS[m]}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isSelected ? 'bg-[#026F39] text-white' : 'bg-slate-200/80 text-slate-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span
                  className={`text-[11px] truncate max-w-full leading-tight ${
                    isSelected ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
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
            className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"
            htmlFor="payment-date"
          >
            <Calendar className="w-3.5 h-3.5 text-[#026F39]" />
            <span>{t.dateRequired || 'DATE'}</span>
            <span className="text-red-500">*</span>
          </label>
          <DateField
            id="payment-date"
            type="date"
            className="w-full bg-slate-100/90 hover:bg-slate-200/80 border-0 rounded-[8px] px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#026F39]/20"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            aria-label={t.paymentDate2}
          />
        </div>

        {/* Reference Row (when mode requires reference) */}
        {showReference && (
          <div>
            <label
              className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"
              htmlFor="payment-ref"
            >
              <Hash className="w-3.5 h-3.5 text-[#026F39]" />
              <span>{t.referenceNumberLabel || 'REFERENCE NUMBER'}</span>
            </label>
            <Input
              id="payment-ref"
              type="text"
              className="w-full bg-slate-100/90 hover:bg-slate-200/80 border-0 rounded-[8px] px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-[#026F39]/20"
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
            className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-1 flex items-center gap-1.5"
            htmlFor="payment-notes"
          >
            <FileText className="w-3.5 h-3.5 text-[#026F39]" />
            <span>{t.notesLabel || 'NOTES'}</span>
          </label>
          <Textarea
            id="payment-notes"
            className="w-full text-sm bg-slate-100/90 hover:bg-slate-200/80 border-0 rounded-[8px] px-3.5 py-2.5 focus:bg-white focus:ring-2 focus:ring-[#026F39]/20 resize-none transition-all text-slate-900 placeholder:text-slate-400"
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
