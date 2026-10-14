/**
 * Bulk Product Add — Clipboard & Delimited Text Parser
 * Inspired by VaahanPro's SpeedGrid text parser.
 */

import type { BulkProductRow } from './bulk-product.types'
import type { Unit, Category } from '../product.types'

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['product', 'product name', 'item', 'item name', 'name', 'title', 'description', 'naam'],
  unit: ['unit', 'uom', 'measure', 'unit of measure'],
  salePrice: ['sale price', 'selling price', 'mrp', 'price', 'rate', 'sp'],
  purchasePrice: ['purchase price', 'buy price', 'cost', 'cost price', 'cp'],
  openingStock: ['opening stock', 'stock', 'qty', 'quantity', 'initial stock', 'opening'],
  minStockLevel: ['min stock', 'minimum stock', 'reorder level', 'min qty', 'reorder'],
  category: ['category', 'group', 'type'],
  sku: ['sku', 'code', 'item code', 'barcode'],
  hsnCode: ['hsn', 'hsn code', 'sac', 'sac code'],
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

function detectDelimiter(firstLine: string): string {
  if (firstLine.includes('\t')) return '\t'
  if (firstLine.includes(',') && !firstLine.includes('\t')) return ','
  if (firstLine.includes(';')) return ';'
  if (firstLine.includes('|')) return '|'
  return '\t'
}

function cleanPrice(val: string): string {
  const cleaned = val.replace(/[₹$,\s]/g, '').trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? '' : String(num)
}

export function parsePastedProductText(
  rawText: string,
  units: Unit[],
  categories: Category[],
  defaultUnitId: string,
): BulkProductRow[] {
  if (!rawText || !rawText.trim()) return []

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return []

  const delimiter = detectDelimiter(lines[0])
  const rawCells = lines.map((l) =>
    l.split(delimiter).map((c) => c.replace(/^["']|["']$/g, '').trim()),
  )

  if (rawCells.length === 0) return []

  // Map header row if present
  let dataRowsStart = 0
  const colIndexMap: Record<number, string> = {}
  const firstRow = rawCells[0]

  let matchedHeadersCount = 0
  firstRow.forEach((cell, idx) => {
    const norm = normalizeHeader(cell)
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(norm) || norm === key.toLowerCase()) {
        colIndexMap[idx] = key
        matchedHeadersCount++
        break
      }
    }
  })

  if (matchedHeadersCount >= 2) {
    dataRowsStart = 1
  } else {
    // Default sequential fallback: Name, SalePrice, PurchasePrice, Stock, Unit, Category
    const defaultSeq = ['name', 'salePrice', 'purchasePrice', 'openingStock', 'unit', 'category']
    defaultSeq.forEach((k, idx) => { colIndexMap[idx] = k })
  }

  const rows: BulkProductRow[] = []

  for (let i = dataRowsStart; i < rawCells.length; i++) {
    const cells = rawCells[i]
    if (cells.every((c) => !c)) continue

    const row: BulkProductRow = {
      id: `bulk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_${i}`,
      name: '',
      unitId: defaultUnitId,
      salePrice: '',
      purchasePrice: '',
      openingStock: '0',
      minStockLevel: '0',
      categoryId: undefined,
      sku: '',
      hsnCode: '',
    }

    cells.forEach((cellVal, colIdx) => {
      const field = colIndexMap[colIdx]
      if (!field || !cellVal) return

      if (field === 'name') row.name = cellVal
      else if (field === 'salePrice') row.salePrice = cleanPrice(cellVal)
      else if (field === 'purchasePrice') row.purchasePrice = cleanPrice(cellVal)
      else if (field === 'openingStock') row.openingStock = cleanPrice(cellVal) || '0'
      else if (field === 'minStockLevel') row.minStockLevel = cleanPrice(cellVal) || '0'
      else if (field === 'sku') row.sku = cellVal
      else if (field === 'hsnCode') row.hsnCode = cellVal
      else if (field === 'unit') {
        const normUnit = cellVal.toLowerCase().trim()
        const matched = units.find(
          (u) => u.name.toLowerCase() === normUnit || u.symbol.toLowerCase() === normUnit,
        )
        if (matched) row.unitId = matched.id
      } else if (field === 'category') {
        const normCat = cellVal.toLowerCase().trim()
        const matched = categories.find((c) => c.name.toLowerCase() === normCat)
        if (matched) row.categoryId = matched.id
      }
    })

    if (row.name) rows.push(row)
  }

  return rows
}
