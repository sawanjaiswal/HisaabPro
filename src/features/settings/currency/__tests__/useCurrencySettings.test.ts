import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCurrencySettings } from '../useCurrencySettings'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockGetCurrencies = vi.fn()
const mockSetExchangeRate = vi.fn()
const mockListRates = vi.fn()
vi.mock('../currency.service', () => ({
  getSupportedCurrencies: (...args: unknown[]) => mockGetCurrencies(...args),
  setExchangeRate: (...args: unknown[]) => mockSetExchangeRate(...args),
  listExchangeRates: (...args: unknown[]) => mockListRates(...args),
}))

vi.mock('../currency.constants', () => ({ CURRENCY_PAGE_SIZE: 20 }))
vi.mock('../currency.utils', () => ({ todayIso: () => '2026-03-19' }))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_CURRENCIES = [{ code: 'USD', name: 'US Dollar' }]
const MOCK_RATES = [{ id: 'r1', fromCurrency: 'USD', rate: 840000 }]

describe('useCurrencySettings', () => {
  it('starts in loading state', () => {
    mockGetCurrencies.mockReturnValue(new Promise(() => {}))
    mockListRates.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useCurrencySettings())
    expect(result.current.status).toBe('loading')
  })

  it('fetches currencies and rates on mount', async () => {
    mockGetCurrencies.mockResolvedValue(MOCK_CURRENCIES)
    mockListRates.mockResolvedValue(MOCK_RATES)
    const { result } = renderHook(() => useCurrencySettings())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.currencies).toEqual(MOCK_CURRENCIES)
    expect(result.current.rates).toEqual(MOCK_RATES)
  })

  it('shows toast on error', async () => {
    mockGetCurrencies.mockRejectedValue(new Error('fail'))
    mockListRates.mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useCurrencySettings())

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(mockToast.error).toHaveBeenCalledWith('Failed to load currency data')
  })

  it('setRate calls service and prepends entry', async () => {
    mockGetCurrencies.mockResolvedValue(MOCK_CURRENCIES)
    mockListRates.mockResolvedValue([])
    const newEntry = { id: 'r2', fromCurrency: 'USD', rate: 850000 }
    mockSetExchangeRate.mockResolvedValue(newEntry)

    const { result } = renderHook(() => useCurrencySettings())
    await waitFor(() => expect(result.current.status).toBe('success'))

    await act(() => result.current.setRate({ fromCurrency: 'USD', rate: 850000, effectiveDate: '2026-03-19' }))
    expect(result.current.rates[0]).toEqual(newEntry)
    expect(mockToast.success).toHaveBeenCalled()
  })

  it('refresh triggers re-fetch', async () => {
    mockGetCurrencies.mockResolvedValue(MOCK_CURRENCIES)
    mockListRates.mockResolvedValue(MOCK_RATES)
    const { result } = renderHook(() => useCurrencySettings())

    await waitFor(() => expect(result.current.status).toBe('success'))
    mockListRates.mockResolvedValue([])

    act(() => { result.current.refresh() })
    await waitFor(() => expect(result.current.rates).toEqual([]))
  })
})
