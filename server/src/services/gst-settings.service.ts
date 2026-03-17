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
  const biz = await prisma.business.update({
    where: { id: businessId },
    data,
    select: GST_SELECT,
  })
  return biz
}
