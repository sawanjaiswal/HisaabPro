import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { Skeleton } from '@/components/feedback/Skeleton'
import '../settings.css'

export const SettingsSkeleton: React.FC = () => {
  const { t } = useLanguage()

  return (
    <div className="settings-page space-y-6" aria-busy="true" aria-label={t.couldNotLoadSettings}>
      {Array.from({ length: 4 }, (_, sectionIndex) => (
        <div key={`section-${sectionIndex}`} className="settings-section py-0">
          <Skeleton width="80px" height="0.6875rem" borderRadius="var(--radius-sm)" />
          <div className="settings-group" style={{ marginTop: 'var(--space-2)' }}>
            {Array.from({ length: sectionIndex === 0 ? 4 : sectionIndex === 1 ? 3 : 2 }, (_, itemIndex) => (
              <div
                key={`item-${sectionIndex}-${itemIndex}`}
                className="settings-item"
                style={{ pointerEvents: 'none' }}
              >
                <Skeleton width="36px" height="36px" borderRadius="var(--radius-md)" />
                <span className="settings-item-content">
                  <Skeleton width="140px" height="0.9375rem" borderRadius="var(--radius-sm)" />
                  <Skeleton width="200px" height="0.8125rem" borderRadius="var(--radius-sm)" />
                </span>
                <Skeleton width="16px" height="16px" borderRadius="var(--radius-sm)" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
