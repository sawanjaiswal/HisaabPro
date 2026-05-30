/** ProductionRunWizardStep2 — Quantity & Date */

import { todayISODate } from '../production-run.utils'
import { Button } from '@/components/ui/Button'
import type { WizardFormState } from '../production-run.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'

interface Step2Props {
  wizard: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
  onNext: () => void
  onBack: () => void
}

export function ProductionRunWizardStep2({ wizard, onUpdate, onNext, onBack }: Step2Props) {
  const qty = parseFloat(wizard.quantityProduced)
  const qtyValid = wizard.quantityProduced.trim() !== '' && !isNaN(qty) && qty > 0
  const dateValid = !!wizard.runDate
  const canProceed = qtyValid && dateValid

  return (
    <div className="pr-wizard-step">
      <h2 className="pr-wizard-step__title">Quantity & Date</h2>
      <p className="pr-wizard-step__desc">
        How many <strong>{wizard.finishedProductName}</strong> are you producing?
      </p>

      <div className="input-group">
        <label htmlFor="pr-qty" className="input-label">Quantity produced <span aria-hidden="true">*</span></label>
        <Input
          id="pr-qty"
          className={`input${!qtyValid && wizard.quantityProduced !== '' ? ' input-error-border' : ''}`}
          type="number"
          min="0.001"
          step="0.001"
          value={wizard.quantityProduced}
          onChange={(e) => onUpdate({ quantityProduced: e.target.value })}
          placeholder="e.g. 10"
          inputMode="decimal"
          aria-required="true"
          aria-label="Quantity produced"
        />
        {!qtyValid && wizard.quantityProduced !== '' && (
          <p className="input-error" role="alert">Quantity must be greater than 0</p>
        )}
      </div>

      <div className="input-group">
        <label htmlFor="pr-date" className="input-label">Production date <span aria-hidden="true">*</span></label>
        <Input
          id="pr-date"
          className="input"
          type="date"
          value={wizard.runDate}
          onChange={(e) => onUpdate({ runDate: e.target.value })}
          max={todayISODate()}
          aria-required="true"
          aria-label="Production date"
        />
      </div>

      <div className="input-group">
        <label htmlFor="pr-notes" className="input-label">
          Notes <span className="text-optional">(optional)</span>
        </label>
        <Textarea
          id="pr-notes"
          className="input"
          value={wizard.notes}
          onChange={(e) => onUpdate({ notes: e.target.value })}
          rows={2}
          placeholder="Any notes about this run..."
          aria-label="Notes"
        />
      </div>

      <div className="pr-wizard-step__actions">
        <Button type="button" variant="ghost" onClick={onBack}>Back</Button>
        <Button
          type="button"
          variant="primary"
          disabled={!canProceed}
          onClick={onNext}
          aria-label="Review components"
        >
          Review Components
        </Button>
      </div>
    </div>
  )
}
