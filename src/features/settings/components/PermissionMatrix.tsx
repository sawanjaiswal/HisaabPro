import React, { useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { ChevronRight } from 'lucide-react'
import type { PermissionModule } from '../settings.types'
import { formatPermissionKey, getPermissionCount } from '../settings.utils'
import '../role-builder.css'
import { Switch } from '@/components/ui/Switch'

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
  const { t } = useLanguage()
  const [isOpen, setIsOpen] = useState(false)
  const { granted, total } = getPermissionCount(selectedPermissions, module.key, module.actions.length)
  const allGranted = granted === total

  return (
    <div className="role-module">
      <div
        className="role-module-header"
        onClick={() => setIsOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsOpen((prev) => !prev)
          }
        }}
        aria-expanded={isOpen}
        aria-controls={`module-content-${module.key}`}
        aria-label={`${module.label} ${t.moduleWord}, ${granted} ${t.ofWord} ${total} ${t.permissionsGranted}`}
      >
        <span className="role-module-name">{module.label}</span>
        <span className="role-module-count">{granted}/{total}</span>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={allGranted}
            onCheckedChange={() => onToggleModuleAll(module.key)}
            ariaLabel={`${t.toggleAllPrefix} ${module.label} ${t.toggleAllSuffix}`}
          />
        </div>
        <ChevronRight
          className={`role-module-chevron${isOpen ? ' role-module-chevron--open' : ''}`}
          size={16}
          aria-hidden="true"
        />
      </div>
      {isOpen && (
        <div
          className="role-module-content"
          id={`module-content-${module.key}`}
        >
          {module.actions.map((action) => {
            const permKey = formatPermissionKey(module.key, action.key)
            const isChecked = selectedPermissions.includes(permKey)
            return (
              <div
                key={permKey}
                className="role-permission-row"
                onClick={() => onToggle(permKey)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onToggle(permKey)
                  }
                }}
                aria-label={`${action.label}${action.description ? ': ' + action.description : ''}, ${isChecked ? t.enabledLabel : t.disabledLabel}`}
              >
                <span className="role-permission-label">
                  {action.label}
                  {action.description && (
                    <span className="role-permission-description">{action.description}</span>
                  )}
                </span>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={isChecked}
                    onCheckedChange={() => onToggle(permKey)}
                    ariaLabel={action.label}
                  />
                </div>
              </div>
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
