/** Settings — Role builder page (lazy loaded)
 *
 * Creates a new role or edits an existing one.
 * - If :id param present -> fetch role first, then render in edit mode
 * - Template pills (create mode only) clone permissions from system roles
 * - PermissionMatrix handles per-action toggles and module-level select-all
 * - Sticky save bar at bottom
 *
 * 4 UI states: loading / error / empty (role not found) / success (form ready)
 */

import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { FALLBACK_BUSINESS_ID } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { useRoleBuilder, useRoleBuilderPage } from './useRoleBuilder'
import { BuilderSkeleton } from './components/BuilderSkeleton'
import { RoleNameInput } from './components/RoleNameInput'
import { RoleDescriptionInput } from './components/RoleDescriptionInput'
import { RoleTemplatePills } from './components/RoleTemplatePills'
import { PermissionMatrix } from './components/PermissionMatrix'
import { RoleSaveBar } from './components/RoleSaveBar'
import { PERMISSION_MODULES } from './permission.constants'
import type { Role } from './settings.types'
import './role-builder.css'
import './settings-toggle.css'

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-gray-600)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

// ---- Inner form -- only rendered when role data is resolved ----

interface BuilderFormProps {
  roleId: string | undefined
  role: Role | undefined
  systemRoles: Role[]
  businessId: string
}

function BuilderForm({ roleId, role, systemRoles, businessId }: BuilderFormProps) {
  const isEditMode = roleId !== undefined

  const {
    form,
    errors,
    isSubmitting,
    updateField,
    togglePermission,
    toggleModuleAll,
    cloneFromTemplate,
    handleSubmit,
  } = useRoleBuilder({ businessId, role })

  return (
    <div className="role-builder">
      <RoleNameInput
        value={form.name}
        error={errors.name}
        onChange={(v) => updateField('name', v)}
      />

      <RoleDescriptionInput
        value={form.description}
        onChange={(v) => updateField('description', v)}
      />

      {!isEditMode && systemRoles.length > 0 && (
        <RoleTemplatePills
          systemRoles={systemRoles}
          onCloneTemplate={cloneFromTemplate}
          onClearPermissions={() => updateField('permissions', [])}
        />
      )}

      {/* Permission matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p style={LABEL_STYLE}>Permissions</p>
        {errors.permissions && (
          <p className="input-error" role="alert">
            {errors.permissions}
          </p>
        )}
        <PermissionMatrix
          modules={PERMISSION_MODULES}
          selectedPermissions={form.permissions}
          onToggle={togglePermission}
          onToggleModuleAll={toggleModuleAll}
        />
      </div>

      <RoleSaveBar
        isEditMode={isEditMode}
        isSubmitting={isSubmitting}
        onSave={() => { void handleSubmit() }}
      />
    </div>
  )
}

// ---- Page wrapper -- delegates fetch state to useRoleBuilderPage ----

export default function RoleBuilderPage() {
  const { id: roleId } = useParams<{ id: string }>()
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID

  const { fetchStatus, fetchError, role, systemRoles, retry } =
    useRoleBuilderPage({ roleId, businessId })

  const pageTitle = roleId !== undefined ? 'Edit Role' : 'Create Role'

  return (
    <AppShell>
      <Header title={pageTitle} backTo={ROUTES.SETTINGS_ROLES} />

      <PageContainer>
        {fetchStatus === 'loading' && <BuilderSkeleton />}

        {fetchStatus === 'error' && (
          <ErrorState
            title="Could not load role"
            message={fetchError ?? 'Check your connection and try again.'}
            onRetry={retry}
          />
        )}

        {fetchStatus === 'not-found' && (
          <ErrorState
            title="Role not found"
            message="This role may have been deleted."
          />
        )}

        {fetchStatus === 'ready' && (
          <BuilderForm
            roleId={roleId}
            role={role}
            systemRoles={systemRoles}
            businessId={businessId}
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
