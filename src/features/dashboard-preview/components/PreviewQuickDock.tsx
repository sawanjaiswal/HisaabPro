import { useNavigate } from 'react-router-dom'
import { Plus, ArrowDownLeft, ScanLine, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PREVIEW_QUICK_ACTIONS } from '../dashboard-preview.constants'

export function PreviewQuickDock() {
  const navigate = useNavigate()

  const renderIcon = (name: string) => {
    switch (name) {
      case 'plus':
        return <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
      case 'arrow-down-left':
        return <ArrowDownLeft size={20} strokeWidth={2.2} aria-hidden="true" />
      case 'scan':
        return <ScanLine size={20} strokeWidth={2.2} aria-hidden="true" />
      case 'user-plus':
        return <UserPlus size={20} strokeWidth={2.2} aria-hidden="true" />
      default:
        return <Plus size={20} aria-hidden="true" />
    }
  }

  return (
    <nav className="quick-dock" aria-label="Primary business actions">
      <div className="quick-dock__grid">
        {PREVIEW_QUICK_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="none"
            className={`quick-dock__btn${action.highlight ? ' quick-dock__btn--highlight' : ''}`}
            onClick={() => navigate(action.route)}
          >
            <div className="quick-dock__icon-wrapper">
              {renderIcon(action.iconName)}
            </div>
            <span className="quick-dock__label">{action.label}</span>
          </Button>
        ))}
      </div>
    </nav>
  )
}
