import { NavLink, useNavigate } from 'react-router-dom'
import { useRef, useState, useEffect } from 'react'
import { LayoutDashboard, Users, FileText, MoreHorizontal } from 'lucide-react'
import { ROUTES } from '@/config/routes.config'

const NAV_ITEMS_LEFT = [
  { to: ROUTES.DASHBOARD, icon: LayoutDashboard, label: 'Home' },
  { to: ROUTES.PARTIES, icon: Users, label: 'Parties' },
] as const

const NAV_ITEMS_RIGHT = [
  { to: ROUTES.INVOICES, icon: FileText, label: 'Invoices' },
  { to: ROUTES.MORE, icon: MoreHorizontal, label: 'More' },
] as const

/** Build the nav bar path with a fixed 80px-wide notch centered horizontally */
function buildNotchPath(w: number, h: number): string {
  const cx = w / 2
  const notch = 40 // half of 80px notch width
  const depth = 34 // how deep the curve dips

  const left = cx - notch
  const right = cx + notch

  return [
    `M0,0`,
    `H${left}`,
    `C${left + 6},0 ${left + 9},4 ${left + 13},12`,
    `C${left + 19},24 ${left + 27},${depth} ${cx},${depth}`,
    `C${right - 27},${depth} ${right - 19},24 ${right - 13},12`,
    `C${right - 9},4 ${right - 6},0 ${right},0`,
    `H${w}`,
    `V${h} H0 Z`,
  ].join(' ')
}

export function BottomNav() {
  const navigate = useNavigate()
  const navRef = useRef<HTMLElement>(null)
  const [dims, setDims] = useState({ w: 375, h: 72 })

  useEffect(() => {
    function measure() {
      if (!navRef.current) return
      const { width, height } = navRef.current.getBoundingClientRect()
      setDims({ w: Math.round(width), h: Math.round(height) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  return (
    <nav ref={navRef} className="bottom-nav" aria-label="Main navigation">
      {/* White bar with fixed-size wave notch */}
      <div className="bottom-nav-bg" aria-hidden="true">
        <svg
          className="bottom-nav-svg"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            className="bottom-nav-svg-path"
            d={buildNotchPath(dims.w, dims.h)}
          />
        </svg>
      </div>

      {NAV_ITEMS_LEFT.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
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
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {NAV_ITEMS_RIGHT.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon size={22} aria-hidden="true" />
          <span className="bottom-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
