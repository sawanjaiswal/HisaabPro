/** Invoice Form — Per-line tax category dropdown
 *
 * Subscribes to the tax-categories query (a passive cache read would find an
 * empty list on any route that never fetched it, and every line would silently
 * go to the server untagged).
 * The line arrives pre-tagged from the product it was added from (see
 * ProductPick) — this column is the override, not the source.
 * Shows "Tax not set" warning on blur when taxCategoryId is null.
 * Hidden entirely in composition mode.
 */

import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useTaxCategories } from '@/hooks/useTaxCategories'
import { formatRate } from '@/features/tax/tax.constants'
import { Select, SelectItem } from '@/components/ui/Select'

const NONE = '__none__' as const

interface TaxPickerColumnProps {
  lineIndex: number
  taxCategoryId: string | null
  compositionScheme: boolean
  onChange: (id: string | null) => void
}

export function TaxPickerColumn({
  lineIndex,
  taxCategoryId,
  compositionScheme,
  onChange,
}: TaxPickerColumnProps) {
  const { user } = useAuth()
  const { categories } = useTaxCategories(user?.businessId ?? '')
  const [touched, setTouched] = useState(false)

  if (compositionScheme) return null

  const showWarning = touched && taxCategoryId === null
  const activeCategories = categories.filter((c) => c.isActive)
  const selectId = `tax-picker-${lineIndex}`

  return (
    <div className="tax-picker-col">
      <label className="line-item-field-label" htmlFor={selectId}>
        Tax
      </label>
      <Select
        value={taxCategoryId ?? NONE}
        onValueChange={(v) => { setTouched(true); onChange(v === NONE ? null : v) }}
        ariaLabel={`Tax category for line item ${lineIndex + 1}`}
      >
        <SelectItem value={NONE}>-- Select tax --</SelectItem>
        {activeCategories.map((cat) => (
          <SelectItem key={cat.id} value={cat.id}>
            {cat.name} ({formatRate(cat.rate)})
          </SelectItem>
        ))}
      </Select>

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
