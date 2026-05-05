/** GST Settings — Service layer (v2, GST Phase 2)
 *
 * Exposes all 7 GST-configuration fields.
 * Auto-flips gstEnabled when a valid GSTIN is saved.
 * Writes AuditLog with GSTIN masked to suffix-4 (Security MB-4).
 * Runs onGstFirstEnabled in the same transaction when gstEnabled flips false→true.
 */

import { prisma } from '../lib/prisma.js'
import logger from '../lib/logger.js'
import { extractStateCode } from './gstin.utils.js'
import type { PatchGstSettingsInput } from '../middleware/validate-gst-settings.js'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GstSettingsData {
  gstin: string | null
  stateCode: string | null
  gstEnabled: boolean
  taxPricingMode: string
  compositionScheme: boolean
  eInvoiceEnabled: boolean
  eWayBillEnabled: boolean
  gstDeclarationText: string | null
  turnoverSlab: string | null
}

const GST_SELECT = {
  gstin: true,
  stateCode: true,
  gstEnabled: true,
  taxPricingMode: true,
  compositionScheme: true,
  eInvoiceEnabled: true,
  eWayBillEnabled: true,
  gstDeclarationText: true,
  turnoverSlab: true,
} as const

// ─── GSTIN masking (Security MB-4) ─────────────────────────────────────────────

/** Mask GSTIN to suffix-4: 'XXXXXXXXXXX1Z5' */
function maskGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const suffix = gstin.slice(-4)
  return 'X'.repeat(gstin.length - 4) + suffix
}

function maskSettingsForAudit(settings: Partial<GstSettingsData>): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...settings }
  if ('gstin' in masked) masked.gstin = maskGstin(settings.gstin ?? null)
  return masked
}

// ─── onGstFirstEnabled ─────────────────────────────────────────────────────────

/**
 * When gstEnabled flips false→true: update all InvoiceTemplate rows for this
 * business to enable GST display blocks where the field is currently undefined
 * (never overwrite an explicit false).
 *
 * NOTE: InvoiceTemplate model is introduced in PR 5 (templates). This function
 * is a no-op until that migration ships. The signature and transaction hook are
 * wired here so PR 5 can fill in the body without changing the call site.
 */
async function onGstFirstEnabled(businessId: string): Promise<void> {
  // PR 5 body: update DocumentTemplate rows where fields.gstTaxSummary === undefined
  // and columns.hsn.visible === undefined. Never overwrites explicit false.
  logger.info('GST_FIRST_ENABLED_HOOK: template update deferred to PR 5', { businessId })
}

// ─── getGstSettings ────────────────────────────────────────────────────────────

export async function getGstSettings(businessId: string): Promise<GstSettingsData> {
  const biz = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: GST_SELECT,
  })
  return {
    ...biz,
    gstDeclarationText: biz.gstDeclarationText ?? null,
    turnoverSlab: biz.turnoverSlab ?? null,
  }
}

// ─── updateGstSettings ─────────────────────────────────────────────────────────

export async function updateGstSettings(
  businessId: string,
  patch: PatchGstSettingsInput,
  userId: string,
): Promise<GstSettingsData> {
  // Load current state for before-snapshot and flip detection
  const current = await prisma.business.findUniqueOrThrow({
    where: { id: businessId },
    select: { ...GST_SELECT, id: true },
  })

  // Build the DB update payload — only include keys that were explicitly passed
  const update: Record<string, unknown> = {}

  if (patch.gstin !== undefined) {
    update.gstin = patch.gstin
    // Auto-flip: GSTIN provided → gstEnabled = true
    if (patch.gstin !== null) {
      update.gstEnabled = true
      update.stateCode = extractStateCode(patch.gstin)
    } else {
      // Clearing GSTIN resets stateCode; gstEnabled stays as-is
      update.stateCode = null
    }
  }

  // Explicit gstEnabled in patch overrides auto-flip (caller can still disable)
  if (patch.gstEnabled !== undefined) {
    update.gstEnabled = patch.gstEnabled
  }

  if (patch.taxPricingMode !== undefined) update.taxPricingMode = patch.taxPricingMode
  if (patch.compositionScheme !== undefined) update.compositionScheme = patch.compositionScheme
  if (patch.eWayBillEnabled !== undefined) update.eWayBillEnabled = patch.eWayBillEnabled
  if (patch.gstDeclarationText !== undefined) update.gstDeclarationText = patch.gstDeclarationText
  if (patch.turnoverSlab !== undefined) update.turnoverSlab = patch.turnoverSlab

  // eInvoiceEnabled: reject if enabling but no GSTIN will be set
  if (patch.eInvoiceEnabled !== undefined) {
    if (patch.eInvoiceEnabled === true) {
      const resolvedGstin = patch.gstin !== undefined ? patch.gstin : current.gstin
      if (!resolvedGstin) {
        const err = new Error('EINVOICE_REQUIRES_GSTIN: eInvoiceEnabled cannot be true when GSTIN is not set')
        Object.assign(err, { statusCode: 400, code: 'EINVOICE_REQUIRES_GSTIN' })
        throw err
      }
    }
    update.eInvoiceEnabled = patch.eInvoiceEnabled
  }

  const wasGstEnabled = current.gstEnabled
  const willFlipEnabled = update.gstEnabled === true && !wasGstEnabled

  // Run in a transaction so template patch and audit are atomic
  const updated = await prisma.$transaction(async (tx) => {
    const biz = await tx.business.update({
      where: { id: businessId },
      data: update as Parameters<typeof tx.business.update>[0]['data'],
      select: GST_SELECT,
    })

    if (willFlipEnabled) {
      await onGstFirstEnabled(businessId)
    }

    // Build masked before/after snapshots for AuditLog (MB-4)
    const before = maskSettingsForAudit({
      gstin: current.gstin,
      stateCode: current.stateCode,
      gstEnabled: current.gstEnabled,
      taxPricingMode: current.taxPricingMode,
      compositionScheme: current.compositionScheme,
      eInvoiceEnabled: current.eInvoiceEnabled,
      eWayBillEnabled: current.eWayBillEnabled,
      gstDeclarationText: current.gstDeclarationText ?? null,
      turnoverSlab: current.turnoverSlab ?? null,
    })
    const after = maskSettingsForAudit({
      gstin: biz.gstin,
      stateCode: biz.stateCode,
      gstEnabled: biz.gstEnabled,
      taxPricingMode: biz.taxPricingMode,
      compositionScheme: biz.compositionScheme,
      eInvoiceEnabled: biz.eInvoiceEnabled,
      eWayBillEnabled: biz.eWayBillEnabled,
      gstDeclarationText: biz.gstDeclarationText ?? null,
      turnoverSlab: biz.turnoverSlab ?? null,
    })

    await tx.auditLog.create({
      data: {
        businessId,
        userId,
        action: 'GST_SETTINGS_UPDATE',
        entityType: 'business',
        entityId: businessId,
        entityLabel: 'GST Settings',
        changes: { before, after } as object,
      },
    })

    logger.info('GST_SETTINGS_UPDATE', {
      businessId,
      userId,
      flipEnabled: willFlipEnabled,
      fields: Object.keys(update),
    })

    return biz
  })

  return {
    ...updated,
    gstDeclarationText: updated.gstDeclarationText ?? null,
    turnoverSlab: updated.turnoverSlab ?? null,
  }
}
