/**
 * Drift guard — frontend PLAN_LIMITS must match the server's plans.ts byte-for-byte
 * on every boolean feature flag. If the backend adds/changes a flag, this test
 * fails until the frontend mirror is updated.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PLAN_LIMITS } from './plan-limits'

function loadServerPlanLimits(): Record<string, Record<string, number | boolean>> {
  const src = readFileSync(
    resolve(__dirname, '../../../server/src/config/plans.ts'),
    'utf8',
  )
  // Extract the PLAN_LIMITS object literal. The server file is static TS, so a
  // targeted regex is enough here — keeps this test zero-deps.
  const match = src.match(/PLAN_LIMITS[^=]*=\s*({[\s\S]*?^})/m)
  if (!match) throw new Error('Could not locate PLAN_LIMITS in server/plans.ts')
  const body = match[1]
    .replace(/\/\/.*$/gm, '')        // strip line comments
    .replace(/,(\s*[}\]])/g, '$1')   // strip trailing commas
    .replace(/([{,\s])(\w+):/g, '$1"$2":') // quote keys
  return JSON.parse(body)
}

describe('PLAN_LIMITS — frontend/backend drift', () => {
  const serverLimits = loadServerPlanLimits()

  it('has matching tier keys', () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual(Object.keys(serverLimits).sort())
  })

  for (const tier of ['FREE', 'PRO', 'BUSINESS'] as const) {
    it(`${tier} flags match server`, () => {
      expect(PLAN_LIMITS[tier]).toEqual(serverLimits[tier])
    })
  }
})
