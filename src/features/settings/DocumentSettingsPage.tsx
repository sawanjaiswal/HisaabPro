/** Settings — Document Settings page (enforceMoq + showLineItemImages + UPI ID) */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { useDocumentSettings } from './useDocumentSettings'
import { UpiIdInput } from './components/UpiIdInput'
import './settings-toggle.css'
import './settings.css'

interface BusinessVpaResponse {
  upiVpa: string | null
}

export default function DocumentSettingsPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { settings, status, refresh, updateField } = useDocumentSettings()

  const { data: businessData } = useQuery({
    queryKey: ['business', businessId, 'vpa'],
    queryFn: () => api<BusinessVpaResponse>(`/businesses/${businessId}`, { cacheReads: true }),
    enabled: !!businessId,
  })

  const [savedVpa, setSavedVpa] = useState<string | null | undefined>(undefined)
  // Use savedVpa if user changed it in this session, otherwise use server data
  const currentVpa = savedVpa !== undefined ? savedVpa : (businessData?.upiVpa ?? null)

  return (
    <AppShell>
      <Header title={t.documentSettingsTitle} backTo={ROUTES.SETTINGS} />
      <PageContainer className="stagger-enter space-y-6">

        {status === 'loading' && (
          <div aria-busy="true" aria-label={t.loading}>
            {[1, 2].map((n) => (
              <div key={n} style={{ marginBottom: 'var(--space-3)' }}>
                <Skeleton height="3.5rem" borderRadius="var(--radius-lg)" />
              </div>
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadSettings}
            message={t.checkConnectionRetry}
            onRetry={refresh}
          />
        )}

        {/* UPI ID — Epic C PR2 (#129) */}
        {status === 'success' && (
          <UpiIdInput
            initialValue={currentVpa}
            onSaved={(v) => setSavedVpa(v)}
          />
        )}

        {status === 'success' && (
          <div className="settings-group">
            {/* Enforce MOQ toggle */}
            <label className="settings-item settings-item--toggle">
              <span className="settings-item-content">
                <span className="settings-item-label">{t.enforceMoqLabel}</span>
                <span className="settings-item-description">{t.enforceMoqDesc}</span>
              </span>
              <span className="settings-item-action">
                <span className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.enforceMoq ?? false}
                    onChange={(e) => updateField('enforceMoq', e.target.checked)}
                    aria-label={t.enforceMoqLabel}
                  />
                  <span className="settings-toggle-track" />
                </span>
              </span>
            </label>

            {/* Show line item images toggle */}
            <label className="settings-item settings-item--toggle">
              <span className="settings-item-content">
                <span className="settings-item-label">{t.showLineItemImagesLabel}</span>
                <span className="settings-item-description">{t.showLineItemImagesDesc}</span>
              </span>
              <span className="settings-item-action">
                <span className="settings-toggle">
                  <input
                    type="checkbox"
                    checked={settings.showLineItemImages ?? false}
                    onChange={(e) => updateField('showLineItemImages', e.target.checked)}
                    aria-label={t.showLineItemImagesLabel}
                  />
                  <span className="settings-toggle-track" />
                </span>
              </span>
            </label>
          </div>
        )}

      </PageContainer>
    </AppShell>
  )
}
