/** ProductionRunWizardStep1 — Choose Recipe */

import { useState, useEffect } from 'react'
import { listBoms } from '../../bom/bom.service'
import { formatVersionBadge } from '../../bom/bom.utils'
import type { BomSummaryDTO } from '../../bom/bom.types'
import type { WizardFormState } from '../production-run.types'

interface Step1Props {
  wizard: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
  onNext: () => void
}

export function ProductionRunWizardStep1({ wizard, onUpdate, onNext }: Step1Props) {
  const [boms, setBoms] = useState<BomSummaryDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    listBoms({ page: 1, isActive: true }, undefined)
      .then((res) => { setBoms(res.data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const selectBom = (bom: BomSummaryDTO) => {
    onUpdate({
      bomId: bom.id,
      bomName: bom.name,
      bomVersion: bom.version,
      finishedProductId: bom.productId,
      finishedProductName: bom.productName,
    })
  }

  const canProceed = !!wizard.bomId

  return (
    <div className="pr-wizard-step">
      <h2 className="pr-wizard-step__title">Choose Recipe</h2>
      <p className="pr-wizard-step__desc">Select a Bill of Materials to run production against.</p>

      {loading && (
        <div className="pr-wizard-bom-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bom-skeleton__card" style={{ height: 64 }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="pr-wizard-error" role="alert">Failed to load recipes. Please go back and try again.</p>
      )}

      {!loading && !error && boms.length === 0 && (
        <p className="pr-wizard-empty">No active recipes found. Create a BOM first.</p>
      )}

      {!loading && !error && boms.length > 0 && (
        <div
          className="pr-wizard-bom-list"
          role="radiogroup"
          aria-label="Select a recipe"
        >
          {boms.map((bom) => (
            <label
              key={bom.id}
              className={`pr-wizard-bom-option${wizard.bomId === bom.id ? ' is-selected' : ''}`}
            >
              <input
                type="radio"
                name="bom-select"
                value={bom.id}
                checked={wizard.bomId === bom.id}
                onChange={() => selectBom(bom)}
                className="sr-only"
                aria-label={`Select ${bom.name}`}
              />
              <div className="pr-wizard-bom-option__body">
                <div className="pr-wizard-bom-option__product">{bom.productName}</div>
                <div className="pr-wizard-bom-option__name">{bom.name}</div>
              </div>
              <div className="pr-wizard-bom-option__meta">
                <span className="badge badge--neutral">{formatVersionBadge(bom.version)}</span>
                {bom.isDefault && <span className="badge badge--primary">Default</span>}
                <span className="pr-wizard-bom-option__count">{bom.componentCount} parts</span>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="pr-wizard-step__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={onNext}
          aria-label="Continue to quantity and date"
        >
          Next
        </button>
      </div>
    </div>
  )
}
