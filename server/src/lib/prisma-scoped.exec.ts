/**
 * ScopePlan execution (File #6b, ARCHITECTURE §3.1).
 *
 * Split out of `prisma-scoped.ts` at the 250-line ceiling, along the seam between
 * "decide what the scoped query is" (the injector, #5), "wire the extension"
 * (`prisma-scoped.ts`), and "run the plan" — this file.
 *
 * The invariant that survives the move: every re-dispatched call is awaited INSIDE
 * runReentry's callback. Prisma promises are lazy, so a non-awaiting callback tears
 * the ALS store down before the query fires and re-enters scoping with no context.
 */
import { runReentry } from './business-context.js'
import {
  buildDeleteByIdArgs,
  buildUpdateByIdArgs,
  type FkGuard,
  type ScopePlan,
} from './prisma-scoped.inject.js'

/** Minimal structural view of a Prisma model delegate (loose — the client is dynamic). */
export interface Delegate {
  findFirst(args: unknown): Promise<{ id: string } | null>
  findFirstOrThrow(args: unknown): Promise<{ id: string }>
  update(args: unknown): Promise<unknown>
  delete(args: unknown): Promise<unknown>
  create(args: unknown): Promise<unknown>
}
export type ScopedClientLike = Record<string, Delegate>
export type Continuation = (args: unknown) => Promise<unknown>

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
export async function runGuards(client: ScopedClientLike, guards: FkGuard[], businessId: string): Promise<void> {
  for (const g of guards) {
    const parent = await runReentry(async () =>
      await client[g.parentModel].findFirst({ where: { id: g.value, businessId }, select: { id: true } }),
    )
    if (!parent) throw new FkTenantReject(g)
  }
}

export async function executePlan(
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

