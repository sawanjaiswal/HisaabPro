/** SideNav — global full-width slide-in drawer
 *
 * Opened by the hamburger button in the shared <Header />, which fires the
 * OPEN_SIDE_NAV_EVENT. Contains identity, business switcher (multi-company),
 * theme/calculator/notifications quick-actions, full app menu, and logout.
 * Replaces the per-page MenuDrawer pattern.
 */

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { X, LogOut, Sun, Moon, Calculator, Bell, Check, Loader2, Plus } from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/config/routes.config'
import { CALCULATOR_TOGGLE_EVENT, OPEN_SIDE_NAV_EVENT } from '@/config/events.config'
import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from '@/features/more/more.constants'
import { ICON_REGISTRY } from '@/features/more/more.icons'
import { useVertical } from '@/hooks/useVertical'
import { isNavVisible } from '@/config/verticals.config'
import { getBusinessInitials, getBusinessColor } from '@/features/business/business.utils'
import { TenantChip } from '@/features/business/components/TenantChip'
import './side-nav.css'
import type React from 'react'

export function SideNav() {
  const navigate = useNavigate()
  const { user, businesses, activeBusiness, switchBusiness, isSwitching, switchingBusinessId, handleLogout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLanguage()
  const vertical = useVertical()
  const [open, setOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_SIDE_NAV_EVENT, handler)
    return () => window.removeEventListener(OPEN_SIDE_NAV_EVENT, handler)
  }, [])

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const close = () => setOpen(false)

  const handleNavigate = (route: string) => {
    navigate(route)
    close()
  }

  const handleSwitchBusiness = (id: string) => {
    if (id === user?.businessId) return
    void switchBusiness(id)
  }

  const handleAddBusiness = () => handleNavigate(ROUTES.CREATE_BUSINESS)

  const handleCalculator = () => {
    window.dispatchEvent(new Event(CALCULATOR_TOGGLE_EVENT))
    close()
  }

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

        {/* Phase 6 #138 PR2 — active tenant chip (suspend state visible at-a-glance). */}
        {activeBusiness && (
          <div className="side-nav-tenant-chip-row">
            <TenantChip business={activeBusiness} variant="full" />
          </div>
        )}

        <div className="side-nav-body">
          {/* Quick actions: theme, calculator, notifications */}
          <div className="side-nav-quick-row" role="group" aria-label="Quick actions">
            <button type="button" className="side-nav-quick" onClick={toggleTheme}>
              <span className="side-nav-quick-icon">
                {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
              </span>
              <span className="side-nav-quick-label">
                {theme === 'dark' ? t.switchToLight : t.switchToDark}
              </span>
            </button>
            <button type="button" className="side-nav-quick" onClick={handleCalculator}>
              <span className="side-nav-quick-icon">
                <Calculator size={20} aria-hidden="true" />
              </span>
              <span className="side-nav-quick-label">{t.calculator}</span>
            </button>
            <button type="button" className="side-nav-quick" onClick={close}>
              <span className="side-nav-quick-icon">
                <Bell size={20} aria-hidden="true" />
              </span>
              <span className="side-nav-quick-label">{t.notifications}</span>
            </button>
          </div>

          {/* Businesses */}
          {businesses.length > 0 && (
            <section className="side-nav-section">
              <h3 className="side-nav-section-title">Your Businesses</h3>
              <div className="side-nav-business-list">
                {businesses.map((biz) => {
                  const isActive = biz.id === user?.businessId
                  const isLoading = switchingBusinessId === biz.id
                  return (
                    <button
                      key={biz.id}
                      type="button"
                      className={`side-nav-business${isActive ? ' is-active' : ''}`}
                      onClick={() => handleSwitchBusiness(biz.id)}
                      disabled={isSwitching}
                      aria-pressed={isActive}
                    >
                      <span
                        className="side-nav-business-avatar"
                        style={{ background: getBusinessColor(biz.id) }}
                        aria-hidden="true"
                      >
                        {getBusinessInitials(biz.name)}
                      </span>
                      <span className="side-nav-business-info">
                        <span className="side-nav-business-name">{biz.name}</span>
                        {biz.role && <span className="side-nav-business-role">{biz.role}</span>}
                      </span>
                      <span className="side-nav-business-status" aria-hidden="true">
                        {isLoading ? <Loader2 size={18} className="side-nav-spin" />
                          : isActive ? <Check size={18} />
                          : null}
                      </span>
                    </button>
                  )
                })}
                <button
                  type="button"
                  className="side-nav-business side-nav-business--add"
                  onClick={handleAddBusiness}
                >
                  <span className="side-nav-business-avatar side-nav-business-avatar--ghost" aria-hidden="true">
                    <Plus size={20} />
                  </span>
                  <span className="side-nav-business-info">
                    <span className="side-nav-business-name">Add Business</span>
                  </span>
                </button>
              </div>
            </section>
          )}

          {/* Full app menu — filtered by active business vertical */}
          {MORE_MENU_GROUPS.map((group) => {
            const items = MORE_MENU_ITEMS.filter(
              (item) => item.group === group.id && isNavVisible(vertical, item.navKey),
            )
            if (items.length === 0) return null
            return (
              <section key={group.id} className="side-nav-section">
                <h3 className="side-nav-section-title">
                  <span aria-hidden="true">{group.emoji}</span>
                  {group.label}
                </h3>
                <div className="side-nav-grid">
                  {items.map((item) => {
                    const Icon = ICON_REGISTRY[item.icon]
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="side-nav-item"
                        onClick={() => handleNavigate(item.route)}
                        aria-label={item.label}
                      >
                        <div
                          className="side-nav-item-icon"
                          style={{ '--icon-bg': item.color } as React.CSSProperties}
                        >
                          {Icon && <Icon size={20} aria-hidden="true" />}
                        </div>
                        <span className="side-nav-item-label">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div className="side-nav-footer">
          <button
            type="button"
            className="side-nav-logout"
            onClick={() => setConfirmLogout(true)}
          >
            <LogOut size={18} aria-hidden="true" />
            {t.logout}
          </button>
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
