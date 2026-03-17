/**
 * Currency Service — Multi-Currency Phase 2E
 *
 * All rates stored as integers: rate * 10000
 * e.g., 1 USD = 84.5678 INR → stored as 845678
 *
 * Converting amount (in foreign minor units) → INR paise:
 *   inrPaise = foreignAmount * rate / 10000
 */

import { prisma } from '../lib/prisma.js'
import type { SetExchangeRateInput, ListExchangeRatesInput, ConvertAmountInput } from '../schemas/currency.schemas.js'

// ---------------------------------------------------------------------------
// Static currency list — extend as needed
// ---------------------------------------------------------------------------

export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
}

export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
]

// ---------------------------------------------------------------------------
// Core service functions
// ---------------------------------------------------------------------------

/** Upsert an exchange rate for a currency pair + effective date. */
export async function setExchangeRate(
  businessId: string,
  data: SetExchangeRateInput,
) {
  const effectiveDate = new Date(data.effectiveDate)

  return prisma.exchangeRate.upsert({
    where: {
      businessId_fromCurrency_toCurrency_effectiveDate: {
        businessId,
        fromCurrency: data.fromCurrency,
        toCurrency: 'INR',
        effectiveDate,
      },
    },
    update: {
      rate: data.rate,
      source: data.source,
    },
    create: {
      businessId,
      fromCurrency: data.fromCurrency,
      toCurrency: 'INR',
      rate: data.rate,
      effectiveDate,
      source: data.source,
    },
  })
}

/**
 * Get the exchange rate for a currency pair closest to (but not after) the
 * given date. Falls back to the most recent rate if no match is found on or
 * before the requested date.
 */
export async function getExchangeRate(
  businessId: string,
  fromCurrency: string,
  toCurrency: string,
  date?: string,
): Promise<{ rate: number; effectiveDate: Date; source: string } | null> {
  const targetDate = date ? new Date(date) : new Date()

  // Find closest rate on or before targetDate
  const rate = await prisma.exchangeRate.findFirst({
    where: {
      businessId,
      fromCurrency,
      toCurrency,
      effectiveDate: { lte: targetDate },
    },
    orderBy: { effectiveDate: 'desc' },
    select: { rate: true, effectiveDate: true, source: true },
  })

  if (rate) return rate

  // Fallback: most recent rate regardless of date
  return prisma.exchangeRate.findFirst({
    where: { businessId, fromCurrency, toCurrency },
    orderBy: { effectiveDate: 'desc' },
    select: { rate: true, effectiveDate: true, source: true },
  })
}

/** List exchange rates for a business, optionally filtered by fromCurrency. */
export async function listExchangeRates(
  businessId: string,
  filters: ListExchangeRatesInput,
) {
  const { fromCurrency, page, limit } = filters
  const skip = (page - 1) * limit

  const where = {
    businessId,
    ...(fromCurrency ? { fromCurrency } : {}),
  }

  const [rates, total] = await Promise.all([
    prisma.exchangeRate.findMany({
      where,
      orderBy: [{ fromCurrency: 'asc' }, { effectiveDate: 'desc' }],
      skip,
      take: limit,
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        rate: true,
        effectiveDate: true,
        source: true,
        createdAt: true,
      },
    }),
    prisma.exchangeRate.count({ where }),
  ])

  return { rates, total, page, limit }
}

/**
 * Convert a foreign currency amount (minor units) to INR paise.
 * Uses integer arithmetic throughout — no floating point.
 *
 * @param amount - Amount in foreign currency minor units (e.g., cents for USD)
 * @param rate   - Exchange rate stored as rate * 10000
 * @returns Amount in INR paise (integer)
 */
export function convertToINR(amount: number, rate: number): number {
  return Math.round((amount * rate) / 10000)
}

/**
 * Convert INR paise to foreign currency minor units.
 *
 * @param amountPaise - Amount in INR paise
 * @param rate        - Exchange rate stored as rate * 10000
 * @returns Amount in foreign currency minor units (integer)
 */
export function convertFromINR(amountPaise: number, rate: number): number {
  if (rate === 0) return 0
  return Math.round((amountPaise * 10000) / rate)
}

/** Convert an amount between two arbitrary currencies via INR as the base. */
export async function convertAmount(
  businessId: string,
  input: ConvertAmountInput,
): Promise<{ converted: number; rate: number | null }> {
  const { fromCurrency, toCurrency, amount, date } = input

  // INR → INR: no conversion needed
  if (fromCurrency === 'INR' && toCurrency === 'INR') {
    return { converted: amount, rate: 10000 }
  }

  // Foreign → INR
  if (toCurrency === 'INR') {
    const rateRecord = await getExchangeRate(businessId, fromCurrency, 'INR', date)
    if (!rateRecord) return { converted: amount, rate: null }
    return { converted: convertToINR(amount, rateRecord.rate), rate: rateRecord.rate }
  }

  // INR → Foreign
  if (fromCurrency === 'INR') {
    const rateRecord = await getExchangeRate(businessId, toCurrency, 'INR', date)
    if (!rateRecord) return { converted: amount, rate: null }
    return { converted: convertFromINR(amount, rateRecord.rate), rate: rateRecord.rate }
  }

  // Foreign → Foreign: convert via INR
  const [fromRate, toRate] = await Promise.all([
    getExchangeRate(businessId, fromCurrency, 'INR', date),
    getExchangeRate(businessId, toCurrency, 'INR', date),
  ])
  if (!fromRate || !toRate) return { converted: amount, rate: null }

  const inrAmount = convertToINR(amount, fromRate.rate)
  return { converted: convertFromINR(inrAmount, toRate.rate), rate: null }
}

/** Return the static list of supported currencies (INR always included). */
export function getSupportedCurrencies(): SupportedCurrency[] {
  return [{ code: 'INR', name: 'Indian Rupee', symbol: '₹' }, ...SUPPORTED_CURRENCIES]
}
