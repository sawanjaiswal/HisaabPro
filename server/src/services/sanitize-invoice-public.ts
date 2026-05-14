/**
 * Public invoice sanitizer — PR3 #130.
 *
 * Security E1 (SECURITY_AUDIT_EPIC_C.md): positive-allowlist Pick.
 * NEVER spread a Prisma model.  A field not listed here is invisible to the
 * public payload — any new column added to Document / Party / Business is
 * automatically excluded until explicitly added.
 *
 * Fuzz test: server/src/services/__tests__/sanitize-invoice-public.test.ts
 * asserts that every non-allowlisted Prisma scalar key returns undefined.
 */

// ---------------------------------------------------------------------------
// Public DTO — the ONLY shape that leaves the server on GET /api/p/invoice/:token
// ---------------------------------------------------------------------------

export type PublicLineItemDto = {
  description: string
  quantity: number
  unit: string | null
  unitPrice: number   // paise
  lineTotal: number   // paise
}

export type PublicPartyDto = {
  name: string
}

export type PublicBusinessDto = {
  name: string
  gstin: string | null
  upiVpa: string | null
}

export type PublicInvoiceDto = {
  id: string
  documentNumber: string
  type: string
  status: string
  issueDate: string      // ISO 8601
  dueDate: string | null // ISO 8601
  currency: string
  subtotal: number       // paise
  grandTotal: number     // paise
  paidAmount: number     // paise
  balanceDue: number     // paise
  lineItems: PublicLineItemDto[]
  party: PublicPartyDto
  business: PublicBusinessDto
  terms: string | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Input shapes — what we fetch from Prisma (explicit select, not full model)
// ---------------------------------------------------------------------------

export interface SanitizeDocument {
  id: string
  documentNumber: string | null
  type: string
  status: string
  documentDate: Date
  dueDate: Date | null
  currencyCode: string
  subtotal: number
  grandTotal: number
  paidAmount: number
  balanceDue: number
  termsAndConditions: string | null
  notes: string | null
  lineItems: SanitizeLineItem[]
  party: SanitizeParty
  business: SanitizeBusiness
}

export interface SanitizeLineItem {
  quantity: number
  rate: number
  lineTotal: number
  product: { name: string; unit: { symbol: string } | null } | null
}

export interface SanitizeParty {
  name: string
}

export interface SanitizeBusiness {
  name: string
  gstin: string | null
  upiVpa: string | null
}

// ---------------------------------------------------------------------------
// Sanitizer — hand-written field-by-field, no spread
// ---------------------------------------------------------------------------

export function sanitizeInvoiceForPublic(doc: SanitizeDocument): PublicInvoiceDto {
  return {
    id: doc.id,
    documentNumber: doc.documentNumber ?? '',
    type: doc.type,
    status: doc.status,
    issueDate: doc.documentDate.toISOString(),
    dueDate: doc.dueDate ? doc.dueDate.toISOString() : null,
    currency: doc.currencyCode,
    subtotal: doc.subtotal,
    grandTotal: doc.grandTotal,
    paidAmount: doc.paidAmount,
    balanceDue: doc.balanceDue,
    lineItems: doc.lineItems.map((li): PublicLineItemDto => ({
      description: li.product?.name ?? '',
      quantity: li.quantity,
      unit: li.product?.unit?.symbol ?? null,
      unitPrice: li.rate,
      lineTotal: li.lineTotal,
    })),
    party: {
      name: doc.party.name,
    },
    business: {
      name: doc.business.name,
      gstin: doc.business.gstin,
      upiVpa: doc.business.upiVpa,
    },
    terms: doc.termsAndConditions ?? null,
    notes: doc.notes ?? null,
  }
}
