#!/usr/bin/env node
/**
 * Runs an E2E db script with DATABASE_URL forced to the E2E database.
 *
 * Exists so `npm run e2e:reset` can never inherit server/.env's dev URL by
 * accident — the child process is given an explicit URL, not the ambient one.
 *
 * Usage: node scripts/e2e/run.mjs reset|seed [-- extra args]
 */

import { spawn } from 'node:child_process'
import { e2eDatabaseUrl } from './db-url.mjs'

const TARGETS = { reset: 'prisma/e2e-reset.ts', seed: 'prisma/e2e-seed.ts' }

const [target, ...rest] = process.argv.slice(2)
const script = TARGETS[target]
if (!script) {
  console.error(`usage: node scripts/e2e/run.mjs <${Object.keys(TARGETS).join('|')}> [args]`)
  process.exit(1)
}

const url = e2eDatabaseUrl()
console.log(`e2e:${target} → ${url.replace(/\/\/[^@]*@/, '//***@')}`)

const child = spawn('npx', ['tsx', script, ...rest], {
  cwd: new URL('../../server/', import.meta.url).pathname,
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url, E2E_DATABASE_URL: url },
})
child.on('exit', (code) => process.exit(code ?? 1))
