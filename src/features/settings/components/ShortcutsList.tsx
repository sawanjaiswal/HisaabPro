import React from 'react'
import type { ShortcutConfig } from '../settings.types'
import { formatShortcutKey } from '../settings.utils'
import '../settings.css'

interface ShortcutsListProps {
  shortcuts: Record<string, ShortcutConfig>
  groups: Array<{ id: string; label: string }>
}

export const ShortcutsList: React.FC<ShortcutsListProps> = ({ shortcuts, groups }) => {
  return (
    <div className="shortcuts-page">
      {groups.map((group) => {
        const groupShortcuts = Object.entries(shortcuts).filter(([key]) =>
          key.startsWith(`${group.id}.`)
        )

        if (groupShortcuts.length === 0) return null

        return (
          <section key={group.id} aria-labelledby={`shortcut-group-${group.id}`}>
            <p className="shortcuts-group-title" id={`shortcut-group-${group.id}`}>
              {group.label}
            </p>
            <div className="shortcuts-list" role="list">
              {groupShortcuts.map(([key, config]) => {
                const parts = formatShortcutKey(config).split(' + ')
                return (
                  <div key={key} className="shortcut-row" role="listitem">
                    <span className="shortcut-label">{config.label}</span>
                    <span className="shortcut-keys" aria-label={formatShortcutKey(config)}>
                      {parts.map((part, index) => (
                        <React.Fragment key={`${key}-part-${part}`}>
                          {index > 0 && (
                            <span className="shortcut-plus" aria-hidden="true">+</span>
                          )}
                          <kbd className="shortcut-key">{part}</kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
