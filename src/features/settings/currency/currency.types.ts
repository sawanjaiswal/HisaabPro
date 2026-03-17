/** Currency — Type definitions
 *
 * Types for multi-currency support: supported currencies, exchange rates,
 * and API payloads. All rate values are integers * 10000 for precision.
 */

// ─── Core types ───────────────────────────────────────────────────────────────

/** A currency supported by the system */
export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
}

/** Exchange rate value with metadata */
export interface ExchangeRate {
  rate: number        // integer * 10000 (e.g. 845000 = Rs 84.50)
  effectiveDate: string // ISO date string YYYY-MM-DD
  source: string      // 'manual' | 'api'
}

/** Full exchange rate record as stored in DB */
export interface ExchangeRateEntry {
  id: string
  businessId: string
  fromCurrency: string
  toCurrency: string
  rate: number         // integer * 10000
  effectiveDate: string
  source: string
  createdAt: string
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface SetExchangeRatePayload {
  fromCurrency: string
  rate: number       // integer * 10000
  effectiveDate: string
}

export interface ConvertAmountPayload {
  fromCurrency: string
  toCurrency: string
  amount: number     // integer (paise or smallest unit)
}

export interface ConvertAmountResult {
  converted: number
  rate: number
}

export interface ExchangeRateListParams {
  fromCurrency?: string
  page?: number
  limit?: number
}
