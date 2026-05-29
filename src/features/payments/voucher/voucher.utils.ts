/** Payment voucher — pure helpers (#90/#91)
 *
 * Intl is unavailable inside the @react-pdf/renderer worker, so paise/date
 * formatting is done manually here (mirrors invoices/pdf/InvoicePdfDocument).
 */

import type { PaymentDetail } from '../payment-models.types'
import type { VoucherData, VoucherKind } from './voucher.types'

/** "Rs 1,00,000.00" — Indian grouping (2,2,3), sign-aware. */
export function fmtPaise(paise: number): string {
  const abs = Math.abs(paise)
  const [intPart, decPart] = (abs / 100).toFixed(2).split('.')
  const n = intPart ?? '0'
  const sign = paise < 0 ? '-' : ''
  if (n.length <= 3) return `${sign}Rs ${n}.${decPart}`
  const suffix = n.slice(n.length - 3)
  const prefix = n.slice(0, n.length - 3)
  let g = ''
  let count = 0
  for (let i = prefix.length - 1; i >= 0; i--) {
    g = prefix[i] + g
    count++
    if (count % 2 === 0 && i !== 0) g = ',' + g
  }
  return `${sign}Rs ${g},${suffix}.${decPart}`
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d ?? '--'}/${m ?? '--'}/${y ?? '----'}`
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const t = Math.floor(n / 10)
  const o = n % 10
  return `${TENS[t]}${o ? ' ' + ONES[o] : ''}`
}

/** Whole rupees → Indian-system words (crore/lakh/thousand/hundred). */
function rupeesToWords(rupees: number): string {
  if (rupees === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(rupees / 10000000)
  const lakh = Math.floor((rupees % 10000000) / 100000)
  const thousand = Math.floor((rupees % 100000) / 1000)
  const hundred = Math.floor((rupees % 1000) / 100)
  const rest = rupees % 100
  if (crore) parts.push(`${twoDigits(crore)} Crore`)
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`)
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`)
  if (hundred) parts.push(`${ONES[hundred]} Hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

/** Paise → "Rupees One Thousand and Fifty Paise Only" (English; voucher legal line). */
export function amountToWords(paise: number): string {
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / 100)
  const paiseRem = abs % 100
  const rupeeWords = `Rupees ${rupeesToWords(rupees)}`
  const paiseWords = paiseRem ? ` and ${twoDigits(paiseRem)} Paise` : ''
  return `${rupeeWords}${paiseWords} Only`
}

/** PaymentType → voucher template. IN flows acknowledge receipt; OUT flows acknowledge payment. */
export function voucherKindFor(type: PaymentDetail['type']): VoucherKind {
  return type === 'PAYMENT_IN' || type === 'PAYROLL_IN' ? 'RECEIPT' : 'PAYMENT'
}

/** Map a loaded PaymentDetail + resolved labels into render-ready voucher data. */
export function buildVoucherData(
  payment: PaymentDetail,
  businessName: string,
  title: string,
  modeLabel: string,
): VoucherData {
  return {
    kind: voucherKindFor(payment.type),
    title,
    businessName,
    partyName: payment.partyName,
    amount: payment.amount,
    amountInWords: amountToWords(payment.amount),
    date: payment.date,
    modeLabel,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
    allocations: payment.allocations.map((a) => ({
      invoiceNumber: a.invoiceNumber,
      amount: a.amount,
    })),
    unallocatedAmount: payment.unallocatedAmount,
  }
}
