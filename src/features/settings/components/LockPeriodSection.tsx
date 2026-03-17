import { LOCK_PERIOD_OPTIONS } from '../settings.constants'
import type { TransactionLockConfig } from '../settings.types'

interface LockPeriodSectionProps {
  lockAfterDays: TransactionLockConfig['lockAfterDays']
  onUpdate: <K extends keyof TransactionLockConfig>(key: K, value: TransactionLockConfig[K]) => void
}

export function LockPeriodSection({ lockAfterDays, onUpdate }: LockPeriodSectionProps) {
  return (
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
            value={lockAfterDays ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              onUpdate('lockAfterDays', raw === '' ? null : Number(raw))
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
  )
}
