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
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/context/AuthContext'
import { useRoles } from './useRoles'
import { RoleCard } from './components/RoleCard'
import './roles.css'

function RolesListSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="roles-list" aria-busy="true" aria-label={t.loadingRolesLabel}>
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
  const { t } = useLanguage()
  const { user } = useAuth()
  const businessId = user?.businessId ?? ''
  const { roles, status, refresh } = useRoles(businessId)

  function handleRoleClick(id: string) {
    navigate(ROUTES.SETTINGS_ROLE_EDIT.replace(':id', id))
  }

  return (
    <AppShell>
      <Header title={t.roles} backTo={ROUTES.SETTINGS} />

      <PageContainer>
        <div className="roles-page">
          {status === 'loading' && <RolesListSkeleton />}

          {status === 'error' && (
            <ErrorState
              title={t.couldNotLoadRoles}
              message={t.checkConnectionRetry2}
              onRetry={refresh}
            />
          )}

          {status === 'success' && roles.length === 0 && (
            <EmptyState
              icon={<Shield size={40} aria-hidden="true" />}
              title={t.noCustomRoles}
              description={t.noCustomRolesDesc}
              action={
                <button
                  className="btn btn-primary btn-md"
                  onClick={() => navigate(ROUTES.SETTINGS_ROLE_NEW)}
                  aria-label={t.createFirstCustomRole}
                >
                  {t.createRole}
                </button>
              }
            />
          )}

          {status === 'success' && roles.length > 0 && (
            <div className="roles-list" role="list" aria-label={t.roles}>
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
        aria-label={t.createNewRole}
      >
        <Plus size={24} aria-hidden="true" />
      </button>
    </AppShell>
  )
}
