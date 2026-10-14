/**
 * Bulk Product Add Modal — Spreadsheet & Fast Ingestion Studio
 * Ported & adapted from VaahanPro's SpeedGrid architecture.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { getUnits } from '../unit.service'
import { getCategories } from '../category.service'
import type { Unit, Category } from '../product.types'
import type { BulkProductRow } from './bulk-product.types'
import { parsePastedProductText } from './bulk-product-parser'
import { validateBulkRow, commitBulkProducts } from './bulk-product.service'
import { BulkProductRowItem } from './BulkProductRowItem'
import { BulkProductToolbar } from './BulkProductToolbar'
import './bulk-product.css'

interface BulkProductAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function createBlankRow(defaultUnitId: string, idx = 0): BulkProductRow {
  return { id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${idx}`, name: '', unitId: defaultUnitId, salePrice: '', purchasePrice: '', openingStock: '0', minStockLevel: '0' }
}

export const BulkProductAddModal: React.FC<BulkProductAddModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [units, setUnits] = useState<Unit[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [rows, setRows] = useState<BulkProductRow[]>([])
  const [isPasting, setIsPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const defaultUnitId = units[0]?.id ?? ''

  useEffect(() => {
    if (!isOpen) return
    let active = true
    Promise.all([getUnits(), getCategories()]).then(([u, c]) => {
      if (!active) return
      setUnits(u)
      setCategories(c)
      const defUnit = u[0]?.id ?? ''
      setRows([createBlankRow(defUnit, 0), createBlankRow(defUnit, 1), createBlankRow(defUnit, 2)])
    }).catch(() => {})
    return () => { active = false }
  }, [isOpen])

  const handleRowChange = useCallback((id: string, field: keyof BulkProductRow, val: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: val } : r)))
  }, [])
  const handleDeleteRow = useCallback((id: string) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev))
  }, [])
  const handleAddRows = (count: number) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, (_, i) => createBlankRow(defaultUnitId, prev.length + i))])
  }
  const handleClearEmpty = () => {
    setRows((prev) => {
      const f = prev.filter((r) => r.name.trim() !== '' || r.salePrice.trim() !== '')
      return f.length > 0 ? f : [createBlankRow(defaultUnitId, 0)]
    })
  }

  const handleParseAndApplyPaste = () => {
    if (!pasteText.trim()) return
    const parsed = parsePastedProductText(pasteText, units, categories, defaultUnitId)
    if (parsed.length === 0) {
      toast.error('No valid products detected in pasted text')
      return
    }
    setRows((prev) => {
      const nonEmpty = prev.filter((r) => r.name.trim() !== '')
      return [...nonEmpty, ...parsed]
    })
    setPasteText('')
    setIsPasting(false)
    toast.success(`Parsed ${parsed.length} products from clipboard`)
  }

  const handleDirectClipboardPaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text?.trim()) {
        const parsed = parsePastedProductText(text, units, categories, defaultUnitId)
        if (parsed.length > 0) {
          setRows((prev) => {
            const nonEmpty = prev.filter((r) => r.name.trim() !== '')
            return [...nonEmpty, ...parsed]
          })
          toast.success(`Imported ${parsed.length} products from clipboard!`)
          return
        }
      }
    } catch {
      // Fallback to manual text box
    }
    setIsPasting(true)
  }

  const { validCount, invalidCount } = useMemo(() => {
    let valid = 0
    let invalid = 0
    rows.forEach((r) => {
      if (!r.name.trim() && !r.salePrice.trim()) return
      if (validateBulkRow(r).isValid) valid++
      else invalid++
    })
    return { validCount: valid, invalidCount: invalid }
  }, [rows])

  const handleCommit = async () => {
    const validRows = rows.filter((r) => validateBulkRow(r).isValid)
    if (validRows.length === 0) {
      toast.error('Please enter at least one valid product with name, unit, and price')
      return
    }

    setIsSubmitting(true)
    setProgress({ current: 0, total: validRows.length })

    try {
      const result = await commitBulkProducts(validRows, (curr, tot) => {
        setProgress({ current: curr, total: tot })
      })

      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })

      if (result.failed === 0) {
        toast.success(`Successfully added all ${result.succeeded} products!`)
        onSuccess()
        onClose()
      } else {
        toast.error(`Added ${result.succeeded} products, but ${result.failed} failed: ${result.failedNames.slice(0, 3).join(', ')}`)
        onSuccess()
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setIsSubmitting(false)
      setProgress(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
      <div className="bulk-product-modal bg-[var(--color-gray-0)] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bulk-product-header">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Bulk Add Products</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Enter multiple products or paste directly from Excel / Google Sheets
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close modal">
            <X size={20} aria-hidden="true" />
          </Button>
        </div>

        <BulkProductToolbar
          onPasteClick={handleDirectClipboardPaste}
          onAddRows={handleAddRows}
          onClearEmpty={handleClearEmpty}
          validCount={validCount}
          invalidCount={invalidCount}
          isPasting={isPasting}
          pasteText={pasteText}
          onPasteTextChange={setPasteText}
          onCancelPaste={() => setIsPasting(false)}
          onApplyPaste={handleParseAndApplyPaste}
        />

        <div className="bulk-product-table-wrap">
          <table className="bulk-product-table">
            <thead>
              <tr>
                <th className="w-10 text-center">#</th>
                <th>Product Name *</th>
                <th>Unit *</th>
                <th>Sale Price (₹) *</th>
                <th>Purchase (₹)</th>
                <th>Stock</th>
                <th>Category</th>
                <th>SKU</th>
                <th className="w-12 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <BulkProductRowItem
                  key={row.id}
                  index={idx}
                  row={row}
                  units={units}
                  categories={categories}
                  onChange={handleRowChange}
                  onDelete={handleDeleteRow}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="bulk-product-footer">
          <div className="text-xs text-[var(--text-secondary)]">
            {progress
              ? `Saving products... (${progress.current} of ${progress.total})`
              : `${rows.length} total rows entered`}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCommit}
              loading={isSubmitting}
              disabled={validCount === 0 || isSubmitting}
            >
              Save {validCount > 0 ? `(${validCount})` : ''} Products
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
