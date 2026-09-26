/** ProductionRunWizardStep2 — Quantity & Date */

import { Text } from '@/components/ui/Text'
import { todayISODate } from '../production-run.utils'
import { Button } from '@/components/ui/Button'
import type { WizardFormState } from '../production-run.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { useLanguage } from '@/context/LanguageContext'
import { Heading } from '@/components/ui/Heading'

interface Step2Props {
  wizard: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
  onNext: () => void
  onBack: () => void
}

export function ProductionRunWizardStep2({ wizard, onUpdate, onNext, onBack }: Step2Props) {
  const { t } = useLanguage()
  const qty = parseFloat(wizard.quantityProduced)
  const qtyValid = wizard.quantityProduced.trim() !== '' && !isNaN(qty) && qty > 0
  const dateValid = !!wizard.runDate
  const canProceed = qtyValid && dateValid

  return (
    <div className="pr-wizard-step">
      <Heading level={2} className="pr-wizard-step__title">{t.prStepQuantityDate}</Heading>
      <Text className="pr-wizard-step__desc">
        {t.prHowMany} <strong>{wizard.finishedProductName}</strong> {t.prAreYouProducing}
      </Text>

      <div className="input-group">
        <label htmlFor="pr-qty" className="input-label">{t.prQuantityProduced} <span aria-hidden="true">*</span></label>
        <Input
          id="pr-qty"
          className={`input${!qtyValid && wizard.quantityProduced !== '' ? ' input-error-border' : ''}`}
          type="number"
          min="0.001"
          step="0.001"
          value={wizard.quantityProduced}
          onChange={(e) => onUpdate({ quantityProduced: e.target.value })}
          placeholder={t.prQtyPlaceholder}
          inputMode="decimal"
          aria-required="true"
          aria-label={t.prQuantityProduced}
        />
        {!qtyValid && wizard.quantityProduced !== '' && (
          <Text className="input-error" role="alert">{t.prQtyMustBePositive}</Text>
        )}
      </div>

      <div className="input-group">
        <label htmlFor="pr-date" className="input-label">{t.prProductionDate} <span aria-hidden="true">*</span></label>
        <DateField
          id="pr-date"
          className="input"
          type="date"
          value={wizard.runDate}
          onChange={(e) => onUpdate({ runDate: e.target.value })}
          max={todayISODate()}
          aria-required="true"
          aria-label={t.prProductionDate}
        />
      </div>

      <div className="input-group">
        <label htmlFor="pr-notes" className="input-label">
          {t.notes} <span className="text-optional">({t.optional})</span>
        </label>
        <Textarea
          id="pr-notes"
          className="input"
          value={wizard.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
          placeholder={t.prNotesPlaceholder}
          aria-label={t.notes}
        />
      </div>

      <div className="pr-wizard-step__actions">
        <Button type="button" variant="ghost" onClick={onBack}>{t.back}</Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canProceed}
          onClick={onNext}
          aria-label={t.prStepReviewComponents}
        >
          {t.prStepReviewComponents}
        </Button>
      </div>
    </div>
  )
}
