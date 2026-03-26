/** CurrencyRatesSkeleton — Layout-preserving skeleton for exchange rates list */

import { useLanguage } from '@/hooks/useLanguage'

export function CurrencyRatesSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="currency-rate-list" aria-busy="true" aria-label={t.loadingExchangeRates}>
      {(['sk-1', 'sk-2', 'sk-3', 'sk-4'] as const).map((skKey) => (
        <div key={skKey} className="currency-rate-skeleton">
          <div className="skeleton-line skeleton-line--code" />
          <div className="skeleton-line skeleton-line--rate" />
          <div className="skeleton-line skeleton-line--date" />
        </div>
      ))}
    </div>
  )
}
