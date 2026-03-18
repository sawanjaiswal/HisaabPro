/** Single conversion row — displays "1 box = 12 pcs" format */

import { Trash2 } from 'lucide-react'
import type { UnitConversion } from '../unit.types'

interface ConversionListItemProps {
  conversion: UnitConversion
  onDelete: (id: string) => void
}

export function ConversionListItem({ conversion, onDelete }: ConversionListItemProps) {
  return (
    <div className="unit-list-item">
      <div className="unit-list-item__info">
        <span className="unit-list-item__name">
          1 {conversion.fromUnit.name} = {conversion.factor} {conversion.toUnit.name}
        </span>
        <span className="unit-list-item__symbol">
          {conversion.fromUnit.symbol} → {conversion.toUnit.symbol}
        </span>
      </div>
      <div className="unit-list-item__actions">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onDelete(conversion.id)}
          aria-label={`Delete conversion ${conversion.fromUnit.symbol} to ${conversion.toUnit.symbol}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
