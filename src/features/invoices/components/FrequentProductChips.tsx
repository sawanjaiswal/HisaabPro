/** FrequentProductChips — "usually bought" one-tap add row.
 *
 * Selling intelligence: once a customer is picked, show the products they buy
 * most often so a repeat order is one tap, not a search. Chips stay visible
 * after they're added — a re-tap bumps the line's quantity (tap Milk ×3 → qty
 * 3), and an added chip shows its running "×N" count instead of the price.
 * Silent on load/error — it's an accelerator, never a blocker.
 */

import { useQuery } from '@tanstack/react-query'
import { Plus, History } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { queryKeys } from '@/lib/query-keys'
import { useLanguage } from '@/hooks/useLanguage'
import { formatRupees } from '@/lib/format'
import { getFrequentProducts } from '../frequent-products.service'
import './frequent-product-chips.css'

interface FrequentProductChipsProps {
  partyId: string
  /** productId → quantity on the invoice (absent/0 = not yet added). */
  quantities: Record<string, number>
  /** Adds the product / bumps its qty (same signature as item-search select). */
  onAdd: (productId: string, ratePaise: number, productName: string) => void
}

export function FrequentProductChips({ partyId, quantities, onAdd }: FrequentProductChipsProps) {
  const { t } = useLanguage()
  const { data } = useQuery({
    queryKey: queryKeys.parties.frequentProducts(partyId),
    queryFn: ({ signal }) => getFrequentProducts(partyId, signal),
    enabled: Boolean(partyId),
    staleTime: 5 * 60_000, // history changes slowly; avoid refetch churn per keystroke
  })

  if (!partyId || !data || data.length === 0) return null

  return (
    <div className="frequent-chips">
      <span className="frequent-chips-label">
        <History size={12} aria-hidden="true" />
        {t.usuallyBought}
      </span>
      <div className="frequent-chips-row">
        {data.map((p) => {
          const qty = quantities[p.productId] ?? 0
          return (
            <Button
              key={p.productId}
              type="button"
              variant="outline"
              size="sm"
              className={`frequent-chip${qty > 0 ? ' frequent-chip--added' : ''}`}
              onClick={() => onAdd(p.productId, p.salePrice, p.name)}
              aria-label={`${p.name}${qty > 0 ? ` ×${qty}` : ''}`}
            >
              <Plus size={12} aria-hidden="true" />
              <span className="frequent-chip-name">{p.name}</span>
              {qty > 0 ? (
                <span className="frequent-chip-qty tabular-nums">×{qty}</span>
              ) : (
                <span className="frequent-chip-price tabular-nums">{formatRupees(p.salePrice)}</span>
              )}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
