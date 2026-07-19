/**
 * Pure where/data merge primitives for the scoping injector (File #3).
 *
 * No DB, no ALS, no Prisma client — every function is a total transform on plain
 * args objects, so File #13 can unit-test them exhaustively. The tenant id is always
 * passed explicitly.
 */
export type QueryArgs = Record<string, unknown>

/**
 * AND-merge a tenant predicate into a where clause without clobbering caller filters.
 * Using AND (never a shallow spread) means a caller `where.businessId` can't override
 * ours and an existing top-level OR still intersects with the tenant bound.
 */
export function mergeWhere(args: QueryArgs | undefined, predicate: Record<string, unknown>): QueryArgs {
  const a = args ?? {}
  const where = (a.where as Record<string, unknown> | undefined) ?? {}
  return { ...a, where: { AND: [where, predicate] } }
}

/** The directly-scoped predicate `{ businessId }`. */
export function businessPredicate(businessId: string): Record<string, unknown> {
  return { businessId }
}

/**
 * The child-scoped predicate `{ <relation>: { businessId } }` — a to-one relation
 * filter that reaches the tenant column on the parent (Prisma reads the bare object
 * as an implicit `is`).
 */
export function relationPredicate(relation: string, businessId: string): Record<string, unknown> {
  return { [relation]: { businessId } }
}

/**
 * Read a scalar value from a Prisma write-data field, unwrapping the `{ set: x }` form
 * that update payloads use. Returns undefined when the field is absent. Used by the H1
 * guard to detect a businessId or scalar-FK reassignment.
 */
export function readScalarSet(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && 'set' in (value as object)) {
    return (value as { set: unknown }).set
  }
  return value
}

/** True when a write-data object carries a field at all (present, even if `{set}`-wrapped). */
export function hasDataField(data: unknown, field: string): boolean {
  return data !== null && typeof data === 'object' && field in (data as object)
}
