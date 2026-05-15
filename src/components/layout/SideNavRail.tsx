/**
 * SideNavRail — persistent left navigation rail at ≥1024px.
 *
 * Mounted alongside <BottomNav /> (which hides ≥lg) so desktop gets a
 * sticky vertical nav. Content mirrors the drawer SideNav: identity,
 * business switcher, theme toggle, menu items, logout.
 *
 * Visibility:
 *   <lg : `display: none` via CSS (see side-nav-rail.css)
 *   ≥lg : fixed left rail, `--side-nav-width` wide, full height
 *
 * Stays width-stable across page navigation so the main column never reflows.
 */

import { useState } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { LogOut, Sun, Moon } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { APP_NAME } from '@/config/app.config'
import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from '@/features/more/more.constants'
import { ICON_REGISTRY } from '@/features/more/more.icons'
import { useVertical } from '@/hooks/useVertical'
import { isNavVisible } from '@/config/verticals.config'
import { getBusinessInitials, getBusinessColor } from '@/features/business/business.utils'
import './side-nav-rail.css'

export function SideNavRail() {
  const navigate = useNavigate()
  const { user, businesses, switchBusiness, isSwitching, handleLogout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const vertical = useVertical()
  const [confirmLogout, setConfirmLogout] = useState(false)

  const handleSwitchBusiness = (id: string) => {
    if (id === user?.businessId) return
    void switchBusiness(id)
  }

  return (
    <aside className="side-nav-rail" aria-label={t.menu}>
      <button
        type="button"
        className="side-nav-rail__brand"
        onClick={() => navigate(ROUTES.DASHBOARD)}
        aria-label={`${APP_NAME} home`}
      >
        <img src="/favicon.svg" alt="" className="side-nav-rail__brand-logo" width={28} height={28} aria-hidden="true" />
        <span className="side-nav-rail__brand-name">{APP_NAME}</span>
      </button>

      <div className="side-nav-rail__body">
        {/* Business switcher — compact at rail width */}
        {businesses.length > 0 && (
          <section className="side-nav-rail__section">
            <h3 className="side-nav-rail__section-title">{t.yourBusinesses ?? 'Businesses'}</h3>
            <div className="side-nav-rail__biz-list">
              {businesses.map((biz) => {
                const isActive = biz.id === user?.businessId
                return (
                  <button
                    key={biz.id}
                    type="button"
                    className={`side-nav-rail__biz${isActive ? ' is-active' : ''}`}
                    onClick={() => handleSwitchBusiness(biz.id)}
                    disabled={isSwitching}
                    aria-pressed={isActive}
                  >
                    <span
                      className="side-nav-rail__biz-avatar"
                      style={{ background: getBusinessColor(biz.id) }}
                      aria-hidden="true"
                    >
                      {getBusinessInitials(biz.name)}
                    </span>
                    <span className="side-nav-rail__biz-name">{biz.name}</span>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Menu groups */}
        {MORE_MENU_GROUPS.map((group) => {
          const items = MORE_MENU_ITEMS.filter(
            (item) => item.group === group.id && isNavVisible(vertical, item.navKey),
          )
          if (items.length === 0) return null
          return (
            <section key={group.id} className="side-nav-rail__section">
              <h3 className="side-nav-rail__section-title">
                <span aria-hidden="true">{group.emoji}</span>
                {group.label}
              </h3>
              <ul className="side-nav-rail__menu">
                {items.map((item) => {
                  const Icon = ICON_REGISTRY[item.icon]
                  return (
                    <li key={item.id}>
                      <NavLink
                        to={item.route}
                        className={({ isActive }) =>
                          `side-nav-rail__link${isActive ? ' is-active' : ''}`
                        }
                      >
                        {Icon && <Icon size={18} aria-hidden="true" className="side-nav-rail__link-icon" />}
                        <span className="side-nav-rail__link-label">{item.label}</span>
                      </NavLink>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="side-nav-rail__footer">
        <button type="button" className="side-nav-rail__footer-btn" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          <span>{theme === 'dark' ? t.switchToLight : t.switchToDark}</span>
        </button>
        <button
          type="button"
          className="side-nav-rail__footer-btn side-nav-rail__footer-btn--logout"
          onClick={() => setConfirmLogout(true)}
        >
          <LogOut size={18} aria-hidden="true" />
          <span>{t.logout}</span>
        </button>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); handleLogout() }}
        title={t.logout}
        description={t.signOutConfirm}
        confirmLabel={t.logout}
      />
    </aside>
  )
}
