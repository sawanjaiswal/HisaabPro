/**
 * Operation classification + mechanical arg builders (File #4).
 *
 * Pure: these decide the *shape* of the re-dispatch (which op, which args) but never
 * touch a DB or the ALS. Consumed by the injector (#5); executed by the transport (#6).
 */
import { mergeWhere, type QueryArgs } from './prisma-scoped.merge.js'

/** Reads that stay the same operation and only need a where AND-merge. */
export const READ_MERGE_OPS: ReadonlySet<string> = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])

/** Reads that must be rewritten findUnique → findFirst (a unique where can't carry a tenant AND-filter as `findUnique`). */
export const FIND_UNIQUE_OPS: ReadonlySet<string> = new Set(['findUnique', 'findUniqueOrThrow'])

/** Single-row writes that resolve the target id under tenant, then act by id (two-step). */
export const TWO_STEP_OPS: ReadonlySet<string> = new Set(['update', 'delete'])

/** Bulk writes scoped exactly like a read: a where AND-merge is sufficient and atomic. */
export const BULK_WHERE_OPS: ReadonlySet<string> = new Set(['updateMany', 'deleteMany'])

/** The findFirst variant a findUnique op maps to (…OrThrow preserved so callers still get the throw). */
export function findFirstVariant(operation: string): 'findFirst' | 'findFirstOrThrow' {
  return operation === 'findUniqueOrThrow' ? 'findFirstOrThrow' : 'findFirst'
}

/** Whether a two-step resolve miss should throw (…OrThrow / delete) or return null (update returns Prisma's own P2025). */
export function twoStepMissingThrows(operation: string): boolean {
  // Prisma's own update/delete throw P2025 on a missing row; our resolve-miss mirrors that.
  return operation === 'update' || operation === 'delete'
}

/** findUnique → findFirst args: keep the caller's selector, AND-merge the tenant predicate. */
export function toFindFirstArgs(args: QueryArgs | undefined, predicate: Record<string, unknown>): QueryArgs {
  return mergeWhere(args, predicate)
}

/** Resolve step: `findFirst({ where: caller ∧ tenant, select: { id: true } })`. */
export function resolveIdArgs(args: QueryArgs | undefined, predicate: Record<string, unknown>): QueryArgs {
  const merged = mergeWhere(args, predicate)
  return { where: merged.where, select: { id: true } }
}

/** Write-by-id step for `update`: `{ where: { id }, data }`, preserving select/include. */
export function updateByIdArgs(id: string, args: QueryArgs): QueryArgs {
  const { where: _ignored, ...rest } = args
  return { ...rest, where: { id } }
}

/** Write-by-id step for `delete`: `{ where: { id } }`, preserving select/include. */
export function deleteByIdArgs(id: string, args: QueryArgs): QueryArgs {
  const { where: _ignored, ...rest } = args
  return { ...rest, where: { id } }
}
