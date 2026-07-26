/**
 * The upload transport against the response the server actually sends.
 *
 * `api<T>()` asserts its type parameter, it never checks it — so a client DTO
 * can describe a response nobody returns and still compile. That is exactly
 * what happened here: the wizard read `res.jobId` from an envelope whose only
 * job field is `res.job.id`, and every upload navigated to /imports/undefined.
 *
 * The envelope below is copied from server/src/routes/imports/create.route.ts
 * (the sync-parse arm). If the route changes shape, this test is the thing
 * that should fail.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const apiMock = vi.fn()
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => apiMock(...args) }))

import { uploadImport } from '../services/import.service'
import { IMPORT_MIN_CLIENT_VERSION } from '../constants/import.constants'

/** What POST /api/imports answers with when the file parses synchronously. */
const SERVER_ENVELOPE = {
  job: {
    id: 'cms1jcpvu0003roduf7fop2c2',
    status: 'PREVIEWED',
    format: 'VYAPAR_CSV',
    fileName: 'parties.csv',
    rowCount: 2,
    errorCount: 0,
    commitToken: '6f1c2f1a-0b3d-4a1e-9d0c-8b7a6e5d4c3b',
    createdAt: '2026-07-26T08:24:45.641Z',
    updatedAt: '2026-07-26T08:24:45.641Z',
  },
  existing: false,
}

function csvFile() {
  return new File(['Party Name,Phone Number\nRaju Traders,9111111111\n'], 'parties.csv', {
    type: 'text/csv',
  })
}

describe('uploadImport speaks the server’s contract', () => {
  beforeEach(() => {
    apiMock.mockReset()
    apiMock.mockResolvedValue(SERVER_ENVELOPE)
  })

  it('the caller can reach the job id and commit token the preview issued', async () => {
    const res = await uploadImport({
      file: csvFile(),
      format: 'VYAPAR_CSV',
      idempotencyKey: 'key-1',
    })
    expect(res.job.id, 'the id the wizard navigates to').toBe(SERVER_ENVELOPE.job.id)
    expect(res.job.commitToken).toBe(SERVER_ENVELOPE.job.commitToken)
    expect(res.existing).toBe(false)
  })

  it('sends the idempotency key under the header the server reads', async () => {
    await uploadImport({ file: csvFile(), format: 'VYAPAR_CSV', idempotencyKey: 'key-2' })
    const opts = apiMock.mock.calls[0]![1] as { headers?: Record<string, string> }
    // middleware/idempotency.ts reads req.headers['x-idempotency-key']; any
    // other spelling is silently ignored and the upload is processed twice.
    expect(opts.headers?.['X-Idempotency-Key']).toBe('key-2')
  })

  it('carries the client version as a header, never as a form field', async () => {
    await uploadImport({ file: csvFile(), format: 'VYAPAR_CSV', idempotencyKey: 'key-3' })
    const [, opts] = apiMock.mock.calls[0]! as [
      string,
      { headers?: Record<string, string>; body?: FormData },
    ]
    // requireMinClientVersion reads the HEADER and 426s in production when it
    // is missing; uploadBodySchema is .strict(), so the same value sent as a
    // form field is a 400 VALIDATION_ERROR ("Unrecognized key: 'clientVersion'").
    // Both halves of that trap are pinned here.
    expect(opts.headers?.['X-Client-Version']).toBe(IMPORT_MIN_CLIENT_VERSION)
    expect(opts.body?.get('clientVersion')).toBeNull()
  })
})
