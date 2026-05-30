/** ProductionRunFormPage — /production-runs/new — 3-step wizard */

import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ProductionRunWizardStep1 } from '../components/ProductionRunWizardStep1'
import { ProductionRunWizardStep2 } from '../components/ProductionRunWizardStep2'
import { ProductionRunWizardStep3 } from '../components/ProductionRunWizardStep3'
import { useProductionRunForm } from '../hooks/useProductionRunForm'
import { WIZARD_STEPS } from '../production-run.constants'
import '../production-run.css'

export default function ProductionRunFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialBomId = searchParams.get('bomId') ?? undefined

  const { step, wizard, submitting, updateWizard, goNext, goBack, submit } =
    useProductionRunForm(initialBomId)

  const handleBack = () => {
    if (step === 0) navigate('/production-runs')
    else goBack()
  }

  return (
    <div className="bom-page">
      {/* Header */}
      <div className="bom-page__header">
        <Button variant="none"
          type="button"
          className="btn btn-ghost btn-icon"
          onClick={handleBack}
          aria-label={step === 0 ? 'Back to production runs' : 'Previous step'}
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Button>
        <div style={{ flex: 1 }}>
          <h1 className="bom-page__title">{WIZARD_STEPS[step]}</h1>
          <div className="pr-wizard-progress" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={WIZARD_STEPS.length}>
            <div className="pr-wizard-dots">
              {WIZARD_STEPS.map((_, i) => (
                <span
                  key={i}
                  className={`pr-wizard-dot${i === step ? ' is-active' : i < step ? ' is-done' : ''}`}
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="pr-wizard-progress__label">Step {step + 1} of {WIZARD_STEPS.length}</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      {step === 0 && (
        <ProductionRunWizardStep1
          wizard={wizard}
          onUpdate={updateWizard}
          onNext={goNext}
        />
      )}

      {step === 1 && (
        <ProductionRunWizardStep2
          wizard={wizard}
          onUpdate={updateWizard}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {step === 2 && (
        <ProductionRunWizardStep3
          wizard={wizard}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {step === 3 && (
        <div className="pr-wizard-step">
          <h2 className="pr-wizard-step__title">Confirm Run</h2>
          <div className="pr-confirm-summary">
            <div className="pr-confirm-row">
              <span className="pr-confirm-row__label">Recipe</span>
              <span className="pr-confirm-row__value">{wizard.bomName}</span>
            </div>
            <div className="pr-confirm-row">
              <span className="pr-confirm-row__label">Finished product</span>
              <span className="pr-confirm-row__value">{wizard.finishedProductName}</span>
            </div>
            <div className="pr-confirm-row">
              <span className="pr-confirm-row__label">Quantity</span>
              <span className="pr-confirm-row__value">{wizard.quantityProduced}</span>
            </div>
            <div className="pr-confirm-row">
              <span className="pr-confirm-row__label">Run date</span>
              <span className="pr-confirm-row__value">{wizard.runDate}</span>
            </div>
            {wizard.notes && (
              <div className="pr-confirm-row">
                <span className="pr-confirm-row__label">Notes</span>
                <span className="pr-confirm-row__value">{wizard.notes}</span>
              </div>
            )}
          </div>

          <div className="pr-wizard-step__actions">
            <Button type="button" variant="ghost" onClick={goBack} disabled={submitting}>Back</Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => void submit()}
              disabled={submitting}
              aria-busy={submitting}
              aria-label="Start production run"
            >
              {submitting
                ? <><Loader2 size={16} className="btn-spinner" aria-hidden="true" /> Starting run...</>
                : 'Start Production Run'
              }
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
