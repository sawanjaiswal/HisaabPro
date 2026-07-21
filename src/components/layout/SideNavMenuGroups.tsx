/**
 * SideNav — the full app menu, grouped and filtered by the active business
 * vertical. A group with no visible items renders nothing rather than an
 * empty heading.
 */

import { MORE_MENU_ITEMS, MORE_MENU_GROUPS } from '@/features/more/more.constants'
import { ICON_REGISTRY } from '@/features/more/more.icons'
import { useVertical } from '@/hooks/useVertical'
import { isNavVisible } from '@/config/verticals.config'
import type React from 'react'

interface Props {
  onNavigate: (route: string) => void
}

export function SideNavMenuGroups({ onNavigate }: Props) {
  const vertical = useVertical()

  return (
    <>
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
                    onClick={() => onNavigate(item.route)}
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
    </>
  )
}
