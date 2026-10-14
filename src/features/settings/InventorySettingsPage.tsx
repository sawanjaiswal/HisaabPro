/** InventorySettingsPage — expiryAlertDays + expiredBatchPolicy (BAT-07)
 *
 * 4 UI states: loading · error · success (form) · saving spinner on submit.
 * Offline-safe: tolerates {} return from api(), shows offline toast.
 * Only shown when vertical has stockTracking enabled (gated by Settings hub).
 */

import { Text } from '@/components/ui/Text'
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { useInventorySettings } from './useInventorySettings'
import type { ExpiredBatchPolicy } from './useInventorySettings'
import { Input } from '@/components/ui/Input'

import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/utils'

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
    <Card
      clickable
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(value)}
      className={cn(
        'p-4 flex items-start gap-3 w-full text-left transition-all',
        selected
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : 'border-border bg-card hover:border-[var(--border-strong)]'
      )}
    >
      <span className={cn('flex-shrink-0 mt-0.5', selected ? 'text-primary' : 'text-muted-foreground')}>
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </span>
      </div>
    </Card>
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
          <div className="flex flex-col gap-4" aria-busy="true">
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
          <form onSubmit={handleSave} className="flex flex-col gap-6">

            {/* Expiry alert days */}
            <Card className="p-4 flex flex-col gap-3">
              <label
                htmlFor="expiry-alert-days"
                className="text-sm font-semibold text-foreground"
              >
                {t.expiryAlertDaysLabel}
              </label>
              <Text className="text-xs text-muted-foreground m-0">
                {t.expiryAlertDaysDesc}
              </Text>
              <Input
                id="expiry-alert-days"
                type="number"
                min={1}
                max={365}
                value={alertDays}
                onChange={handleAlertDaysChange}
                placeholder={t.expiryAlertDaysPlaceholder}
              />
            </Card>

            {/* Expired batch policy */}
            <div className="flex flex-col gap-3">
              <div>
                <Text className="font-semibold text-sm text-foreground mb-1">
                  {t.expiredBatchPolicyLabel}
                </Text>
                <Text className="text-xs text-muted-foreground m-0">
                  {t.expiredBatchPolicyDesc}
                </Text>
              </div>

              <div role="radiogroup" aria-label={t.expiredBatchPolicyLabel} className="flex flex-col gap-3">
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
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isSaving}
              aria-busy={isSaving}
              className="w-full"
            >
              {isSaving ? '…' : t.saveInventorySettings}
            </Button>
          </form>
        )}
      </PageContainer>
    </AppShell>
  )
}
