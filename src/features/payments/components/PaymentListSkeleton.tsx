/** Payment list — skeleton loader matching PaymentCard layout */

import React from 'react'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

const SKELETON_COUNT = 5

export const PaymentListSkeleton: React.FC = () => {
  const { t } = useLanguage()
  return (
    <div
      className="payment-skeleton"
      role="status"
      aria-label={t.loadingPayments}
    >
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div
          key={`skeleton-payment-${i}`}
          className="payment-skeleton-item"
          aria-hidden="true"
        >
          <Skeleton
            width="44px"
            height="44px"
            borderRadius="var(--radius-md)"
          />

          <div className="payment-skeleton-content">
            <Skeleton width="150px" height="1rem" />
            <Skeleton width="110px" height="0.75rem" />
          </div>

          <div className="payment-skeleton-right">
            <Skeleton
              width="72px"
              height="1rem"
              borderRadius="var(--radius-sm)"
            />
            <Skeleton
              width="64px"
              height="18px"
              borderRadius="var(--radius-full)"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
