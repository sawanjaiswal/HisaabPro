/**
 * GSTIN external verification — GST Suvidha Provider (GSP) lookup.
 *
 * Optional integration, configured via env (same pattern as Resend / Aisensy):
 *   GSTIN_VERIFY_API_URL  — provider taxpayer-search endpoint
 *   GSTIN_VERIFY_API_KEY  — provider API key (sent as x-api-key)
 *
 * When the provider is not configured we return verified:false (NOT a fabricated
 * pass) so callers never claim a registry confirmation that never happened.
 */

import logger from '../lib/logger.js'

export interface GstinVerifyExternalResult {
  /** True only when a real provider confirmed an active registration. */
  verified: boolean
  /** Whether GSP credentials are present — distinguishes "no check" from "not found". */
  providerConfigured: boolean
  legalName?: string
  tradeName?: string
  status?: string
  type?: string
  registrationDate?: string
  /** Set when the provider was queried but could not confirm. */
  error?: string
}

/** Defensive map of a GSP taxpayer-search payload — providers vary in field casing. */
export function mapProviderResponse(raw: unknown): GstinVerifyExternalResult {
  const r = (raw ?? {}) as Record<string, unknown>
  const str = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = r[k]
      if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return undefined
  }

  const status = str('status', 'sts')
  return {
    providerConfigured: true,
    // Active/registered statuses confirm the GSTIN; anything else is unverified.
    verified: status ? /^(active|registered)$/i.test(status) : false,
    legalName: str('legalName', 'lgnm'),
    tradeName: str('tradeName', 'tradeNam', 'tradeNm'),
    status,
    type: str('type', 'dty', 'taxpayerType'),
    registrationDate: str('registrationDate', 'rgdt'),
  }
}

export async function verifyGstinExternal(gstin: string): Promise<GstinVerifyExternalResult> {
  const apiKey = process.env.GSTIN_VERIFY_API_KEY
  const baseUrl = process.env.GSTIN_VERIFY_API_URL
  if (!apiKey || !baseUrl) {
    logger.warn('verifyGstinExternal skipped: GSTIN_VERIFY_API_* not configured')
    return { verified: false, providerConfigured: false }
  }

  try {
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}gstin=${encodeURIComponent(gstin)}`
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })

    if (response.status === 404) {
      return { verified: false, providerConfigured: true, error: 'GSTIN not found in registry' }
    }
    if (!response.ok) {
      logger.error('GSTIN verify provider error', { gstin: gstin.slice(0, 2), status: response.status })
      return { verified: false, providerConfigured: true, error: `Provider returned ${response.status}` }
    }

    return mapProviderResponse(await response.json())
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown verify error'
    logger.error('verifyGstinExternal exception', { gstin: gstin.slice(0, 2), error: message })
    return { verified: false, providerConfigured: true, error: 'Verification lookup failed' }
  }
}
