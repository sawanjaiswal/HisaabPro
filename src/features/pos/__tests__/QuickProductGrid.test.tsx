/**
 * Contract test for the POS quick-add grid.
 *
 * The payload below is the real shape of GET /api/products after api()
 * unwraps the { success, data } envelope — see
 * server/src/services/product/search.ts (`return { products, pagination,
 * summary }`) and server/src/services/product/selects.ts (`currentStock`,
 * not `stock`).
 *
 * Trace: .claude/fix-trace-pos-contract.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QuickProductGrid } from '../components/QuickProductGrid'

const apiMock = vi.fn()
vi.mock('@/lib/api', () => ({ api: (...args: unknown[]) => apiMock(...args) }))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      add: 'Add',
      errorTitle: 'Something went wrong',
      posQuickAdd: 'Quick add',
      posFrequentProducts: 'Frequently sold',
      posLoadingProducts: 'Loading products',
      posScanOrSearchToAdd: 'Scan or search to add',
    },
  }),
}))

/** Exactly what the server returns — no `items`, no `stock`. */
const serverPayload = {
  products: [
    {
      id: 'prod-1',
      name: 'Tata Salt 1kg',
      sku: 'TS-1KG',
      barcode: '8901030865278',
      category: { id: 'cat-1', name: 'Grocery' },
      unit: { id: 'unit-1', name: 'Piece', symbol: 'pc' },
      salePrice: 2800,
      purchasePrice: 2400,
      currentStock: 12,
      minStockLevel: 5,
      status: 'ACTIVE' as const,
      createdAt: '2026-07-01T00:00:00Z',
    },
  ],
  pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
  summary: {
    totalProducts: 1,
    lowStockCount: 0,
    totalStockValue: 28800,
    outOfStockCount: 0,
  },
}

beforeEach(() => {
  apiMock.mockReset()
})

describe('<QuickProductGrid />', () => {
  it('renders products from the real server response shape', async () => {
    apiMock.mockResolvedValue(serverPayload)

    render(<QuickProductGrid onSelect={vi.fn()} />)

    expect(await screen.findByText('Tata Salt 1kg')).toBeInTheDocument()
    expect(screen.getByText('₹28.00')).toBeInTheDocument()
  })

  it('shows the empty state when the business has no products', async () => {
    apiMock.mockResolvedValue({
      ...serverPayload,
      products: [],
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    })

    render(<QuickProductGrid onSelect={vi.fn()} />)

    expect(await screen.findByText('Scan or search to add')).toBeInTheDocument()
  })

  it('shows the error state with a retry when the fetch fails', async () => {
    apiMock.mockRejectedValue(new Error('Network down'))

    render(<QuickProductGrid onSelect={vi.fn()} />)

    await waitFor(() => expect(screen.getByText('Network down')).toBeInTheDocument())
  })
})
