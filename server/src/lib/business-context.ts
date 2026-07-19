/**
 * Tenant context store (File #2, capability: business-context).
 *
 * A single AsyncLocalStorage frame carries the active tenant for the lifetime of a
 * request (or a cron/webhook job). The scoping extension reads it via
 * `getBusinessContext()` and AND-merges `businessId` into every query. Absence on a
 * scoped model is a FAIL-CLOSED error (never a silent global query).
 *
 * Two escape frames:
 *   - `runUnscoped(reason, fn)` — the ONLY sanctioned cross-tenant path; clears the
 *     tenant frame and writes an audit row (via __basePrismaUnsafe, wired in #6 to
 *     avoid an import cycle) so every unscoped window is accountable.
 *   - `runReentry(fn)` — internal: marks a re-dispatched call so the extension passes
 *     it straight through to the inner (soft-delete) client instead of re-scoping.
 *     Exported for the extension only; feature code must never call it.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface BusinessContext {
  /** the active tenant; empty string is rejected at frame-entry (fail-closed) */
  businessId: string
  /** the acting user (audit + runUnscoped log); never used for scoping */
  userId: string
}

/**
 * Sanctioned reasons for a cross-tenant window. A closed union so a new unscoped
 * caller is a compile error until it justifies itself (and lands in the audit log).
 */
export type UnscopedReason =
  | 'auth.login-by-phone'
  | 'auth.audit-write'
  | 'business.create'
  | 'business.switch-resolve'
  | 'platform.admin'
  | `cron.${string}`
  | 'webhook.provider'
  | 'response.continuation'

export class ScopedContextError extends Error {
  readonly code = 'SCOPED_PRISMA_CONTEXT_UNSET'
  constructor(model?: string) {
    super(
      model
        ? `Tenant context missing while querying scoped model "${model}"`
        : 'Tenant context missing',
    )
    this.name = 'ScopedContextError'
  }
}

// --- the three frames ---
const businessSlot = new AsyncLocalStorage<BusinessContext>()
const reentrySlot = new AsyncLocalStorage<true>()
/** truthy inside a runUnscoped window — lets the extension pass scoped models through */
const unscopedSlot = new AsyncLocalStorage<UnscopedReason>()

/** Run `fn` with the tenant frame active. Rejects an empty businessId (fail-closed). */
export function runInBusinessContext<T>(ctx: BusinessContext, fn: () => T): T {
  if (!ctx.businessId) throw new ScopedContextError()
  return businessSlot.run(ctx, fn)
}

/** The active tenant frame, or undefined outside any frame (extension throws on scoped models). */
export function getBusinessContext(): BusinessContext | undefined {
  return businessSlot.getStore()
}

/** Active unscoped reason, if inside a runUnscoped window. */
export function getUnscopedReason(): UnscopedReason | undefined {
  return unscopedSlot.getStore()
}

/** True while a re-dispatched (extension-internal) call is in flight. */
export function isReentrant(): boolean {
  return reentrySlot.getStore() === true
}

/**
 * Extension-internal: mark `fn` as a re-dispatched call so the scoping layer passes it
 * straight through. MUST be awaited inside the callback (Prisma promises are lazy —
 * see project_scoped_prisma_mechanism memory). Never call from feature code.
 */
export function runReentry<T>(fn: () => Promise<T>): Promise<T> {
  return reentrySlot.run(true, fn)
}

/**
 * The audit sink for unscoped windows. Wired by prisma.ts (#6) after the base client
 * exists, avoiding a business-context → prisma import cycle. Until wired it's a no-op
 * (tests stub it via setup.ts #20); in prod #6 sets it at module load.
 */
export type UnscopedAuditSink = (entry: {
  reason: UnscopedReason
  userId: string | null
  businessId: string | null
}) => void
let auditSink: UnscopedAuditSink = () => {}
export function setUnscopedAuditSink(sink: UnscopedAuditSink): void {
  auditSink = sink
}

/**
 * The ONLY sanctioned cross-tenant path. Clears the tenant frame for `fn` and records
 * an audit row. Nested tenant context is intentionally dropped: the whole point is a
 * platform-wide window. The reason is a closed union so every caller is enumerable.
 */
export function runUnscoped<T>(reason: UnscopedReason, fn: () => T): T {
  const outer = businessSlot.getStore()
  auditSink({ reason, userId: outer?.userId ?? null, businessId: outer?.businessId ?? null })
  // exit() detaches the tenant frame so the extension sees "no context" and, combined
  // with the unscoped frame, passes scoped models straight through to the base client.
  return unscopedSlot.run(reason, () => businessSlot.exit(fn))
}
