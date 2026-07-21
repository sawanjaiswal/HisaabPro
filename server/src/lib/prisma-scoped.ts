/**
 * The scoping transport (File #6, capability: tenant-scoping).
 *
 * Wraps the pure injector (#5) in a Prisma `$extends` `$allOperations` component that:
 *   - passes reentrant / global / unscoped calls straight through,
 *   - FAILS CLOSED on a scoped model with no tenant frame,
 *   - executes the injector's ScopePlan by RE-DISPATCHING on the caller's open tx
 *     client (tx-ALS slot) or the inner soft-delete client — never the raw base client.
 *
 * Composition (set in #7): base.$extends(softDelete).$extends(scoping). The LAST
 * query extension declared runs FIRST, so scoping runs → soft-delete → DB. `getInner`
 * is late-bound to the soft-delete client (NO scoping layer) so a re-dispatch can't
 * re-enter scoping infinitely and businessId merges exactly once.
 *
 * Every re-dispatched call is awaited INSIDE runReentry's callback — Prisma promises
 * are lazy (see project_scoped_prisma_mechanism); a non-awaiting callback tears down
 * the ALS store before the query fires and re-enters scoping with no context.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { Prisma } from '@prisma/client'
import {
  ScopedContextError,
  getBusinessContext,
  getUnscopedReason,
  isReentrant,
  runReentry,
} from './business-context.js'
import { isTenantModel } from './scoped-models.js'
import { injectScope } from './prisma-scoped.inject.js'
import {
  executePlan,
  type Continuation,
  type ScopedClientLike,
} from './prisma-scoped.exec.js'
import {
  getShadowPort,
  readArgFlags,
  shouldShadow,
  ShadowPlanRefused,
  ShadowProbeNoContext,
} from './prisma-scoped.shadow.js'

export {
  ScopedNotFound,
  FkTenantReject,
  type ScopedClientLike,
} from './prisma-scoped.exec.js'
export { setShadowPort } from './prisma-scoped.shadow.js'

/** Active interactive-tx client — set by scopedTransaction so two-step writes stay atomic. */
const txSlot = new AsyncLocalStorage<ScopedClientLike>()

/**
 * Build the scoping extension. `getInner` is late-bound to the soft-delete client so
 * the re-dispatch target has no scoping layer (see composition note above).
 */
export function createScopingExtension(getInner: () => ScopedClientLike) {
  /**
   * The scoped side of the comparison — the REAL mechanism, not a re-implementation.
   *
   * Fidelity note, stated rather than glossed: under `enforce` a read's `sameOp`
   * branch calls the extension's own continuation; the probe calls a re-dispatch on
   * the inner soft-delete client instead. Both traverse soft-delete exactly once and
   * bottom out on the same pool, so the diff is apples-to-apples on the axis that
   * matters. The residual difference is composition order inside Prisma's extension
   * stack.
   */
  async function runScopedProbe(
    model: string,
    operation: string,
    args: unknown,
    businessId: string,
  ): Promise<unknown> {
    // Belt for AA-5. The primary control is observe()'s no-context branch; this
    // exists so a future caller bypassing that branch gets a counted shadow-error
    // instead of a fabricated clean diff. `where: { businessId: undefined }` is
    // DROPPED by Prisma — the repo's own recorded cross-tenant footgun.
    if (!businessId) throw new ShadowProbeNoContext(model)

    const plan = injectScope(model, operation, args as Record<string, unknown> | undefined, businessId)
    // Reads can never produce these kinds today, and executePlan issues REAL
    // writes for them. Refusing here makes "shadow never writes" a property of the
    // code rather than of what SHADOW_READ_OPS happens to contain right now.
    if (plan.exec.kind === 'twoStep' || plan.exec.kind === 'upsert' || plan.exec.kind === 'passthrough') {
      throw new ShadowPlanRefused(plan.exec.kind)
    }

    const client = getInner()
    // The await sits INSIDE runReentry's callback. A non-awaiting callback tears
    // the ALS store down before the lazy Prisma promise fires — every existing
    // executePlan branch has this shape for the same reason.
    // `Delegate` models only the five ops the write plans need; a probe legitimately
    // calls findMany/findUniqueOrThrow too. Widened here rather than casting the op
    // name to a member that exists, which would type-check while describing the
    // wrong call.
    const delegate = client[model] as unknown as Record<string, Continuation>
    const probeContinuation: Continuation = (a) => runReentry(async () => await delegate[operation](a))

    return executePlan(client, model, businessId, plan, probeContinuation, args)
  }

  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const q = query as Continuation

          // ── SHADOW BRANCH — above the fail-closed guard chain, and the sole exit ──
          const port = getShadowPort()
          if (port && model) {
            // (1) The caller's value is bound FIRST, before any harness code can
            // run. Promise.resolve on a Prisma thenable subscribes exactly once,
            // so both consumers share one query — this is what makes "at most one
            // extra read per sampled read" true rather than hoped-for. Prisma
            // promises being lazy has burned this layer before (see the header).
            const real = Promise.resolve(q(args))
            try {
              if (shouldShadow(model, operation, txSlot.getStore() !== undefined)) {
                void port
                  .observe({
                    model,
                    operation,
                    real,
                    businessId: getBusinessContext()?.businessId,
                    runScoped: (businessId) => runScopedProbe(model, operation, args, businessId),
                    argFlags: readArgFlags(args),
                  })
                  // (2b) `observe` is specified never to reject; this is the
                  // ENFORCEMENT of that spec, not belt-and-braces. On Node >= 15 an
                  // unhandled rejection terminates the process, so a future editing
                  // mistake inside observe() would turn a counted harness error into
                  // an API outage.
                  .catch(() => {
                    try {
                      port.countHarnessError()
                    } catch {
                      /* N-2 — total */
                    }
                  })
              }
            } catch {
              // (2a) a synchronous throw anywhere in shouldShadow / arg reading
              try {
                port.countHarnessError()
              } catch {
                /* N-2 — total */
              }
            }
            // (3) The UNSCOPED result. Runtime behaviour under shadow is unchanged,
            // and nothing the probe computed can reach the caller.
            return real
          }

          if (!model || isReentrant() || !isTenantModel(model) || getUnscopedReason()) return q(args)

          const ctx = getBusinessContext()
          if (!ctx) throw new ScopedContextError(model)

          const plan = injectScope(model, operation, args as Record<string, unknown> | undefined, ctx.businessId)
          const client = txSlot.getStore() ?? getInner()
          return executePlan(client, model, ctx.businessId, plan, q, args)
        },
      },
    },
  })
}

/**
 * Interactive-transaction shim: threads the tx client into the ALS slot so the
 * two-step writes inside re-dispatch on the SAME tx (atomic, rolls back together).
 * Wired to the concrete scoped client in #7 (`export const scopedTransaction = ...`).
 */
export function makeScopedTransaction(scoped: {
  $transaction: <T>(fn: (tx: unknown) => Promise<T>, opts?: unknown) => Promise<T>
}) {
  return function scopedTransaction<T>(fn: (tx: ScopedClientLike) => Promise<T>, opts?: unknown): Promise<T> {
    return scoped.$transaction(
      (tx) => txSlot.run(tx as ScopedClientLike, () => fn(tx as ScopedClientLike)),
      opts,
    )
  }
}
