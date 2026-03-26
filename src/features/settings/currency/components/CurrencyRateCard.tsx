/** CurrencyRateCard — Displays a single exchange rate entry */

import { Calendar } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { formatRateLabel, formatEffectiveDate } from '../currency.utils'
import type { ExchangeRateEntry } from '../currency.types'

interface CurrencyRateCardProps {
  entry: ExchangeRateEntry
}

export function CurrencyRateCard({ entry }: CurrencyRateCardProps) {
  const { t } = useLanguage()

  return (
    <div className="currency-rate-card">
      <div className="currency-rate-card__main">
        <span className="currency-rate-card__code">{entry.fromCurrency}</span>
        <span className="currency-rate-card__rate">
          {formatRateLabel(entry.fromCurrency, entry.rate)}
        </span>
      </div>
      <div className="currency-rate-card__meta">
        <Calendar size={12} aria-hidden="true" />
        <span>{formatEffectiveDate(entry.effectiveDate)}</span>
        {entry.source === 'manual' && (
          <span className="currency-rate-card__badge">{t.manualBadge}</span>
        )}
      </div>
    </div>
  )
}
