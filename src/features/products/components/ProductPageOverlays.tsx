/**
 * ProductsPage — Drawers and Modal Overlays Container
 */

import React from 'react'
import { ProductCategoryDrawer } from './ProductCategoryDrawer'
import { ProductFilterDrawer } from './ProductFilterDrawer'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { LabelPrintDialog } from '../label-print/LabelPrintDialog'
import { BulkProductAddModal } from '../bulk/BulkProductAddModal'
import type { ProductSortBy } from '../product.types'
import type { ProductStatusFilter } from '@/lib/types/product.types'

interface ProductPageOverlaysProps {
  categoryDrawerOpen: boolean
  onCloseCategoryDrawer: () => void
  activeCategoryId?: string
  onSelectCategory: (id: string) => void
  filterDrawerOpen: boolean
  onCloseFilterDrawer: () => void
  status?: ProductStatusFilter
  sortBy?: ProductSortBy
  sortOrder?: 'asc' | 'desc'
  onStatusChange: (status: ProductStatusFilter | undefined) => void
  onSortByChange: (sortBy: ProductSortBy) => void
  onSortOrderChange: (order: 'asc' | 'desc') => void
  onResetFilters: () => void
  scannerOpen: boolean
  onCloseScanner: () => void
  onBarcodeScan: (code: string) => void
  labelPrintOpen: boolean
  onCloseLabelPrint: () => void
  selectedIds: string[]
  bulkModalOpen: boolean
  onCloseBulkModal: () => void
  onBulkSuccess: () => void
}

export const ProductPageOverlays: React.FC<ProductPageOverlaysProps> = ({
  categoryDrawerOpen,
  onCloseCategoryDrawer,
  activeCategoryId,
  onSelectCategory,
  filterDrawerOpen,
  onCloseFilterDrawer,
  status,
  sortBy,
  sortOrder,
  onStatusChange,
  onSortByChange,
  onSortOrderChange,
  onResetFilters,
  scannerOpen,
  onCloseScanner,
  onBarcodeScan,
  labelPrintOpen,
  onCloseLabelPrint,
  selectedIds,
  bulkModalOpen,
  onCloseBulkModal,
  onBulkSuccess,
}) => {
  return (
    <>
      <ProductCategoryDrawer
        open={categoryDrawerOpen}
        onClose={onCloseCategoryDrawer}
        activeCategoryId={activeCategoryId ?? 'ALL'}
        onSelect={onSelectCategory}
      />
      <ProductFilterDrawer
        open={filterDrawerOpen}
        onClose={onCloseFilterDrawer}
        status={status}
        sortBy={sortBy ?? 'createdAt'}
        sortOrder={sortOrder ?? 'desc'}
        onStatusChange={onStatusChange}
        onSortByChange={onSortByChange}
        onSortOrderChange={onSortOrderChange}
        onReset={onResetFilters}
      />
      {scannerOpen && <BarcodeScanner onScan={onBarcodeScan} onClose={onCloseScanner} />}
      {labelPrintOpen && (
        <LabelPrintDialog productIds={selectedIds} onClose={onCloseLabelPrint} />
      )}
      <BulkProductAddModal
        isOpen={bulkModalOpen}
        onClose={onCloseBulkModal}
        onSuccess={onBulkSuccess}
      />
    </>
  )
}
