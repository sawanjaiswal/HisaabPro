/** Row / skeleton sub-components for StaffPermissionsPage. */
import { ChevronRight, Shield } from 'lucide-react'
import { PERMISSION_MODULES } from './permission.constants'
import { PermissionMatrix } from './components/PermissionMatrix'
import type { Role, StaffMember } from './settings.types'

const noop = () => undefined

export function totalPermissions(): number {
  return PERMISSION_MODULES.reduce((sum, m) => sum + m.actions.length, 0)
}

export function permissionLabel(count: number): string {
  return `${count}/${totalPermissions()} permissions`
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

interface RoleRowProps {
  role: Role
  isOpen: boolean
  onToggle: () => void
}

export function RoleRow({ role, isOpen, onToggle }: RoleRowProps) {
  return (
    <div className="sp-item">
      <button
        type="button"
        className="sp-item-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`sp-role-${role.id}`}
        aria-label={`${role.name}, ${permissionLabel(role.permissions.length)}`}
      >
        <span className="sp-item-avatar" aria-hidden="true">
          <Shield size={16} />
        </span>
        <span className="sp-item-info">
          <span className="sp-item-name">{role.name}</span>
          {role.staffCount > 0 && (
            <span className="sp-item-meta">{role.staffCount} staff member{role.staffCount !== 1 ? 's' : ''}</span>
          )}
        </span>
        <span className="sp-item-badge">{permissionLabel(role.permissions.length)}</span>
        <ChevronRight
          size={16}
          className={`sp-item-chevron${isOpen ? ' sp-item-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="sp-item-body" id={`sp-role-${role.id}`}>
          <PermissionMatrix
            modules={PERMISSION_MODULES}
            selectedPermissions={role.permissions}
            onToggle={noop}
            onToggleModuleAll={noop}
          />
        </div>
      )}
    </div>
  )
}

interface PersonRowProps {
  staff: StaffMember
  rolePermissions: string[]
  isOpen: boolean
  onToggle: () => void
}

export function PersonRow({ staff, rolePermissions, isOpen, onToggle }: PersonRowProps) {
  return (
    <div className="sp-item">
      <button
        type="button"
        className="sp-item-header"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`sp-person-${staff.id}`}
        aria-label={`${staff.name}, ${staff.role.name}, ${permissionLabel(rolePermissions.length)}`}
      >
        <span className="sp-item-avatar" aria-hidden="true">{initials(staff.name)}</span>
        <span className="sp-item-info">
          <span className="sp-item-name">{staff.name}</span>
          <span className="sp-item-meta">{staff.role.name}</span>
        </span>
        <span className="sp-item-badge">{permissionLabel(rolePermissions.length)}</span>
        <ChevronRight
          size={16}
          className={`sp-item-chevron${isOpen ? ' sp-item-chevron--open' : ''}`}
          aria-hidden="true"
        />
      </button>
      {isOpen && (
        <div className="sp-item-body" id={`sp-person-${staff.id}`}>
          <PermissionMatrix
            modules={PERMISSION_MODULES}
            selectedPermissions={rolePermissions}
            onToggle={noop}
            onToggleModuleAll={noop}
          />
        </div>
      )}
    </div>
  )
}

export function ListSkeleton() {
  return (
    <div className="sp-list" aria-busy="true" aria-label="Loading permissions">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`sp-sk-${i}`} className="sp-skeleton-item" />
      ))}
    </div>
  )
}
