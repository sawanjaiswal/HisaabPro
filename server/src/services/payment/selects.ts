/**
 * Payment select constants — shared across all payment sub-modules
 */

export const PAYMENT_LIST_SELECT = {
  id: true,
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  party: { select: { id: true, name: true, phone: true } },
  _count: { select: { allocations: true } },
  discount: { select: { calculatedAmount: true } },
} as const

export const PAYMENT_DETAIL_SELECT = {
  id: true,
  offlineId: true,
  version: true, // #150 optimistic-lock token surfaced to clients
  type: true,
  amount: true,
  date: true,
  mode: true,
  referenceNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  party: {
    select: {
      id: true, name: true, phone: true,
      outstandingBalance: true,
    },
  },
  allocations: {
    select: {
      id: true,
      amount: true,
      invoice: {
        select: { id: true, documentNumber: true, grandTotal: true, balanceDue: true },
      },
    },
  },
  discount: {
    select: {
      id: true, type: true, valuePaise: true, percentBps: true,
      calculatedAmount: true, reason: true,
    },
  },
  creator: { select: { id: true, name: true } },
} as const

/**
 * Raw PaymentDiscount row as selected above → the API `PaymentDiscount` shape.
 * The DB stores `valuePaise` XOR `percentBps` (migration A2 CHECK constraint);
 * the client contract exposes a single `value` (0-100 for PERCENTAGE, paise for
 * FIXED). Deriving it here keeps every payment-detail return site consistent.
 */
export function mapPaymentDiscount(
  discount:
    | { id: string; type: string; valuePaise: number | null; percentBps: number | null; calculatedAmount: number; reason: string | null }
    | null,
) {
  if (!discount) return null
  const value = discount.type === 'PERCENTAGE'
    ? (discount.percentBps ?? 0) / 100
    : (discount.valuePaise ?? 0)
  return {
    id: discount.id,
    type: discount.type,
    value,
    calculatedAmount: discount.calculatedAmount,
    reason: discount.reason,
  }
}
