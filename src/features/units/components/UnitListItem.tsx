/** Single unit row with edit/delete actions */

import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Unit } from '../unit.types'
import { UnitCategoryBadge } from './UnitCategoryBadge'
import { getUnitCategory } from '../unit.utils'

interface UnitListItemProps {
  unit: Unit
  onEdit: (unit: Unit) => void
  onDelete: (id: string) => Promise<boolean>
}

export function UnitListItem({ unit, onEdit, onDelete }: UnitListItemProps) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const isCustom = unit.type === 'CUSTOM'

  const handleDelete = async () => {
    setIsDeleting(true)
    const ok = await onDelete(unit.id)
    setIsDeleting(false)
    if (ok) setDeleteOpen(false)
  }

  return (
    <>
      <div className="unit-list-item">
        <div className="unit-list-item__info">
          <span className="unit-list-item__name">{unit.name}</span>
          <span className="unit-list-item__symbol">{unit.symbol}</span>
          <UnitCategoryBadge category={getUnitCategory(unit)} />
          {unit.productCount > 0 && (
            <span className="unit-list-item__count">
              {unit.productCount} product{unit.productCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {isCustom && (
          <div className="unit-list-item__actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => onEdit(unit)}
              aria-label={`Edit ${unit.name}`}
            >
              <Pencil size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setDeleteOpen(true)}
              aria-label={`Delete ${unit.name}`}
              disabled={unit.productCount > 0}
            >
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${unit.name}"?`}
        description={
          unit.productCount > 0
            ? `${unit.productCount} product(s) use this unit. Reassign them first.`
            : 'This custom unit will be permanently removed.'
        }
        isLoading={isDeleting}
      />
    </>
  )
}
