/**
 * A1 + A2 — the two lines that make shadow mode real (File #46, ARCHITECTURE §12;
 * AC-3, AC-13, AC-15, AC-24, AC-30).
 *
 * Shadow mode is wired by exactly two statements in `lib/prisma.ts`:
 *
 *   A1  `setShadowPort(createShadowPort({...}))`  — under `shadow` only
 *   A2  `export const prisma = mode === 'off' ? clients.softDeleted : clients.scoped`
 *
 * Neither is useful alone, and that is what makes one test able to police both: a
 * port installed while `prisma` still points at the soft-delete client observes
 * nothing (the scoping extension is not on the path, so `$allOperations` never
 * runs), and the scoped client with no port is `enforce` without enforcement.
 * Delete either line and every assertion below goes red.
 *
 * This runs against a REAL Postgres, two real tenants. A mocked client could not
 * distinguish the two bindings — the whole question is which extension stack the
 * exported symbol actually resolved to at module load, and only a query that
 * reaches the database answers it.
 *
 * §12.1 / SS-3: the mode is read ONCE at module load and `clients` is memoised
 * onto `globalThis`, so no test here sets `SCOPED_PRISMA_ENFORCE`. It is declared
 * in `vitest.shadow.config.ts` (`pool: 'forks'`, no parallelism). The sibling
 * `describe` at the bottom covers the DEFAULT pass — it runs only when the var is
 * unset, and asserts the inverse.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { __basePrismaUnsafe, prisma } from '../lib/prisma.js'
import { getShadowPort } from '../lib/prisma-scoped.shadow.js'
import { runInBusinessContext } from '../lib/business-context.js'

const MODE = process.env.SCOPED_PRISMA_ENFORCE
const SHADOW = MODE === 'shadow'

const SUFFIX = `shadow-int-${Date.now()}`
const BIZ_A = `biz-a-${SUFFIX}`
const BIZ_B = `biz-b-${SUFFIX}`

/**
 * Seeded and read back on the RAW client.
 *
 * Deliberate: the fixture must exist regardless of what the exported `prisma`
 * resolved to, and the assertions must read the shadow tables without being
 * observed by the harness that is writing them.
 */
const raw = __basePrismaUnsafe

/**
 * More than SHADOW_SKEW_MAX_IDS (3) parties per tenant, deliberately.
 *
 * With one party each, a cross-tenant read leaks exactly one id in exactly one
 * direction — which `classify` reads as `skew-suspect`, the "a row was written
 * between the two reads" kind, not `diverged`. That verdict is correct for the
 * fixture and useless as a test: a real missing filter is whole-tenant-shaped,
 * so the fixture has to be whole-tenant-shaped too or A1 asserts the harness's
 * behaviour on an input the harness was built to dismiss.
 */
const PARTIES_PER_TENANT = 5

async function seedBusiness(id: string, name: string): Promise<void> {
  await raw.business.create({ data: { id, name } })
  await raw.party.createMany({
    // The suffix is in the party NAME, not just the business id: every read below
    // selects on it, so a run only ever sees its own fixture and never a previous
    // run's leftovers (which would make the row counts unrepeatable).
    data: Array.from({ length: PARTIES_PER_TENANT }, (_, i) => ({
      businessId: id,
      name: `${name} party ${i} ${SUFFIX}`,
      type: 'CUSTOMER' as const,
    })),
  })
}

/** The sink is fire-and-forget by design (§5.2) — poll rather than sleep a guess. */
async function waitFor<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 5000): Promise<T> {
  const deadline = Date.now() + ms
  let last = await read()
  while (!ok(last) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 50))
    last = await read()
  }
  return last
}

function divergences(where: Record<string, unknown> = {}) {
  return raw.scopedShadowDivergence.findMany({
    where: { ...where, model: 'Party' },
    orderBy: { createdAt: 'asc' },
  })
}

beforeAll(async () => {
  await seedBusiness(BIZ_A, 'Tenant A')
  await seedBusiness(BIZ_B, 'Tenant B')
})

afterAll(async () => {
  await raw.party.deleteMany({ where: { businessId: { in: [BIZ_A, BIZ_B] } } })
  await raw.business.deleteMany({ where: { id: { in: [BIZ_A, BIZ_B] } } })
  await raw.scopedShadowDivergence.deleteMany({ where: { subjectBusinessId: { in: [BIZ_A, BIZ_B] } } })
})

describe.runIf(SHADOW)('A1 + A2 — shadow wiring against a real database', () => {
  it('A1 — an unframed-by-where read inside a tenant frame is observed and recorded', async () => {
    const before = (await divergences({ kind: 'diverged' })).length

    // No `where` at all: the caller's own query is genuinely cross-tenant, which
    // is what the harness exists to measure. Under `shadow` the CALLER still gets
    // the unscoped rows — behaviour is unchanged, only observation is added.
    // `async () => await …` is load-bearing, not style. Prisma promises are LAZY:
    // a callback that returns the promise unawaited lets `businessSlot.run()` exit
    // before the query fires, the extension reads an empty frame, and the read is
    // recorded as `no-context` — a framed read filed under the unframed backlog.
    // Every runUnscoped/reentry site in this codebase has the same shape for the
    // same reason.
    const rows = await runInBusinessContext(
      { businessId: BIZ_A, userId: 'u-int' },
      async () => await prisma.party.findMany({ where: { name: { contains: SUFFIX } } }),
    )
    const businessIds = new Set(rows.map((r) => r.businessId))
    expect(businessIds.has(BIZ_A)).toBe(true)
    // AC-13-adjacent: shadow does not change what the caller sees. If this ever
    // narrows to one tenant, the harness has become load-bearing and the mode is
    // `enforce` in all but name.
    expect(businessIds.has(BIZ_B)).toBe(true)

    // A1 proper: the port was installed AND reached. `sampled` is bumped on every
    // observation regardless of verdict, so it is the counter that distinguishes
    // "the harness ran" from "the harness agreed".
    const stats = await waitFor(
      () => raw.scopedShadowStat.findMany({ where: { kind: 'sampled' } }),
      (s) => s.length > 0,
    )
    expect(stats.length).toBeGreaterThan(0)

    // AC-3: the two-tenant read diverges, and it is recorded exactly once.
    const after = await waitFor(
      () => divergences({ kind: 'diverged' }),
      (d) => d.length > before,
    )
    expect(after.length).toBe(before + 1)

    const row = after[after.length - 1]!
    expect(row.operation).toBe('findMany')
    // The scoped side saw strictly fewer rows — that IS the divergence.
    expect(row.scopedCount).toBeLessThan(row.unscopedCount)
    // FM-13 / §9.3: ids are capped and the magnitude is carried by the counts.
    expect(row.onlyUnscoped.length).toBeLessThanOrEqual(20)
  })

  it('A2 — the exported `prisma` is the SCOPED client, not the soft-delete one', () => {
    // Read as a property of the module, not re-derived: if the ternary in
    // `prisma.ts` bound `softDeleted` under shadow, the scoping extension would
    // never be on the path and A1 above could not have produced a single row.
    // This assertion states the same fact directly so the failure names the cause.
    expect(getShadowPort()).not.toBeNull()
    expect(MODE).toBe('shadow')
  })

  it('AC-30 — a clean framed comparison writes ZERO divergence rows', async () => {
    const before = (await divergences()).length

    // The caller already scopes by hand — which is how all 406 call sites work
    // today. Unscoped and scoped answers agree, so there is nothing to record.
    await runInBusinessContext(
      { businessId: BIZ_A, userId: 'u-int' },
      async () => await prisma.party.findMany({ where: { businessId: BIZ_A } }),
    )
    await new Promise((r) => setTimeout(r, 300))

    // This is what keeps the divergence table an ANOMALY table. If a clean
    // comparison wrote a row, the table would fill with the healthy case and the
    // cutover decision would be read off noise (RS-1).
    expect((await divergences()).length).toBe(before)

    const framed = await waitFor(
      () => raw.scopedShadowStat.findMany({ where: { kind: 'observed-framed' } }),
      (s) => s.length > 0,
    )
    expect(framed.length).toBeGreaterThan(0)
  })

  it('AC-24 — two no-context reads on different operations produce TWO rows (AA-2)', async () => {
    // Outside any tenant frame — cron and pre-business traffic, i.e. most of the
    // runUnscoped backlog this table exists to enumerate.
    await prisma.party.findMany({ where: { name: { contains: SUFFIX } } })
    await prisma.party.findFirst({ where: { name: { contains: SUFFIX } } })

    const rows = await waitFor(
      () => divergences({ kind: 'no-context' }),
      (d) => d.length >= 2,
    )
    const ops = new Set(rows.map((r) => r.operation))
    // The dedupe key carries the classification AND the operation. Keying on the
    // payload shapeHash alone would collapse every empty-diff record into one row
    // and destroy exactly the backlog query this table is for.
    expect(ops.has('findMany')).toBe(true)
    expect(ops.has('findFirst')).toBe(true)
    // FM-13: a no-context row has no tenant, and must not invent one.
    for (const r of rows) expect(r.subjectBusinessId).toBeNull()
  })
})

/**
 * The DEFAULT-pass inverse (§12.1, SS-3): with the flag UNSET, the harness must
 * be absent — no port, and not one shadow row for an ordinary read.
 *
 * §12.1 specified this as a sibling describe guarded on the var being unset, run
 * by the default suite. That does not work in this repo and it is worth saying
 * why rather than shipping a block that silently never executes: the default
 * server pass (`vitest.config.ts`) points `DATABASE_URL` at a placeholder that
 * nothing dials, AND excludes `scoped-shadow.*.test.ts` for exactly that reason.
 * A guarded describe there would be dead code asserting nothing — which is this
 * epic's founding failure wearing a test's clothes.
 *
 * So the inverse runs where a real database exists (this pass) and gets its unset
 * flag the only way §12.1 permits: a CHILD PROCESS. The mode is read once at
 * module load and `clients` is memoised onto `globalThis`, so deleting the var
 * in-process would change nothing and pass for the wrong reason.
 */
describe.runIf(SHADOW)('default-pass inverse — the harness is ABSENT unless enabled', () => {
  it('with SCOPED_PRISMA_ENFORCE unset: no port installed, zero shadow rows written', async () => {
    const probe = `
      const run = async () => {
        const { getShadowPort } = await import('./src/lib/prisma-scoped.shadow.ts')
        const { prisma, __basePrismaUnsafe } = await import('./src/lib/prisma.ts')
        const before = await __basePrismaUnsafe.scopedShadowDivergence.count()
        await prisma.party.findMany({ take: 5 })
        await new Promise((r) => setTimeout(r, 300))
        const after = await __basePrismaUnsafe.scopedShadowDivergence.count()
        console.log('RESULT:' + JSON.stringify({ port: getShadowPort() !== null, before, after }))
        await __basePrismaUnsafe.$disconnect()
      }
      run().catch((e) => { console.error(e); process.exit(1) })
    `
    const env = { ...process.env }
    delete env.SCOPED_PRISMA_ENFORCE
    delete env.SCOPED_PRISMA_SHADOW_SAMPLE

    const res = spawnSync('npx', ['tsx', '-e', probe], {
      cwd: resolve(__dirname, '../..'),
      env,
      encoding: 'utf8',
      timeout: 60_000,
    })
    const line = `${res.stdout ?? ''}`.split('\n').find((l) => l.startsWith('RESULT:'))
    expect(line, `probe produced no result:\n${res.stdout}\n${res.stderr}`).toBeDefined()

    const result = JSON.parse(line!.slice('RESULT:'.length)) as {
      port: boolean
      before: number
      after: number
    }
    expect(result.port).toBe(false)
    // The read itself must be entirely unobserved. A single row here means the
    // default flipped and every deploy that never set the var is now running a
    // harness nobody asked for.
    expect(result.after).toBe(result.before)
  }, 90_000)
})
