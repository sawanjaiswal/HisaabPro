/** Products — in-page large title block (GPT mockup).
 *
 * Big "Products" title + subtitle, with a round scan button and a round
 * emerald "+" add button on the right. Replaces the floating FAB — the "+"
 * here is the primary add action. Pure presentation; parent owns handlers.
 */

import React from 'react'
import { Plus, ScanBarcode } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'

interface ProductsPageHeaderProps {
  onScan: () => void
  onAdd: () => void
}

export const ProductsPageHeader: React.FC<ProductsPageHeaderProps> = ({ onScan, onAdd }) => {
  const { t } = useLanguage()

  return (
    <div className="products-page-header">
      <div className="products-page-header__text">
        <h1 className="products-page-title">{t.products}</h1>
        <p className="products-page-subtitle">{t.manageInventorySubtitle}</p>
      </div>
      <div className="products-page-header__actions">
        <Button
          variant="none"
          className="products-round-btn"
          onClick={onScan}
          aria-label={t.scanBarcode}
        >
          <ScanBarcode size={20} aria-hidden="true" />
        </Button>
        <Button
          variant="none"
          className="products-round-btn products-round-btn--primary"
          onClick={onAdd}
          aria-label={t.addProduct}
        >
          <Plus size={22} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
