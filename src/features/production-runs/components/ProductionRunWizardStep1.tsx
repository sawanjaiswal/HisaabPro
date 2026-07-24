/** ProductionRunWizardStep1 — Choose Recipe */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { listBoms } from '../../bom/bom.service'
import { formatVersionBadge } from '../../bom/bom.utils'
import type { BomSummaryDTO } from '../../bom/bom.types'
import type { WizardFormState } from '../production-run.types'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/context/LanguageContext'

interface Step1Props {
  wizard: WizardFormState
  onUpdate: (updates: Partial<WizardFormState>) => void
  onNext: () => void
}

export function ProductionRunWizardStep1({ wizard, onUpdate, onNext }: Step1Props) {
  const { t } = useLanguage()
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
      <h2 className="pr-wizard-step__title">{t.prStepChooseRecipe}</h2>
      <p className="pr-wizard-step__desc">{t.prChooseRecipeDesc}</p>

      {loading && (
        <div className="pr-wizard-bom-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bom-skeleton__card" style={{ height: 64 }} />
          ))}
        </div>
      )}

      {!loading && error && (
        <p className="pr-wizard-error" role="alert">{t.prLoadRecipesError}</p>
      )}

      {!loading && !error && boms.length === 0 && (
        <p className="pr-wizard-empty">{t.prNoActiveRecipes}</p>
      )}

      {!loading && !error && boms.length > 0 && (
        <div
          className="pr-wizard-bom-list"
          role="radiogroup"
          aria-label={t.prSelectRecipe}
        >
          {boms.map((bom) => (
            <label
              key={bom.id}
              className={`pr-wizard-bom-option${wizard.bomId === bom.id ? ' is-selected' : ''}`}
            >
              <Input
                type="radio"
                name="bom-select"
                value={bom.id}
                checked={wizard.bomId === bom.id}
                onChange={() => selectBom(bom)}
                className="sr-only"
                aria-label={`${t.prSelectLabel} ${bom.name}`}
              />
              <div className="pr-wizard-bom-option__body">
                <div className="pr-wizard-bom-option__product">{bom.productName}</div>
                <div className="pr-wizard-bom-option__name">{bom.name}</div>
              </div>
              <div className="pr-wizard-bom-option__meta">
                <span className="badge badge--neutral">{formatVersionBadge(bom.version)}</span>
                {bom.isDefault && <span className="badge badge--primary">{t.defaultLabel}</span>}
                <span className="pr-wizard-bom-option__count">{bom.componentCount} {t.prParts}</span>
              </div>
            </label>
          ))}
        </div>
      )}

      <div className="pr-wizard-step__actions">
        <Button
          type="button"
          variant="primary"
          disabled={!canProceed}
          onClick={onNext}
          aria-label={t.prContinueToQty}
        >
          {t.next}
        </Button>
      </div>
    </div>
  )
}
