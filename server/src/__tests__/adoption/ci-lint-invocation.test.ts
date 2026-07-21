/**
 * A9b — CI invokes the tenant-leak lint (File #57, ARCHITECTURE §12).
 *
 * A9 proves `.githooks/pre-commit` runs the lint. That is NOT sufficient
 * coverage, because the hook only runs where `core.hooksPath` was set — local
 * git config, never committed. A fresh clone, a CI runner, and any machine that
 * skipped `npm install` all bypass it silently. So the hook is an invoker that
 * CAN be un-configured, and B-4 requires at least one that cannot.
 *
 * `qa.yml` is that invoker: it runs on every PR with no per-machine setup.
 *
 * The test does not grep the file for the string `lint:raw-client` — a
 * commented-out line, a step under an `if: false`, or a run block in a job that
 * no longer exists would all satisfy a grep. It extracts the qa job's `run:`
 * commands, requires one to reference the lint, and then EXECUTES that extracted
 * string verbatim against a planted violation. Green therefore means "the exact
 * command CI will run does reject a raw-client escape", not "a matching string
 * appears in a YAML file".
 */
import { afterEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PROBE_REL, REPO_ROOT, plantLeakProbe, removeLeakProbe } from './leak-probe.helper.js'

const WORKFLOW = resolve(REPO_ROOT, '.github/workflows/qa.yml')

/**
 * Pull the `run:` commands out of the workflow's first job.
 *
 * Hand-rolled rather than a YAML dependency: the shapes in play are
 * `run: <cmd>` and `run: |` blocks under `steps:`, and adding a parser to the
 * server's dependency tree to read one CI file is a worse trade than thirty
 * lines that fail loudly if the file's shape changes. The `checks` job is
 * located by name so a second job's steps cannot satisfy the assertion.
 */
function runCommandsOfChecksJob(yaml: string): string[] {
  const lines = yaml.split('\n')
  const start = lines.findIndex((l) => /^ {2}checks:/.test(l))
  expect(start, 'qa.yml has no `checks:` job — the workflow was restructured').toBeGreaterThan(-1)

  // The job ends where the next job at the same indentation begins.
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i]!)) {
      end = i
      break
    }
  }

  const commands: string[] = []
  for (let i = start; i < end; i++) {
    const line = lines[i]!
    const inline = line.match(/^\s+-?\s*run:\s*(?!\|)(\S.*)$/)
    if (inline) {
      commands.push(inline[1]!.trim())
      continue
    }
    if (/^\s+-?\s*run:\s*\|\s*$/.test(line)) {
      const indent = (lines[i + 1]?.match(/^\s*/)?.[0] ?? '').length
      for (let j = i + 1; j < end; j++) {
        const body = lines[j]!
        if (body.trim() === '') continue
        if ((body.match(/^\s*/)?.[0] ?? '').length < indent) break
        commands.push(body.trim())
      }
    }
  }
  return commands
}

describe('A9b — CI runs the tenant-leak lint', () => {
  afterEach(removeLeakProbe)

  it('the checks job contains a run command that invokes the lint, and that command rejects a violation', () => {
    const commands = runCommandsOfChecksJob(readFileSync(WORKFLOW, 'utf8'))
    expect(commands.length, 'no run: commands parsed — the parser or qa.yml drifted').toBeGreaterThan(0)

    const lintCommand = commands.find(
      (c) => c.includes('lint:raw-client') || c.includes('lint-raw-client.mjs'),
    )
    expect(
      lintCommand,
      `no CI step invokes the tenant-leak lint. Parsed commands:\n${commands.join('\n')}`,
    ).toBeDefined()

    plantLeakProbe()
    try {
      // Verbatim, through a shell, from the repo root — exactly how the runner
      // executes it. Re-implementing the command here (`node scripts/...`) would
      // test this test's idea of CI rather than CI.
      const res = spawnSync(lintCommand!, { cwd: REPO_ROOT, shell: true, encoding: 'utf8' })
      const output = `${res.stdout ?? ''}${res.stderr ?? ''}`

      expect(res.status, `command \`${lintCommand}\` did not fail:\n${output}`).not.toBe(0)
      expect(output).toContain('[B2]')
      expect(output).toContain(PROBE_REL)
    } finally {
      removeLeakProbe()
    }
  }, 120_000)

  it('the same command passes on a clean tree', () => {
    const lintCommand = runCommandsOfChecksJob(readFileSync(WORKFLOW, 'utf8')).find((c) =>
      c.includes('lint:raw-client'),
    )!
    const res = spawnSync(lintCommand, { cwd: REPO_ROOT, shell: true, encoding: 'utf8' })
    // Without this control, a lint that failed unconditionally would satisfy the
    // assertion above and CI would be red on every PR for reasons nobody linked
    // back to this test.
    expect(res.status, `${res.stdout ?? ''}${res.stderr ?? ''}`).toBe(0)
  }, 120_000)
})
