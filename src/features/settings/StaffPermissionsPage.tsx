/** Settings — Staff Permissions page
 *
 * Shows permissions "By Role" or "By Person".
 * Read-only PermissionMatrix — no-op handlers for toggle/toggleAll.
 * 4 UI states: loading / error / empty / success.
 */

import { useState, useEffect, useCallback } from 'react'
import { ChevronRight, Shield, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { PERMISSION_MODULES } from './permission.constants'
import { PermissionMatrix } from './components/PermissionMatrix'
import { getRoles } from './role.service'
import { getStaff } from './staff.service'
import type { Role } from './settings.types'
import type { StaffMember } from './settings.types'
import './staff-permissions.css'

// ─── Types ─────────────────────────────────────────────────────────────────

type Tab = 'role' | 'person'
type Status = 'loading' | 'error' | 'success'

// ─── No-op handlers for read-only PermissionMatrix ─────────────────────────

const noop = () => undefined

// ─── Helpers ───────────────────────────────────────────────────────────────

function totalPermissions(): number {
  return PERMISSION_MODULES.reduce((sum, m) => sum + m.actions.length, 0)
}

function permissionLabel(count: number): string {
  return `${count}/${totalPermissions()} permissions`
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

// ─── Sub-components ─────────────────────────────────────────────────────────

interface RoleRowProps {
  role: Role
  isOpen: boolean
  onToggle: () => void
}

function RoleRow({ role, isOpen, onToggle }: RoleRowProps) {
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

function PersonRow({ staff, rolePermissions, isOpen, onToggle }: PersonRowProps) {
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

// ─── Skeleton ───────────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="sp-list" aria-busy="true" aria-label="Loading permissions">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`sp-sk-${i}`} className="sp-skeleton-item" />
      ))}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function StaffPermissionsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const businessId = user?.businessId ?? ''

  const [tab, setTab] = useState<Tab>('role')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [roles, setRoles] = useState<Role[]>([])
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [status, setStatus] = useState<Status>('loading')
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!businessId) return
    const controller = new AbortController()
    setStatus('loading')
    setExpandedId(null)

    Promise.all([
      getRoles(businessId, controller.signal),
      getStaff(businessId, controller.signal),
    ])
      .then(([rolesRes, staffRes]) => {
        setRoles(rolesRes.data.roles)
        setStaff(staffRes.data.staff)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const message = err instanceof ApiError ? err.message : 'Failed to load permissions'
        toast.error(message)
      })

    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build a map of roleId → permissions for fast lookup in By Person view
  const rolePermissionsMap = new Map<string, string[]>(
    roles.map((r) => [r.id, r.permissions])
  )

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <AppShell>
      <Header title="Permissions" backTo={ROUTES.SETTINGS} />

      <PageContainer>
        <div className="sp-page stagger-enter">

          {/* Segmented toggle */}
          <div className="sp-toggle" role="tablist" aria-label="View permissions by">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'role'}
              className={`sp-toggle-btn${tab === 'role' ? ' sp-toggle-btn--active' : ''}`}
              onClick={() => { setTab('role'); setExpandedId(null) }}
            >
              By Role
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'person'}
              className={`sp-toggle-btn${tab === 'person' ? ' sp-toggle-btn--active' : ''}`}
              onClick={() => { setTab('person'); setExpandedId(null) }}
            >
              By Person
            </button>
          </div>

          {/* Loading */}
          {status === 'loading' && <ListSkeleton />}

          {/* Error */}
          {status === 'error' && (
            <ErrorState
              title="Could not load permissions"
              message="Check your connection and try again."
              onRetry={refresh}
            />
          )}

          {/* By Role */}
          {status === 'success' && tab === 'role' && (
            roles.length === 0 ? (
              <EmptyState
                icon={<Shield size={40} aria-hidden="true" />}
                title="No roles found"
                description="Create a role first to view its permissions."
              />
            ) : (
              <div className="sp-list stagger-list" role="list" aria-label="Roles">
                {roles.map((role) => (
                  <div key={role.id} role="listitem">
                    <RoleRow
                      role={role}
                      isOpen={expandedId === role.id}
                      onToggle={() => toggleExpand(role.id)}
                    />
                  </div>
                ))}
              </div>
            )
          )}

          {/* By Person */}
          {status === 'success' && tab === 'person' && (
            staff.length === 0 ? (
              <EmptyState
                icon={<Users size={40} aria-hidden="true" />}
                title="No staff members"
                description="Invite a team member to see their permissions here."
              />
            ) : (
              <div className="sp-list stagger-list" role="list" aria-label="Staff members">
                {staff.map((member) => (
                  <div key={member.id} role="listitem">
                    <PersonRow
                      staff={member}
                      rolePermissions={rolePermissionsMap.get(member.role.id) ?? []}
                      isOpen={expandedId === member.id}
                      onToggle={() => toggleExpand(member.id)}
                    />
                  </div>
                ))}
              </div>
            )
          )}

        </div>
      </PageContainer>
    </AppShell>
  )
}
