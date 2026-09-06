import { useNavigate, useLocation } from 'react-router-dom'
import { Sparkles, LayoutGrid } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import { Button } from '@/components/ui/Button'

export function DashboardViewSwitcher() {
  const navigate = useNavigate()
  const location = useLocation()
  const isPreview = location.pathname.includes('/preview')

  return (
    <div className="dash-switcher">
      <div className="dash-switcher__inner">
        <div className="dash-switcher__badge">
          <Sparkles size={14} className="dash-switcher__sparkle" aria-hidden="true" />
          <span>Design Preview</span>
        </div>
        <div className="dash-switcher__tabs" role="tablist" aria-label="Dashboard style switch">
          <Button
            variant="none"
            role="tab"
            aria-selected={!isPreview}
            className={`dash-switcher__tab${!isPreview ? ' dash-switcher__tab--active' : ''}`}
            onClick={() => navigate(ROUTES.DASHBOARD)}
          >
            <LayoutGrid size={13} aria-hidden="true" />
            <span>Classic</span>
          </Button>
          <Button
            variant="none"
            role="tab"
            aria-selected={isPreview}
            className={`dash-switcher__tab${isPreview ? ' dash-switcher__tab--active' : ''}`}
            onClick={() => navigate('/dashboard/preview')}
          >
            <Sparkles size={13} aria-hidden="true" />
            <span>Modern Cred</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
