/**
 * Phase 7 · 7.1D PR-D3 — Payment → invoice resolver (chunk-scoped).
 *
 * Resolves `NormalizedPayment.invoiceNumber → Document.id` within a
 * single businessId. Two-tier:
 *
 *   - If `normalized.invoiceId` is already populated (preview pass
 *     resolved it), use it directly — re-verify the FK is in-business
 *     under the tx (TOCTOU defence: invoice could have been deleted or
 *     moved between preview and commit).
 *   - Else look up by (businessId, documentNumber) ignoring soft-deleted
 *     rows. First match wins; multi-match within a single business is
 *     rare (documentNumber is unique per business by convention but NOT
 *     enforced at the DB) — we pick the earliest createdAt to be
 *     deterministic.
 *
 * Cache: a single `Map<invoiceNumber, Document.id | NOT_FOUND_SENTINEL>`
 * built up across the chunk. M12 — Map + has-check, NEVER plain object.
 *
 * The resolver is `null`-tolerant: rows with `null` invoiceNumber AND
 * `null` invoiceId resolve to `{ status: 'NO_INVOICE' }` (un-allocated
 * payment — Payment row exists, no PaymentAllocation row). Unmatchable
 * invoice numbers resolve to `{ status: 'NOT_FOUND' }` and the caller
 * marks the row COMMIT_BLOCKED_INVOICE_NOT_FOUND.
 *
 * Authority:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6 (resolver step before guard)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md M1 (businessId scoping)
 *   - M12 frozen-Map pattern (prototype pollution defence)
 */

import type { Tx } from '../commit.helpers.js'
import type { NormalizedPayment } from './types.js'

export type InvoiceResolution =
  | { status: 'RESOLVED'; invoiceId: string }
  | { status: 'NO_INVOICE' }
  | { status: 'NOT_FOUND' }

const NOT_FOUND = Symbol('NOT_FOUND')
type CacheValue = string | typeof NOT_FOUND

export class PaymentInvoiceResolver {
  // M12 — Map, never object. Keys are pre-trimmed invoice numbers.
  private readonly cache = new Map<string, CacheValue>()

  constructor(
    private readonly tx: Tx,
    private readonly businessId: string,
  ) {}

  /**
   * Resolve a single normalized payment row to an invoice id (or
   * NOT_FOUND / NO_INVOICE). Cached per-chunk so N rows referencing
   * the same invoice number issue only one Document SELECT.
   */
  async resolve(row: NormalizedPayment): Promise<InvoiceResolution> {
    // 1. Preview-resolved ids — re-verify in-business.
    if (row.invoiceId) {
      const ok = await this.verifyInBusiness(row.invoiceId)
      if (ok) return { status: 'RESOLVED', invoiceId: row.invoiceId }
      // Preview-resolved id no longer valid — fall through to lookup
      // by number (if any) so the row gets a second chance.
    }
    if (!row.invoiceNumber) {
      return { status: 'NO_INVOICE' }
    }

    const key = row.invoiceNumber.trim()
    if (key === '') return { status: 'NO_INVOICE' }

    // M12 — has-check, not `key in obj`.
    if (this.cache.has(key)) {
      const v = this.cache.get(key)
      if (v === NOT_FOUND) return { status: 'NOT_FOUND' }
      return { status: 'RESOLVED', invoiceId: v as string }
    }

    const id = await this.lookupByNumber(key)
    this.cache.set(key, id ?? NOT_FOUND)
    return id ? { status: 'RESOLVED', invoiceId: id } : { status: 'NOT_FOUND' }
  }

  private async verifyInBusiness(invoiceId: string): Promise<boolean> {
    const rows = await this.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Document"
      WHERE id = ${invoiceId}
        AND "businessId" = ${this.businessId}
        AND "isDeleted" = false
      LIMIT 1
    `
    return rows.length === 1
  }

  private async lookupByNumber(documentNumber: string): Promise<string | null> {
    // businessId scoping is non-negotiable (M1). Pick earliest createdAt
    // to be deterministic if two docs share a number (legacy data).
    const rows = await this.tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Document"
      WHERE "businessId" = ${this.businessId}
        AND "documentNumber" = ${documentNumber}
        AND "isDeleted" = false
      ORDER BY "createdAt" ASC
      LIMIT 1
    `
    return rows[0]?.id ?? null
  }
}
