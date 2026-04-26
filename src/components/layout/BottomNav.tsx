import { createPortal } from 'react-dom'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, FileText, Users, Package, Plus } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { ROUTES } from '@/config/routes.config'
import { useLanguage } from '@/hooks/useLanguage'
import './BottomNav.css'

type IconType = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>

interface NavItem {
  to: string
  icon: IconType
  label: string
}

function NavTab({ to, icon: Icon, label }: NavItem) {
  return (
    <li className="bnav__cell">
      <NavLink
        to={to}
        end={to === ROUTES.DASHBOARD}
        className={({ isActive }) =>
          `bnav__tab${isActive ? ' bnav__tab--active' : ''}`
        }
        aria-label={label}
      >
        <span className="bnav__icon">
          <Icon size={22} aria-hidden="true" />
        </span>
        <span className="bnav__label">{label}</span>
      </NavLink>
    </li>
  )
}

export function BottomNav() {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const leftItems: readonly NavItem[] = [
    { to: ROUTES.DASHBOARD, icon: Home, label: t.dashboard ?? 'Home' },
    { to: ROUTES.INVOICES, icon: FileText, label: t.invoices },
  ]

  const rightItems: readonly NavItem[] = [
    { to: ROUTES.PRODUCTS, icon: Package, label: t.products },
    { to: ROUTES.PARTIES, icon: Users, label: t.parties },
  ]

  return createPortal(
    <>
      <nav className="bnav" aria-label="Main navigation">
        <ul className="bnav__items">
          {leftItems.map((item) => (
            <NavTab key={item.to} {...item} />
          ))}
          <li className="bnav__notch-gap" aria-hidden="true" />
          {rightItems.map((item) => (
            <NavTab key={item.to} {...item} />
          ))}
        </ul>
      </nav>
      <button
        type="button"
        className="bnav__fab"
        onClick={() => navigate(`${ROUTES.INVOICE_CREATE}?type=SALE`)}
        aria-label={t.createInvoice ?? 'Create new invoice'}
        title={t.createInvoice ?? 'Create new invoice'}
      >
        <Plus size={24} strokeWidth={2.75} aria-hidden="true" />
      </button>
    </>,
    document.body,
  )
}
