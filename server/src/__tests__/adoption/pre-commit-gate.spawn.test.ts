/**
 * A9 — the raw-client lint is actually INVOKED by `.githooks/pre-commit`
 * (File #43, ARCHITECTURE §12).
 *
 * `scripts/scoped/__tests__/lint-raw-client.rule.test.ts` proves the RULE is
 * correct. It says nothing about whether anything runs it — and a correct rule
 * with no invoker is precisely the failure this epic was created after (SR-3).
 * So this test never imports the lint. It spawns the hook and reads the exit
 * code, which is the only phrasing that goes red when someone deletes the
 * `node scripts/scoped/lint-raw-client.mjs` line from the hook.
 *
 * Two things are asserted beyond "non-zero":
 *
 *   - a clean tree exits 0. Without that control, a hook that failed for any
 *     unrelated reason (a broken SSOT registry, a missing dep) would satisfy
 *     the violation case and the test would be green while measuring nothing.
 *   - `SSOT_BYPASS=1` does NOT silence it. Those two gates were one `exit 0`
 *     until they were split; anyone silencing a module-drift complaint would
 *     have silenced cross-tenant leak detection in the same keystroke. The
 *     split is a property of the hook, so the hook is where it is asserted.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { PROBE_REL, REPO_ROOT, plantLeakProbe, removeLeakProbe } from './leak-probe.helper.js'

const HOOK = resolve(REPO_ROOT, '.githooks/pre-commit')

interface HookRun {
  status: number | null
  output: string
}

/**
 * Run the hook as git would.
 *
 * `GIT_INDEX_FILE` points at a throwaway index so the `git add` below cannot
 * touch the developer's real staging area — a test that stages files into the
 * working index would silently fold this probe into whatever the person running
 * it was about to commit.
 */
function runHook(opts: { stageProbe?: boolean; env?: Record<string, string> } = {}): HookRun {
  const indexDir = mkdtempSync(join(tmpdir(), 'hp-hook-'))
  const childEnv = { ...process.env, GIT_INDEX_FILE: join(indexDir, 'index'), ...opts.env }
  try {
    if (opts.stageProbe) {
      // Staging is realism, not mechanism: the lint walks the working tree, so
      // the hook would fail on the planted file either way. It is done because
      // it is what git actually does at commit time, and because an index-aware
      // rewrite of the lint would keep this test meaningful rather than quietly
      // turning it into a no-op.
      spawnSync('git', ['add', '--intent-to-add', PROBE_REL], {
        cwd: REPO_ROOT,
        env: childEnv,
        encoding: 'utf8',
      })
    }
    const res = spawnSync('sh', [HOOK], { cwd: REPO_ROOT, env: childEnv, encoding: 'utf8' })
    return { status: res.status, output: `${res.stdout ?? ''}${res.stderr ?? ''}` }
  } finally {
    rmSync(indexDir, { recursive: true, force: true })
  }
}

describe('A9 — pre-commit invokes the tenant-leak lint', () => {
  afterEach(() => {
    // Belt and braces with the `finally` blocks below: a probe surviving this
    // file would fail the repo's pre-commit for whoever commits next, i.e. this
    // test would break the gate it exists to verify.
    removeLeakProbe()
  })

  it('exits 0 on a clean tree (the control that makes the failure case mean something)', () => {
    const res = runHook()
    expect(res.status, `hook output:\n${res.output}`).toBe(0)
  }, 120_000)

  it('exits non-zero and names the B2 vector when a raw-client escape is staged', () => {
    plantLeakProbe()
    try {
      const res = runHook({ stageProbe: true })

      expect(res.status).not.toBe(0)
      // The exit code alone would be satisfied by any failure in the hook. The
      // vector tag proves the failing gate is the tenant-leak one.
      expect(res.output).toContain('[B2]')
      expect(res.output).toContain(PROBE_REL)
    } finally {
      removeLeakProbe()
    }
  }, 120_000)

  it('is not silenced by SSOT_BYPASS — the two gates carry separate bypasses', () => {
    plantLeakProbe()
    try {
      const res = runHook({ env: { SSOT_BYPASS: '1' } })
      expect(res.status).not.toBe(0)
      expect(res.output).toContain('[B2]')
    } finally {
      removeLeakProbe()
    }
  }, 120_000)
})
