/**
 * Backfill Wizard — Step 2: Options
 *
 * Default tax category dropdown, setPositionFromParty checkbox,
 * date range picker (defaults to current FY).
 */

import { useState, type Dispatch } from 'react'
import { Button } from '@/components/ui/Button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import type { WizardAction, WizardOptions } from '../gst-returns.types'

interface Props {
  options: WizardOptions
  dispatch: Dispatch<WizardAction>
}

function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function fromInputDate(s: string): Date {
  return new Date(s + 'T00:00:00')
}

export function BackfillStep2Options({ options, dispatch }: Props) {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { categories } = useTaxCategories(businessId)

  const [taxCategoryId, setTaxCategoryId] = useState(options.defaultTaxCategoryId)
  const [setPosFromParty, setSetPosFromParty] = useState(options.setPositionFromParty)
  const [startDate, setStartDate]           = useState(toInputDate(options.dateRange[0]))
  const [endDate, setEndDate]               = useState(toInputDate(options.dateRange[1]))

  function handleNext() {
    if (!taxCategoryId) return
    const updatedOptions: WizardOptions = {
      defaultTaxCategoryId: taxCategoryId,
      setPositionFromParty: setPosFromParty,
      dateRange: [fromInputDate(startDate), fromInputDate(endDate)],
    }
    dispatch({ type: 'GO_OPTIONS', options: updatedOptions })
    dispatch({ type: 'GO_CONFIRMATION' })
  }

  const activeCategories = categories.filter(c => c.isActive)
  const canProceed = Boolean(taxCategoryId) && startDate <= endDate

  return (
    <div className="bfw-step">
      <p className="bfw-step-desc">{t.backfillOptionsDesc}</p>

      <div className="bfw-field">
        <label htmlFor="bfw-tax-cat" className="bfw-label">
          {t.backfillDefaultTaxCategory}
        </label>
        <select
          id="bfw-tax-cat"
          className="bfw-select"
          value={taxCategoryId}
          onChange={e => setTaxCategoryId(e.target.value)}
          required
        >
          <option value="">{t.selectTax}</option>
          {activeCategories.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="bfw-field">
        <label htmlFor="bfw-start" className="bfw-label">{t.backfillFromDate}</label>
        <input
          id="bfw-start"
          type="date"
          className="bfw-input"
          value={startDate}
          onChange={e => setStartDate(e.target.value)}
        />
      </div>

      <div className="bfw-field">
        <label htmlFor="bfw-end" className="bfw-label">{t.backfillToDate}</label>
        <input
          id="bfw-end"
          type="date"
          className="bfw-input"
          value={endDate}
          onChange={e => setEndDate(e.target.value)}
        />
      </div>

      <div className="bfw-checkbox-row">
        <input
          id="bfw-pos-party"
          type="checkbox"
          className="bfw-checkbox"
          checked={setPosFromParty}
          onChange={e => setSetPosFromParty(e.target.checked)}
        />
        <label htmlFor="bfw-pos-party" className="bfw-checkbox-label">
          {t.backfillSetPosFromParty}
        </label>
      </div>

      <div className="bfw-actions bfw-actions--row">
        <Button
          variant="secondary" size="md"
          onClick={() => dispatch({ type: 'BACK' })}
          aria-label={t.back}
        >
          <ChevronLeft size={18} aria-hidden="true" />
          {t.back}
        </Button>
        <Button
          variant="primary" size="md"
          onClick={handleNext}
          disabled={!canProceed}
          aria-label={t.backfillNextStep}
        >
          {t.next}
          <ChevronRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
