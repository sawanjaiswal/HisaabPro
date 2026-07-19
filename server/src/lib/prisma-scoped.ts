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
import {
  buildDeleteByIdArgs,
  buildUpdateByIdArgs,
  injectScope,
  type FkGuard,
  type ScopePlan,
} from './prisma-scoped.inject.js'

/** Minimal structural view of a Prisma model delegate (loose — the client is dynamic). */
interface Delegate {
  findFirst(args: unknown): Promise<{ id: string } | null>
  findFirstOrThrow(args: unknown): Promise<{ id: string }>
  update(args: unknown): Promise<unknown>
  delete(args: unknown): Promise<unknown>
  create(args: unknown): Promise<unknown>
}
export type ScopedClientLike = Record<string, Delegate>
type Continuation = (args: unknown) => Promise<unknown>

/** Active interactive-tx client — set by scopedTransaction so two-step writes stay atomic. */
const txSlot = new AsyncLocalStorage<ScopedClientLike>()

export class ScopedNotFound extends Error {
  readonly code = 'SCOPED_PRISMA_NOT_FOUND'
  constructor(model: string) {
    super(`No ${model} row in the active tenant matched the query`)
    this.name = 'ScopedNotFound'
  }
}
export class FkTenantReject extends Error {
  readonly code = 'SCOPED_PRISMA_DATA_FK_REJECT'
  constructor(g: FkGuard) {
    super(`Referenced ${g.parentModel} (${g.relationLabel}=${g.value}) does not belong to the active tenant`)
    this.name = 'FkTenantReject'
  }
}

/** Verify every FK the write reassigns resolves to a row in this tenant (H1 FK-guard). */
async function runGuards(client: ScopedClientLike, guards: FkGuard[], businessId: string): Promise<void> {
  for (const g of guards) {
    const parent = await runReentry(async () =>
      await client[g.parentModel].findFirst({ where: { id: g.value, businessId }, select: { id: true } }),
    )
    if (!parent) throw new FkTenantReject(g)
  }
}

async function executePlan(
  client: ScopedClientLike,
  model: string,
  businessId: string,
  plan: ScopePlan,
  query: Continuation,
  originalArgs: unknown,
): Promise<unknown> {
  await runGuards(client, plan.guards, businessId)
  const { exec } = plan

  switch (exec.kind) {
    case 'passthrough':
      return query(originalArgs)
    case 'sameOp':
      // same operation, new args → flows through inner soft-delete → DB
      return query(exec.args)
    case 'findFirst':
      return runReentry(async () => await client[model][exec.operation](exec.args))
    case 'twoStep':
      return runReentry(async () => {
        const found = await client[model].findFirst(exec.resolveArgs)
        if (!found) {
          if (exec.missingThrows) throw new ScopedNotFound(model)
          return null
        }
        const writeArgs =
          exec.writeOp === 'update'
            ? buildUpdateByIdArgs(found.id, exec.args)
            : buildDeleteByIdArgs(found.id, exec.args)
        return await client[model][exec.writeOp](writeArgs)
      })
    case 'upsert':
      return runReentry(async () => {
        const found = await client[model].findFirst(exec.resolveArgs)
        if (found) {
          const a = exec.args as Record<string, unknown>
          return await client[model].update({
            where: { id: found.id },
            data: exec.updateData,
            ...(a.select !== undefined ? { select: a.select } : {}),
            ...(a.include !== undefined ? { include: a.include } : {}),
          })
        }
        return await client[model].create(exec.createArgs)
      })
  }
}

/**
 * Build the scoping extension. `getInner` is late-bound to the soft-delete client so
 * the re-dispatch target has no scoping layer (see composition note above).
 */
export function createScopingExtension(getInner: () => ScopedClientLike) {
  return Prisma.defineExtension({
    name: 'tenant-scoping',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const q = query as Continuation
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
