/**
 * invoice-crud.service — updateDocument payload contract.
 *
 * Regression guard: the server's updateDocumentSchema is `.strict()` and
 * forbids the create-only keys (type, clientId, originalDocumentId,
 * creditDebitReason). The form payload is create-shaped and always carries
 * `type`, so updateDocument MUST strip those keys before serializing the PUT
 * body — otherwise every invoice edit 400s with "Unrecognized key(s)".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}))

import { updateDocument } from '../invoice-crud.service'
import type { DocumentFormData } from '../invoice.types'

const BASE = {
  type: 'SALE_INVOICE',
  status: 'SAVED',
  partyId: 'party-1',
  documentDate: '2026-07-19',
  lineItems: [{ productId: 'p1', quantity: 1, unitPrice: 100 }],
  clientId: 'offline-uuid',
  originalDocumentId: 'orig-1',
  creditDebitReason: 'return',
  notes: 'hello',
} as unknown as Partial<DocumentFormData>

beforeEach(() => {
  vi.clearAllMocks()
  mockApi.mockResolvedValue({ id: 'doc-1' })
})

describe('updateDocument — strict-schema payload', () => {
  it('omits create-only keys from the PUT body', async () => {
    await updateDocument('doc-1', BASE, 3)

    expect(mockApi).toHaveBeenCalledTimes(1)
    const [path, opts] = mockApi.mock.calls[0] as [string, { method: string; body: string }]
    expect(path).toBe('/documents/doc-1')
    expect(opts.method).toBe('PUT')

    const body = JSON.parse(opts.body)
    expect(body).not.toHaveProperty('type')
    expect(body).not.toHaveProperty('clientId')
    expect(body).not.toHaveProperty('originalDocumentId')
    expect(body).not.toHaveProperty('creditDebitReason')
    // Update-allowed fields survive
    expect(body.partyId).toBe('party-1')
    expect(body.notes).toBe('hello')
  })

  it('still derives offline-queue metadata from the doc type', async () => {
    await updateDocument('doc-1', BASE)
    const [, opts] = mockApi.mock.calls[0] as [string, { entityType: string }]
    expect(opts.entityType).toBe('invoice')
  })
})
