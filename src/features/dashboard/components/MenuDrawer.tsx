import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, LogOut } from 'lucide-react'
import { createPortal } from 'react-dom'
import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from '@/features/more/more.constants'
import { ICON_REGISTRY } from '@/features/more/more.icons'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/context/AuthContext'
import type React from 'react'
import './MenuDrawer.css'

interface MenuDrawerProps {
  open: boolean
  onClose: () => void
}

export function MenuDrawer({ open, onClose }: MenuDrawerProps) {
  const navigate = useNavigate()
  const { handleLogout } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)

  // Focus the close button when drawer opens
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleNavigate = (route: string) => {
    navigate(route)
    onClose()
  }

  const handleSignOut = () => setConfirmLogout(true)

  if (!open) return null

  return createPortal(
    <div className="menu-drawer-root" role="dialog" aria-modal="true" aria-label="Menu">
      {/* Backdrop */}
      <div className="menu-drawer-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Panel slides in from right */}
      <div className="menu-drawer-panel" ref={panelRef}>
        <div className="menu-drawer-header">
          <span className="menu-drawer-title">Menu</span>
          <button type="button" className="menu-drawer-close" onClick={onClose} aria-label="Close menu" ref={closeRef}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="menu-drawer-body">
          {MORE_MENU_GROUPS.map((group) => {
            const items = MORE_MENU_ITEMS.filter((item) => item.group === group.id)
            if (items.length === 0) return null
            return (
              <section key={group.id} className="menu-drawer-section">
                <h3 className="menu-drawer-section-title">
                  <span aria-hidden="true">{group.emoji}</span>
                  {group.label}
                </h3>
                <div className="menu-drawer-grid">
                  {items.map((item) => {
                    const Icon = ICON_REGISTRY[item.icon]
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className="menu-drawer-item"
                        onClick={() => handleNavigate(item.route)}
                        aria-label={item.label}
                      >
                        <div
                          className="menu-drawer-item-icon"
                          style={{ '--icon-bg': item.color } as React.CSSProperties}
                        >
                          {Icon && <Icon size={20} aria-hidden="true" />}
                        </div>
                        <span className="menu-drawer-item-label">{item.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>

        <div className="menu-drawer-footer">
          <button type="button" className="menu-drawer-logout" onClick={handleSignOut}>
            <LogOut size={18} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); onClose(); handleLogout() }}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
      />
    </div>,
    document.body,
  )
}
