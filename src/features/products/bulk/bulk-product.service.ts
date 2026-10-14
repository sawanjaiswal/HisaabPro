/**
 * Bulk Product Add — Validation & Commit Service (Level 6 SSOT)
 */

import { createProduct } from '../product.service'
import type { BulkProductRow, BulkProductRowValidation } from './bulk-product.types'
import type { ProductFormData } from '../product.types'

export function validateBulkRow(row: BulkProductRow): BulkProductRowValidation {
  const errors: Record<string, string> = {}

  if (!row.name.trim()) {
    errors.name = 'Product name is required'
  }

  if (!row.unitId) {
    errors.unitId = 'Unit is required'
  }

  const sp = parseFloat(row.salePrice)
  if (isNaN(sp) || sp < 0) {
    errors.salePrice = 'Valid sale price is required'
  }

  if (row.purchasePrice.trim() !== '') {
    const pp = parseFloat(row.purchasePrice)
    if (isNaN(pp) || pp < 0) {
      errors.purchasePrice = 'Purchase price cannot be negative'
    }
  }

  if (row.openingStock.trim() !== '') {
    const os = parseFloat(row.openingStock)
    if (isNaN(os) || os < 0) {
      errors.openingStock = 'Opening stock cannot be negative'
    }
  }

  if (row.minStockLevel.trim() !== '') {
    const ms = parseFloat(row.minStockLevel)
    if (isNaN(ms) || ms < 0) {
      errors.minStockLevel = 'Min stock cannot be negative'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}

export function rowToFormData(row: BulkProductRow): ProductFormData {
  const saleRupees = parseFloat(row.salePrice) || 0
  const purchaseRupees = parseFloat(row.purchasePrice) || 0
  const openingStock = parseFloat(row.openingStock) || 0
  const minStockLevel = parseFloat(row.minStockLevel) || 0

  return {
    name: row.name.trim(),
    unitId: row.unitId,
    salePrice: Math.round(saleRupees * 100),
    purchasePrice: Math.round(purchaseRupees * 100),
    openingStock,
    minStockLevel,
    stockValidation: 'GLOBAL',
    status: 'ACTIVE',
    autoGenerateSku: !row.sku?.trim(),
    sku: row.sku?.trim() || undefined,
    categoryId: row.categoryId || null,
    hsnCode: row.hsnCode?.trim() || undefined,
  }
}

export interface BulkCommitResult {
  succeeded: number
  failed: number
  failedNames: string[]
}

export async function commitBulkProducts(
  rows: BulkProductRow[],
  onProgress?: (current: number, total: number) => void,
): Promise<BulkCommitResult> {
  const validRows = rows.filter((r) => validateBulkRow(r).isValid)
  let succeeded = 0
  let failed = 0
  const failedNames: string[] = []

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    try {
      const payload = rowToFormData(row)
      await createProduct(payload)
      succeeded++
    } catch {
      failed++
      failedNames.push(row.name)
    }
    onProgress?.(i + 1, validRows.length)
  }

  return { succeeded, failed, failedNames }
}
