// #150 Multi-user collaboration — optimistic-lock helper.
//
// The lock lives IN the write, not in middleware. The dormant
// conflict-detection middleware reads updatedAt then the real .update() runs
// tens of ms later, non-transactionally — a lost update by construction
// (architecture-critique M1). Here the conditional updateMany and the field
// write share one transaction, so a concurrent writer either loses the row
// lock and then matches 0 rows (-> 409), or wins and we 409. No TOCTOU window.
import { prisma } from './prisma.js'
import { AppError, ErrorCode } from './errors.js'

export type LockModel = 'party' | 'product' | 'document' | 'payment'

// Models that carry an updatedBy FK — used only for the 409 "modified by" hint.
const HAS_UPDATED_BY: Record<LockModel, boolean> = {
  party: false,
  product: false,
  document: true,
  payment: true,
}

// Matches the project pattern (services/document/helpers.ts) — the extended
// client's transaction callback arg, not the base Prisma.TransactionClient.
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/**
 * Parse the X-Entity-Version request header. Returns undefined for absent or
 * malformed values — callers treat undefined as "no lock" (legacy clients).
 */
export function parseEntityVersion(raw: string | string[] | undefined): number | undefined {
  if (raw === undefined || Array.isArray(raw) || raw === '') return undefined
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return undefined
  return n
}

/**
 * Conditional, atomic version bump. MUST run inside the same transaction as the
 * field write. Bumps version only if the row still sits at expectedVersion (and
 * belongs to businessId). count !== 1 => another writer won the race (or the
 * row vanished) => 409 CONFLICT carrying the current server version.
 *
 * expectedVersion === undefined skips the lock entirely (back-compat for
 * clients that don't send X-Entity-Version — unguarded last-write-wins).
 */
export async function bumpVersionOrConflict(
  tx: TxClient,
  model: LockModel,
  id: string,
  businessId: string,
  expectedVersion: number | undefined,
): Promise<void> {
  if (expectedVersion === undefined) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (tx as any)[model]
  const res = await delegate.updateMany({
    where: { id, businessId, version: expectedVersion },
    data: { version: { increment: 1 } },
  })
  if (res.count === 1) return

  // Lost the race (or row not ours). Re-read scoped to the tenant so we never
  // leak whether a foreign-tenant id exists: a row outside businessId returns
  // null -> generic 409 with no serverVersion/updatedBy.
  const select: Record<string, boolean> = { version: true }
  if (HAS_UPDATED_BY[model]) select.updatedBy = true
  const current = await delegate.findFirst({ where: { id, businessId }, select })

  throw new AppError(
    ErrorCode.CONFLICT,
    409,
    'This record was changed by another user. Reload to see the latest, then re-apply your change.',
    current
      ? { serverVersion: current.version as number, updatedBy: (current.updatedBy as string | null) ?? null }
      : {},
  )
}
