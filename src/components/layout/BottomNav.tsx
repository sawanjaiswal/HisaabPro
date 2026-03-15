import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, Package, FileText, Settings } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'

const NAV_ITEMS = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.PARTIES, icon: Users, label: 'Parties' },
  { to: ROUTES.INVOICES, icon: FileText, label: 'Invoices' },
  { to: ROUTES.PRODUCTS, icon: Package, label: 'Items' },
  { to: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
] as const

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
          aria-label={label}
        >
          <Icon size={20} aria-hidden="true" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
