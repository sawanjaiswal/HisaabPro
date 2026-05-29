/**
 * gstin-verify.service unit tests — provider mapping + not-configured guard.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mapProviderResponse, verifyGstinExternal } from '../gstin-verify.service.js'

describe('mapProviderResponse', () => {
  it('confirms an active registration', () => {
    const r = mapProviderResponse({ status: 'Active', lgnm: 'Acme Pvt Ltd', dty: 'Regular', rgdt: '2017-07-01' })
    expect(r.verified).toBe(true)
    expect(r.providerConfigured).toBe(true)
    expect(r.legalName).toBe('Acme Pvt Ltd')
    expect(r.type).toBe('Regular')
    expect(r.registrationDate).toBe('2017-07-01')
  })

  it('does not confirm a cancelled/suspended registration', () => {
    expect(mapProviderResponse({ status: 'Cancelled', lgnm: 'X' }).verified).toBe(false)
    expect(mapProviderResponse({ sts: 'Suspended' }).verified).toBe(false)
  })

  it('treats a missing status as unverified', () => {
    const r = mapProviderResponse({})
    expect(r.verified).toBe(false)
    expect(r.providerConfigured).toBe(true)
    expect(r.legalName).toBeUndefined()
  })

  it('reads camelCase field aliases', () => {
    const r = mapProviderResponse({ status: 'registered', legalName: 'Beta', tradeName: 'Beta Store' })
    expect(r.verified).toBe(true)
    expect(r.tradeName).toBe('Beta Store')
  })
})

describe('verifyGstinExternal — not configured', () => {
  const prevKey = process.env.GSTIN_VERIFY_API_KEY
  const prevUrl = process.env.GSTIN_VERIFY_API_URL

  beforeEach(() => {
    delete process.env.GSTIN_VERIFY_API_KEY
    delete process.env.GSTIN_VERIFY_API_URL
  })
  afterEach(() => {
    if (prevKey !== undefined) process.env.GSTIN_VERIFY_API_KEY = prevKey
    if (prevUrl !== undefined) process.env.GSTIN_VERIFY_API_URL = prevUrl
    vi.restoreAllMocks()
  })

  it('returns verified:false without fabricating a pass when no provider is set', async () => {
    const r = await verifyGstinExternal('27AAPFU0939F1ZV')
    expect(r.verified).toBe(false)
    expect(r.providerConfigured).toBe(false)
  })
})
