/** GST Settings — Service layer
 *
 * Read/update GST fields on the Business model.
 * Returns only GST-relevant fields to the frontend.
 */

import { prisma } from '../lib/prisma.js'

export interface GstSettingsData {
  gstin: string | null
  stateCode: string | null
  compositionScheme: boolean
  eInvoiceEnabled: boolean
  eWayBillEnabled: boolean
}

const GST_SELECT = {
  gstin: true,
  stateCode: true,
  compositionScheme: true,
  eInvoiceEnabled: true,
  eWayBillEnabled: true,
} as const

export async function getGstSettings(businessId: string): Promise<GstSettingsData> {
  const biz = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: GST_SELECT,
  })
  return biz
}

export async function updateGstSettings(
  businessId: string,
  data: Partial<GstSettingsData>,
): Promise<GstSettingsData> {
  // Destructure only allowed GST fields — prevent mass assignment
  const { gstin, stateCode, compositionScheme, eInvoiceEnabled, eWayBillEnabled } = data
  const safeData: Partial<GstSettingsData> = {}
  if (gstin !== undefined) safeData.gstin = gstin
  if (stateCode !== undefined) safeData.stateCode = stateCode
  if (compositionScheme !== undefined) safeData.compositionScheme = compositionScheme
  if (eInvoiceEnabled !== undefined) safeData.eInvoiceEnabled = eInvoiceEnabled
  if (eWayBillEnabled !== undefined) safeData.eWayBillEnabled = eWayBillEnabled

  const biz = await prisma.business.update({
    where: { id: businessId },
    data: safeData,
    select: GST_SELECT,
  })
  return biz
}
