/**
 * A4 — `validateScopedPrismaBoot()` is actually CALLED at boot (File #42, §12).
 *
 * This test spawns the real entrypoint as a child process. That is deliberately
 * the expensive option (a couple of seconds of CI), and the cheap alternative is
 * the exact thing being guarded against:
 *
 *   import { validateScopedPrismaBoot } from '../lib/env.scoped-prisma.js'
 *   expect(() => validateScopedPrismaBoot()).toThrow()
 *
 * That assertion passes today. It also passed for the entire window in which the
 * function existed, was correct, was unit-tested, and had ZERO call sites (SR-3).
 * It tests the definition; A4 has to test the invoker (AA-4). Only a real boot can
 * tell those two apart, so only a real boot is run.
 *
 * `shadown` is a typo of `shadow` — chosen because it is the realistic operator
 * error. A garbage value like `xyzzy` would be caught by eye in a deploy review;
 * a one-character slip in a Render env var is not, and silently degrading to
 * `off` under it is how tenant isolation gets turned off by accident.
 */
import { describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const SERVER_ROOT = resolve(__dirname, '../../..')

interface BootResult {
  code: number | null
  stderr: string
  stdout: string
}

/**
 * Boot the entrypoint with `env` overlaid and report how it died.
 *
 * A successful boot listens forever, so the timeout is part of the contract: if
 * the guard is gone the process stays up, we kill it, and `code` is null — which
 * the assertions treat as a failure, not as an inconclusive run.
 */
function bootWith(env: Record<string, string>, timeoutMs = 25_000): Promise<BootResult> {
  return new Promise((resolvePromise) => {
    const child = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: SERVER_ROOT,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        // A port of its own: a boot that gets far enough to listen must not
        // collide with a dev server and fail for the wrong reason.
        PORT: '5599',
        ...env,
      },
    })

    let stderr = ''
    let stdout = ''
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))

    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolvePromise({ code, stderr, stdout })
    })
  })
}

describe('A4 — boot guard is invoked by the entrypoint', () => {
  it(
    'refuses to boot on a mis-set SCOPED_PRISMA_ENFORCE and says why',
    async () => {
      const res = await bootWith({ SCOPED_PRISMA_ENFORCE: 'shadown' })

      // Non-zero AND non-null: null means we killed a process that was happily
      // serving traffic with a tenant-isolation flag nobody validated.
      expect(res.code).not.toBe(0)
      expect(res.code).not.toBeNull()

      // The message matters as much as the exit code. An operator reading a
      // crash-loop log needs the name of the variable they mistyped, not a stack.
      const output = `${res.stderr}${res.stdout}`
      expect(output).toContain('SCOPED_PRISMA_ENFORCE')
      expect(output).toMatch(/off\|shadow\|enforce/)
    },
    40_000,
  )

  it(
    'refuses to boot when cutover is declared done but the mode is not enforce',
    async () => {
      // The post-cutover guard (M3). Once `enforce` is the declared production
      // state, booting in any other mode means tenant isolation is off while
      // everyone believes it is on — the failure this whole epic is upstream of.
      const res = await bootWith({
        NODE_ENV: 'production',
        SCOPED_PRISMA_CUTOVER_DONE: 'true',
        SCOPED_PRISMA_ENFORCE: 'off',
      })

      expect(res.code).not.toBe(0)
      expect(res.code).not.toBeNull()
      expect(`${res.stderr}${res.stdout}`).toContain('SCOPED_PRISMA_CUTOVER_DONE')
    },
    40_000,
  )
})
