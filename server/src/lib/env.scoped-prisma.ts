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

/** Shadow-diff sampling rate 0..1 (auto-throttled by the harness under load). Default 1. */
export function getScopedPrismaShadowSample(): number {
  const raw = Number(process.env.SCOPED_PRISMA_SHADOW_SAMPLE)
  if (!Number.isFinite(raw) || raw < 0) return 1
  return raw > 1 ? 1 : raw
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
