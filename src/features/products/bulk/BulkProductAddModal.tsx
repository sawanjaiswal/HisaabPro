/**
 * Bulk Product Add Modal — Full View Fast Ingestion Studio
 * Ported & adapted from VaahanPro's SpeedGrid architecture.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Table, LayoutGrid } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/query-keys'
import { getUnits } from '../unit.service'
import { getCategories } from '../category.service'
import type { Unit, Category } from '../product.types'
import type { BulkProductRow } from './bulk-product.types'
import { parsePastedProductText } from './bulk-product-parser'
import { validateBulkRow, commitBulkProducts, createBlankRow } from './bulk-product.service'
import { BulkProductRowItem } from './BulkProductRowItem'
import { BulkProductCardItem } from './BulkProductCardItem'
import { BulkProductToolbar } from './BulkProductToolbar'
import './bulk-product.css'

interface BulkProductAddModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
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
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
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
    setRows((prev) => [...prev.filter((r) => r.name.trim() !== ''), ...parsed])
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
          setRows((prev) => [...prev.filter((r) => r.name.trim() !== ''), ...parsed])
          toast.success(`Imported ${parsed.length} products from clipboard!`)
          return
        }
      }
    } catch { /* Fallback */ }
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
      const res = await commitBulkProducts(validRows, (c, t) => setProgress({ current: c, total: t }))
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all() })
      if (res.failed === 0) toast.success(`Successfully added all ${res.succeeded} products!`)
      else toast.error(`Added ${res.succeeded} products, ${res.failed} failed: ${res.failedNames.slice(0, 3).join(', ')}`)
      onSuccess()
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setIsSubmitting(false)
      setProgress(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--color-gray-0)] w-full h-full overflow-hidden">
      <div className="bulk-product-header shrink-0">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)]">Bulk Add Products</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Enter multiple products or paste directly from spreadsheets
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
            title={viewMode === 'cards' ? 'Switch to Spreadsheet Table' : 'Switch to Mobile Cards'}
            aria-label="Toggle view layout"
          >
            {viewMode === 'cards' ? <Table size={18} /> : <LayoutGrid size={18} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </Button>
        </div>
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

      <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-28">
        {viewMode === 'cards' ? (
          <div className="space-y-3 max-w-3xl mx-auto">
            {rows.map((row, idx) => (
              <BulkProductCardItem
                key={row.id}
                index={idx}
                row={row}
                units={units}
                categories={categories}
                onChange={handleRowChange}
                onDelete={handleDeleteRow}
              />
            ))}
          </div>
        ) : (
          <div className="bulk-product-table-wrap border border-[var(--color-gray-200)] rounded-xl overflow-x-auto bg-[var(--color-gray-0)]">
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
        )}
      </div>

      <div className="bulk-product-footer shrink-0">
        <div className="text-xs text-[var(--text-secondary)] font-medium">
          {progress ? `Saving (${progress.current}/${progress.total})...` : `${validCount} ready (${rows.length} rows)`}
        </div>
        <div className="flex items-center gap-2">
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
  )
}
