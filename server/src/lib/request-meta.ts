/**
 * Per-request metadata ALS slot (File #26, ARCHITECTURE §9.2).
 *
 * Pulled forward from Phase 4 into Phase 3: `observe()` reads this on both of its
 * branches, so the harness cannot compile without it. Only the *accessor* moved —
 * the middleware that opens the frame (#27/#28) is still Phase 4, which means
 * `getRequestMeta()` returns `undefined` for now and every record reads
 * `provenance: 'job'`. That is a real gap with a real symptom, and A3a/A3b are the
 * assertions that close it; it is stated here so the interim state is not mistaken
 * for the finished one.
 *
 * The PII wall lives in the shape, not in the discipline of callers: this slot
 * holds no request object, no URL, and no user. `getRouteHint()` is a function
 * rather than a string so the Express *route template* (`/api/parties/:id`) is
 * read at record time. `originalUrl` would carry the interpolated id — a tenant's
 * primary key written into a durable, admin-readable table.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestMeta } from './prisma-shadow.types.js'

const metaSlot = new AsyncLocalStorage<RequestMeta>()

/** `undefined` on the job path (cron, queue, boot) — that absence IS the signal. */
export function getRequestMeta(): RequestMeta | undefined {
  return metaSlot.getStore()
}

/**
 * Open the frame for one request. Callers must invoke `next()` INSIDE `fn` so the
 * store survives the rest of the chain — the same shape `scopedContext` uses, and
 * for the same reason: an ALS store torn down early reads as "no frame", which
 * here silently relabels every HTTP record as `job`.
 */
export function runWithRequestMeta<T>(meta: RequestMeta, fn: () => T): T {
  return metaSlot.run(meta, fn)
}
