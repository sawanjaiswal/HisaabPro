/**
 * Bulk Product Add — Mobile Responsive Card Item
 */

import React, { useState } from 'react'
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { BulkProductRow } from './bulk-product.types'
import { validateBulkRow } from './bulk-product.service'
import type { Unit, Category } from '../product.types'

interface BulkProductCardItemProps {
  index: number
  row: BulkProductRow
  units: Unit[]
  categories: Category[]
  onChange: (id: string, field: keyof BulkProductRow, value: string) => void
  onDelete: (id: string) => void
}

export const BulkProductCardItem: React.FC<BulkProductCardItemProps> = ({
  index,
  row,
  units,
  categories,
  onChange,
  onDelete,
}) => {
  const [showMore, setShowMore] = useState(false)
  const { isValid, errors } = validateBulkRow(row)

  return (
    <div
      className={`p-3.5 bg-[var(--color-gray-0)] border rounded-xl shadow-xs space-y-3 transition-colors ${
        !isValid && row.name.trim()
          ? 'border-[var(--color-error-400)] bg-[var(--color-error-50)]/30'
          : 'border-[var(--color-gray-200)]'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-[var(--color-gray-100)] text-[var(--text-secondary)] font-mono text-xs flex items-center justify-center font-semibold">
            {index + 1}
          </span>
          <span
            className={`bulk-status-dot bulk-status-dot--${isValid ? 'valid' : 'invalid'}`}
            title={isValid ? 'Valid row' : Object.values(errors).join(', ')}
          />
          <span className="text-xs font-medium text-[var(--text-muted)]">
            {isValid ? 'Ready to add' : errors.name || errors.salePrice || 'Incomplete'}
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => onDelete(row.id)}
          aria-label={`Delete product ${index + 1}`}
          className="text-[var(--color-error-500)] hover:text-[var(--color-error-700)] h-8 w-8 p-0"
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Product Name *
        </label>
        <Input
          type="text"
          placeholder="e.g. Amul Milk 500ml"
          value={row.name}
          onChange={(e) => onChange(row.id, 'name', e.target.value)}
          hasError={Boolean(errors.name)}
          className="h-10 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Unit *
          </label>
          <Select
            size="compact"
            value={row.unitId}
            onValueChange={(val) => onChange(row.id, 'unitId', val)}
            options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Sale Price (₹) *
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={row.salePrice}
            onChange={(e) => onChange(row.id, 'salePrice', e.target.value)}
            hasError={Boolean(errors.salePrice)}
            className="h-10 text-sm font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Purchase (₹)
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="0.00"
            value={row.purchasePrice}
            onChange={(e) => onChange(row.id, 'purchasePrice', e.target.value)}
            hasError={Boolean(errors.purchasePrice)}
            className="h-10 text-sm font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Opening Stock
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            placeholder="0"
            value={row.openingStock}
            onChange={(e) => onChange(row.id, 'openingStock', e.target.value)}
            hasError={Boolean(errors.openingStock)}
            className="h-10 text-sm font-mono"
          />
        </div>
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => setShowMore(!showMore)}
          className="text-xs text-[var(--text-secondary)] p-0 h-7 flex items-center gap-1"
        >
          {showMore ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showMore ? 'Fewer options' : 'More options (Category, SKU)'}
        </Button>

        {showMore && (
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-[var(--color-gray-100)] mt-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                Category
              </label>
              <Select
                size="compact"
                value={row.categoryId ?? ''}
                onValueChange={(val) => onChange(row.id, 'categoryId', val || '')}
                options={[
                  { value: '', label: '(None)' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">
                SKU / Barcode
              </label>
              <Input
                type="text"
                placeholder="Auto-generate"
                value={row.sku ?? ''}
                onChange={(e) => onChange(row.id, 'sku', e.target.value)}
                className="h-10 text-sm font-mono"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
