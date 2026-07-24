/**
 * Invoice Settings — singleton per business (round-off + decimal precision).
 *
 * GET upserts defaults on first read (mirrors inventory-settings.service.ts).
 * PUT is a full replace: wire strings → DB enums via the mapper (R4). One row
 * per business (@unique businessId). Every write emits an auditLog row + event.
 */

import { prisma } from '../lib/prisma.js'
import { analyticsEmit } from '../lib/analytics.js'
import {
  toInvoiceSettings,
  toInvoiceSettingsColumns,
  type InvoiceSettingsRow,
} from './invoice-settings.mapper.js'
import type { InvoiceSettingsDTO } from './invoice-template/template.types.js'
import type { UpdateInvoiceSettingsInput } from '../schemas/invoice-settings.schema.js'
import { createAuditEntry } from './settings/audit.js'

const SETTINGS_SELECT = {
  roundOffEnabled: true,
  roundOffPrecision: true,
  roundOffMethod: true,
  roundOffShowOnInvoice: true,
  quantityDecimals: true,
  rateDecimals: true,
} as const

/** GET /api/invoice-settings — upsert-on-read defaults. */
export async function getInvoiceSettings(businessId: string): Promise<InvoiceSettingsDTO> {
  const row = await prisma.invoiceSettings.upsert({
    where: { businessId },
    create: { businessId },
    update: {},
    select: SETTINGS_SELECT,
  })
  return toInvoiceSettings(row as InvoiceSettingsRow)
}

/** PUT /api/invoice-settings — full replace. */
export async function updateInvoiceSettings(
  businessId: string,
  userId: string,
  data: UpdateInvoiceSettingsInput,
): Promise<InvoiceSettingsDTO> {
  // The Zod DTO omits the fixed amount:2 field; the mapper never reads it.
  const columns = toInvoiceSettingsColumns(data as unknown as InvoiceSettingsDTO)

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.invoiceSettings.upsert({
      where: { businessId },
      create: { businessId, ...columns },
      update: { ...columns },
      select: SETTINGS_SELECT,
    })
    await createAuditEntry({
      businessId,
      entityType: 'InvoiceSettings',
      entityId: businessId,
      entityLabel: null,
      userId,
      action: 'UPDATE',
      changes: {
        roundOffPrecision: columns.roundOffPrecision,
        roundOffMethod: columns.roundOffMethod,
      },
    }, tx)
    return updated
  })

  analyticsEmit('invoice_settings_updated', {
    roundOffPrecision: columns.roundOffPrecision,
    roundOffMethod: columns.roundOffMethod,
  })
  return toInvoiceSettings(row as InvoiceSettingsRow)
}
