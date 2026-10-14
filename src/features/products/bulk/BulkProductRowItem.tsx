/**
 * Bulk Product Add — Individual Spreadsheet Row Component
 */

import React from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import type { BulkProductRow } from './bulk-product.types'
import { validateBulkRow } from './bulk-product.service'
import type { Unit, Category } from '../product.types'

interface BulkProductRowItemProps {
  index: number
  row: BulkProductRow
  units: Unit[]
  categories: Category[]
  onChange: (id: string, field: keyof BulkProductRow, value: string) => void
  onDelete: (id: string) => void
}

export const BulkProductRowItem: React.FC<BulkProductRowItemProps> = ({
  index,
  row,
  units,
  categories,
  onChange,
  onDelete,
}) => {
  const { isValid, errors } = validateBulkRow(row)

  return (
    <tr className={!isValid && row.name.trim() ? 'row-invalid' : ''}>
      <td className="text-center w-10">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className={`bulk-status-dot bulk-status-dot--${isValid ? 'valid' : 'invalid'}`}
            title={isValid ? 'Valid row' : Object.values(errors).join(', ')}
          />
          <span className="text-xs text-[var(--text-muted)] font-mono">{index + 1}</span>
        </div>
      </td>
      <td className="min-w-[180px]">
        <Input
          inputSize="sm"
          type="text"
          placeholder="e.g. Amul Milk 500ml"
          value={row.name}
          onChange={(e) => onChange(row.id, 'name', e.target.value)}
          hasError={Boolean(errors.name)}
          title={errors.name}
          className="h-8 py-1 px-2 text-xs"
        />
      </td>
      <td className="min-w-[110px]">
        <Select
          size="compact"
          value={row.unitId}
          onValueChange={(val) => onChange(row.id, 'unitId', val)}
          options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
        />
      </td>
      <td className="w-28">
        <Input
          inputSize="sm"
          type="number"
          step="any"
          min="0"
          className="h-8 py-1 px-2 text-xs font-mono"
          placeholder="0.00"
          value={row.salePrice}
          onChange={(e) => onChange(row.id, 'salePrice', e.target.value)}
          hasError={Boolean(errors.salePrice)}
          title={errors.salePrice}
        />
      </td>
      <td className="w-28">
        <Input
          inputSize="sm"
          type="number"
          step="any"
          min="0"
          className="h-8 py-1 px-2 text-xs font-mono"
          placeholder="0.00"
          value={row.purchasePrice}
          onChange={(e) => onChange(row.id, 'purchasePrice', e.target.value)}
          hasError={Boolean(errors.purchasePrice)}
          title={errors.purchasePrice}
        />
      </td>
      <td className="w-24">
        <Input
          inputSize="sm"
          type="number"
          step="any"
          min="0"
          className="h-8 py-1 px-2 text-xs font-mono"
          placeholder="0"
          value={row.openingStock}
          onChange={(e) => onChange(row.id, 'openingStock', e.target.value)}
          hasError={Boolean(errors.openingStock)}
        />
      </td>
      <td className="min-w-[130px]">
        <Select
          size="compact"
          value={row.categoryId ?? ''}
          onValueChange={(val) => onChange(row.id, 'categoryId', val || '')}
          options={[
            { value: '', label: '(None)' },
            ...categories.map((c) => ({ value: c.id, label: c.name }))
          ]}
        />
      </td>
      <td className="w-28">
        <Input
          inputSize="sm"
          type="text"
          className="h-8 py-1 px-2 text-xs font-mono"
          placeholder="Auto"
          value={row.sku ?? ''}
          onChange={(e) => onChange(row.id, 'sku', e.target.value)}
        />
      </td>
      <td className="w-12 text-center">
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => onDelete(row.id)}
          aria-label="Delete row"
          className="text-error-500 hover:text-error-700"
        >
          <Trash2 size={16} aria-hidden="true" />
        </Button>
      </td>
    </tr>
  )
}
