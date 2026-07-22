/** Settings — Staff Permissions (read-only view by role or by person). */
import { useState, useEffect, useCallback } from 'react'
import { Shield, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { HeroPage } from '@/components/layout/HeroPage'
import { ErrorState } from '@/components/feedback/ErrorState'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ROUTES } from '@/config/routes.config'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import { getRoles } from './role.service'
import { getStaff } from './staff.service'
import type { Role, StaffMember } from './settings.types'
import { RoleRow, PersonRow, ListSkeleton } from './StaffPermissionsPage.parts'
import './staff-permissions.css'
import { Button } from '@/components/ui/Button'

type Tab = 'role' | 'person'
type Status = 'loading' | 'error' | 'success'

export default function StaffPermissionsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
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
        const message = err instanceof ApiError ? err.message : (t.failedLoadPermissions as string)
        toast.error(message)
      })
    return () => controller.abort()
  }, [businessId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const rolePermissionsMap = new Map<string, string[]>(
    roles.map((r) => [r.id, r.permissions])
  )

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <AppShell>
      <Header title={t.permissions as string} backTo={ROUTES.SETTINGS} />
      <HeroPage>
        <div className="sp-page stagger-enter space-y-6">
          <div className="sp-toggle" role="tablist" aria-label={t.viewPermissionsBy as string}>
            <Button variant="none"
              type="button"
              role="tab"
              aria-selected={tab === 'role'}
              className={`sp-toggle-btn${tab === 'role' ? ' sp-toggle-btn--active' : ''}`}
              onClick={() => { setTab('role'); setExpandedId(null) }}
            >
              {t.byRole as string}
            </Button>
            <Button variant="none"
              type="button"
              role="tab"
              aria-selected={tab === 'person'}
              className={`sp-toggle-btn${tab === 'person' ? ' sp-toggle-btn--active' : ''}`}
              onClick={() => { setTab('person'); setExpandedId(null) }}
            >
              {t.byPerson as string}
            </Button>
          </div>

          {status === 'loading' && <ListSkeleton />}

          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadPermissions as string}
              message={t.checkConnectionRetry2 as string}
              onRetry={refresh}
            />
          )}

          {status === 'success' && tab === 'role' && (
            roles.length === 0 ? (
              <EmptyState
                icon={<Shield size={40} aria-hidden="true" />}
                title={t.noRolesFound as string}
                description={t.createRoleFirstDesc as string}
              />
            ) : (
              <div className="sp-list stagger-list" role="list" aria-label={t.roles as string}>
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

          {status === 'success' && tab === 'person' && (
            staff.length === 0 ? (
              <EmptyState
                icon={<Users size={40} aria-hidden="true" />}
                title={t.noStaffMembers as string}
                description={t.inviteTeamMemberDesc as string}
              />
            ) : (
              <div className="sp-list stagger-list" role="list" aria-label={t.staffMembersLabel as string}>
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
      </HeroPage>
    </AppShell>
  )
}
