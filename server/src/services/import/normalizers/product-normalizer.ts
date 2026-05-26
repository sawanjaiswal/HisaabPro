/**
 * Phase 7 · 7.1B — Product normalizer
 *
 * Pure function: RawProductRow + ColumnMapping → NormalizedProduct.
 *
 * Field pipeline (SCOPE L100-170 + M5/M6/M7):
 *   name  → sanitizeControlChars(NAME_MAX_LEN) → placeholder check
 *   sku   → sanitizeControlChars(SKU_MAX_LEN) → length guard
 *   hsn   → validateHsn  (M7)
 *   unit  → resolveUnit  (M6)
 *   sale  / purchase / mrp → parsePaiseBigInt (BigInt paise)
 *   openingStock → numeric string preserved (Decimal precision)
 *   description  → truncated at DESCRIPTION_MAX_LEN
 *
 * Rows are NEVER dropped here — even fully malformed rows pass through
 * with `issues[]`. classifyRow downstream decides STAGED vs ERROR.
 *
 * Cross-references:
 *   - SCOPE_PHASE7_IMPORT_7_1B.md File Plan row 10
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M5/M6/M7
 */

import type {
  NormalizedProduct,
  RawProductRow,
  RowIssue,
} from '../../../types/import.types.js'
import {
  DESCRIPTION_MAX_LEN,
  PRODUCT_PLACEHOLDER_NAMES,
  SKU_MAX_LEN,
  UNIT_MAX_LEN,
} from '../../../constants/import.constants.js'
import { sanitizeControlChars } from '../security/unicode.js'
import { parsePaiseBigInt } from '../utils/price.util.js'
import { resolveUnit } from '../utils/unit-resolver.js'
import { validateHsn } from '../utils/hsn.util.js'
import type { ProductColumnMapping } from './product-mappings.js'

export type { ProductColumnMapping } from './product-mappings.js'

const NAME_MAX_LEN = 200

function lookup(
  raw: Record<string, string>,
  header: string | undefined,
): string | undefined {
  if (!header) return undefined
  const direct = raw[header]
  if (direct !== undefined) return direct
  const lc = header.toLowerCase()
  for (const k of Object.keys(raw)) {
    if (k.toLowerCase() === lc) return raw[k]
  }
  return undefined
}

function issue(field: string, code: string, message: string): RowIssue {
  return { field, code, message }
}

function pushPrice(
  issues: RowIssue[],
  field: string,
  raw: string | undefined,
): bigint | undefined {
  if (raw === undefined || raw === null) return undefined
  const trimmed = String(raw).trim()
  if (trimmed === '') return undefined
  const r = parsePaiseBigInt(trimmed)
  if (r.value === null) {
    issues.push(issue(field, r.issue ?? 'PRICE_INVALID', `${field} invalid`))
    return undefined
  }
  if (r.issue === 'PRICE_PRECISION_LOST') {
    issues.push(issue(field, 'PRICE_PRECISION_LOST', `${field} rounded to 2dp`))
  }
  return r.value
}

function normaliseOpeningStock(
  raw: string | undefined,
  issues: RowIssue[],
): string {
  if (!raw) return '0'
  const t = String(raw).trim().replace(/,/g, '')
  if (t === '') return '0'
  if (!/^-?\d+(\.\d+)?$/.test(t)) {
    issues.push(
      issue('openingStock', 'OPENING_STOCK_INVALID', 'Opening stock not numeric'),
    )
    return '0'
  }
  return t
}

export function normalizeProductRow(
  row: RawProductRow,
  mapping: ProductColumnMapping,
): NormalizedProduct {
  const issues: RowIssue[] = []

  // name (M6 sanitise + placeholder check)
  const rawName = lookup(row.raw, mapping.name)
  const name = sanitizeControlChars(rawName ?? '', { maxLen: NAME_MAX_LEN })
  if (!name) {
    issues.push(issue('name', 'NAME_REQUIRED', 'Name is required'))
  } else if (PRODUCT_PLACEHOLDER_NAMES.has(name.toLowerCase())) {
    issues.push(
      issue('name', 'PRODUCT_PLACEHOLDER_NAME', 'Placeholder name'),
    )
  }

  // sku
  let sku: string | undefined
  const rawSku = lookup(row.raw, mapping.sku)
  if (rawSku !== undefined) {
    const cleanedSku = sanitizeControlChars(rawSku, { maxLen: SKU_MAX_LEN })
    if (cleanedSku) {
      if (String(rawSku).trim().length > SKU_MAX_LEN) {
        issues.push(issue('sku', 'SKU_TOO_LONG', `SKU exceeds ${SKU_MAX_LEN}`))
      }
      sku = cleanedSku
    }
  }

  // hsn (M7)
  let hsnCode: string | null = null
  const rawHsn = lookup(row.raw, mapping.hsn)
  if (rawHsn !== undefined && rawHsn !== '') {
    const r = validateHsn(rawHsn)
    hsnCode = r.hsn
    if (r.issue) issues.push(issue('hsn', r.issue, 'HSN invalid'))
  }

  // unit (M6)
  let unit: string | undefined
  let unitSourceText: string | undefined
  const rawUnit = lookup(row.raw, mapping.unit)
  if (rawUnit !== undefined && rawUnit !== '') {
    const r = resolveUnit(rawUnit)
    if (r.unit) {
      unit = r.unit
    } else {
      if (r.unitSourceText) {
        const cleanedSrc = sanitizeControlChars(r.unitSourceText, {
          maxLen: UNIT_MAX_LEN,
        })
        if (cleanedSrc) unitSourceText = cleanedSrc
      }
      if (r.issue) issues.push(issue('unit', r.issue, 'Unit not found'))
    }
  }

  // prices (BigInt paise)
  const salePrice = pushPrice(issues, 'salePrice', lookup(row.raw, mapping.salePrice))
  const purchasePrice = pushPrice(
    issues,
    'purchasePrice',
    lookup(row.raw, mapping.purchasePrice),
  )
  const mrp = pushPrice(issues, 'mrp', lookup(row.raw, mapping.mrp))

  // opening stock (Decimal-as-string)
  const openingStock = normaliseOpeningStock(
    lookup(row.raw, mapping.openingStock),
    issues,
  )

  // description (truncate, no issue if empty)
  let description: string | undefined
  const rawDesc = lookup(row.raw, mapping.description)
  if (rawDesc !== undefined && rawDesc !== '') {
    const cleaned = sanitizeControlChars(rawDesc, { maxLen: DESCRIPTION_MAX_LEN })
    if (String(rawDesc).length > DESCRIPTION_MAX_LEN) {
      issues.push(
        issue(
          'description',
          'DESCRIPTION_TRUNCATED',
          `Description truncated at ${DESCRIPTION_MAX_LEN}`,
        ),
      )
    }
    if (cleaned) description = cleaned
  }

  const out: NormalizedProduct = {
    name,
    openingStock,
    issues,
    hsnCode,
  }
  if (sku !== undefined) out.sku = sku
  if (unit !== undefined) out.unit = unit
  if (unitSourceText !== undefined) out.unitSourceText = unitSourceText
  if (salePrice !== undefined) out.salePrice = salePrice
  if (purchasePrice !== undefined) out.purchasePrice = purchasePrice
  if (mrp !== undefined) out.mrp = mrp
  if (description !== undefined) out.description = description
  return out
}

export {
  TALLY_PRODUCT_MAPPING,
  VYAPAR_PRODUCT_MAPPING,
  BUSY_PRODUCT_MAPPING,
  defaultProductMappingFor,
} from './product-mappings.js'
