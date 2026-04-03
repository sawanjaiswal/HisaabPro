/** UpgradePrompt — shown when a 402 is returned or a feature requires upgrading */

import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'

interface UpgradePromptProps {
  requiredPlan: 'PRO' | 'BUSINESS'
  feature?: string
}

export function UpgradePrompt({ requiredPlan, feature }: UpgradePromptProps) {
  const navigate = useNavigate()

  return (
    <div
      role="alert"
      style={{
        borderRadius: '0.75rem',
        border: '1px solid var(--color-warning-200, #fde68a)',
        background: 'var(--color-warning-50, #fffbeb)',
        padding: '1rem',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          fontSize: '0.875rem',
          fontWeight: 500,
          color: 'var(--color-warning-800, #92400e)',
          margin: 0,
        }}
      >
        {feature ? `${feature} requires` : 'This feature requires'} the{' '}
        <strong>{requiredPlan}</strong> plan
      </p>
      <p
        style={{
          marginTop: '0.25rem',
          fontSize: '0.75rem',
          color: 'var(--color-warning-600, #d97706)',
        }}
      >
        Upgrade to unlock this feature and grow your business
      </p>
      <div style={{ marginTop: '0.75rem' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={() => navigate(ROUTES.SETTINGS)}
        >
          View Plans
        </Button>
      </div>
    </div>
  )
}
