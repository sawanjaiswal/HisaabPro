/** Paise → English words on the Indian numbering system (crore / lakh).
 *
 * The legal "Amount in words" line printed on vouchers (#90, #91) and on the
 * invoice preview (#3). Lived in payments/voucher until invoices needed it —
 * one module, both callers.
 */

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

/** Paise → "Rupees One Thousand and Fifty Paise Only" (English; legal line). */
export function amountToWords(paise: number): string {
  const abs = Math.abs(paise)
  const rupees = Math.floor(abs / 100)
  const paiseRem = abs % 100
  const rupeeWords = `Rupees ${rupeesToWords(rupees)}`
  const paiseWords = paiseRem ? ` and ${twoDigits(paiseRem)} Paise` : ''
  return `${rupeeWords}${paiseWords} Only`
}
