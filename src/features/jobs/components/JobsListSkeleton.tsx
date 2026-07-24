/** JobsListSkeleton — loading UI state */

import { useLanguage } from '@/hooks/useLanguage'

export function JobsListSkeleton() {
  const { t } = useLanguage()
  return (
    <div aria-label={t.jobsLoading} aria-busy="true" style={{ display: 'flex', flexDirection: 'column' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          style={{
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
          aria-hidden="true"
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ width: 80, height: 14, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 70, height: 20, borderRadius: 9999 }} />
          </div>
          <div className="skeleton" style={{ width: '65%', height: 16, borderRadius: 4 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div className="skeleton" style={{ width: 100, height: 13, borderRadius: 4 }} />
            <div className="skeleton" style={{ width: 70, height: 14, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
