/** Invoice Calculations — Pure calculation hook
 *
 * Wraps the invoice.utils.ts calculation engine for use in form components.
 * All values are in PAISE (integer). Recalculates via useMemo whenever
 * lineItems or charges change. Zero-dependency on form state structure.
 */

import { useMemo } from 'react'
import {
  calculateInvoiceTotals,
  calculateLineTotal,
  calculateLineProfit,
} from './invoice.utils'
import type { InvoiceTotals, LineItemCalc, ChargeCalc } from './invoice.utils'
import type { RoundOffSetting } from './invoice.types'

// ─── Per-line calculation result ──────────────────────────────────────────────

export interface LineCalculation {
  /** Index matching the lineItems array position */
  index: number
  /** (qty × rate) - discountAmount, in PAISE */
  lineTotal: number
  /** Calculated discount amount, in PAISE */
  discountAmount: number
  /** lineTotal - (qty × purchasePrice), in PAISE */
  profit: number
  /** Profit as percentage of lineTotal (two decimal places) */
  profitPercent: number
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseInvoiceCalculationsReturn extends InvoiceTotals {
  /** Per-line calculated values matching lineItems array indices */
  lineCalculations: LineCalculation[]
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvoiceCalculations(
  lineItems: LineItemCalc[],
  charges: ChargeCalc[],
  roundOffSetting: RoundOffSetting = 'NONE',
): UseInvoiceCalculationsReturn {

  const totals = useMemo(
    () => calculateInvoiceTotals(lineItems, charges, roundOffSetting),
    [lineItems, charges, roundOffSetting],
  )

  const lineCalculations = useMemo<LineCalculation[]>(
    () =>
      lineItems.map((item, index) => {
        const { lineTotal, discountAmount } = calculateLineTotal(
          item.quantity,
          item.ratePaise,
          item.discountType,
          item.discountValue,
        )
        const { profit, profitPercent } = calculateLineProfit(
          item.ratePaise,
          item.purchasePricePaise,
          item.quantity,
          discountAmount,
        )
        return { index, lineTotal, discountAmount, profit, profitPercent }
      }),
    [lineItems],
  )

  return {
    ...totals,
    lineCalculations,
  }
}
