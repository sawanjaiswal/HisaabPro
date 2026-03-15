/** Product list — summary stats hero card */

import React from 'react'
import { formatProductPrice } from '../product.utils'
import type { ProductListResponse } from '../product.types'
import './ProductSummaryBar.css'

interface ProductSummaryBarProps {
  summary: ProductListResponse['summary']
}

export const ProductSummaryBar: React.FC<ProductSummaryBarProps> = ({ summary }) => {
  const { totalProducts, lowStockCount, totalStockValue } = summary

  return (
    <div className="card-primary product-summary-bar" aria-label="Inventory summary">
      <p className="product-summary-count">{totalProducts} Products</p>
      <div className="product-summary-grid">
        <div className="product-summary-col">
          <span className="money-label product-summary-label">Total</span>
          <span className="money-hero product-summary-total">{totalProducts}</span>
        </div>
        <div className="product-summary-col">
          <span className="money-label product-summary-label">Low Stock</span>
          <span className="money-hero product-summary-low">{lowStockCount}</span>
        </div>
        <div className="product-summary-col">
          <span className="money-label product-summary-label">Stock Value</span>
          <span className="money-hero product-summary-value">{formatProductPrice(totalStockValue)}</span>
        </div>
      </div>
    </div>
  )
}
