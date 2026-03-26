/** Settings — Loading skeleton for role builder form */

import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

export function BuilderSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="role-builder" aria-busy="true" aria-label={t.loadingRoleLabel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton width="60px" height="0.75rem" borderRadius="var(--radius-sm)" />
        <Skeleton width="100%" height="44px" borderRadius="var(--radius-md)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton width="80px" height="0.75rem" borderRadius="var(--radius-sm)" />
        <Skeleton width="100%" height="80px" borderRadius="var(--radius-md)" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={`mod-skel-${i}`} width="100%" height="52px" borderRadius="var(--radius-lg)" />
      ))}
    </div>
  )
}
