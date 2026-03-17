/** Tax — GST Settings skeleton loader */

import { Skeleton } from '@/components/feedback/Skeleton'

export function GstSettingsSkeleton() {
  return (
    <div className="gst-settings-skeleton" aria-busy="true" aria-label="Loading GST settings">
      <Skeleton width="100%" height="160px" borderRadius="var(--radius-lg)" />
      <Skeleton width="100%" height="80px" borderRadius="var(--radius-lg)" />
      <Skeleton width="100%" height="80px" borderRadius="var(--radius-lg)" />
    </div>
  )
}
