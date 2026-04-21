import type { TransactionLockConfig } from '../settings.types'
import { useLanguage } from '@/hooks/useLanguage'

interface ThresholdSectionProps {
  priceChangeThresholdPercent: TransactionLockConfig['priceChangeThresholdPercent']
  discountThresholdPercent: TransactionLockConfig['discountThresholdPercent']
  onUpdate: <K extends keyof TransactionLockConfig>(key: K, value: TransactionLockConfig[K]) => void
}

export function ThresholdSection({
  priceChangeThresholdPercent,
  discountThresholdPercent,
  onUpdate,
}: ThresholdSectionProps) {
  const { t } = useLanguage()

  return (
    <section>
      <p className="settings-section-title py-0">{t.thresholdsTitle}</p>
      <div className="txn-controls">

        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.priceChangeThreshold}</p>
            <p className="txn-control-description">
              {t.priceChangeThresholdDesc}
            </p>
          </div>
          <div className="txn-threshold-input">
            <input
              type="number"
              className="txn-threshold-field"
              value={priceChangeThresholdPercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                onUpdate('priceChangeThresholdPercent', raw === '' ? null : Number(raw))
              }}
              min={0}
              max={100}
              placeholder="—"
              aria-label={t.priceChangeThresholdAria}
            />
            <span className="txn-threshold-suffix">%</span>
          </div>
        </div>

        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.discountThresholdLabel}</p>
            <p className="txn-control-description">
              {t.discountThresholdDesc}
            </p>
          </div>
          <div className="txn-threshold-input">
            <input
              type="number"
              className="txn-threshold-field"
              value={discountThresholdPercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                onUpdate('discountThresholdPercent', raw === '' ? null : Number(raw))
              }}
              min={0}
              max={100}
              placeholder="—"
              aria-label={t.discountThresholdAria}
            />
            <span className="txn-threshold-suffix">%</span>
          </div>
        </div>

      </div>
    </section>
  )
}
