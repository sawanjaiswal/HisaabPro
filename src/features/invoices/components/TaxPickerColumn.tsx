/** Invoice Form — Per-line tax category dropdown
 *
 * Reads TanStack Query ['tax', 'categories'] cache.
 * Auto-fills from product.taxCategoryId for new lines.
 * Shows "Tax not set" warning on blur when taxCategoryId is null.
 * Hidden entirely in composition mode.
 */

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { queryKeys } from '@/lib/query-keys'
import type { TaxCategory } from '@/lib/types/tax.types'
import { formatRate } from '@/features/tax/tax.constants'

interface TaxPickerColumnProps {
  lineIndex: number
  taxCategoryId: string | null
  productTaxCategoryId?: string | null
  isNewLine?: boolean
  compositionScheme: boolean
  onChange: (id: string | null) => void
}

export function TaxPickerColumn({
  lineIndex,
  taxCategoryId,
  productTaxCategoryId,
  isNewLine = false,
  compositionScheme,
  onChange,
}: TaxPickerColumnProps) {
  const qc = useQueryClient()
  const categories = qc.getQueryData<TaxCategory[]>(queryKeys.tax.categories()) ?? []
  const [touched, setTouched] = useState(false)
  const autoFilled = useRef(false)

  // Auto-fill from product on new line mount
  useEffect(() => {
    if (isNewLine && !autoFilled.current && productTaxCategoryId && taxCategoryId === null) {
      const match = categories.find((c) => c.id === productTaxCategoryId && c.isActive)
      if (match) {
        onChange(match.id)
        autoFilled.current = true
      }
    }
  }, [isNewLine, productTaxCategoryId, taxCategoryId, categories, onChange])

  if (compositionScheme) return null

  const showWarning = touched && taxCategoryId === null
  const activeCategories = categories.filter((c) => c.isActive)
  const selectId = `tax-picker-${lineIndex}`

  return (
    <div className="tax-picker-col">
      <label className="line-item-field-label" htmlFor={selectId}>
        Tax
      </label>
      <select
        id={selectId}
        className={`input tax-picker-select${showWarning ? ' input-error' : ''}`}
        value={taxCategoryId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        onBlur={() => setTouched(true)}
        aria-label={`Tax category for line item ${lineIndex + 1}`}
        aria-invalid={showWarning}
        aria-describedby={showWarning ? `tax-warn-${lineIndex}` : undefined}
      >
        <option value="">-- Select tax --</option>
        {activeCategories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name} ({formatRate(cat.rate)})
          </option>
        ))}
      </select>

      {showWarning && (
        <span
          id={`tax-warn-${lineIndex}`}
          className="tax-picker-warning"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={12} aria-hidden="true" />
          Tax not set
        </span>
      )}
    </div>
  )
}
