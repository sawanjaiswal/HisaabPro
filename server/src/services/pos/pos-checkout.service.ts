/**
 * POS Checkout — orchestrator. All mutations live in a single Prisma
 * $transaction: idempotency check → clientId guard → reprice + MOQ → party →
 * tax → drift/payment guards → receipt → inventory → Document → PosSale +
 * items → loyalty redeem + accrue → cash → event → idempotency store.
 * Post-commit analytics fire via queueMicrotask (architecture §3.8).
 */

import { prisma } from '../../lib/prisma.js'
import logger from '../../lib/logger.js'
import { notFoundError } from '../../lib/errors.js'
import type { PosServiceCtx, PosSaleDTO } from './pos.types.js'
import { assertMoq } from '../document/moq.guard.js'
import { validateCreatePosSale, validateLoyaltyOnCheckout } from './pos.validators.js'
import { checkIdempotency, storeIdempotency } from './pos-checkout.idempotency.js'
import { priceLines, sumPricedLines } from './pos-checkout.pricing.js'
import { applyTax, deriveSupplyType } from './pos-checkout.tax.js'
import { getOrCreateWalkInParty } from './pos-checkout.walkin.js'
import { allocateNumber } from './pos-checkout.receipt.js'
import { claimInventory } from './pos-checkout.inventory.js'
import { createCashEntry } from './pos-checkout.cash.js'
import { persistPosSale, buildPosSaleDTO } from './pos-checkout.persist.js'
import {
  applyCheckoutLoyalty,
  emitCheckoutLoyaltyAnalytics,
} from './pos-checkout.loyalty.js'
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

  const input = validateCreatePosSale(rawInput)

  // Loyalty-aware async validation (NEW_S2 + S1) runs BEFORE the tx opens so
  // cross-tenant partyId throws 400 without consuming the idempotency key.
  await validateLoyaltyOnCheckout(businessId, input)

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { stateCode: true, taxPricingMode: true },
  })
  if (!business) throw notFoundError('Business')
  const taxPricingMode = input.taxPricingMode ?? business.taxPricingMode ?? 'EXCLUSIVE'

  return prisma.$transaction(async (tx) => {
    const idempResult = await checkIdempotency(tx, businessId, input.idempotencyKey)
    if (idempResult.hit) return idempResult.response

    if (input.clientId) {
      const dup = await tx.posSale.findUnique({
        where: { clientId: input.clientId },
        select: { id: true },
      })
      if (dup) throw duplicateClientIdError(input.clientId)
    }

    const posSetting = await tx.posSetting.findUnique({ where: { businessId } })

    // Reprice + MOQ guard (server-authoritative pricing)
    const pricedLines = await priceLines(tx, businessId, input.items)
    const { subtotal, totalDiscount } = sumPricedLines(pricedLines)
    const docSettings = await tx.documentSettings.findUnique({
      where: { businessId }, select: { enforceMoq: true },
    })
    const moqRows = await tx.product.findMany({
      where: { id: { in: input.items.map(i => i.productId) }, businessId },
      select: { id: true, name: true, moq: true },
    })
    assertMoq(
      POS_DOCUMENT_TYPE,
      input.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
      new Map(moqRows.map(p => [p.id, p])),
      docSettings?.enforceMoq ?? true,
    )

    // Resolve party (provided or walk-in sentinel)
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

    // Tax engine + drift/payment guards
    const { taxedLines, taxSummary, grandTotal, interState } = applyTax(
      pricedLines,
      business.stateCode ?? null,
      partyResolution,
      taxPricingMode as 'EXCLUSIVE' | 'INCLUSIVE'
    )
    const drift = Math.abs(grandTotal - input.clientGrandTotal)
    if (drift > TOTAL_DRIFT_TOLERANCE_PAISE) {
      throw totalMismatchError(grandTotal, input.clientGrandTotal, drift)
    }
    const paymentSum = input.payments.reduce((s, p) => s + p.amountPaise, 0)
    if (paymentSum !== grandTotal) throw paymentSumMismatchError(paymentSum, grandTotal)
    const saleDate = input.saleDate ? new Date(input.saleDate) : new Date()

    // Receipt allocation + inventory claim
    const { receiptNumber, receiptSeq, financialYear } = await allocateNumber(
      tx, businessId, posSetting
    )
    const inventoryResult = await claimInventory(
      tx, businessId, userId, taxedLines, `pending:${receiptNumber}`, receiptNumber
    )

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

    // Persist PosSale + items
    const persistParams = {
      businessId, userId, documentId: document.id, receiptNumber, receiptSeq,
      financialYear, partyResolution, input, taxedLines, taxSummary,
      subtotal, totalDiscount, grandTotal, taxPricingMode, saleDate, inventoryResult,
    }
    const { posSaleId, batchNumberMap } = await persistPosSale(tx, persistParams)

    // Loyalty 10.5/10.6 — redemption + accrual on the same tx-client so any
    // throw rolls back both PosSale and LoyaltyLedger rows. Helper isolated
    // in pos-checkout.loyalty.ts to keep this orchestrator ≤ 250 LOC.
    const loyaltyOutcome = await applyCheckoutLoyalty(tx, {
      businessId, posSaleId, partyId: partyResolution.partyId,
      input, subtotal, saleDate,
    })

    await createCashEntry(
      tx, businessId, userId, posSaleId, receiptNumber, input.payments, input.idempotencyKey
    )

    await tx.posSaleEvent.create({
      data: {
        posSaleId, type: POS_EVENT_CREATED, actorId: userId,
        payload: { receiptNumber, grandTotal, interState },
      },
    })

    const dto: PosSaleDTO = buildPosSaleDTO(posSaleId, document.id, persistParams, batchNumberMap)
    await storeIdempotency(tx, businessId, input.idempotencyKey, dto, userId)

    logger.info('POS sale created', { businessId, posSaleId, receiptNumber, grandTotal })

    // Post-commit telemetry — queueMicrotask defers emission until AFTER
    // $transaction resolves (architecture §3.8 side-effect rule).
    queueMicrotask(() =>
      emitCheckoutLoyaltyAnalytics(loyaltyOutcome, {
        businessId, posSaleId, partyId: partyResolution.partyId,
      })
    )

    return dto
  })
}
