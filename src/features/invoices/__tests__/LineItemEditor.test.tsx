import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LineItemEditor } from '../components/LineItemEditor'
import { LineItemQuantityStepper } from '../components/LineItemQuantityStepper'
import { LineItemActionIcons } from '../components/LineItemActionIcons'

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      removeFromLineItems: 'Remove item',
      discount: 'Discount',
      freeItemBadge: 'Free',
      rateRs: 'RATE (₹)',
      lineTotal: 'Line Total',
    },
  }),
}))

// Mock useLineItemProductInfo
vi.mock('../components/useLineItemProductInfo', () => ({
  useLineItemProductInfo: () => ({
    unitSymbol: 'PCS',
    currentStock: 10,
    purchasePrice: 4000,
    sku: 'SKU-123',
  }),
}))

describe('LineItemQuantityStepper', () => {
  it('increments and decrements quantity correctly', () => {
    const onChange = vi.fn()
    render(
      <LineItemQuantityStepper
        index={0}
        quantity={2}
        productName="Maji"
        onChange={onChange}
      />
    )

    const decBtn = screen.getByLabelText('Decrease quantity for Maji')
    const incBtn = screen.getByLabelText('Increase quantity for Maji')

    fireEvent.click(incBtn)
    expect(onChange).toHaveBeenCalledWith(3)

    fireEvent.click(decBtn)
    expect(onChange).toHaveBeenCalledWith(1)
  })
})

describe('LineItemActionIcons', () => {
  it('renders discount, edit, and delete icons and triggers callbacks', () => {
    const onToggleDiscount = vi.fn()
    const onToggleFree = vi.fn()
    const onEditProduct = vi.fn()
    const onRemove = vi.fn()

    render(
      <LineItemActionIcons
        index={0}
        productName="Maji"
        productId="prod-1"
        isFree={false}
        canMarkFree={true}
        hasActiveDiscount={false}
        showDiscount={false}
        onToggleDiscount={onToggleDiscount}
        onToggleFree={onToggleFree}
        onEditProduct={onEditProduct}
        onRemove={onRemove}
      />
    )

    fireEvent.click(screen.getByLabelText('Add discount'))
    expect(onToggleDiscount).toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText('Edit product details'))
    expect(onEditProduct).toHaveBeenCalledWith('prod-1')

    fireEvent.click(screen.getByLabelText('Maji Remove item'))
    expect(onRemove).toHaveBeenCalledWith(0)
  })
})

describe('LineItemEditor', () => {
  const baseItem = {
    productId: 'prod-1',
    productName: 'Maji',
    quantity: 1,
    rate: 5500, // Rs 55 in paise
    discountType: 'PERCENTAGE' as const,
    discountValue: 0,
    taxCategoryId: null,
    hsnCode: '',
    discountAmount: 0,
    lineTotal: 5500,
    profit: 1500,
    profitPercent: 27.27,
  }

  it('renders product letter avatar, name, price per unit, and stock', () => {
    render(
      <LineItemEditor
        item={baseItem}
        index={0}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        showProfit={false}
        priceMode="AUTO"
        onPriceModeChange={vi.fn()}
      />
    )

    // Letter avatar 'M'
    expect(screen.getByText('M')).toBeDefined()
    // Product name
    expect(screen.getByText('Maji')).toBeDefined()
    // Price per unit
    expect(screen.getByText('₹ 55/PCS')).toBeDefined()
    // Stock indicator
    expect(screen.getByText(/Stock: 10\.0PCS/)).toBeDefined()
  })

  it('toggles expansion when clicking price/chevron', () => {
    render(
      <LineItemEditor
        item={baseItem}
        index={0}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
        showProfit={false}
        priceMode="AUTO"
        onPriceModeChange={vi.fn()}
      />
    )

    const toggleBtn = screen.getByLabelText(/details for Maji/i)
    fireEvent.click(toggleBtn)

    // Purchase Price (PP) appears when expanded
    expect(screen.getByText(/PP/)).toBeDefined()
    expect(screen.getByText('₹ 40')).toBeDefined()
  })
})
