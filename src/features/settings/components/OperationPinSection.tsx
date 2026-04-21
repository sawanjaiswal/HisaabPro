import { Shield } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'

interface OperationPinSectionProps {
  operationPinSet: boolean
}

export function OperationPinSection({ operationPinSet }: OperationPinSectionProps) {
  const { t } = useLanguage()
  return (
    <section>
      <p className="settings-section-title">{t.operationPinTitle}</p>
      <div className="txn-controls">
        <div className="txn-control-row">
          <div className="txn-control-content">
            <p className="txn-control-label">{t.operationPinTitle}</p>
            <p className="txn-control-description">
              {t.operationPinDesc}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
            <Shield
              size={16}
              aria-hidden="true"
              style={{ color: operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)' }}
            />
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 500,
                color: operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)',
              }}
            >
              {operationPinSet ? t.operationPinSetLabel : t.operationPinNotSet}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
