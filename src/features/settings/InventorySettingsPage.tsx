/** InventorySettingsPage — expiryAlertDays + expiredBatchPolicy (BAT-07)
 *
 * 4 UI states: loading · error · success (form) · saving spinner on submit.
 * Offline-safe: tolerates {} return from api(), shows offline toast.
 * Only shown when vertical has stockTracking enabled (gated by Settings hub).
 */

import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useInventorySettings } from './useInventorySettings'
import type { ExpiredBatchPolicy } from './useInventorySettings'

// ─── Policy Radio Option ──────────────────────────────────────────────────────

function PolicyOption({
  value,
  selected,
  label,
  description,
  icon,
  onSelect,
}: {
  value: ExpiredBatchPolicy
  selected: boolean
  label: string
  description: string
  icon: React.ReactNode
  onSelect: (v: ExpiredBatchPolicy) => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--space-3)',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--space-4)',
        border: selected ? '2px solid var(--color-primary)' : '1.5px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: selected ? 'var(--color-primary-surface, #e0f2f1)' : 'var(--color-surface)',
        cursor: 'pointer',
        minHeight: 44,
        transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ color: selected ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }}>
        {icon}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
          {label}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
          {description}
        </span>
      </span>
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InventorySettingsPage() {
  const { t } = useLanguage()
  const {
    alertDays, setAlertDays,
    policy, setPolicy,
    initialized, status, refetch,
    save, isSaving,
  } = useInventorySettings()

  function handleAlertDaysChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Math.max(1, Math.min(365, parseInt(e.target.value, 10) || 1))
    setAlertDays(v)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    save()
  }

  return (
    <AppShell>
      <Header title={t.inventorySettings} backTo={ROUTES.SETTINGS} />

      <PageContainer>
        {/* Loading */}
        {status === 'pending' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} aria-busy="true">
            {[40, 48, 40, 80, 80, 48].map((h, i) => (
              <Skeleton key={i} height={`${h}px`} />
            ))}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadInventorySettings}
            message={t.checkConnectionRetry}
            onRetry={() => void refetch()}
          />
        )}

        {/* Success / form */}
        {(status === 'success' || initialized) && (
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>

            {/* Expiry alert days */}
            <div className="card-primary" style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <label
                htmlFor="expiry-alert-days"
                style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}
              >
                {t.expiryAlertDaysLabel}
              </label>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                {t.expiryAlertDaysDesc}
              </p>
              <input
                id="expiry-alert-days"
                type="number"
                min={1}
                max={365}
                value={alertDays}
                onChange={handleAlertDaysChange}
                placeholder={t.expiryAlertDaysPlaceholder}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  border: '1.5px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-surface)',
                  minHeight: 44,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Expired batch policy */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                  {t.expiredBatchPolicyLabel}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: 0 }}>
                  {t.expiredBatchPolicyDesc}
                </p>
              </div>

              <div role="radiogroup" aria-label={t.expiredBatchPolicyLabel} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <PolicyOption
                  value="WARN_ONLY"
                  selected={policy === 'WARN_ONLY'}
                  label={t.policyWarnOnly}
                  description={t.policyWarnOnlyDesc}
                  icon={<AlertTriangle size={18} aria-hidden="true" />}
                  onSelect={setPolicy}
                />
                <PolicyOption
                  value="HARD_BLOCK"
                  selected={policy === 'HARD_BLOCK'}
                  label={t.policyHardBlock}
                  description={t.policyHardBlockDesc}
                  icon={<ShieldAlert size={18} aria-hidden="true" />}
                  onSelect={setPolicy}
                />
              </div>
            </div>

            {/* Save button */}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              aria-busy={isSaving}
              style={{ minHeight: 48, fontWeight: 600, fontSize: 'var(--text-base)' }}
            >
              {isSaving ? '…' : t.saveInventorySettings}
            </button>
          </form>
        )}
      </PageContainer>
    </AppShell>
  )
}
