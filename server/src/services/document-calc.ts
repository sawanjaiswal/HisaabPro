/**
 * Document Calculation — server-side totals calculation
 * All amounts in PAISE (integer). Must match frontend utils exactly.
 */

interface LineItemCalc {
  quantity: number
  rate: number // paise
  discountType: string
  discountValue: number
  purchasePrice: number // paise
}

interface ChargeCalc {
  type: string
  value: number // paise for FIXED, percentage * 100 for PERCENTAGE
}

export function calculateLineDiscount(
  quantity: number,
  ratePaise: number,
  discountType: string,
  discountValue: number
): { discountAmount: number; lineTotal: number } {
  const gross = Math.round(quantity * ratePaise)
  let discountAmount = 0

  if (discountType === 'PERCENTAGE' && discountValue > 0) {
    discountAmount = Math.round(gross * discountValue / 10000) // discountValue is basis points (percent * 100)
  } else if (discountType === 'AMOUNT' && discountValue > 0) {
    discountAmount = discountValue
  }

  const lineTotal = Math.max(0, gross - discountAmount)
  return { discountAmount, lineTotal }
}

export function calculateChargeAmount(
  subtotalPaise: number,
  chargeType: string,
  chargeValue: number
): number {
  if (chargeType === 'PERCENTAGE' && chargeValue > 0) {
    return Math.round(subtotalPaise * chargeValue / 10000) // value is basis points
  }
  return chargeValue // FIXED — already in paise
}

export function calculateRoundOff(amountPaise: number, roundOffSetting: string): number {
  if (roundOffSetting === 'NONE') return 0

  let roundTo = 100 // 1 rupee = 100 paise
  if (roundOffSetting === 'NEAREST_050') roundTo = 50
  if (roundOffSetting === 'NEAREST_010') roundTo = 10

  const rounded = Math.round(amountPaise / roundTo) * roundTo
  return rounded - amountPaise
}

export function calculateDocumentTotals(
  lineItems: LineItemCalc[],
  charges: ChargeCalc[],
  roundOffSetting: string
): {
  subtotal: number
  totalDiscount: number
  totalAdditionalCharges: number
  roundOff: number
  grandTotal: number
  totalCost: number
  totalProfit: number
  profitPercent: number
  lineResults: Array<{
    discountAmount: number
    lineTotal: number
    profit: number
    profitPercent: number
  }>
} {
  let subtotal = 0
  let totalDiscount = 0
  let totalCost = 0
  const lineResults: Array<{
    discountAmount: number
    lineTotal: number
    profit: number
    profitPercent: number
  }> = []

  for (const item of lineItems) {
    const { discountAmount, lineTotal } = calculateLineDiscount(
      item.quantity, item.rate, item.discountType, item.discountValue
    )
    subtotal += lineTotal
    totalDiscount += discountAmount

    const cost = Math.round(item.quantity * item.purchasePrice)
    totalCost += cost

    const profit = lineTotal - cost
    const profitPercent = lineTotal > 0 ? Math.round((profit / lineTotal) * 10000) / 100 : 0

    lineResults.push({ discountAmount, lineTotal, profit, profitPercent })
  }

  let totalAdditionalCharges = 0
  for (const charge of charges) {
    totalAdditionalCharges += calculateChargeAmount(subtotal, charge.type, charge.value)
  }

  const preRound = subtotal + totalAdditionalCharges
  const roundOff = calculateRoundOff(preRound, roundOffSetting)
  const grandTotal = preRound + roundOff
  const totalProfit = grandTotal - totalCost
  const profitPercent = grandTotal > 0 ? Math.round((totalProfit / grandTotal) * 10000) / 100 : 0

  return {
    subtotal,
    totalDiscount,
    totalAdditionalCharges,
    roundOff,
    grandTotal,
    totalCost,
    totalProfit,
    profitPercent,
    lineResults,
  }
}
