/** Tax — GST Settings skeleton loader */

import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'

export function GstSettingsSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="gst-settings-skeleton" aria-busy="true" aria-label={t.loadingGstSettings}>
      <Skeleton width="100%" height="160px" borderRadius="var(--radius-lg)" />
      <Skeleton width="100%" height="80px" borderRadius="var(--radius-lg)" />
      <Skeleton width="100%" height="80px" borderRadius="var(--radius-lg)" />
    </div>
  )
}
