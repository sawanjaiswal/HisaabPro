import { describe, it, expect } from 'vitest'
import { resolveGateAccess, type GateInput } from '../gate-policy'

const base: GateInput = {
  feature: 'parties',
  plan: 'FREE',
  state: 'NONE',
  isInGrace: false,
  isLoading: false,
  isError: false,
  timedOut: false,
}

describe('resolveGateAccess — failure-mode contract', () => {
  it('FREE feature fails OPEN on error (mirrors server FREE floor)', () => {
    expect(resolveGateAccess({ ...base, isError: true })).toBe('allow')
  })

  it('FREE feature renders while loading (no gate flash)', () => {
    expect(resolveGateAccess({ ...base, isLoading: true })).toBe('allow')
  })

  it('FREE feature renders on timeout', () => {
    expect(resolveGateAccess({ ...base, isLoading: true, timedOut: true })).toBe('allow')
  })

  it('FREE feature is blocked only by a KNOWN LOCKED account', () => {
    expect(resolveGateAccess({ ...base, state: 'LOCKED' })).toBe('upgrade')
  })

  it('PAID feature errors on fetch failure (never grant paid on uncertainty)', () => {
    expect(resolveGateAccess({ ...base, feature: 'accounting', isError: true })).toBe('error')
  })

  it('PAID feature waits while loading', () => {
    expect(resolveGateAccess({ ...base, feature: 'accounting', isLoading: true })).toBe('loading')
  })

  it('PAID feature is granted when the plan includes it', () => {
    expect(resolveGateAccess({ ...base, feature: 'accounting', plan: 'PRO' })).toBe('allow')
  })

  it('PAID feature prompts upgrade when the plan excludes it', () => {
    expect(resolveGateAccess({ ...base, feature: 'accounting', plan: 'FREE' })).toBe('upgrade')
  })

  it('PAID feature is granted during grace (plan still reflects paid tier)', () => {
    expect(
      resolveGateAccess({ ...base, feature: 'accounting', plan: 'PRO', state: 'PAST_DUE', isInGrace: true }),
    ).toBe('allow')
  })
})
