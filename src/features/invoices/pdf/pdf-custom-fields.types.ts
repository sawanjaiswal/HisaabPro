/**
 * PR4 — Types for custom-field values rendered inside the invoice PDF.
 *
 * Security (4.1): only fields with showOnInvoice=true and matching
 * businessId are passed into the PDF renderer. Filtering is done
 * client-side by usePdfCustomFields (defence-in-depth: the
 * GET /api/documents/:id/custom-fields endpoint already scopes by
 * businessId via listDocumentCustomFields, per custom-fields.ts:140-157).
 */

import type { CustomFieldType } from '@/features/settings/document-custom-fields.service'
import type { ApplicableDocumentType } from '@/features/settings/document-custom-fields.service'

/** A resolved custom-field row ready to render in the PDF. */
export interface PdfCustomFieldRow {
  /** fieldDefId — used as React key */
  fieldDefId: string
  /** Label shown in the "Custom Details" block header */
  name: string
  /** Formatted display value (never null/empty — rows with no value are
   *  pre-filtered before this type is produced) */
  displayValue: string
}

/**
 * Props for PdfCustomFieldsSection.
 *
 * The parent PDF document component fetches raw values from the API,
 * applies the showOnInvoice + documentType filters, then passes
 * the pre-resolved rows here to keep the PDF component pure/testable.
 */
export interface PdfCustomFieldsSectionProps {
  /** Pre-filtered rows (showOnInvoice=true, non-empty value, correct doc type).
   *  Empty array → section is not rendered. */
  rows: PdfCustomFieldRow[]
  /** Section heading — pass t.customDetails from the active language */
  sectionLabel: string
}

/**
 * Raw API row from GET /api/documents/:id/custom-fields.
 * Mirrors the Prisma select in custom-fields.ts:listDocumentCustomFields.
 */
export interface RawCustomFieldValueRow {
  fieldDefId: string
  valueJson: unknown
  fieldDef: {
    name: string
    fieldType: string
    options: string[]
    required: boolean
    showOnInvoice: boolean
    /** ApplicableDocumentType values present in this array, or empty = all types */
    documentTypes?: string[]
  }
}

/** Resolve a raw valueJson to a display string for the PDF.
 *  Returns null when value is empty (row should be skipped). */
export function resolveDisplayValue(
  fieldType: CustomFieldType,
  valueJson: unknown,
): string | null {
  if (valueJson === null || valueJson === undefined || valueJson === '') return null

  switch (fieldType) {
    case 'TEXT':
      return typeof valueJson === 'string' ? valueJson : String(valueJson)

    case 'NUMBER': {
      const n = typeof valueJson === 'number' ? valueJson : Number(valueJson)
      if (!Number.isFinite(n)) return null
      // Indian number grouping — Intl unavailable in react-pdf renderer
      return formatIndianNumber(n)
    }

    case 'DATE': {
      if (typeof valueJson !== 'string') return null
      // Parse ISO date string to dd/mm/yyyy
      const d = new Date(valueJson)
      if (Number.isNaN(d.getTime())) return null
      const day   = String(d.getDate()).padStart(2, '0')
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const year  = d.getFullYear()
      return `${day}/${month}/${year}`
    }

    case 'DROPDOWN':
      return typeof valueJson === 'string' ? valueJson : null

    default:
      return typeof valueJson === 'string' ? valueJson : String(valueJson)
  }
}

/**
 * Indian number formatting without Intl (react-pdf renderer context).
 * 1000 → "1,000"  |  100000 → "1,00,000"  |  12345.6 → "12,345.60"
 */
function formatIndianNumber(n: number): string {
  const abs = Math.abs(n)
  const [intPart, decPart] = abs.toFixed(2).split('.')
  const s = intPart ?? '0'
  let result = ''

  if (s.length <= 3) {
    result = s
  } else {
    const suffix = s.slice(s.length - 3)
    const prefix = s.slice(0, s.length - 3)
    let grouped = ''
    let idx = 0
    for (let i = prefix.length - 1; i >= 0; i--) {
      grouped = prefix[i] + grouped
      idx++
      if (idx % 2 === 0 && i !== 0) grouped = ',' + grouped
    }
    result = grouped + ',' + suffix
  }

  const sign = n < 0 ? '-' : ''
  return `${sign}${result}.${decPart ?? '00'}`
}

/**
 * Filter and resolve raw API rows into PdfCustomFieldRow[].
 *
 * Security 4.1:
 * - Excludes rows where fieldDef.showOnInvoice !== true
 * - Excludes rows with empty / null values
 * - Filters by documentType when fieldDef.documentTypes is non-empty
 *
 * The businessId scoping is already enforced by the API (custom-fields.ts:140-157)
 * but callers should ONLY pass rows from their own businessId as defence in depth.
 */
export function filterPdfCustomFieldRows(
  rawRows: RawCustomFieldValueRow[],
  docType: ApplicableDocumentType,
): PdfCustomFieldRow[] {
  const result: PdfCustomFieldRow[] = []

  for (const row of rawRows) {
    // Security 4.1 — showOnInvoice gate
    if (!row.fieldDef.showOnInvoice) continue

    // documentType filter — empty array means all types
    const applicableTypes = row.fieldDef.documentTypes ?? []
    if (applicableTypes.length > 0 && !applicableTypes.includes(docType)) continue

    const display = resolveDisplayValue(
      row.fieldDef.fieldType as CustomFieldType,
      row.valueJson,
    )
    if (display === null) continue

    result.push({ fieldDefId: row.fieldDefId, name: row.fieldDef.name, displayValue: display })
  }

  return result
}
