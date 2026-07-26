/**
 * GST helpers for Suite K (plan §12).
 *
 * The seeded business ships with GST off, because that is what most micro
 * retailers run. Suite K turns it on for its own cases and turns it back off
 * afterwards: a second business would need a business switch on every request,
 * and leaving GST on would silently change the arithmetic every other suite
 * asserts.
 */

import type { Page } from '@playwright/test'
import { csrfRequest } from './fixtures'
import { API } from './parties'

/** A Maharashtra (27) GSTIN — the business's own state for these cases. */
export const BUSINESS_GSTIN = '27AAACH7409R1ZZ'
/** Business's home state code, derived by the server from the GSTIN above. */
export const HOME_STATE = '27'
/** Karnataka — any state that is not {@link HOME_STATE} makes a supply inter-state. */
export const OTHER_STATE = '29'

export interface GstSettings {
  gstEnabled: boolean
  gstin: string | null
  stateCode: string | null
  taxPricingMode: string
}

export async function apiGetGstSettings(page: Page): Promise<GstSettings> {
  const res = await page.request.get(`${API}/gst/settings`)
  if (!res.ok()) throw new Error(`get gst settings failed (${res.status()})`)
  const body = (await res.json()) as { data?: { settings?: GstSettings } }
  if (!body.data?.settings) throw new Error(`gst settings missing: ${JSON.stringify(body)}`)
  return body.data.settings
}

async function patchGstSettings(page: Page, patch: Record<string, unknown>): Promise<GstSettings> {
  const res = await csrfRequest(page, 'patch', `${API}/gst/settings`, patch)
  if (!res.ok()) throw new Error(`patch gst settings failed (${res.status()}): ${await res.text()}`)
  const body = (await res.json()) as { data?: { settings?: GstSettings } }
  return body.data!.settings!
}

/**
 * Turns GST on with a known GSTIN. The server derives `stateCode` from the
 * GSTIN's first two digits, and that is what every intra/inter-state decision
 * compares against — so the state cannot be set independently, and a case that
 * assumed otherwise would assert against the wrong split.
 */
export async function enableGst(page: Page, taxPricingMode = 'EXCLUSIVE'): Promise<GstSettings> {
  return patchGstSettings(page, { gstin: BUSINESS_GSTIN, gstEnabled: true, taxPricingMode })
}

/** Restores the seeded default so the other suites keep their arithmetic. */
export async function disableGst(page: Page): Promise<void> {
  await patchGstSettings(page, { gstEnabled: false, taxPricingMode: 'EXCLUSIVE' })
}

export interface TaxCategory {
  id: string
  name: string
  /** basis points — 1800 = 18% */
  rate: number
}

/**
 * The business's tax categories, seeding the statutory defaults (0/5/12/18/28)
 * on first use. Rates are read back rather than assumed: a case that hardcoded
 * "the 18% one is called GST 18%" would break on a renamed category while the
 * arithmetic it meant to test was still correct.
 */
export async function apiTaxCategories(page: Page): Promise<TaxCategory[]> {
  const read = async (): Promise<TaxCategory[]> => {
    const res = await page.request.get(`${API}/tax-categories`)
    const body = (await res.json()) as {
      data?: { taxCategories?: TaxCategory[] } | TaxCategory[]
    }
    const data = body.data
    return Array.isArray(data) ? data : (data?.taxCategories ?? [])
  }

  let categories = await read()
  if (categories.length === 0) {
    const seeded = await csrfRequest(page, 'post', `${API}/tax-categories/seed-defaults`)
    if (!seeded.ok()) throw new Error(`seed tax categories failed (${seeded.status()})`)
    categories = await read()
  }
  return categories
}

/** The category charging `rate` basis points, or a clear failure naming what exists. */
export async function taxCategoryAt(page: Page, rate: number): Promise<TaxCategory> {
  const categories = await apiTaxCategories(page)
  const match = categories.find((c) => Number(c.rate) === rate)
  if (!match) {
    throw new Error(
      `no tax category at ${rate}bp — have: ${categories.map((c) => `${c.name}:${c.rate}`).join(', ')}`,
    )
  }
  return match
}

/**
 * Total tax on a document.
 *
 * `Document` has no `totalTax` column — the heads (CGST/SGST/IGST/cess) ARE the
 * stored fact, because that is what a return is filed under. Summing them here
 * keeps the cases asserting the same number the department sees.
 */
export function taxOf(d: {
  totalCgst?: number
  totalSgst?: number
  totalIgst?: number
  totalCess?: number
}): number {
  return (
    Number(d.totalCgst ?? 0) +
    Number(d.totalSgst ?? 0) +
    Number(d.totalIgst ?? 0) +
    Number(d.totalCess ?? 0)
  )
}

/** Same, for one line — lines carry per-head amounts, not a blended `taxAmount`. */
export function lineTaxOf(l: {
  cgstAmount?: number
  sgstAmount?: number
  igstAmount?: number
  cessAmount?: number
}): number {
  return (
    Number(l.cgstAmount ?? 0) +
    Number(l.sgstAmount ?? 0) +
    Number(l.igstAmount ?? 0) +
    Number(l.cessAmount ?? 0)
  )
}
