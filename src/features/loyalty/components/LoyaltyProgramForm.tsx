/**
 * Loyalty #125 — Settings form.
 *
 * Composes:
 *   • Enable toggle (loyalty-toggle-row)
 *   • Accrual section (rate %, min spend ₹)
 *   • Redemption section (unit, ₹/unit)
 *   • Expiry section (toggle + months)
 *   • Save button (offline-safe — tolerates {} via Offline Rule 5)
 *
 * Errors come back as i18n keys (loyaltyErrorRateMax etc.) so this file does
 * NOT contain any hardcoded copy. The page wrapper supplies AppShell+Header.
 */

import { useEffect, useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  DEFAULT_ACCRUAL_MIN_SPEND_PAISE,
  DEFAULT_ACCRUAL_RATE_BPS,
  DEFAULT_EXPIRY_MONTHS,
  DEFAULT_REDEMPTION_PAISE_PER_UNIT,
  DEFAULT_REDEMPTION_UNIT,
  EXPIRY_MONTHS_MAX,
  EXPIRY_MONTHS_MIN,
} from '../loyalty.constants'
import { useUpdateLoyaltyProgram } from '../hooks/useLoyaltyProgram'
import {
  bpsToPercentLabel,
  percentToBps,
  validateProgramInput,
} from '../loyalty.utils'
import type { LoyaltyProgramDTO } from '../loyalty.types'
import '@/styles/components.loyalty.css'

interface LoyaltyProgramFormProps {
  program: LoyaltyProgramDTO | null
}

interface FormState {
  enabled: boolean
  ratePercent: string          // user-facing percent string (e.g. "1.25")
  minSpendRupees: string       // user-facing rupees string
  redemptionUnit: string
  redemptionRupees: string     // ₹ per unit (user-facing)
  expiryEnabled: boolean
  expiryMonths: string
}

function toFormState(p: LoyaltyProgramDTO | null): FormState {
  return {
    enabled: p?.enabled ?? false,
    ratePercent: bpsToPercentLabel(p?.accrualRateBps ?? DEFAULT_ACCRUAL_RATE_BPS).replace('%', ''),
    minSpendRupees: String(Math.floor((p?.accrualMinSpendPaise ?? DEFAULT_ACCRUAL_MIN_SPEND_PAISE) / 100)),
    redemptionUnit: String(p?.redemptionUnit ?? DEFAULT_REDEMPTION_UNIT),
    redemptionRupees: String(Math.floor((p?.redemptionPaisePerUnit ?? DEFAULT_REDEMPTION_PAISE_PER_UNIT) / 100)),
    expiryEnabled: (p?.expiryMonths ?? DEFAULT_EXPIRY_MONTHS) != null,
    expiryMonths: String(p?.expiryMonths ?? 12),
  }
}

export function LoyaltyProgramForm({ program }: LoyaltyProgramFormProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const [form, setForm] = useState<FormState>(() => toFormState(program))

  // Re-seed once when the program data arrives (initial null → loaded DTO).
  useEffect(() => {
    if (program) setForm(toFormState(program))
  }, [program])

  const update = useUpdateLoyaltyProgram({
    onSuccess: () => {
      toast.success(navigator.onLine ? t.loyaltySavedToast : t.loyaltyQueuedToast)
    },
    onError: () => {
      toast.error(t.loyaltySaveFailed)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const input = {
      enabled: form.enabled,
      accrualRateBps: percentToBps(form.ratePercent),
      accrualMinSpendPaise: Math.round(parseFloat(form.minSpendRupees || '0') * 100),
      redemptionUnit: Math.floor(Number(form.redemptionUnit) || 0),
      redemptionPaisePerUnit: Math.round(parseFloat(form.redemptionRupees || '0') * 100),
      expiryMonths: form.expiryEnabled ? Math.floor(Number(form.expiryMonths) || 0) : null,
    }

    const errors = validateProgramInput(input)
    const firstErrorKey = Object.values(errors)[0]
    if (firstErrorKey) {
      const msg = (t as unknown as Record<string, string>)[firstErrorKey] ?? t.loyaltySaveFailed
      toast.error(msg)
      return
    }
    update.mutate(input)
  }

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  return (
    <form className="loyalty-program-form" onSubmit={handleSubmit}>
      {/* Enable toggle */}
      <div className="loyalty-toggle-row">
        <div className="loyalty-toggle-row__copy">
          <span className="loyalty-toggle-row__label">{t.loyaltyEnableLabel}</span>
          <span className="loyalty-toggle-row__desc">{t.loyaltyEnableHint}</span>
        </div>
        <input
          type="checkbox"
          aria-label={t.loyaltyEnableLabel}
          checked={form.enabled}
          onChange={(e) => setField('enabled', e.target.checked)}
          style={{ width: 20, height: 20, minHeight: 20 }}
        />
      </div>

      {/* Accrual */}
      <section className="loyalty-program-form__section">
        <h2 className="loyalty-program-form__section-title">{t.loyaltyAccrualSection}</h2>

        <div>
          <Input
            label={t.loyaltyAccrualRateLabel}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="0.01"
            value={form.ratePercent}
            onChange={(e) => setField('ratePercent', e.target.value)}
            onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
          />
          <p className="loyalty-program-form__hint">{t.loyaltyAccrualRateHint}</p>
        </div>

        <div>
          <Input
            label={t.loyaltyMinSpendLabel}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.minSpendRupees}
            onChange={(e) => setField('minSpendRupees', e.target.value)}
            onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
          />
          <p className="loyalty-program-form__hint">{t.loyaltyMinSpendHint}</p>
        </div>
      </section>

      {/* Redemption */}
      <section className="loyalty-program-form__section">
        <h2 className="loyalty-program-form__section-title">{t.loyaltyRedemptionSection}</h2>

        <div>
          <Input
            label={t.loyaltyRedemptionUnitLabel}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={form.redemptionUnit}
            onChange={(e) => setField('redemptionUnit', e.target.value)}
            onKeyDown={(e) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault() }}
          />
          <p className="loyalty-program-form__hint">{t.loyaltyRedemptionUnitHint}</p>
        </div>

        <div>
          <Input
            label={t.loyaltyRedemptionRateLabel}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={form.redemptionRupees}
            onChange={(e) => setField('redemptionRupees', e.target.value)}
            onKeyDown={(e) => { if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault() }}
          />
          <p className="loyalty-program-form__hint">{t.loyaltyRedemptionRateHint}</p>
        </div>
      </section>

      {/* Expiry */}
      <section className="loyalty-program-form__section">
        <h2 className="loyalty-program-form__section-title">{t.loyaltyExpirySection}</h2>

        <div className="loyalty-toggle-row">
          <div className="loyalty-toggle-row__copy">
            <span className="loyalty-toggle-row__label">{t.loyaltyExpiryToggleLabel}</span>
            <span className="loyalty-toggle-row__desc">{t.loyaltyExpiryNeverHint}</span>
          </div>
          <input
            type="checkbox"
            aria-label={t.loyaltyExpiryToggleLabel}
            checked={form.expiryEnabled}
            onChange={(e) => setField('expiryEnabled', e.target.checked)}
            style={{ width: 20, height: 20, minHeight: 20 }}
          />
        </div>

        {form.expiryEnabled && (
          <div>
            <Input
              label={t.loyaltyExpiryMonthsLabel}
              type="number"
              inputMode="numeric"
              min={EXPIRY_MONTHS_MIN}
              max={EXPIRY_MONTHS_MAX}
              step={1}
              value={form.expiryMonths}
              onChange={(e) => setField('expiryMonths', e.target.value)}
              onKeyDown={(e) => { if (['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault() }}
            />
          </div>
        )}
      </section>

      <div className="loyalty-program-form__footer">
        <Button type="submit" variant="primary" loading={update.isPending}>
          {update.isPending ? t.loyaltySaveProgress : t.loyaltySaveButton}
        </Button>
      </div>
    </form>
  )
}
