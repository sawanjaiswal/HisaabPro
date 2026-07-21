/**
 * Tenant isolation — scoped-Prisma rollout flag (Wave A, P0.1).
 *
 * Land-dark default is `off`: the scoping $extends layer is NOT attached and the
 * app behaves exactly as before. `shadow` attaches it in diff-only mode (#10);
 * `enforce` makes it the live client. Read ONCE at boot (M3) — flipping the flag
 * requires a restart; there is no half-applied window.
 */

export type ScopedPrismaMode = 'off' | 'shadow' | 'enforce'

/** Parse SCOPED_PRISMA_ENFORCE into a mode. `true` is an alias for `enforce`. */
export function getScopedPrismaMode(): ScopedPrismaMode {
  const raw = (process.env.SCOPED_PRISMA_ENFORCE ?? '').trim().toLowerCase()
  if (raw === 'enforce' || raw === 'true') return 'enforce'
  if (raw === 'shadow') return 'shadow'
  return 'off'
}

/**
 * Shadow-diff sampling rate 0..1, auto-throttled by the harness under load.
 *
 * Default `0.01`, not `1` (ARCHITECTURE §8.4 target row). The accessor predates
 * the harness, when nothing consumed it and the default was inert. Now an unset
 * value decides how much extra read load `shadow` puts on prod, and the audit's
 * named scenario is exactly this one: the var goes missing on a redeploy
 * (`sync: false` on Render), the mode flag survives, and every scoped read
 * silently runs twice. The rollout sets `0.01` explicitly; this makes forgetting
 * to fail small instead of at 100%.
 */
export function getScopedPrismaShadowSample(): number {
  const raw = Number(process.env.SCOPED_PRISMA_SHADOW_SAMPLE)
  if (!Number.isFinite(raw) || raw < 0) return 0.01
  return raw > 1 ? 1 : raw
}

/**
 * Shadow-harness knobs (File #24, §8.4).
 *
 * Not re-exported through `env.ts` — that barrel is owned by a concurrent
 * session and is outside this epic's file plan, so the three consumers import
 * from here directly. Recorded as D-10 with a follow-up to add the barrel rows
 * once that session's write settles.
 *
 * Every accessor clamps rather than throws. A bad tuning value must not be able
 * to take the API down: the harness is an observer, and the failure mode of a
 * mistyped sample rate should be "the default rate" and not "no service".
 */
function intFromEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

/** Per-probe timeout. The probe loses the race rather than holding a pool slot. */
export function getScopedPrismaShadowTimeoutMs(): number {
  return intFromEnv(process.env.SCOPED_PRISMA_SHADOW_TIMEOUT_MS, 250, 1, 5_000)
}

/** Concurrent probe cap. Upper bound 5 keeps the harness under 50% of the 10-conn pool. */
export function getScopedPrismaShadowMaxInflight(): number {
  return intFromEnv(process.env.SCOPED_PRISMA_SHADOW_MAX_INFLIGHT, 2, 0, 5)
}

/**
 * Concurrent sink-write cap (B-2). The sink shares the same 10-connection pool as
 * the probe, which rev-2 arithmetic missed — a no-context read skips the probe and
 * then still issues an upsert. Gauged separately so it is budgeted, not assumed free.
 */
export function getScopedPrismaShadowSinkMaxInflight(): number {
  return intFromEnv(process.env.SCOPED_PRISMA_SHADOW_SINK_MAX_INFLIGHT, 2, 0, 5)
}

/**
 * Synthetic tenant the canary fixture reads under. Unset ⇒ canary disabled, which
 * is the correct default: a canary pointed at a real business would write that
 * tenant's row ids into the divergence table on every run.
 */
export function getScopedPrismaShadowCanaryBusinessId(): string | undefined {
  const raw = (process.env.SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID ?? '').trim()
  return raw === '' ? undefined : raw
}

/**
 * Boot-guard (M3 / Phase-3). Once cutover is declared done
 * (`SCOPED_PRISMA_CUTOVER_DONE=true`), production MUST run with `enforce` — anything
 * else fails to boot so a mis-set flag can never silently drop tenant isolation.
 * Pre-cutover it only rejects a garbage value; land-dark `off` boots fine.
 */
export function validateScopedPrismaBoot(): void {
  const raw = (process.env.SCOPED_PRISMA_ENFORCE ?? '').trim().toLowerCase()
  if (raw && !['off', 'false', 'shadow', 'enforce', 'true'].includes(raw)) {
    throw new Error(`Invalid SCOPED_PRISMA_ENFORCE="${process.env.SCOPED_PRISMA_ENFORCE}". Use off|shadow|enforce.`)
  }
  const cutoverDone = process.env.SCOPED_PRISMA_CUTOVER_DONE === 'true'
  const isProd = (process.env.NODE_ENV ?? 'development') === 'production'
  if (cutoverDone && isProd && getScopedPrismaMode() !== 'enforce') {
    throw new Error(
      'FATAL: SCOPED_PRISMA_CUTOVER_DONE=true but SCOPED_PRISMA_ENFORCE is not enforce. ' +
        'Post-cutover production must run scoped Prisma in enforce mode (tenant isolation).',
    )
  }
}
