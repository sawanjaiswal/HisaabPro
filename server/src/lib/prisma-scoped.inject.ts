/**
 * The scoping decision core (File #5, capability: tenant-scoping).
 *
 * `injectScope(model, operation, args, businessId)` is PURE — no DB, no ALS, the tenant
 * id passed explicitly — so File #13 unit-tests every branch. It returns a ScopePlan the
 * transport (#6) executes: an exec (the re-dispatch shape) plus DB-verification guards
 * (H1 FK-reassignment / connect) that the transport resolves in-tenant before writing.
 *
 * H1 businessId-reassignment is caught HERE (a pure, deterministic throw) since it needs
 * no DB; FK-reassignment needs a lookup, so it becomes a guard.
 */
import {
  businessPredicate,
  hasDataField,
  mergeWhere,
  readScalarSet,
  relationPredicate,
  type QueryArgs,
} from './prisma-scoped.merge.js'
import {
  BULK_WHERE_OPS,
  FIND_UNIQUE_OPS,
  READ_MERGE_OPS,
  deleteByIdArgs as _deleteByIdArgs,
  findFirstVariant,
  resolveIdArgs,
  toFindFirstArgs,
  twoStepMissingThrows,
  updateByIdArgs as _updateByIdArgs,
} from './prisma-scoped.rewrite.js'
import { childRule, isDirectlyScoped, scopedFksOf } from './scoped-models.js'

// re-export the by-id builders so the transport imports them from one place
export const buildUpdateByIdArgs = _updateByIdArgs
export const buildDeleteByIdArgs = _deleteByIdArgs

/** A parent-id the transport must verify belongs to the tenant before the write lands. */
export interface FkGuard {
  /** directly-scoped model to resolve `value` against (it carries businessId) */
  parentModel: string
  /** the FK id to check */
  value: string
  /** relation/column name, for the error message */
  relationLabel: string
}

export type PlanExec =
  | { kind: 'passthrough' }
  | { kind: 'sameOp'; args: QueryArgs }
  | { kind: 'findFirst'; operation: 'findFirst' | 'findFirstOrThrow'; args: QueryArgs }
  | { kind: 'twoStep'; resolveArgs: QueryArgs; writeOp: 'update' | 'delete'; args: QueryArgs; missingThrows: boolean }
  | { kind: 'upsert'; resolveArgs: QueryArgs; updateData: unknown; createArgs: QueryArgs; args: QueryArgs }

export interface ScopePlan {
  exec: PlanExec
  guards: FkGuard[]
}

export class DataBusinessIdReject extends Error {
  readonly code = 'SCOPED_PRISMA_DATA_BUSINESSID_REJECT'
  constructor() {
    super('Write payload attempts to set businessId to another tenant')
    this.name = 'DataBusinessIdReject'
  }
}
export class NestedScopedCreateReject extends Error {
  readonly code = 'SCOPED_PRISMA_NESTED_CREATE_REJECT'
  constructor(relation: string) {
    super(`Nested create/connectOrCreate on scoped relation "${relation}" cannot be tenant-injected; use connect`)
    this.name = 'NestedScopedCreateReject'
  }
}
export class UnsupportedScopedOp extends Error {
  readonly code = 'SCOPED_PRISMA_UNSUPPORTED_OP'
  constructor(model: string, operation: string) {
    super(`Operation "${operation}" on scoped model "${model}" has no scoping rule`)
    this.name = 'UnsupportedScopedOp'
  }
}

const noGuards = (exec: PlanExec): ScopePlan => ({ exec, guards: [] })

/** Relation field name for a child's tenant FK (derived from DMMF via scoped-models). */
function childRelationName(model: string, fk: string): string {
  const found = scopedFksOf(model).find((f) => f.fk === fk)
  if (!found) throw new Error(`SCOPED_PRISMA_CHILD_RELATION_UNRESOLVED(${model}.${fk})`)
  return found.relation
}

/** Collect FK-reassignment / connect guards from a write-data object (create or update). */
function collectFkGuards(model: string, data: Record<string, unknown>): FkGuard[] {
  const guards: FkGuard[] = []
  for (const { fk, parent, relation } of scopedFksOf(model)) {
    const scalar = readScalarSet(data[fk])
    if (typeof scalar === 'string') guards.push({ parentModel: parent, value: scalar, relationLabel: relation })
    const rel = data[relation]
    if (rel !== null && typeof rel === 'object') {
      const nested = rel as Record<string, unknown>
      // nested create / connectOrCreate would create a scoped parent WITHOUT businessId
      // (nested writes bypass this extension) — reject; callers must `connect` instead.
      if ('create' in nested || 'connectOrCreate' in nested) throw new NestedScopedCreateReject(relation)
      const connect = nested.connect
      if (connect !== null && typeof connect === 'object') {
        const id = (connect as Record<string, unknown>).id
        if (typeof id === 'string') guards.push({ parentModel: parent, value: id, relationLabel: relation })
      }
    }
  }
  return guards
}

/** H1: reject a write that tries to move the row to another tenant via businessId. */
function guardBusinessIdData(data: Record<string, unknown>, businessId: string): void {
  if (!hasDataField(data, 'businessId')) return
  const v = readScalarSet(data.businessId)
  if (v !== undefined && v !== businessId) throw new DataBusinessIdReject()
}

export function injectScope(
  model: string,
  operation: string,
  args: QueryArgs | undefined,
  businessId: string,
): ScopePlan {
  const direct = isDirectlyScoped(model)
  const child = childRule(model)
  if (!direct && !child) return noGuards({ kind: 'passthrough' }) // global — transport also guards this

  const predicate = direct
    ? businessPredicate(businessId)
    : relationPredicate(childRelationName(model, child!.fk), businessId)
  const a = (args ?? {}) as QueryArgs

  if (FIND_UNIQUE_OPS.has(operation)) {
    return noGuards({ kind: 'findFirst', operation: findFirstVariant(operation), args: toFindFirstArgs(a, predicate) })
  }
  if (READ_MERGE_OPS.has(operation)) {
    return noGuards({ kind: 'sameOp', args: mergeWhere(a, predicate) })
  }

  if (operation === 'create') {
    const data = (a.data ?? {}) as Record<string, unknown>
    const guards = collectFkGuards(model, data)
    const injected = direct ? { ...a, data: { ...data, businessId } } : a
    return { exec: { kind: 'sameOp', args: injected }, guards }
  }
  if (operation === 'createMany') {
    const rows = (Array.isArray(a.data) ? a.data : [a.data]) as Record<string, unknown>[]
    const guards = rows.flatMap((r) => collectFkGuards(model, r ?? {}))
    const injected = direct ? { ...a, data: rows.map((r) => ({ ...(r ?? {}), businessId })) } : a
    return { exec: { kind: 'sameOp', args: injected }, guards }
  }
  if (operation === 'update') {
    const data = (a.data ?? {}) as Record<string, unknown>
    if (direct) guardBusinessIdData(data, businessId)
    return {
      exec: { kind: 'twoStep', resolveArgs: resolveIdArgs(a, predicate), writeOp: 'update', args: a, missingThrows: twoStepMissingThrows('update') },
      guards: collectFkGuards(model, data),
    }
  }
  if (operation === 'delete') {
    return noGuards({ kind: 'twoStep', resolveArgs: resolveIdArgs(a, predicate), writeOp: 'delete', args: a, missingThrows: twoStepMissingThrows('delete') })
  }
  if (BULK_WHERE_OPS.has(operation)) {
    const data = (a.data ?? {}) as Record<string, unknown>
    const guards: FkGuard[] = []
    if (operation === 'updateMany') {
      if (direct) guardBusinessIdData(data, businessId)
      guards.push(...collectFkGuards(model, data))
    }
    return { exec: { kind: 'sameOp', args: mergeWhere(a, predicate) }, guards }
  }
  if (operation === 'upsert') {
    const create = (a.create ?? {}) as Record<string, unknown>
    const update = (a.update ?? {}) as Record<string, unknown>
    if (direct) guardBusinessIdData(update, businessId)
    const guards = [...collectFkGuards(model, create), ...collectFkGuards(model, update)]
    const createArgs = direct ? { data: { ...create, businessId } } : { data: create }
    return { exec: { kind: 'upsert', resolveArgs: resolveIdArgs(a, predicate), updateData: update, createArgs, args: a }, guards }
  }

  throw new UnsupportedScopedOp(model, operation)
}
