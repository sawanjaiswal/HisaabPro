import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { PermissionModule } from '../settings.types'
import { formatPermissionKey, getPermissionCount } from '../settings.utils'
import '../settings.css'

interface PermissionMatrixProps {
  modules: PermissionModule[]
  selectedPermissions: string[]
  onToggle: (key: string) => void
  onToggleModuleAll: (moduleKey: string) => void
}

interface ModuleRowProps {
  module: PermissionModule
  selectedPermissions: string[]
  onToggle: (key: string) => void
  onToggleModuleAll: (moduleKey: string) => void
}

const ModuleRow: React.FC<ModuleRowProps> = ({ module, selectedPermissions, onToggle, onToggleModuleAll }) => {
  const [isOpen, setIsOpen] = useState(false)
  const { granted, total } = getPermissionCount(selectedPermissions, module.key, module.actions.length)
  const allGranted = granted === total

  return (
    <div className="role-module">
      <button
        className="role-module-header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={`module-content-${module.key}`}
        aria-label={`${module.label} module, ${granted} of ${total} permissions granted`}
      >
        <span className="role-module-name">{module.label}</span>
        <span className="role-module-count">{granted}/{total}</span>
        <label
          className="settings-toggle"
          onClick={(e) => { e.stopPropagation(); onToggleModuleAll(module.key) }}
          aria-label={`Toggle all ${module.label} permissions`}
        >
          <input
            type="checkbox"
            checked={allGranted}
            onChange={() => onToggleModuleAll(module.key)}
            aria-label={`Toggle all ${module.label} permissions`}
          />
          <span className="settings-toggle-track" />
        </label>
        <ChevronRight
          className={`role-module-chevron${isOpen ? ' role-module-chevron--open' : ''}`}
          size={16}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div
          className="role-module-content"
          id={`module-content-${module.key}`}
        >
          {module.actions.map((action) => {
            const permKey = formatPermissionKey(module.key, action.key)
            const isChecked = selectedPermissions.includes(permKey)
            return (
              <button
                key={permKey}
                className="role-permission-row"
                onClick={() => onToggle(permKey)}
                aria-label={`${action.label}${action.description ? ': ' + action.description : ''}, ${isChecked ? 'enabled' : 'disabled'}`}
              >
                <span className="role-permission-label">
                  {action.label}
                  {action.description && (
                    <span className="role-permission-description">{action.description}</span>
                  )}
                </span>
                <label className="settings-toggle" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(permKey)}
                    aria-label={action.label}
                  />
                  <span className="settings-toggle-track" />
                </label>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export const PermissionMatrix: React.FC<PermissionMatrixProps> = ({
  modules,
  selectedPermissions,
  onToggle,
  onToggleModuleAll,
}) => {
  return (
    <div className="role-permission-matrix">
      {modules.map((module) => (
        <ModuleRow
          key={module.key}
          module={module}
          selectedPermissions={selectedPermissions}
          onToggle={onToggle}
          onToggleModuleAll={onToggleModuleAll}
        />
      ))}
    </div>
  )
}
