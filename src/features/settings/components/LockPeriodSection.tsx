import { LOCK_PERIOD_OPTIONS } from '../settings.constants'
import { useLanguage } from '@/hooks/useLanguage'
import type { TransactionLockConfig } from '../settings.types'

interface LockPeriodSectionProps {
  lockAfterDays: TransactionLockConfig['lockAfterDays']
  onUpdate: <K extends keyof TransactionLockConfig>(key: K, value: TransactionLockConfig[K]) => void
}

export function LockPeriodSection({ lockAfterDays, onUpdate }: LockPeriodSectionProps) {
  const { t } = useLanguage()
  return (
    <section>
      <p className="settings-section-title">{t.lockSettingsTitle}</p>
      <div className="txn-controls">
        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.lockPeriodLabel}</p>
            <p className="txn-control-description">
              {t.lockPeriodDesc}
            </p>
          </div>
          <select
            value={lockAfterDays ?? ''}
            onChange={(e) => {
              const raw = e.target.value
              onUpdate('lockAfterDays', raw === '' ? null : Number(raw))
            }}
            aria-label={t.lockPeriodAria}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1.5px solid var(--color-gray-300)',
              fontSize: 'var(--fs-df)',
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
