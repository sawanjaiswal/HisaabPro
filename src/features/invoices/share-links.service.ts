/** Invoicing — Public Share Link services
 *
 * CRUD wrappers for the /documents/:id/share-links endpoints.
 * POST and PATCH pass entityType + entityLabel (Offline Rule 2).
 */

import { api } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShareLinkTtl = 7 | 30 | 90 | null

export interface ShareLink {
  id: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  accessCount: number
}

export interface IssuedShareLink extends ShareLink {
  /** Token — shown only once at issue time */
  token: string
  /** Full public URL (e.g. https://app.hisaabpro.in/p/invoice/<token>) */
  url: string
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * POST /api/documents/:id/share-links
 * Issues a new share link with the given TTL.
 * entityLabel uses documentNumber so the offline queue shows a meaningful name.
 */
export async function issueShareLink(
  documentId: string,
  documentNumber: string,
  ttlDays: ShareLinkTtl
): Promise<IssuedShareLink> {
  return api<IssuedShareLink>(`/documents/${documentId}/share-links`, {
    method: 'POST',
    body: JSON.stringify({ ttlDays }),
    entityType: 'shareLink',
    entityLabel: documentNumber,
  })
}

/**
 * GET /api/documents/:id/share-links
 * Lists all (active + revoked) share links for a document.
 * Safe to cache — no PII beyond createdAt / expiresAt / accessCount.
 */
export async function listShareLinks(documentId: string): Promise<ShareLink[]> {
  return api<ShareLink[]>(`/documents/${documentId}/share-links`, {
    cacheReads: true,
  })
}

/**
 * PATCH /api/documents/:id/share-links/:linkId
 * Revokes a single share link.
 */
export async function revokeShareLink(
  documentId: string,
  documentNumber: string,
  linkId: string
): Promise<void> {
  await api<void>(`/documents/${documentId}/share-links/${linkId}`, {
    method: 'PATCH',
    body: JSON.stringify({ revoked: true }),
    entityType: 'shareLink',
    entityLabel: documentNumber,
  })
}

// ─── Public (no-auth) ─────────────────────────────────────────────────────────

export interface PublicInvoiceLineItem {
  id: string
  sortOrder: number
  product: { name: string; unit: string }
  quantity: number
  rate: number
  discountAmount: number
  lineTotal: number
}

export interface PublicInvoiceDto {
  documentNumber: string
  documentDate: string
  dueDate: string | null
  notes: string | null
  termsAndConditions: string | null
  grandTotal: number
  subtotal: number
  totalDiscount: number
  totalAdditionalCharges: number
  roundOff: number
  balanceDue: number
  party: {
    name: string
    phone: string
    email: string | null
    billingAddress: {
      street: string
      city: string
      state: string
      pincode: string
    } | null
  }
  business: {
    name: string
    upiVpa: string | null
    address: string | null
  }
  lineItems: PublicInvoiceLineItem[]
}
