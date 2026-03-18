import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useUnitManager } from '../useUnitManager'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({ useToast: () => mockToast }))

const mockGetUnits = vi.fn()
const mockCreateUnit = vi.fn()
const mockUpdateUnit = vi.fn()
const mockDeleteUnit = vi.fn()
const mockGetConversions = vi.fn()

vi.mock('../../products/unit.service', () => ({
  getUnits: (...args: unknown[]) => mockGetUnits(...args),
  createUnit: (...args: unknown[]) => mockCreateUnit(...args),
  updateUnit: (...args: unknown[]) => mockUpdateUnit(...args),
  deleteUnit: (...args: unknown[]) => mockDeleteUnit(...args),
  getUnitConversions: (...args: unknown[]) => mockGetConversions(...args),
}))

beforeEach(() => { vi.clearAllMocks() })

const MOCK_UNITS = [{ id: '1', name: 'kg', symbol: 'kg' }]

describe('useUnitManager', () => {
  it('starts in loading state', () => {
    mockGetUnits.mockReturnValue(new Promise(() => {}))
    mockGetConversions.mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useUnitManager())
    expect(result.current.status).toBe('loading')
  })

  it('fetches units on mount', async () => {
    mockGetUnits.mockResolvedValue(MOCK_UNITS)
    mockGetConversions.mockResolvedValue([])
    const { result } = renderHook(() => useUnitManager())

    await waitFor(() => expect(result.current.status).toBe('success'))
    expect(result.current.units).toEqual(MOCK_UNITS)
  })

  it('creates a unit and shows toast', async () => {
    mockGetUnits.mockResolvedValue([])
    mockGetConversions.mockResolvedValue([])
    const newUnit = { id: '2', name: 'litre', symbol: 'L' }
    mockCreateUnit.mockResolvedValue(newUnit)

    const { result } = renderHook(() => useUnitManager())
    await waitFor(() => expect(result.current.status).toBe('success'))

    const created = await act(() => result.current.handleCreate({ name: 'litre', symbol: 'L' }))
    expect(created).toEqual(newUnit)
    expect(mockToast.success).toHaveBeenCalledWith('Unit created')
  })

  it('shows error toast on create failure', async () => {
    mockGetUnits.mockResolvedValue([])
    mockGetConversions.mockResolvedValue([])
    mockCreateUnit.mockRejectedValue(new Error('Duplicate'))

    const { result } = renderHook(() => useUnitManager())
    await waitFor(() => expect(result.current.status).toBe('success'))

    const created = await act(() => result.current.handleCreate({ name: 'kg', symbol: 'kg' }))
    expect(created).toBeNull()
    expect(mockToast.error).toHaveBeenCalledWith('Duplicate')
  })

  it('search updates query and re-fetches', async () => {
    mockGetUnits.mockResolvedValue(MOCK_UNITS)
    mockGetConversions.mockResolvedValue([])
    const { result } = renderHook(() => useUnitManager())

    await waitFor(() => expect(result.current.status).toBe('success'))
    act(() => { result.current.handleSearch('litre') })

    expect(result.current.search).toBe('litre')
    expect(mockGetUnits).toHaveBeenCalledWith('litre', expect.any(AbortSignal))
  })

  it('deletes a unit and removes from list', async () => {
    mockGetUnits.mockResolvedValue(MOCK_UNITS)
    mockGetConversions.mockResolvedValue([])
    mockDeleteUnit.mockResolvedValue(undefined)

    const { result } = renderHook(() => useUnitManager())
    await waitFor(() => expect(result.current.units).toHaveLength(1))

    await act(() => result.current.handleDelete('1'))
    expect(result.current.units).toHaveLength(0)
    expect(mockToast.success).toHaveBeenCalledWith('Unit deleted')
  })
})
