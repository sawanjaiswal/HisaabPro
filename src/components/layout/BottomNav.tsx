import { NavLink, useNavigate } from 'react-router-dom'
import { Home, FileText, Users, Settings, MoreHorizontal, Plus } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: Home, label: 'Home' },
  { to: ROUTES.INVOICES, icon: FileText, label: 'Invoices' },
  { to: ROUTES.PARTIES, icon: Users, label: 'Parties' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
  { to: ROUTES.MORE, icon: MoreHorizontal, label: 'More' },
] as const

export function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav-modern" aria-label="Main navigation">
      {/* Left navigation items */}
      <div className="bottom-nav-modern__items bottom-nav-modern__items--left">
        {NAV_ITEMS.slice(0, 2).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav-modern__item ${isActive ? 'bottom-nav-modern__item--active' : ''}`}
            aria-label={label}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="bottom-nav-modern__label">{label}</span>
          </NavLink>
        ))}
      </div>

      {/* Center FAB */}
      <div className="bottom-nav-modern__fab-container">
        <button
          className="bottom-nav-modern__fab"
          onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
          aria-label="Create new invoice"
          title="Create new invoice"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Right navigation items */}
      <div className="bottom-nav-modern__items bottom-nav-modern__items--right">
        {NAV_ITEMS.slice(2).map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav-modern__item ${isActive ? 'bottom-nav-modern__item--active' : ''}`}
            aria-label={label}
          >
            <Icon size={20} aria-hidden="true" />
            <span className="bottom-nav-modern__label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
