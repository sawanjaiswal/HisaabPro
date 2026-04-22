import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Home, FileText, Users, Settings, MoreHorizontal } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'
import './bottom-nav.css'

interface NavItem {
  label: string
  icon: React.ReactNode
  route: string
  testId: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: <Home size={20} />, route: ROUTES.DASHBOARD, testId: 'nav-dashboard' },
  { label: 'Invoices', icon: <FileText size={20} />, route: ROUTES.INVOICES, testId: 'nav-invoices' },
  { label: 'Parties', icon: <Users size={20} />, route: ROUTES.PARTIES, testId: 'nav-parties' },
  { label: 'Settings', icon: <Settings size={20} />, route: ROUTES.SETTINGS, testId: 'nav-settings' },
  { label: 'More', icon: <MoreHorizontal size={20} />, route: ROUTES.MORE, testId: 'nav-more' },
]

export function BottomNavigation() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (route: string) => {
    if (route === ROUTES.DASHBOARD) return location.pathname === route
    return location.pathname.startsWith(route)
  }

  const handleNavClick = (route: string) => {
    navigate(route)
  }

  return (
    <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
      <div className="bottom-nav__items">
        {NAV_ITEMS.slice(0, 2).map((item) => (
          <button
            key={item.testId}
            onClick={() => handleNavClick(item.route)}
            className={`bottom-nav__item ${isActive(item.route) ? 'bottom-nav__item--active' : ''}`}
            aria-label={item.label}
            aria-current={isActive(item.route) ? 'page' : undefined}
            data-testid={item.testId}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Floating Action Button - Center */}
      <div className="bottom-nav__fab-container">
        <button
          className="bottom-nav__fab"
          onClick={() => navigate(ROUTES.INVOICE_CREATE)}
          aria-label="Create new invoice"
          title="Create new invoice"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="bottom-nav__items">
        {NAV_ITEMS.slice(2).map((item) => (
          <button
            key={item.testId}
            onClick={() => handleNavClick(item.route)}
            className={`bottom-nav__item ${isActive(item.route) ? 'bottom-nav__item--active' : ''}`}
            aria-label={item.label}
            aria-current={isActive(item.route) ? 'page' : undefined}
            data-testid={item.testId}
          >
            <span className="bottom-nav__icon">{item.icon}</span>
            <span className="bottom-nav__label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
