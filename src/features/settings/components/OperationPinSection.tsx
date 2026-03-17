import { Shield } from 'lucide-react'

interface OperationPinSectionProps {
  operationPinSet: boolean
}

export function OperationPinSection({ operationPinSet }: OperationPinSectionProps) {
  return (
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
              style={{ color: operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)' }}
            />
            <span
              style={{
                fontSize: '0.8125rem',
                fontWeight: 500,
                color: operationPinSet ? 'var(--color-success-600)' : 'var(--color-gray-400)',
              }}
            >
              {operationPinSet ? 'Set' : 'Not set'}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
