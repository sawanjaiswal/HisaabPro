/** Settings — Roles list page (lazy loaded)
 *
 * Shows all roles for the business.
 * Clicking a card navigates to the edit page.
 * FAB navigates to role creation.
 * 4 UI states: loading / error / empty / success
 */

import { useNavigate } from 'react-router-dom'
import { Plus, Shield } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useRoles } from './useRoles'
import { RoleCard } from './components/RoleCard'
import './settings.css'

// TODO: get from auth context
const BUSINESS_ID = 'business_1'

function RolesListSkeleton() {
  return (
    <div className="roles-list" aria-busy="true" aria-label="Loading roles">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={`role-skeleton-${i}`} className="role-card" style={{ pointerEvents: 'none' }}>
          <Skeleton width="40px" height="40px" borderRadius="var(--radius-md)" />
          <span className="role-card-body">
            <Skeleton width="120px" height="0.9375rem" borderRadius="var(--radius-sm)" />
            <Skeleton
              width="200px"
              height="0.8125rem"
              borderRadius="var(--radius-sm)"
            />
            <Skeleton
              width="80px"
              height="0.8125rem"
              borderRadius="var(--radius-sm)"
            />
          </span>
        </div>
      ))}
    </div>
  )
}

export default function RolesPage() {
  const navigate = useNavigate()
  const { roles, status, refresh } = useRoles(BUSINESS_ID)

  function handleRoleClick(id: string) {
    navigate(ROUTES.SETTINGS_ROLE_EDIT.replace(':id', id))
  }

  return (
    <AppShell>
      <Header title="Roles" backTo={ROUTES.SETTINGS} />

      <PageContainer>
        <div className="roles-page">
          {status === 'loading' && <RolesListSkeleton />}

          {status === 'error' && (
            <ErrorState
              title="Could not load roles"
              message="Check your connection and try again."
              onRetry={refresh}
            />
          )}

          {status === 'success' && roles.length === 0 && (
            <EmptyState
              icon={<Shield size={40} aria-hidden="true" />}
              title="No custom roles"
              description="System roles are always available. Create a custom role to fine-tune staff permissions."
              action={
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => navigate(ROUTES.SETTINGS_ROLE_NEW)}
                  aria-label="Create first custom role"
                >
                  Create Role
                </button>
              }
            />
          )}

          {status === 'success' && roles.length > 0 && (
            <div className="roles-list" role="list" aria-label="Roles">
              {roles.map((role) => (
                <div key={role.id} role="listitem">
                  <RoleCard role={role} onClick={handleRoleClick} />
                </div>
              ))}
            </div>
          )}
        </div>
      </PageContainer>

      <button
        className="fab"
        onClick={() => navigate(ROUTES.SETTINGS_ROLE_NEW)}
        aria-label="Create new role"
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
