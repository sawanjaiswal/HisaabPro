import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError, api } from '../api'

describe('ApiError', () => {
  it('creates error with message, code, and status', () => {
    const err = new ApiError('Not found', 'NOT_FOUND', 404)
    expect(err.message).toBe('Not found')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.status).toBe(404)
    expect(err.name).toBe('ApiError')
  })

  it('is an instance of Error', () => {
    const err = new ApiError('fail', 'UNKNOWN', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(ApiError)
  })

  it('has proper stack trace', () => {
    const err = new ApiError('test', 'TEST', 400)
    expect(err.stack).toBeTruthy()
  })
})

describe('401 refresh interceptor — /auth/me should refresh, not hard-log-out', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.unstubAllGlobals()
  })

  it('attempts a token refresh and retries on a 401 from /auth/me instead of throwing immediately', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock
      // 1. GET /auth/me → 401 (expired access token)
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false }), { status: 401 }))
      // 2. POST /auth/refresh → 200 (refresh-token cookie still valid)
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
      // 3. Retried GET /auth/me → 200
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: { user: { id: '1' } } }), { status: 200 }),
      )

    const result = await api('/auth/me')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[1][0])).toContain('/auth/refresh')
    expect(result).toEqual({ user: { id: '1' } })
  })

  it('does NOT attempt a refresh on a 401 from /auth/login (bad credentials, not expired token)', async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS' } }), { status: 401 }),
    )

    await expect(
      api('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }) }),
    ).rejects.toThrow(ApiError)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
