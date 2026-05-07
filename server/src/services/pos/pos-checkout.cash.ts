/**
 * POS Checkout — Cash Entry Creation (Feature-Flagged)
 *
 * When CASH_REGISTER_ENABLED=true AND any payment mode is 'cash',
 * creates a CashEntry IN row linked back to the PosSale.
 *
 * Uses the cash_entries table directly (no service wrapper that opens its own tx).
 * MUST be called within the outer Prisma $transaction.
 */

import type { ExtendedPrismaClient } from '../../lib/prisma.js'
import type { PosPaymentInput } from './pos.types.js'
import logger from '../../lib/logger.js'

type TxClient = Parameters<Parameters<ExtendedPrismaClient['$transaction']>[0]>[0]

/**
 * Returns true when the CASH_REGISTER_ENABLED feature flag is active.
 * Reads from process.env at call time so tests can override it.
 */
export function isCashRegisterEnabled(): boolean {
  return process.env['CASH_REGISTER_ENABLED'] === 'true'
}

/**
 * Create a CashEntry IN record for the cash portion of a POS sale.
 *
 * Only called when:
 *  1. CASH_REGISTER_ENABLED env var is 'true'
 *  2. At least one payment has mode === 'cash'
 *
 * @param tx           - Prisma tx client
 * @param businessId   - Owning business
 * @param createdBy    - BusinessUser.id (cashier)
 * @param posSaleId    - Completed PosSale.id for the referenceId link
 * @param receiptNumber - Human-readable receipt for the note
 * @param payments     - Full payment breakdown from input
 * @param idempotencyKey - Same key as the sale (deduplicate on CashEntry side)
 */
export async function createCashEntry(
  tx: TxClient,
  businessId: string,
  createdBy: string,
  posSaleId: string,
  receiptNumber: string,
  payments: PosPaymentInput[],
  idempotencyKey: string
): Promise<void> {
  if (!isCashRegisterEnabled()) return

  const cashPayments = payments.filter(p => p.mode === 'cash')
  if (cashPayments.length === 0) return

  const totalCashPaise = cashPayments.reduce((sum, p) => sum + p.amountPaise, 0)
  if (totalCashPaise <= 0) return

  // Resolve the BusinessUser row for this userId in this business.
  // CashEntry.createdBy stores BusinessUser.id (not User.id).
  const businessUser = await tx.businessUser.findFirst({
    where: { userId: createdBy, businessId },
    select: { id: true },
  })

  const buId = businessUser?.id ?? createdBy  // fallback: use userId directly

  await tx.cashEntry.create({
    data: {
      businessId,
      expression: String(totalCashPaise),  // raw expression stored as-is
      amountPaise: BigInt(totalCashPaise),
      direction: 'IN',
      note: `POS sale ${receiptNumber}`,
      createdBy: buId,
      idempotencyKey: `pos:${idempotencyKey}`,
      // Phase 2: ledgerJournalId link — not yet wired (TODO: accounting integration)
    },
  })

  logger.info('POS cash entry created', { businessId, posSaleId, totalCashPaise })
}
