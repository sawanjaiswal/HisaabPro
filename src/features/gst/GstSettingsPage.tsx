/**
 * GST Settings Page — Phase 2
 *
 * 4 UI states: loading / error / empty (gst off) / success (gst on, all fields).
 * Mobile-first: 320px primary. Form logic in useGstSettingsForm.
 * Form fields split into GstFormFields to keep this file ≤ 250 lines.
 */

import { Receipt, Save, Database } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { useGstSettings } from './useGstSettings'
import { useGstSettingsForm } from './useGstSettingsForm'
import { GstFormFields } from './GstFormFields'
import './gst-settings-v2.css'

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function GstSkeleton() {
  return (
    <div className="gsv2-skeleton" aria-busy="true" aria-label="Loading GST settings">
      {[1, 2].map(n => (
        <div key={n} className="gsv2-skeleton-card">
          <div className="gsv2-skeleton-line gsv2-skeleton-line--short" />
          <div className="gsv2-skeleton-line gsv2-skeleton-line--full gsv2-skeleton-line--input" />
          <div className="gsv2-skeleton-line gsv2-skeleton-line--medium" />
          <div className="gsv2-skeleton-line gsv2-skeleton-line--full gsv2-skeleton-line--input" />
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function GstSettingsPage() {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const { settings, status, refresh, updateGst, isSaving } = useGstSettings()
  const {
    form, patch, gstinValidation, handleGstinBlur, handleSubmit, dirty,
    COMPOSITION_RATES, rateLabel,
  } = useGstSettingsForm(settings, updateGst, isSaving)

  return (
    <AppShell>
      <Header title={t.gstSettings} backTo={ROUTES.SETTINGS} />
      <PageContainer>
        <div className="gsv2-page stagger-enter">

          {/* ── Loading ── */}
          {status === 'loading' && <GstSkeleton />}

          {/* ── Error ── */}
          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadGstSettings}
              message={t.checkConnectionRetry}
              onRetry={refresh}
            />
          )}

          {/* ── Success (empty = GST off, success = GST on with all fields) ── */}
          {status === 'success' && (
            <>
              {/* Master gate card */}
              <div className="gsv2-card">
                <div className="gsv2-card-header">
                  <span className="gsv2-card-icon" aria-hidden="true">
                    <Receipt size={20} />
                  </span>
                  <span className="gsv2-card-title">{t.gstSettings}</span>
                </div>

                {/* gstEnabled toggle */}
                <div className="gsv2-row">
                  <div>
                    <div className="gsv2-row-label">{t.gstEnabledLabel}</div>
                    <div className="gsv2-row-desc">{t.gstEnabledDesc}</div>
                  </div>
                  <div className="gsv2-row-right">
                    <button
                      className="gsv2-toggle"
                      role="switch"
                      aria-checked={form.gstEnabled}
                      aria-label={form.gstEnabled ? t.gstEnabledOn : t.gstEnabledOff}
                      onClick={() => patch('gstEnabled', !form.gstEnabled)}
                      disabled={isSaving}
                    >
                      <span className="gsv2-toggle-thumb" />
                    </button>
                  </div>
                </div>
              </div>

              {/* All other fields */}
              <GstFormFields
                form={form}
                gstinValidation={gstinValidation}
                businessStateCode={settings.stateCode}
                isSaving={isSaving}
                onPatch={patch}
                onGstinBlur={handleGstinBlur}
                compositionRates={COMPOSITION_RATES}
                rateLabel={rateLabel}
              />

              {/* Backfill wizard link — only when GST is enabled */}
              {form.gstEnabled && (
                <button
                  type="button"
                  className="gsv2-card gsv2-nav-link"
                  onClick={() => navigate(ROUTES.GST_BACKFILL)}
                  aria-label={t.backfillNavLabel}
                >
                  <span className="gsv2-card-icon" aria-hidden="true">
                    <Database size={20} />
                  </span>
                  <span className="gsv2-nav-link-body">
                    <span className="gsv2-card-title">{t.backfillNavLabel}</span>
                    <span className="gsv2-row-desc">{t.backfillNavDesc}</span>
                  </span>
                </button>
              )}

              {/* Save button — appears only when dirty */}
              {dirty && (
                <button
                  className="gsv2-save-btn"
                  onClick={handleSubmit}
                  disabled={isSaving || gstinValidation.valid === false}
                  aria-label={t.saveGstSettings}
                >
                  {isSaving ? (
                    t.savingGstSettings
                  ) : (
                    <><Save size={16} aria-hidden="true" /> {t.saveGstSettings}</>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
