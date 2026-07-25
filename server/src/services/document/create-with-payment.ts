/** Document Service — createDocumentWithPayment
 *
 * Gold-standard "sell in one shot": create the document, then — when the caller
 * supplied `payment` and the doc is a SAVED SALE_INVOICE — record the money
 * received against it. The payment goes through the CANONICAL createPayment
 * service (allocations + party outstanding + GL double-entry posting), so this
 * stays consistent with a payment recorded from the Payments screen. We do NOT
 * duplicate the simplified inline logic in quick-sale.ts.
 *
 * Not one atomic transaction (createDocument and createPayment each own their
 * tx — matching the established quick-sale pattern). The allocation is clamped
 * to grandTotal so createPayment's `allocTotal <= amount` invariant always
 * holds; any excess received stays on the payment as party advance.
 */

import { createDocument } from './create.js'
import { createPayment } from '../payment/create.js'
import type { CreateDocumentInput } from '../../schemas/document.schemas.js'

export async function createDocumentWithPayment(
  businessId: string,
  userId: string,
  data: CreateDocumentInput,
) {
  const doc = await createDocument(businessId, userId, data)

  const payment = data.payment
  const eligible = data.status === 'SAVED' && data.type === 'SALE_INVOICE'
  if (!payment || payment.amountReceived <= 0 || !eligible) return doc

  const docData = doc as { id: string; grandTotal: number | bigint }
  const grandTotal = Number(docData.grandTotal)
  const allocationAmt = Math.min(payment.amountReceived, grandTotal)

  const paymentResult = await createPayment(businessId, userId, {
    type: 'PAYMENT_IN',
    partyId: data.partyId,
    amount: payment.amountReceived,
    date: data.documentDate,
    mode: payment.mode,
    referenceNumber: payment.referenceNumber,
    allocations: allocationAmt > 0
      ? [{ invoiceId: docData.id, amount: allocationAmt }]
      : [],
  })

  const changeAmount = Math.max(0, payment.amountReceived - grandTotal)

  return {
    ...doc,
    payment: {
      id: paymentResult.id,
      amount: payment.amountReceived,
      mode: payment.mode,
      allocatedAmount: allocationAmt,
      changeAmount,
    },
  }
}
