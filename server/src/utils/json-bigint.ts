/**
 * Phase 7 · 7.1B — M5 BigInt JSON serialisation
 *
 * JSON.stringify throws on `BigInt` values. This module provides a
 * scoped replacer + a typed helper for serialising `NormalizedProduct`
 * to a JSON-safe shape (paise become strings on the wire). We
 * DELIBERATELY do NOT install a global `BigInt.prototype.toJSON` —
 * that mutates a primitive prototype across every module in the
 * process and turns silent type changes (number→string) into invisible
 * footguns far from this file.
 *
 * Cross-references:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M5
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1B.md §6 (wire format)
 */

import type { NormalizedProduct } from '../types/import.types.js'

/** Standard JSON.stringify replacer turning BigInt into a string. */
export function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? String(value) : value
}

/**
 * Map a `NormalizedProduct` to a JSON-serialisable view: bigint fields
 * become decimal strings, everything else passes through. The wire is
 * always a string here so the FE can `BigInt(str)` without precision
 * loss and `Number(b)` only when calling `formatCurrency` (safe — the
 * regex bounds keep values inside MAX_SAFE_INTEGER).
 */
export function serializeNormalizedProduct(
  p: NormalizedProduct,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    name: p.name,
    openingStock: p.openingStock,
    issues: p.issues,
  }
  if (p.sku !== undefined) out.sku = p.sku
  if (p.hsnCode !== undefined) out.hsnCode = p.hsnCode
  if (p.salePrice !== undefined) out.salePrice = String(p.salePrice)
  if (p.purchasePrice !== undefined) out.purchasePrice = String(p.purchasePrice)
  if (p.mrp !== undefined) out.mrp = String(p.mrp)
  if (p.unit !== undefined) out.unit = p.unit
  if (p.unitSourceText !== undefined) out.unitSourceText = p.unitSourceText
  if (p.description !== undefined) out.description = p.description
  return out
}
