/** Frontend pricing resolver — fixture-driven test suite
 *
 * Uses the same JSON fixture as the backend (copied, not symlinked).
 * All 15 cases must pass to prove FE/BE parity.
 */

import { describe, it, expect } from 'vitest'
import { resolvePrice } from './pricing-resolver'
import type { PriceResolverInput, PriceResolverResult } from './pricing-resolver'
import cases from './__fixtures__/pricing-resolver.cases.json'

interface TestCase {
  name: string
  input: PriceResolverInput
  expected: PriceResolverResult
}

describe('resolvePrice — frontend mirror', () => {
  ;(cases as TestCase[]).forEach(({ name, input, expected }) => {
    it(name, () => {
      expect(resolvePrice(input)).toEqual(expected)
    })
  })
})
