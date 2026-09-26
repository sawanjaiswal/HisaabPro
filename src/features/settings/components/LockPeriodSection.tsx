import { Text } from '@/components/ui/Text'
import { LOCK_PERIOD_OPTIONS } from '../settings.constants'
import { useLanguage } from '@/hooks/useLanguage'
import { Select, SelectItem } from '@/components/ui/Select'
import type { TransactionLockConfig } from '../settings.types'

interface LockPeriodSectionProps {
  lockAfterDays: TransactionLockConfig['lockAfterDays']
  onUpdate: <K extends keyof TransactionLockConfig>(key: K, value: TransactionLockConfig[K]) => void
}

export function LockPeriodSection({ lockAfterDays, onUpdate }: LockPeriodSectionProps) {
  const { t } = useLanguage()
  return (
    <section>
      <Text className="settings-section-title py-0">{t.lockSettingsTitle}</Text>
      <div className="txn-controls">
        <div className="txn-control-row">
          <div className="txn-control-content">
            <Text className="txn-control-label">{t.lockPeriodLabel}</Text>
            <Text className="txn-control-description">
              {t.lockPeriodDesc}
            </Text>
          </div>
          <div className="txn-control-select">
            <Select
              value={lockAfterDays == null ? '__never__' : String(lockAfterDays)}
              onValueChange={(v) => onUpdate('lockAfterDays', v === '__never__' ? null : Number(v))}
              ariaLabel={t.lockPeriodAria}
            >
              {LOCK_PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.label} value={opt.value == null ? '__never__' : String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </section>
  )
}
