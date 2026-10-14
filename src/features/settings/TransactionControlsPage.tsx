import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import { LockPeriodSection } from './components/LockPeriodSection'
import { ApprovalTogglesSection } from './components/ApprovalTogglesSection'
import { ThresholdSection } from './components/ThresholdSection'
import { OperationPinSection } from './components/OperationPinSection'
import { useTransactionControls } from './useTransactionControls'
import './transaction-controls.css'

export default function TransactionControlsPage() {
  const { config, status, refresh, updateField } = useTransactionControls()
  const { t } = useLanguage()

  return (
    <AppShell>
      <Header title={t.transactionControls} backTo={ROUTES.SETTINGS} />
      <PageContainer className="txn-controls-page stagger-enter space-y-6">

        {status === 'loading' && (
          <div aria-busy="true" aria-label={t.couldNotLoadSettings} className="space-y-2">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton
                key={n}
                height="3.75rem"
                borderRadius="var(--radius-lg)"
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title={t.couldNotLoadTxnControls}
            message={t.checkConnectionRetry2}
            onRetry={refresh}
          />
        )}

        {status === 'success' && (
          <>
            <LockPeriodSection
              lockAfterDays={config.lockAfterDays}
              onUpdate={updateField}
            />
            <ApprovalTogglesSection
              requireApprovalForEdit={config.requireApprovalForEdit}
              requireApprovalForDelete={config.requireApprovalForDelete}
              onUpdate={updateField}
            />
            <ThresholdSection
              priceChangeThresholdPercent={config.priceChangeThresholdPercent}
              discountThresholdPercent={config.discountThresholdPercent}
              onUpdate={updateField}
            />
            <OperationPinSection operationPinSet={config.operationPinSet} />
          </>
        )}

      </PageContainer>
    </AppShell>
  )
}
