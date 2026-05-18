/** audit-log.service tests — Phase 6 PR4 FE
 *
 * Coverage:
 *   - buildAuditSearchQuery() respects/omits the right params
 *   - searchAuditLog() forwards verbatim to api() with cursor pagination
 *   - listRedactions / upsertRedaction / disableRedaction call shapes
 *   - exportAuditLog uses raw fetch (POST application/json → Blob)
 *   - URL builder does NOT escape or mangle the `q` value (fuzz strings
 *     must reach the BE intact — same battery as the PR4 BE test)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApi = vi.fn()
vi.mock('@/lib/api', () => ({
  api: (...args: unknown[]) => mockApi(...args),
  ApiError: class ApiError extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

vi.mock('@/config/app.config', () => ({
  API_URL: 'http://test.local/api',
  APP_NAME: 'HisaabPro',
  TIMEOUTS: { fetchMs: 30000, debounceMs: 300 },
}))

import {
  buildAuditSearchQuery,
  searchAuditLog,
  listRedactions,
  upsertRedaction,
  disableRedaction,
  exportAuditLog,
  downloadAuditCsv,
} from '../audit-log.service'
import { AUDIT_PAGE_SIZE } from '../audit.constants'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── buildAuditSearchQuery ────────────────────────────────────────────────────

describe('buildAuditSearchQuery', () => {
  it('emits only the limit when filters and cursor are empty', () => {
    const qs = buildAuditSearchQuery({}, null)
    expect(qs).toBe(`limit=${AUDIT_PAGE_SIZE}`)
  })

  it('includes every supplied filter', () => {
    const qs = buildAuditSearchQuery(
      {
        q: 'foo',
        entityType: 'INVOICE',
        action: 'UPDATE',
        userId: 'usr_1',
        dateFrom: '2026-05-01',
        dateTo: '2026-05-17',
      },
      null,
    )
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBe('foo')
    expect(params.get('entityType')).toBe('INVOICE')
    expect(params.get('action')).toBe('UPDATE')
    expect(params.get('userId')).toBe('usr_1')
    expect(params.get('dateFrom')).toBe('2026-05-01')
    expect(params.get('dateTo')).toBe('2026-05-17')
    expect(params.get('limit')).toBe(String(AUDIT_PAGE_SIZE))
  })

  it('omits empty-string filters', () => {
    const qs = buildAuditSearchQuery({ q: '', entityType: '', userId: '' }, null)
    const params = new URLSearchParams(qs)
    expect(params.get('q')).toBeNull()
    expect(params.get('entityType')).toBeNull()
    expect(params.get('userId')).toBeNull()
  })

  it('appends the cursor when supplied', () => {
    const qs = buildAuditSearchQuery({}, 'opaque-cursor-abc==')
    const params = new URLSearchParams(qs)
    expect(params.get('cursor')).toBe('opaque-cursor-abc==')
  })

  it('omits the cursor when null or empty', () => {
    expect(new URLSearchParams(buildAuditSearchQuery({}, null)).get('cursor')).toBeNull()
    expect(new URLSearchParams(buildAuditSearchQuery({}, '')).get('cursor')).toBeNull()
  })

  it('honors a custom limit', () => {
    const qs = buildAuditSearchQuery({}, null, 50)
    expect(new URLSearchParams(qs).get('limit')).toBe('50')
  })

  // Verbatim-q fuzz battery — these are the same strings PR4 BE proved
  // websearch_to_tsquery handles. The FE MUST forward them unmodified
  // (no escaping, normalizing, or stripping) so the BE hardening applies.
  const FUZZ = [
    'R&D', '(test)', "it's", 'a|b', '--', '&|!()', '"unclosed quote',
    '((unbalanced', 'AND', 'OR', '<script>', 'a/b/c', ' leading-space',
    'trailing-space ', 'tab\there', 'newline\nhere', 'utf-8 ✓ ©',
  ] as const

  describe('q fuzz battery — values reach the BE verbatim', () => {
    for (const q of FUZZ) {
      it(`preserves q exactly: ${JSON.stringify(q)}`, () => {
        const qs = buildAuditSearchQuery({ q }, null)
        const params = new URLSearchParams(qs)
        expect(params.get('q')).toBe(q)
      })
    }
  })
})

// ─── searchAuditLog ───────────────────────────────────────────────────────────

describe('searchAuditLog', () => {
  it('calls api() with /audit and the query string', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    await searchAuditLog({ q: 'test' }, null)
    expect(mockApi).toHaveBeenCalledTimes(1)
    const [path] = mockApi.mock.calls[0]
    expect(String(path).startsWith('/audit?')).toBe(true)
    expect(String(path)).toContain('q=test')
    expect(String(path)).toContain(`limit=${AUDIT_PAGE_SIZE}`)
  })

  it('forwards the cursor on subsequent pages', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    await searchAuditLog({}, 'cursor-page-2')
    const [path] = mockApi.mock.calls[0]
    expect(String(path)).toContain('cursor=cursor-page-2')
  })

  it('forwards an AbortSignal when supplied', async () => {
    mockApi.mockResolvedValue({ rows: [], nextCursor: null })
    const controller = new AbortController()
    await searchAuditLog({}, null, AUDIT_PAGE_SIZE, controller.signal)
    const [, opts] = mockApi.mock.calls[0]
    expect((opts as { signal?: AbortSignal })?.signal).toBe(controller.signal)
  })
})

// ─── Redactions CRUD ─────────────────────────────────────────────────────────

describe('redactions service', () => {
  it('listRedactions GETs /audit/redactions', async () => {
    mockApi.mockResolvedValue({ items: [] })
    await listRedactions()
    expect(mockApi).toHaveBeenCalledWith('/audit/redactions', expect.any(Object))
  })

  it('upsertRedaction POSTs with entityType + entityLabel for the offline queue', async () => {
    mockApi.mockResolvedValue({ redaction: { id: 'r1' } })
    await upsertRedaction({ entityType: 'PARTY', fieldPath: 'phone', enabled: true })
    expect(mockApi).toHaveBeenCalledWith('/audit/redactions', expect.objectContaining({
      method: 'POST',
      entityType: 'redaction',
      entityLabel: 'PARTY.phone',
    }))
    const [, opts] = mockApi.mock.calls[0]
    expect(JSON.parse((opts as { body: string }).body)).toEqual({
      entityType: 'PARTY',
      fieldPath: 'phone',
      enabled: true,
    })
  })

  it('disableRedaction DELETEs the encoded id with a label', async () => {
    mockApi.mockResolvedValue({ redaction: { id: 'r1' } })
    await disableRedaction('id with spaces', 'PARTY.phone')
    expect(mockApi).toHaveBeenCalledWith(
      `/audit/redactions/${encodeURIComponent('id with spaces')}`,
      expect.objectContaining({
        method: 'DELETE',
        entityType: 'redaction',
        entityLabel: 'PARTY.phone',
      }),
    )
  })
})

// ─── exportAuditLog ──────────────────────────────────────────────────────────

describe('exportAuditLog', () => {
  it('POSTs to /audit/export with the filter body and returns a Blob', async () => {
    const csv = 'col\nrow1\n'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(csv, { status: 200, headers: { 'Content-Type': 'text/csv' } }),
    )
    const blob = await exportAuditLog({ q: 'foo', action: 'CREATE' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://test.local/api/audit/export')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ q: 'foo', action: 'CREATE' })
    // No cursor/limit in the export body — server's export endpoint rejects them
    expect(body).not.toHaveProperty('cursor')
    expect(body).not.toHaveProperty('limit')
    // The return is a Blob-shape (Node and browser Blob constructors differ
    // across vitest environments — assert the shape, not the identity).
    expect(blob).toBeTruthy()
    expect(typeof (blob as Blob).size).toBe('number')
    expect((blob as Blob).size).toBeGreaterThan(0)
    fetchSpy.mockRestore()
  })

  it('throws ApiError on non-2xx response', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Forbidden', { status: 403 }),
    )
    await expect(exportAuditLog({})).rejects.toMatchObject({
      code: 'EXPORT_FAILED',
      status: 403,
    })
    fetchSpy.mockRestore()
  })
})

describe('downloadAuditCsv', () => {
  it('creates an anchor, clicks it, and revokes the object URL', () => {
    const createObjectURL = vi.fn(() => 'blob:abc')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true })

    const blob = new Blob(['x'], { type: 'text/csv' })
    downloadAuditCsv(blob, 'audit.csv')

    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:abc')
  })
})
