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
    <div role="alert" className="upgrade-prompt">
      <p className="upgrade-prompt-title">
        {feature ? `${feature} requires` : 'This feature requires'} the{' '}
        <strong>{requiredPlan}</strong> plan
      </p>
      <p className="upgrade-prompt-subtitle">
        Upgrade to unlock this feature and grow your business
      </p>
      <div className="upgrade-prompt-action">
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
