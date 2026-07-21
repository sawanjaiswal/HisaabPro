/**
 * Shadow-harness types (File #2, ARCHITECTURE §5).
 *
 * This module imports NOTHING from `prisma-scoped*` or `prisma.ts`. That is the
 * cycle break (AA-6): `prisma-scoped.ts` depends only on these types, and the
 * concrete port is injected at the composition root. Adding an import here
 * re-creates the cycle that throws a TDZ error at boot under `shadow` only —
 * the mode nobody runs locally.
 */

/** Record kinds (§9.1). `clean` never reaches the divergence table. */
export type ShadowKind =
  | 'clean'
  | 'diverged'
  | 'unstable-window'
  | 'skew-suspect'
  | 'no-context'
  | 'shadow-error'
  | 'unsupported-shape'
  | 'canary'

/** How the query arrived. `job` = no Express request in scope. */
export type ShadowProvenance = 'http' | 'job'

/**
 * The narrow slice of Prisma the sink and stats modules need.
 *
 * Deliberately not `PrismaClient`: a structural type keeps `sink.ts` and
 * `stats.ts` free of any import from `prisma.ts`, so the type-only import
 * cannot silently re-introduce the runtime cycle (AA-6, security §11).
 */
export interface ShadowDb {
  scopedShadowDivergence: {
    upsert(args: unknown): Promise<unknown>
    groupBy(args: unknown): Promise<unknown>
    count(args?: unknown): Promise<number>
  }
  scopedShadowStat: {
    upsert(args: unknown): Promise<unknown>
    findMany(args?: unknown): Promise<unknown>
  }
}

/**
 * Counter names. Every clean framed comparison bumps `observed-framed`, which is
 * what exit criterion 2 counts distinct `routeHint`s over — it rises with healthy
 * traffic. Rev 2 based that criterion on the divergence table, which holds
 * anomalies only and therefore reads near-zero during exactly the outcome it is
 * meant to certify (RS-1).
 */
export type ShadowStatKind = ShadowKind | 'sampled' | 'observed-framed'

/** Per-request metadata carried in an ALS slot. Never holds PII (§9.2). */
export interface RequestMeta {
  method: string
  /** Matched Express route template only — never `originalUrl`/`params`/`query`. */
  getRouteHint(): string
  /**
   * Whether the verified token carried a tenant. Lets a lost frame be told
   * apart from a request that legitimately has no tenant yet (AA-3).
   */
  hadBusinessOnToken: boolean
}

/** Output of `diffIds` — ids only, both arrays capped at `SHADOW_MAX_IDS`. */
export interface ShadowDiff {
  onlyUnscoped: string[]
  onlyScoped: string[]
  unscopedCount: number
  scopedCount: number
  /** An id array hit `SHADOW_MAX_IDS`, or a result set hit `SHADOW_MAX_ROWS`. */
  truncated: boolean
  /** `select` omitted `id`, or rows carry no `id` scalar — not comparable. */
  unsupportedShape: boolean
}

/** Booleans derived from `args`. The args themselves never cross this boundary. */
export interface ShadowArgFlags {
  hasInclude: boolean
  /** `take` / `skip` / `cursor` present — the result window is unstable. */
  hasBoundedWindow: boolean
}

/** The persisted shape. Built by a key allowlist in `redact.ts` (§9.2). */
export interface ScopedShadowDivergenceRecord {
  kind: ShadowKind
  model: string
  operation: string
  provenance: ShadowProvenance
  /** Body field, never an index label — see the schema comment on the model. */
  subjectBusinessId: string | null
  routeHint: string
  hadBusinessOnToken: boolean
  onlyUnscoped: string[]
  onlyScoped: string[]
  unscopedCount: number
  scopedCount: number
  truncated: boolean
  hasInclude: boolean
  hasBoundedWindow: boolean
  observationIntervalMs: number
  /** `err.name` only — `err.message` embeds failing field values (§9.2). */
  errorName: string | null
  shapeHash: string
}

export interface ShadowObserveInput {
  model: string
  operation: string
  /** The caller's already-issued promise. Reused, never re-executed (§4.1). */
  real: Promise<unknown>
  /** Absent when no ALS tenant frame is open — takes the no-context branch. */
  businessId: string | undefined
  /** Re-dispatches the scoped plan. Only ever called with a real businessId. */
  runScoped(businessId: string): Promise<unknown>
  argFlags: ShadowArgFlags
}

export interface ShadowPort {
  /** Sample × throttle × inflight × breaker. Cheap, synchronous. */
  shouldSample(): boolean
  /** Fire-and-forget. Never throws, never returns a value, never awaited. */
  observe(input: ShadowObserveInput): void
}
