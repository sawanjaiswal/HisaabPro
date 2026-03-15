import { useState, useEffect, useRef, useCallback } from 'react'
import { Shield } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { getTransactionLockConfig, updateTransactionLockConfig } from './settings.service'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { LOCK_PERIOD_OPTIONS, DEFAULT_TRANSACTION_LOCK_CONFIG } from './settings.constants'
import type { TransactionLockConfig } from './settings.types'
import './settings.css'

// TODO: get from auth context
const BUSINESS_ID = 'business_1'

const DEBOUNCE_MS = 500

export default function TransactionControlsPage() {
  const toast = useToast()

  const [config, setConfig] = useState<TransactionLockConfig>(DEFAULT_TRANSACTION_LOCK_CONFIG)
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading')
  const [refreshKey, setRefreshKey] = useState(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')

    getTransactionLockConfig(BUSINESS_ID, controller.signal)
      .then((res) => {
        setConfig(res.data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load settings'
        toast.error(message)
      })

    return () => controller.abort()
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const debouncedSave = useCallback((updated: TransactionLockConfig) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      updateTransactionLockConfig(BUSINESS_ID, updated)
        .then(() => toast.success('Settings saved'))
        .catch((err: unknown) => {
          const message = err instanceof ApiError ? err.message : 'Failed to save settings'
          toast.error(message)
        })
    }, DEBOUNCE_MS)
  }, [toast])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  function updateField<K extends keyof TransactionLockConfig>(
    key: K,
    value: TransactionLockConfig[K],
  ) {
    setConfig((prev) => {
      const updated = { ...prev, [key]: value }
      debouncedSave(updated)
      return updated
    })
  }

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
            <section>
              <p className="settings-section-title">Lock Settings</p>
              <div className="txn-controls">

                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Lock Period</p>
                    <p className="txn-control-description">
                      Transactions older than this cannot be edited or deleted
                    </p>
                  </div>
                  <select
                    value={config.lockAfterDays ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value
                      updateField('lockAfterDays', raw === '' ? null : Number(raw))
                    }}
                    aria-label="Lock period"
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      border: '1.5px solid var(--color-gray-300)',
                      fontSize: '0.9375rem',
                      fontFamily: 'var(--font-primary)',
                      minHeight: 44,
                      background: 'var(--color-gray-0, #fff)',
                      color: 'var(--color-gray-900)',
                      flexShrink: 0,
                    }}
                  >
                    {LOCK_PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.label} value={opt.value ?? ''}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

              </div>
            </section>

            <section>
              <p className="settings-section-title">Approvals</p>
              <div className="txn-controls">

                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Require Approval for Edits</p>
                    <p className="txn-control-description">
                      Staff must request approval before editing locked transactions
                    </p>
                  </div>
                  <label className="settings-toggle" aria-label="Require approval for edits">
                    <input
                      type="checkbox"
                      checked={config.requireApprovalForEdit}
                      onChange={(e) => updateField('requireApprovalForEdit', e.target.checked)}
                    />
                    <span className="settings-toggle-track" />
                  </label>
                </div>

                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Require Approval for Deletes</p>
                    <p className="txn-control-description">
                      Staff must request approval before deleting any transaction
                    </p>
                  </div>
                  <label className="settings-toggle" aria-label="Require approval for deletes">
                    <input
                      type="checkbox"
                      checked={config.requireApprovalForDelete}
                      onChange={(e) => updateField('requireApprovalForDelete', e.target.checked)}
                    />
                    <span className="settings-toggle-track" />
                  </label>
                </div>

              </div>
            </section>

            <section>
              <p className="settings-section-title">Thresholds</p>
              <div className="txn-controls">

                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Price Change Threshold</p>
                    <p className="txn-control-description">
                      Require approval when price is changed by more than this
                    </p>
                  </div>
                  <div className="txn-threshold-input">
                    <input
                      type="number"
                      className="txn-threshold-field"
                      value={config.priceChangeThresholdPercent ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateField('priceChangeThresholdPercent', raw === '' ? null : Number(raw))
                      }}
                      min={0}
                      max={100}
                      placeholder="—"
                      aria-label="Price change threshold percentage"
                    />
                    <span className="txn-threshold-suffix">%</span>
                  </div>
                </div>

                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Discount Threshold</p>
                    <p className="txn-control-description">
                      Require approval when discount exceeds this percentage
                    </p>
                  </div>
                  <div className="txn-threshold-input">
                    <input
                      type="number"
                      className="txn-threshold-field"
                      value={config.discountThresholdPercent ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value
                        updateField('discountThresholdPercent', raw === '' ? null : Number(raw))
                      }}
                      min={0}
                      max={100}
                      placeholder="—"
                      aria-label="Discount threshold percentage"
                    />
                    <span className="txn-threshold-suffix">%</span>
                  </div>
                </div>

              </div>
            </section>

            <section>
              <p className="settings-section-title">Operation PIN</p>
              <div className="txn-controls">
                <div className="txn-control-row">
                  <div className="txn-control-content">
                    <p className="txn-control-label">Operation PIN</p>
                    <p className="txn-control-description">
                      Required to approve requests and perform sensitive actions
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                    <Shield
                      size={16}
                      aria-hidden="true"
                      style={{ color: config.operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)' }}
                    />
                    <span
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: config.operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)',
                      }}
                    >
                      {config.operationPinSet ? 'Set' : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

      </PageContainer>
    </AppShell>
  )
}
