/** PriceSourceHint — small chip rendered below a line item's rate field.
 *
 * Shows which pricing level resolved the rate and, for TIER source,
 * provides a link to the price list settings page.
 *
 * MANUAL     → "Custom price" muted badge + "Reset to auto" link
 * PARTY_PRICING → "Party-specific override" badge (no reset—these are saved overrides)
 * TIER        → "From <listName>" chip linking to /price-lists/:id
 * PRODUCT_DEFAULT → nothing rendered
 */

import React, { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '@/hooks/useLanguage'
import type { PriceResolverResult } from './pricing-resolver'
import './price-source-hint.css'
import { Button } from '@/components/ui/Button'

// ─── Props ────────────────────────────────────────────────────────────────────

interface PriceSourceHintProps {
  source: PriceResolverResult['source']
  /** Name of the price list — only needed when source === 'TIER' */
  listName?: string
  /** ID of the price list — only needed when source === 'TIER' */
  listId?: string
  /** Called when user clicks "Reset to auto" — only shown for MANUAL */
  onReset: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PriceSourceHint: React.FC<PriceSourceHintProps> = ({
  source,
  listName,
  listId,
  onReset,
}) => {
  const { t } = useLanguage()

  const handleReset = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      onReset()
    },
    [onReset],
  )

  if (source === 'PRODUCT_DEFAULT') return null

  if (source === 'MANUAL') {
    return (
      <div className="price-hint price-hint--manual" aria-label={t.priceSourceLabel}>
        <span className="price-hint__badge">{t.priceHintCustom}</span>
        <Button variant="none"
          type="button"
          className="price-hint__reset"
          onClick={handleReset}
          aria-label={t.priceHintResetToAuto}
        >
          {t.priceHintResetToAuto}
        </Button>
      </div>
    )
  }

  if (source === 'PARTY_PRICING') {
    return (
      <div className="price-hint price-hint--party" aria-label={t.priceSourceLabel}>
        <span className="price-hint__badge">{t.priceHintPartySpecific}</span>
      </div>
    )
  }

  // TIER
  const label = listName
    ? t.priceHintFromList.replace('{listName}', listName)
    : t.priceHintFromList.replace('{listName}', '')

  if (listId) {
    return (
      <div className="price-hint price-hint--tier" aria-label={t.priceSourceLabel}>
        <Link
          to={`/price-lists/${listId}`}
          className="price-hint__tier-link"
          aria-label={`${label} — ${t.priceListLinkLabel}`}
          tabIndex={0}
        >
          {label}
        </Link>
      </div>
    )
  }

  return (
    <div className="price-hint price-hint--tier" aria-label={t.priceSourceLabel}>
      <span className="price-hint__badge">{label}</span>
    </div>
  )
}
