/** Currency — API service layer
 *
 * All calls go through the shared `api()` wrapper which handles auth cookies,
 * timeout, 401 refresh, and offline queueing.
 * POST mutations pass an idempotency key via X-Idempotency-Key header.
 */

import { api } from '@/lib/api'
import type {
  SupportedCurrency,
  ExchangeRateEntry,
  SetExchangeRatePayload,
  ConvertAmountPayload,
  ConvertAmountResult,
  ExchangeRateListParams,
} from './currency.types'

// ─── Supported currencies ─────────────────────────────────────────────────────

export async function getSupportedCurrencies(
  signal?: AbortSignal
): Promise<SupportedCurrency[]> {
  return api<SupportedCurrency[]>('/currency/supported', { signal })
}

// ─── Exchange rates ───────────────────────────────────────────────────────────

export async function setExchangeRate(
  payload: SetExchangeRatePayload,
  signal?: AbortSignal
): Promise<ExchangeRateEntry> {
  return api<ExchangeRateEntry>('/currency/exchange-rates', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    signal,
  })
}

export async function listExchangeRates(
  params: ExchangeRateListParams = {},
  signal?: AbortSignal
): Promise<ExchangeRateEntry[]> {
  const { fromCurrency, page = 1, limit = 20 } = params
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (fromCurrency) qs.set('fromCurrency', fromCurrency)
  return api<ExchangeRateEntry[]>(`/currency/exchange-rates?${qs}`, { signal })
}

export async function getLatestRate(
  currencyCode: string,
  date?: string,
  signal?: AbortSignal
): Promise<ExchangeRateEntry> {
  const qs = date ? `?date=${date}` : ''
  return api<ExchangeRateEntry>(`/currency/exchange-rates/${currencyCode}${qs}`, { signal })
}

// ─── Conversion ───────────────────────────────────────────────────────────────

export async function convertAmount(
  payload: ConvertAmountPayload,
  signal?: AbortSignal
): Promise<ConvertAmountResult> {
  return api<ConvertAmountResult>('/currency/convert', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'X-Idempotency-Key': crypto.randomUUID() },
    signal,
  })
}
