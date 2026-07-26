/**
 * Allocation guard — the single validator every path that writes a
 * PaymentAllocation must clear.
 *
 * An allocation moves money onto an invoice: `paidAmount` up, `balanceDue`
 * down. Three things therefore have to be true before one is written, and they
 * were previously checked in one place, partially, and not at all in the other:
 *
 *   1. the allocations must fit inside the payment,
 *   2. every invoice must belong to THIS business (an id off the wire that is
 *      not scoped is a write into another tenant's ledger), and
 *   3. no invoice may be paid past what is due on it — over-allocating drives
 *      `balanceDue` negative, which then reads as "the shop owes the customer"
 *      on the statement and subtracts from every receivables total.
 */

import { prisma } from '../../lib/prisma.js'
import { notFoundError, validationError } from '../../lib/errors.js'

export interface AllocationInput {
  invoiceId: string
  amount: number
}

/** Invoice statuses an allocation may be written against. */
const PAYABLE_STATUSES = ['SAVED', 'SHARED'] as const

/** Sums repeated lines for the same invoice — two lines still share one balance. */
function totalPerInvoice(allocations: AllocationInput[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const a of allocations) {
    totals.set(a.invoiceId, (totals.get(a.invoiceId) ?? 0) + a.amount)
  }
  return totals
}

export async function assertAllocationsPayable(
  businessId: string,
  allocations: AllocationInput[],
  paymentAmount: number,
  /**
   * What this same payment currently has allocated, per invoice. On an update
   * those rows are reversed before the new ones are written, so their amounts
   * are capacity the invoice is about to get back — without this, re-saving an
   * unchanged allocation would fail against the balance it created itself.
   */
  alreadyAllocated: Map<string, number> = new Map(),
): Promise<void> {
  const allocTotal = allocations.reduce((sum, a) => sum + a.amount, 0)
  if (allocTotal > paymentAmount) {
    throw validationError('Total allocations exceed payment amount')
  }
  if (allocations.length === 0) return

  const perInvoice = totalPerInvoice(allocations)
  const invoices = await prisma.document.findMany({
    where: {
      id: { in: [...perInvoice.keys()] },
      businessId,
      isDeleted: false,
      status: { in: [...PAYABLE_STATUSES] },
    },
    select: { id: true, documentNumber: true, balanceDue: true },
  })
  const byId = new Map(invoices.map(i => [i.id, i]))

  for (const [invoiceId, amount] of perInvoice) {
    const invoice = byId.get(invoiceId)
    if (!invoice) throw notFoundError(`Invoice ${invoiceId}`)

    const capacity = invoice.balanceDue + (alreadyAllocated.get(invoiceId) ?? 0)
    if (amount > capacity) {
      throw validationError(
        `Allocation exceeds the amount due on invoice ${invoice.documentNumber ?? invoiceId}`,
      )
    }
  }
}
