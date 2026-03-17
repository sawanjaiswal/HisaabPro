import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { LockPeriodSection } from './components/LockPeriodSection'
import { ApprovalTogglesSection } from './components/ApprovalTogglesSection'
import { ThresholdSection } from './components/ThresholdSection'
import { OperationPinSection } from './components/OperationPinSection'
import { useTransactionControls } from './useTransactionControls'
import './transaction-controls.css'
import './settings-toggle.css'

export default function TransactionControlsPage() {
  const { config, status, refresh, updateField } = useTransactionControls()

  return (
    <AppShell>
      <Header title="Transaction Controls" backTo={ROUTES.SETTINGS} />
      <PageContainer className="txn-controls-page">

        {status === 'loading' && (
          <div aria-busy="true" aria-label="Loading settings">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{ height: 60, marginBottom: 'var(--space-2)', borderRadius: 'var(--radius-lg)', background: 'var(--color-gray-100)', opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {status === 'error' && (
          <ErrorState
            title="Could not load transaction controls"
            message="Check your connection and try again."
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
