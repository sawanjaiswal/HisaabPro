/** Price list row (mockup #55) — tinted icon square, name, product count, status.
 *
 * The row is pure navigation: rename and delete live on the detail page, which
 * is where the mockup puts them, so the row stays a single tap target.
 */

import React from 'react'
import { Tags, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceList } from '../price-list.types'

interface PriceListRowProps {
  priceList: PriceList
  onOpen: (id: string) => void
}

export const PriceListRow: React.FC<PriceListRowProps> = ({ priceList, onOpen }) => {
  const { t } = useLanguage()

  return (
    <div className="pl-row" role="listitem">
      <Button
        type="button"
        variant="ghost"
        className="pl-row-main"
        onClick={() => onOpen(priceList.id)}
        aria-label={`${priceList.name} — ${priceList.entryCount} ${t.plEntries}`}
      >
        <span className="pl-row-icon" aria-hidden="true">
          <Tags size={20} />
        </span>

        <span className="pl-row-text">
          <span className="pl-row-name">{priceList.name}</span>
          <span className="pl-row-count">
            {priceList.entryCount} {t.plEntries} · {priceList.partyCount} {t.plParties}
          </span>
        </span>

        {priceList.isDefault && <span className="pl-row-status">{t.plDefault}</span>}

        <ChevronRight size={18} className="pl-row-chevron" aria-hidden="true" />
      </Button>
    </div>
  )
}
