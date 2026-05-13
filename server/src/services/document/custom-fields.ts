/**
 * #134 — Document Custom Field Value services.
 *
 * Read + upsert per-document field values, plus a validation helper
 * that the create/update document services call inside their tx.
 */
import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'
import type { ExtendedPrismaClient } from '../../lib/prisma.js'

type Tx = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

const DOCUMENT_TYPE_TO_CUSTOM_FIELD: Record<string, string> = {
  SALE_INVOICE: 'INVOICE',
  PURCHASE_INVOICE: 'INVOICE',
  CREDIT_NOTE: 'INVOICE',
  DEBIT_NOTE: 'INVOICE',
  ESTIMATE: 'ESTIMATE',
  PROFORMA: 'ESTIMATE',
  SALE_ORDER: 'SALE_ORDER',
  PURCHASE_ORDER: 'SALE_ORDER',
  DELIVERY_CHALLAN: 'DELIVERY_CHALLAN',
}

export function mapDocumentTypeToCustomFieldKey(docType: string): string {
  return DOCUMENT_TYPE_TO_CUSTOM_FIELD[docType] ?? 'INVOICE'
}

export interface CustomFieldValueInput {
  fieldDefId: string
  valueJson?: unknown
}

/**
 * Validate an incoming valueJson against a field definition.
 * Throws validationError with CUSTOM_FIELD_INVALID_VALUE on type mismatch.
 */
function validateValue(
  def: { id: string; name: string; fieldType: string; options: string[] },
  raw: unknown,
): unknown {
  if (raw === null || raw === undefined || raw === '') return null

  switch (def.fieldType) {
    case 'TEXT':
      if (typeof raw !== 'string') {
        throw validationError(`${def.name} must be text`, { code: 'CUSTOM_FIELD_INVALID_VALUE' })
      }
      if (raw.length > 500) {
        throw validationError(`${def.name} is too long (max 500)`, { code: 'CUSTOM_FIELD_INVALID_VALUE' })
      }
      return raw
    case 'NUMBER': {
      const n = typeof raw === 'number' ? raw : Number(raw)
      if (!Number.isFinite(n)) {
        throw validationError(`${def.name} must be a number`, { code: 'CUSTOM_FIELD_INVALID_VALUE' })
      }
      return n
    }
    case 'DATE':
      if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) {
        throw validationError(`${def.name} must be a valid date`, { code: 'CUSTOM_FIELD_INVALID_VALUE' })
      }
      return raw
    case 'DROPDOWN':
      if (typeof raw !== 'string' || !def.options.includes(raw)) {
        throw validationError(
          `${def.name}: "${String(raw)}" is not a valid option`,
          { code: 'CUSTOM_FIELD_INVALID_VALUE' },
        )
      }
      return raw
    default:
      return raw
  }
}

/**
 * Validate and persist (delete-then-create) custom field values inside a tx.
 * Enforces required-field rule for fields applicable to this document type.
 */
export async function persistDocumentCustomFieldValues(
  tx: Tx,
  params: {
    businessId: string
    documentId: string
    documentType: string
    values: CustomFieldValueInput[]
  },
): Promise<void> {
  const docKey = mapDocumentTypeToCustomFieldKey(params.documentType)

  // Load all DOCUMENT-scoped field defs for this business once.
  const defs = await tx.customFieldDefinition.findMany({
    where: { businessId: params.businessId, entityType: 'DOCUMENT', isDeleted: false },
    select: { id: true, name: true, fieldType: true, options: true, required: true, documentTypes: true },
  })

  const applicableDefs = defs.filter(d => d.documentTypes.length === 0 || d.documentTypes.includes(docKey))
  const defMap = new Map(applicableDefs.map(d => [d.id, d]))

  // Cross-tenant guard: any fieldDefId in the body must belong to this business AND be applicable to docType.
  for (const v of params.values) {
    if (!defMap.has(v.fieldDefId)) {
      throw notFoundError(`Custom field ${v.fieldDefId}`)
    }
  }

  // Required-field rule — for every required def applicable to this doc type,
  // payload must provide a non-empty value.
  const valueMap = new Map(params.values.map(v => [v.fieldDefId, v.valueJson]))
  for (const def of applicableDefs) {
    if (!def.required) continue
    const raw = valueMap.get(def.id)
    if (raw === undefined || raw === null || raw === '') {
      throw validationError(`${def.name} is required`, { code: 'CUSTOM_FIELD_REQUIRED' })
    }
  }

  // Type-validate each provided value
  const sanitized = params.values.map(v => ({
    fieldDefId: v.fieldDefId,
    valueJson: validateValue(defMap.get(v.fieldDefId)!, v.valueJson),
  })).filter(v => v.valueJson !== null)

  await tx.documentCustomFieldValue.deleteMany({ where: { documentId: params.documentId } })
  if (sanitized.length === 0) return

  await tx.documentCustomFieldValue.createMany({
    data: sanitized.map(v => ({
      documentId: params.documentId,
      fieldDefId: v.fieldDefId,
      businessId: params.businessId,
      valueJson: v.valueJson as object,
    })),
  })
}

/** GET /api/documents/:id/custom-fields */
export async function listDocumentCustomFields(businessId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, businessId },
    select: { id: true },
  })
  if (!doc) throw notFoundError('Document')

  return prisma.documentCustomFieldValue.findMany({
    where: { documentId, businessId },
    select: {
      fieldDefId: true,
      valueJson: true,
      fieldDef: {
        select: { name: true, fieldType: true, options: true, required: true, showOnInvoice: true },
      },
    },
  })
}
