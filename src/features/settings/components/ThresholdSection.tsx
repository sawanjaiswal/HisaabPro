import type { TransactionLockConfig } from '../settings.types'

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
  return (
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
              value={priceChangeThresholdPercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                onUpdate('priceChangeThresholdPercent', raw === '' ? null : Number(raw))
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
              value={discountThresholdPercent ?? ''}
              onChange={(e) => {
                const raw = e.target.value
                onUpdate('discountThresholdPercent', raw === '' ? null : Number(raw))
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
  )
}
