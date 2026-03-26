/** Tax — Tax Categories skeleton loader */

import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

export function TaxCategoriesSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="tax-cat-list" aria-busy="true" aria-label={t.loadingTaxCategories}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={`tax-skel-${i}`} className="tax-cat-card" style={{ pointerEvents: 'none' }}>
          <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
          <span className="tax-cat-card-body">
            <Skeleton width="140px" height="0.9375rem" borderRadius="var(--radius-sm)" />
            <Skeleton width="100px" height="0.8125rem" borderRadius="var(--radius-sm)" />
          </span>
        </div>
      ))}
    </div>
  )
}
