/**
 * POS Checkout — Main Orchestrator
 *
 * createPosSale(ctx, rawInput) → PosSaleDTO
 *
 * All mutations are inside a single Prisma $transaction:
 *  1. Idempotency check
 *  2. clientId uniqueness guard
 *  3. Load PosSetting
 *  4. Reprice lines (server-authoritative)
 *  5. Resolve party (provided or walk-in sentinel)
 *  6. Apply tax engine
 *  7. Guards: drift ≤ tolerance + payment sum
 *  8. Allocate receipt number
 *  9. Claim inventory
 * 10. Create Document (POS_SALE)
 * 11. Persist PosSale + PosSaleItem (via pos-checkout.persist.ts)
 * 12. Cash entry (feature-flagged)
 * 13. PosSaleEvent CREATED
 * 14. Store idempotency
 * 15. Return DTO
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notFoundError } from '../../lib/errors.js'
import type { PosServiceCtx, PosSaleDTO } from './pos.types.js'
import { validateCreatePosSale } from './pos.validators.js'
import { checkIdempotency, storeIdempotency } from './pos-checkout.idempotency.js'
import { priceLines, sumPricedLines } from './pos-checkout.pricing.js'
import { applyTax, deriveSupplyType } from './pos-checkout.tax.js'
import { getOrCreateWalkInParty } from './pos-checkout.walkin.js'
import { allocateNumber } from './pos-checkout.receipt.js'
import { claimInventory } from './pos-checkout.inventory.js'
import { createCashEntry } from './pos-checkout.cash.js'
import { persistPosSale, buildPosSaleDTO } from './pos-checkout.persist.js'
import {
  totalMismatchError,
  paymentSumMismatchError,
  duplicateClientIdError,
} from './pos.errors.js'
import {
  TOTAL_DRIFT_TOLERANCE_PAISE,
  POS_DOCUMENT_TYPE,
  POS_EVENT_CREATED,
} from './pos.constants.js'

export async function createPosSale(
  ctx: PosServiceCtx,
  rawInput: unknown
): Promise<PosSaleDTO> {
  const { businessId, userId } = ctx

  // ── 1. Validate input via Zod ──────────────────────────────────────────
  const input = validateCreatePosSale(rawInput)

  // Load business info outside tx (read-only)
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true, taxPricingMode: true },
  })
  if (!business) throw notFoundError('Business')

  const taxPricingMode = input.taxPricingMode ?? business.taxPricingMode ?? 'EXCLUSIVE'

  return prisma.$transaction(async (tx) => {
    // ── 1b. Idempotency check ──────────────────────────────────────────
    const idempResult = await checkIdempotency(tx, businessId, input.idempotencyKey)
    if (idempResult.hit) return idempResult.response

    // ── 1c. clientId uniqueness guard ─────────────────────────────────
    if (input.clientId) {
      const dup = await tx.posSale.findUnique({
        where: { clientId: input.clientId },
        select: { id: true },
      })
      if (dup) throw duplicateClientIdError(input.clientId)
    }

    // ── 2. Load PosSetting ─────────────────────────────────────────────
    const posSetting = await tx.posSetting.findUnique({ where: { businessId } })

    // ── 3. Reprice lines (server-authoritative) ────────────────────────
    const pricedLines = await priceLines(tx, businessId, input.items)
    const { subtotal, totalDiscount } = sumPricedLines(pricedLines)

    // ── 4. Resolve party ───────────────────────────────────────────────
    let partyGstin: string | null = null
    let partyStateCode: string | null = null
    let partyId: string

    if (input.partyId) {
      const party = await tx.party.findFirst({
        where: { id: input.partyId, businessId },
        select: { id: true, gstin: true, stateCode: true },
      })
      if (!party) throw notFoundError('Party')
      partyId = party.id
      partyGstin = party.gstin ?? null
      partyStateCode = party.stateCode ?? null
    } else {
      const walkIn = await getOrCreateWalkInParty(tx, businessId)
      partyId = walkIn.id
    }

    const supplyType = deriveSupplyType(partyGstin)
    const partyResolution = {
      partyId,
      partyName: '',
      partyGstin,
      partyStateCode,
      placeOfSupply: partyStateCode ?? business.stateCode ?? null,
      supplyType,
    }

    // ── 5. Tax engine ──────────────────────────────────────────────────
    const { taxedLines, taxSummary, grandTotal, interState } = applyTax(
      pricedLines,
      business.stateCode ?? null,
      partyResolution,
      taxPricingMode as 'EXCLUSIVE' | 'INCLUSIVE'
    )

    // ── 6. Guards ──────────────────────────────────────────────────────
    const drift = Math.abs(grandTotal - input.clientGrandTotal)
    if (drift > TOTAL_DRIFT_TOLERANCE_PAISE) {
      throw totalMismatchError(grandTotal, input.clientGrandTotal, drift)
    }
    const paymentSum = input.payments.reduce((s, p) => s + p.amountPaise, 0)
    if (paymentSum !== grandTotal) throw paymentSumMismatchError(paymentSum, grandTotal)

    const saleDate = input.saleDate ? new Date(input.saleDate) : new Date()

    // ── 7. Allocate receipt number ─────────────────────────────────────
    const { receiptNumber, receiptSeq, financialYear } = await allocateNumber(
      tx,
      businessId,
      posSetting
    )

    // ── 8. Claim inventory ─────────────────────────────────────────────
    const inventoryResult = await claimInventory(
      tx,
      businessId,
      userId,
      taxedLines,
      `pending:${receiptNumber}`,
      receiptNumber
    )

    // ── 9. Create Document row ─────────────────────────────────────────
    const document = await tx.document.create({
      data: {
        businessId,
        type: POS_DOCUMENT_TYPE,
        status: 'SAVED',
        partyId,
        documentDate: saleDate,
        documentNumber: receiptNumber,
        financialYear: financialYear.replace('-', ''),
        subtotal,
        totalDiscount,
        grandTotal,
        totalTaxableValue: taxSummary.totalTaxableValue,
        totalCgst: taxSummary.totalCgst,
        totalSgst: taxSummary.totalSgst,
        totalIgst: taxSummary.totalIgst,
        totalCess: taxSummary.totalCess,
        placeOfSupply: partyResolution.placeOfSupply,
        supplyType,
        taxPricingMode,
        isReverseCharge: false,
        createdBy: userId,
        totalAdditionalCharges: 0,
        roundOff: 0,
      },
      select: { id: true },
    })

    // ── 10. Persist PosSale + PosSaleItem ──────────────────────────────
    const persistParams = {
      businessId,
      userId,
      documentId: document.id,
      receiptNumber,
      receiptSeq,
      financialYear,
      partyResolution,
      input,
      taxedLines,
      taxSummary,
      subtotal,
      totalDiscount,
      grandTotal,
      taxPricingMode,
      saleDate,
      inventoryResult,
    }

    const { posSaleId, batchNumberMap } = await persistPosSale(tx, persistParams)

    // ── 11. Cash entry (feature-flagged) ───────────────────────────────
    await createCashEntry(
      tx, businessId, userId, posSaleId, receiptNumber, input.payments, input.idempotencyKey
    )

    // ── 12. PosSaleEvent CREATED ───────────────────────────────────────
    await tx.posSaleEvent.create({
      data: {
        posSaleId,
        type: POS_EVENT_CREATED,
        actorId: userId,
        payload: { receiptNumber, grandTotal, interState },
      },
    })

    // ── 13. Build DTO and store idempotency ────────────────────────────
    const dto: PosSaleDTO = buildPosSaleDTO(posSaleId, document.id, persistParams, batchNumberMap)
    await storeIdempotency(tx, businessId, input.idempotencyKey, dto, userId)

    logger.info('POS sale created', { businessId, posSaleId, receiptNumber, grandTotal })
    return dto
  })
}
