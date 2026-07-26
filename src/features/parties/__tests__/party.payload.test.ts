import { describe, it, expect } from 'vitest'
import { toCreatePartyPayload, toUpdatePartyPayload } from '../party.payload'
import type { PartyFormData } from '../party.types'

/**
 * Both server schemas are `.strict()`, so this suite asserts absence as much as
 * presence: an extra key is a 400, not a harmless field.
 */
const FORM: PartyFormData = {
  name: 'Raju Traders',
  phone: '9876543210',
  type: 'CUSTOMER',
  tags: ['retail'],
  gstin: '27AAPFU0939F1ZF',
  pan: 'AAPFU0939F',
  creditLimit: 0,
  creditLimitMode: 'WARN',
  addresses: [],
  customFields: [
    { fieldId: 'f1', value: 'kept' },
    { fieldId: 'f2', value: '   ' },
  ],
  // Display-only state the GSTIN verifier writes into the form.
  gstinVerified: true,
  gstinLegalName: 'Raju Traders Pvt Ltd',
  gstinStatus: 'Active',
  openingBalance: { amount: 1500, type: 'RECEIVABLE', asOfDate: '2026-07-26' },
} as PartyFormData

describe('toCreatePartyPayload', () => {
  it('drops the GSTIN verification state the server does not accept', () => {
    const payload = toCreatePartyPayload(FORM) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('gstinVerified')
    expect(payload).not.toHaveProperty('gstinLegalName')
    expect(payload).not.toHaveProperty('gstinStatus')
    // The GSTIN itself must still go — it is what makes the party B2B.
    expect(payload.gstin).toBe('27AAPFU0939F1ZF')
  })

  it('converts the opening balance from rupees to paise', () => {
    expect(toCreatePartyPayload(FORM).openingBalance?.amount).toBe(150000)
  })

  it('strips blank custom field values', () => {
    expect(toCreatePartyPayload(FORM).customFields).toEqual([{ fieldId: 'f1', value: 'kept' }])
  })
})

describe('toUpdatePartyPayload', () => {
  it('drops the verification state and the create-only sub-resources', () => {
    const payload = toUpdatePartyPayload(FORM) as unknown as Record<string, unknown>
    expect(payload).not.toHaveProperty('gstinVerified')
    expect(payload).not.toHaveProperty('gstinLegalName')
    expect(payload).not.toHaveProperty('gstinStatus')
    expect(payload).not.toHaveProperty('addresses')
    expect(payload).not.toHaveProperty('openingBalance')
  })
})
