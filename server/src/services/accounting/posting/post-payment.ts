/**
 * Post a Payment (PAYMENT_IN / PAYMENT_OUT) to the GL.
 * Call inside the payment mutation's transaction. PAYROLL_* types have no
 * customer-ledger impact and produce an empty map (no-op).
 */
import { mapPayment, type PaymentForPosting } from './posting.maps.js'
import { persistPosting } from './index.js'
import type { Tx } from './posting.types.js'

const POSTABLE = new Set(['PAYMENT_IN', 'PAYMENT_OUT'])

export interface PostPaymentArgs {
  businessId: string
  userId: string
  payment: PaymentForPosting & { id: string; referenceNumber: string | null; date: Date }
}

export async function postPayment(tx: Tx, { businessId, userId, payment }: PostPaymentArgs) {
  if (!POSTABLE.has(payment.type)) return null
  const map = mapPayment(payment)
  return persistPosting(
    tx,
    {
      businessId,
      userId,
      date: payment.date,
      narration: `${payment.type} ${payment.referenceNumber ?? payment.id}`,
      sourceType: 'PAYMENT',
      sourceId: payment.id,
      sourceNumber: payment.referenceNumber,
    },
    map,
  )
}
