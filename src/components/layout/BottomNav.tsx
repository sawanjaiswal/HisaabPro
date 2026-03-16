import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, FileText, Package } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'

const NAV_ITEMS_LEFT = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.PARTIES, icon: Users, label: 'Parties' },
] as const

const NAV_ITEMS_RIGHT = [
  { to: ROUTES.INVOICES, icon: FileText, label: 'Invoices' },
  { to: ROUTES.PRODUCTS, icon: Package, label: 'Items' },
] as const

export function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {/* White bar with smooth wave notch — SVG path with bezier curves */}
      <div className="bottom-nav-bg" aria-hidden="true">
        <svg
          className="bottom-nav-svg"
          viewBox="0 0 375 90"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,0 H140 C148,0 152,6 158,16 C166,32 176,44 187.5,44 C199,44 209,32 217,16 C223,6 227,0 235,0 H375 V90 H0 Z"
            fill="white"
          />
        </svg>
      </div>

      {NAV_ITEMS_LEFT.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          aria-label={label}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}

      {/* Center FAB — lime circle with plus, sits above the notch */}
      <div className="bottom-nav-fab-wrapper">
        <button
          className="bottom-nav-fab"
          onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
          aria-label="Create new invoice"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {NAV_ITEMS_RIGHT.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          aria-label={label}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
