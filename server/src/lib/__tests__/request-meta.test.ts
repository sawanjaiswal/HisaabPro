/**
 * File #29 — the request-meta ALS slot.
 *
 * Small surface, but two of its properties are the difference between the shadow
 * harness recording usable evidence and recording noise, so both are asserted
 * rather than assumed:
 *
 *   1. The store survives an `await`. `runWithRequestMeta` wraps `next()`, and
 *      every Express handler after it is async. An ALS store that did not
 *      propagate across continuations would leave `getRequestMeta()` undefined by
 *      the time a Prisma query runs — silently relabelling every HTTP record as
 *      `job` and reading, from the outside, exactly like "the middleware was never
 *      mounted".
 *
 *   2. `getRouteHint` is evaluated late. It is stored as a thunk precisely so the
 *      Express route template can be read at record-build time; a test that only
 *      checked the returned string would pass on an implementation that captured
 *      the value eagerly, which is the bug the thunk exists to prevent.
 */
import { describe, expect, it, vi } from 'vitest'
import { getRequestMeta, runWithRequestMeta } from '../request-meta.js'
import type { RequestMeta } from '../prisma-shadow.types.js'

const meta = (over: Partial<RequestMeta> = {}): RequestMeta => ({
  method: 'GET',
  getRouteHint: () => 'GET /api/parties',
  hadBusinessOnToken: true,
  ...over,
})

describe('request-meta ALS slot', () => {
  it('is undefined outside any frame — the job path', () => {
    expect(getRequestMeta()).toBeUndefined()
  })

  it('exposes the meta inside the frame', () => {
    runWithRequestMeta(meta(), () => {
      expect(getRequestMeta()?.method).toBe('GET')
      expect(getRequestMeta()?.hadBusinessOnToken).toBe(true)
    })
  })

  it('survives awaits — the store must reach the Prisma call, not just the middleware', async () => {
    await runWithRequestMeta(meta(), async () => {
      await new Promise((r) => setTimeout(r, 1))
      await Promise.resolve()
      expect(getRequestMeta()?.getRouteHint()).toBe('GET /api/parties')
    })
  })

  it('does not leak out of the frame', async () => {
    await runWithRequestMeta(meta(), async () => {
      await Promise.resolve()
    })
    expect(getRequestMeta()).toBeUndefined()
  })

  it('nests without clobbering — an inner frame restores the outer on exit', () => {
    runWithRequestMeta(meta({ method: 'GET' }), () => {
      runWithRequestMeta(meta({ method: 'POST' }), () => {
        expect(getRequestMeta()?.method).toBe('POST')
      })
      expect(getRequestMeta()?.method).toBe('GET')
    })
  })

  it('evaluates getRouteHint lazily, at read time', () => {
    const hint = vi.fn(() => 'GET /api/parties/:id')

    runWithRequestMeta(meta({ getRouteHint: hint }), () => {
      // Stored, not called. `req.route` does not exist yet when `auth` runs — an
      // eager read would capture '' on every request in production.
      expect(hint).not.toHaveBeenCalled()
      expect(getRequestMeta()?.getRouteHint()).toBe('GET /api/parties/:id')
      expect(hint).toHaveBeenCalledTimes(1)
    })
  })

  it('returns whatever the thunk returns at call time, including a later value', () => {
    let route: string | null = null
    const m = meta({ getRouteHint: () => (route ? `GET ${route}` : '') })

    runWithRequestMeta(m, () => {
      expect(getRequestMeta()?.getRouteHint()).toBe('')
      // The handler layer matched — this is the transition the thunk exists for.
      route = '/api/parties'
      expect(getRequestMeta()?.getRouteHint()).toBe('GET /api/parties')
    })
  })
})
