/** Currency Settings — Hook
 *
 * Fetches supported currencies and paginated exchange rate history.
 * Exposes setRate() action with optimistic feedback via toast.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { CURRENCY_PAGE_SIZE } from './currency.constants'
import { getSupportedCurrencies, setExchangeRate, listExchangeRates } from './currency.service'
import { todayIso } from './currency.utils'
import type { SupportedCurrency, ExchangeRateEntry, SetExchangeRatePayload } from './currency.types'

type Status = 'loading' | 'error' | 'success'

interface UseCurrencySettingsReturn {
  currencies: SupportedCurrency[]
  rates: ExchangeRateEntry[]
  status: Status
  page: number
  hasMore: boolean
  setPage: (p: number) => void
  setRate: (payload: SetExchangeRatePayload) => Promise<void>
  refresh: () => void
}

export function useCurrencySettings(): UseCurrencySettingsReturn {
  const toast = useToast()

  const [currencies, setCurrencies] = useState<SupportedCurrency[]>([])
  const [rates, setRates] = useState<ExchangeRateEntry[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Track in-flight setRate calls to prevent duplicate submissions
  const settingRateRef = useRef(false)

  // Fetch supported currencies + current page of rates in parallel
  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    Promise.all([
      getSupportedCurrencies(controller.signal),
      listExchangeRates({ page, limit: CURRENCY_PAGE_SIZE }, controller.signal),
    ])
      .then(([fetchedCurrencies, fetchedRates]) => {
        setCurrencies(fetchedCurrencies)
        setRates(fetchedRates)
        setHasMore(fetchedRates.length === CURRENCY_PAGE_SIZE)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load currency data'
        toast.error(message)
      })

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, refreshKey])

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const setRate = useCallback(async (payload: SetExchangeRatePayload): Promise<void> => {
    if (settingRateRef.current) return
    settingRateRef.current = true

    // Default effectiveDate to today if not provided
    const finalPayload: SetExchangeRatePayload = {
      ...payload,
      effectiveDate: payload.effectiveDate || todayIso(),
    }

    try {
      const newEntry = await setExchangeRate(finalPayload)
      // Prepend the new entry so it appears at the top
      setRates((prev) => [newEntry, ...prev])
      toast.success(`Rate set: 1 ${finalPayload.fromCurrency} = Rs ${(finalPayload.rate / 10000).toFixed(2)}`)
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to set exchange rate'
      toast.error(message)
      throw err
    } finally {
      settingRateRef.current = false
    }
  }, [toast])

  return { currencies, rates, status, page, hasMore, setPage, setRate, refresh }
}
