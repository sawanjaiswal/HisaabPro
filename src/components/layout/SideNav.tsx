/** SideNav — global full-width slide-in drawer
 *
 * Opened by the hamburger button in the shared <Header />, which fires the
 * OPEN_SIDE_NAV_EVENT. Contains identity, business switcher (multi-company),
 * theme/calculator/notifications quick-actions, full app menu, and logout.
 * Replaces the per-page MenuDrawer pattern.
 *
 * State lives in `useSideNav`; the switcher and app menu are their own
 * components — this file is the drawer shell.
 */

import { createPortal } from 'react-dom'
import { X, LogOut, Sun, Moon, Calculator, Bell } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { TenantChip } from '@/features/business/components/TenantChip'
import { SideNavBusinessSwitcher } from './SideNavBusinessSwitcher'
import { SideNavMenuGroups } from './SideNavMenuGroups'
import { useSideNav } from './useSideNav'
import './side-nav.css'

export function SideNav() {
  const { user, activeBusiness, handleLogout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const {
    open, close, closeRef,
    confirmLogout, setConfirmLogout,
    handleNavigate, handleCalculator,
  } = useSideNav()

  if (!open) return null

  return createPortal(
    <div className="side-nav-root" role="dialog" aria-modal="true" aria-label={t.menu}>
      <div className="side-nav-backdrop" onClick={close} aria-hidden="true" />

      <div className="side-nav-panel">
        <div className="side-nav-header">
          <div className="side-nav-identity">
            <span className="side-nav-greeting">{t.menu}</span>
            {user?.name && <span className="side-nav-user">{user.name}</span>}
          </div>
          <div className="side-nav-header-actions">
            <button
              type="button"
              className="side-nav-icon-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t.switchToLight : t.switchToDark}
              title={theme === 'dark' ? t.switchToLight : t.switchToDark}
            >
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="side-nav-icon-btn"
              onClick={handleCalculator}
              aria-label={t.calculator}
              title={t.calculator}
            >
              <Calculator size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="side-nav-icon-btn"
              onClick={close}
              aria-label={t.notifications}
              title={t.notifications}
            >
              <Bell size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="side-nav-close"
              onClick={close}
              aria-label={t.closeMenu}
              ref={closeRef}
            >
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Phase 6 #138 PR2 — active tenant chip (suspend state visible at-a-glance). */}
        {activeBusiness && (
          <div className="side-nav-tenant-chip-row">
            <TenantChip business={activeBusiness} variant="full" />
          </div>
        )}

        <div className="side-nav-body">
          <SideNavBusinessSwitcher onNavigate={handleNavigate} />
          <SideNavMenuGroups onNavigate={handleNavigate} />

          <div className="side-nav-footer">
            <div className="side-nav-grid">
              <button
                type="button"
                className="side-nav-item side-nav-item--logout"
                onClick={() => setConfirmLogout(true)}
                aria-label={t.logout}
              >
                <div className="side-nav-item-icon side-nav-item-icon--logout">
                  <LogOut size={20} aria-hidden="true" />
                </div>
                <span className="side-nav-item-label">{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); close(); handleLogout() }}
        title={t.logout}
        description={t.signOutConfirm}
        confirmLabel={t.logout}
      />
    </div>,
    document.body,
  )
}
