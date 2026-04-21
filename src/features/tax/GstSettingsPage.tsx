/** Tax — GST Settings page (lazy loaded)
 *
 * GSTIN entry, state code, composition scheme toggle.
 * Links to Tax Categories and GST Reports.
 * 4 UI states: loading / error / success (no empty — always shows card)
 */

import { useNavigate } from 'react-router-dom'
import { Receipt, FileText, Building2 } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { INDIAN_STATES } from './tax.constants'
import { useGstSettings } from './useGstSettings'
import { GstInfoCard } from './components/GstInfoCard'
import { GstQuickLinks } from './components/GstQuickLinks'
import { GstSettingsSkeleton } from './components/GstSettingsSkeleton'
import './gst-settings.css'

export default function GstSettingsPage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { settings, status, refresh, updateGst } = useGstSettings(businessId)
  const stateName = settings.stateCode ? INDIAN_STATES[settings.stateCode] ?? 'Unknown' : null

  return (
    <AppShell>
      <Header title={t.gstSettings} backTo={ROUTES.SETTINGS} />
      <PageContainer>
        <div className="gst-settings-page stagger-enter space-y-6">
          {status === 'loading' && <GstSettingsSkeleton />}
          {status === 'error' && (
            <ErrorState title={t.couldNotLoadGstSettings} message={t.checkConnectionRetry} onRetry={refresh} />
          )}
          {status === 'success' && (
            <>
              <GstInfoCard gstin={settings.gstin} stateCode={settings.stateCode} stateName={stateName} compositionScheme={settings.compositionScheme} onUpdate={updateGst} />
              <GstQuickLinks
                links={[
                  { icon: Receipt, label: t.taxRates, description: t.manageTaxRateCategories, route: ROUTES.SETTINGS_TAX_RATES },
                  { icon: FileText, label: t.gstReturns, description: t.exportGstrData, route: ROUTES.REPORT_GST_RETURNS },
                  { icon: Building2, label: t.taxSummary, description: t.viewTaxCollectedPaid, route: ROUTES.REPORT_TAX_SUMMARY },
                ]}
                onNavigate={(route) => navigate(route)}
              />
            </>
          )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
