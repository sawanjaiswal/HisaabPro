/**
 * Rule-level tests for `lint-raw-client.mjs` (File #44).
 *
 * EXPLICITLY NOT AN ADOPTION ASSERTION. Nothing here would go red if every
 * invoker of this lint were deleted tomorrow — the rule would still be correct
 * and these tests would still pass. That combination (correct, tested, called by
 * nothing) is the founding failure of this epic, so it is worth stating in the
 * file itself rather than leaving a reader to assume coverage.
 *
 * Adoption is carried by:
 *   A9  — `server/src/__tests__/adoption/pre-commit-gate.spawn.test.ts`
 *   A9b — `server/src/__tests__/adoption/ci-lint-invocation.test.ts`
 *
 * What IS here: the decisions the rule makes. The lint has no exported API — it
 * is a CLI that walks the repo — so each case plants a file, runs the script,
 * and reads the verdict.
 *
 * Two rules are deliberately not covered:
 *   - the ALLOWLIST arm (B2 skipping `server/src/lib/prisma.ts`) is asserted
 *     indirectly by the clean-tree case: that file contains the token on every
 *     run, so a broken allowlist makes the whole repo fail.
 *   - B-5 handoff detection would require planting into an allowlisted file, and
 *     the only two are `lib/prisma.ts` and `jobs/shadow-canary.cron.ts` — the
 *     first is a HIGH_RISK_PATHS-gated trust anchor. A test that rewrites the
 *     tenant-isolation choke point to check a lint is a worse trade than the
 *     gap; the rule's own comment block carries the reasoning instead.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(__dirname, '../../..')
const LINT = resolve(REPO_ROOT, 'scripts/scoped/lint-raw-client.mjs')

// `server/src/services/` because the lint skips any directory named `__tests__`
// (IGNORED_DIRS). A fixture written beside this file would be invisible to the
// tool and every case below would pass while measuring nothing.
const FIXTURE_REL = 'server/src/services/__lint_rule_fixture.generated.ts'
const FIXTURE_ABS = resolve(REPO_ROOT, FIXTURE_REL)

// Assembled at runtime so this test file is not itself a B2 violation.
const RAW_CLIENT = ['__base', 'Prisma', 'Unsafe'].join('')

function plant(content: string): void {
  writeFileSync(FIXTURE_ABS, content, 'utf8')
}

function clean(): void {
  rmSync(FIXTURE_ABS, { force: true })
}

interface LintRun {
  status: number | null
  output: string
}

function runLint(): LintRun {
  const res = spawnSync('node', [LINT], { cwd: REPO_ROOT, encoding: 'utf8' })
  return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` }
}

describe('lint-raw-client rule behaviour', () => {
  afterEach(clean)

  it('passes on the repo as committed (also proves the B2 allowlist arm works)', () => {
    const res = runLint()
    // `server/src/lib/prisma.ts` holds the raw-client token by definition, so a
    // green run here means the allowlist is being consulted, not that the token
    // is absent.
    expect(res.status, res.output).toBe(0)
    expect(res.output).toContain('OK')
  }, 60_000)

  it('B2 — flags the raw client in a non-allowlisted file and names the tenant-scoped model', () => {
    // `party`, not `invoice`: the label is resolved from the live DMMF and this
    // schema has no `Invoice` model (documents are `Document`). A fixture naming
    // a model that does not exist would take the generic-message branch and this
    // assertion could never fail, which is how the degraded lookup below stayed
    // invisible in the first place.
    plant(`export const leak = () => ${RAW_CLIENT}.party.findMany()\n`)
    const res = runLint()

    expect(res.status).toBe(1)
    expect(res.output).toContain('[B2]')
    expect(res.output).toContain(FIXTURE_REL)
    // The message is the useful half. `Party` is derived from the DMMF at run
    // time, so this also fails if the model-label lookup silently degrades — it
    // did exactly that for months, resolving `@prisma/client` from a directory
    // where it is not installed and falling into the catch on every run.
    expect(res.output).toContain('Party')
  }, 60_000)

  it('B2 — does not flag a mention inside a comment', () => {
    plant(
      `// ${RAW_CLIENT} is the unscoped client; never import it here.\n` +
        ` * ${RAW_CLIENT} again, this time in a block-comment continuation\n` +
        `export const safe = () => 1\n`,
    )
    const res = runLint()

    // Best-effort by design (the rule is line-based, not a parser). Documenting
    // it as intended behaviour matters: without this case, someone tightening
    // the regex would not know that prose about the token is expected to pass.
    expect(res.status, res.output).toBe(0)
  }, 60_000)

  it('B7 — flags raw SQL in a file that has no allowlist budget', () => {
    plant(
      `import { prisma } from '../lib/prisma.js'\n` +
        `export const q = () => prisma.$queryRaw\`SELECT 1\`\n`,
    )
    const res = runLint()

    expect(res.status).toBe(1)
    expect(res.output).toContain('[B7]')
    expect(res.output).toContain(FIXTURE_REL)
  }, 60_000)
})
