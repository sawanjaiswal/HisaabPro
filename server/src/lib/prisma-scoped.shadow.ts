/**
 * Shadow-harness gate for the scoping transport (File #22b, ARCHITECTURE §3.1a, §4.2).
 *
 * Split out of `prisma-scoped.ts` when that file crossed the 250-line ceiling. The
 * cut is along a real seam rather than a line count: everything here answers "may
 * the harness observe this call, and who is allowed to install it", while
 * `prisma-scoped.ts` keeps the injection transport itself.
 *
 * One consequence is worth stating. `shouldShadow` used to read the module-private
 * `txSlot` directly; across a file boundary it takes `inTransaction` as an argument
 * instead. The alternative — exporting `txSlot` — would widen a private ALS slot on
 * a tenant-isolation trust anchor to every importer in the server, which is a far
 * worse trade than passing one boolean.
 */
import { getUnscopedReason, isReentrant } from './business-context.js'
import { isTenantModel } from './scoped-models.js'
// barrel row deferred — env.ts is owned by a concurrent session (epic: scoped-prisma-shadow)
import { getScopedPrismaMode } from './env.scoped-prisma.js'
import { SHADOW_READ_OPS } from './prisma-shadow.constants.js'
import type { ShadowArgFlags, ShadowPort } from './prisma-shadow.types.js'

/**
 * The shadow harness, installed once at the composition root under `shadow` only.
 *
 * `null` under `off` and `enforce` — not "disabled by a flag check in the hot
 * path" but ABSENT, one null-check deep. Both halves of §3.1's wiring (this port
 * and `prisma` resolving to the scoped client) are useless alone, which is what
 * makes the adoption assertion able to fail if either line is deleted. That is
 * the direct answer to this epic's founding failure: four components that
 * typechecked, grepped clean, and were never called.
 */
let shadowPort: ShadowPort | null = null

export class ShadowPortModeError extends Error {
  constructor(mode: string) {
    super(`setShadowPort() refused: scoped-prisma mode is "${mode}", not "shadow"`)
    this.name = 'ShadowPortModeError'
  }
}
export class ShadowPortAlreadySetError extends Error {
  constructor() {
    super('setShadowPort() refused: a shadow port is already installed (one-shot)')
    this.name = 'ShadowPortAlreadySetError'
  }
}
export class ShadowProbeNoContext extends Error {
  constructor(model: string) {
    super(`Shadow probe on ${model} reached the scoped side with no businessId`)
    this.name = 'ShadowProbeNoContext'
  }
}
export class ShadowPlanRefused extends Error {
  constructor(kind: string) {
    super(`Shadow probe refused a "${kind}" plan — the shadow side never writes`)
    this.name = 'ShadowPlanRefused'
  }
}

/**
 * Install the harness. Mode-guarded and one-shot (M-2).
 *
 * This is a new exported mutable-state setter on a trust anchor, which is a
 * supply-chain-shaped hazard if left open: any module able to import this file
 * could otherwise install its own port under any mode, and §3.1's "absent, not
 * flag-disabled" property would hold only by convention. There is deliberately no
 * `clearShadowPort()` — tests that need the unset state get a fresh module
 * registry (`pool: 'forks'`), not a reset export that also exists in production.
 */
export function setShadowPort(port: ShadowPort): void {
  const mode = getScopedPrismaMode()
  if (mode !== 'shadow') throw new ShadowPortModeError(mode)
  if (shadowPort !== null) throw new ShadowPortAlreadySetError()
  shadowPort = port
}

/**
 * Read-only by construction (§4.2).
 *
 * `inTransaction` arrives as an argument rather than being read here: the tx-ALS
 * slot stays module-private to `prisma-scoped.ts`, and exporting it to satisfy one
 * boolean would widen a tenant-isolation trust anchor to every importer.
 *
 * Condition 1 re-reads the mode as a belt: a port installed by some future path
 * that bypasses the setter still cannot put the harness on the `enforce` hot path.
 */
export function shouldShadow(model: string, operation: string, inTransaction: boolean): boolean {
  return (
    shadowPort !== null &&
    getScopedPrismaMode() === 'shadow' &&
    isTenantModel(model) &&
    SHADOW_READ_OPS.has(operation) &&
    !isReentrant() &&
    !getUnscopedReason() &&
    !inTransaction &&
    shadowPort.shouldSample()
  )
}

/** The installed port, or null. Read on the hot path — keep it a plain field read. */
export function getShadowPort(): ShadowPort | null {
  return shadowPort
}

/**
 * Booleans only. The args themselves never cross into the harness — they carry
 * phone numbers, names, and amounts, and the divergence table is durable and
 * admin-readable.
 *
 * `hasBoundedWindow` is what lets the classifier separate a real divergence from a
 * paginated read whose window legitimately shifted between the two observations.
 */
export function readArgFlags(args: unknown): ShadowArgFlags {
  const a = (args ?? {}) as Record<string, unknown>
  return {
    hasInclude: a.include !== undefined,
    hasBoundedWindow: a.take !== undefined || a.skip !== undefined || a.cursor !== undefined,
  }
}

