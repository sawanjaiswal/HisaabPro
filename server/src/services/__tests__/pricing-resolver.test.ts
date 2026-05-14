import { describe, it, expect } from 'vitest'
import { resolvePrice } from '../pricing-resolver.js'
import type { PriceResolverInput, PriceResolverResult } from '../pricing-resolver.js'
import cases from '../../validators/__fixtures__/pricing-resolver.cases.json'

interface FixtureCase {
  name: string
  input: PriceResolverInput
  expected: PriceResolverResult
}

describe('pricing-resolver', () => {
  for (const c of cases as FixtureCase[]) {
    it(c.name, () => {
      expect(resolvePrice(c.input)).toEqual(c.expected)
    })
  }
})
