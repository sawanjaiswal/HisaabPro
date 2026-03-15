/** Settings — Role builder page (lazy loaded)
 *
 * Creates a new role or edits an existing one.
 * - If :id param present → fetch role first, then render in edit mode
 * - Template pills (create mode only) clone permissions from system roles
 * - PermissionMatrix handles per-action toggles and module-level select-all
 * - Sticky save bar at bottom
 *
 * 4 UI states: loading / error / empty (role not found) / success (form ready)
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { ROUTES } from '@/config/routes.config'
import { useRoleBuilder } from './useRoleBuilder'
import { PermissionMatrix } from './components/PermissionMatrix'
import { PERMISSION_MODULES, SYSTEM_ROLE_NAMES } from './settings.constants'
import { getRole, getRoles } from './settings.service'
import { ApiError } from '@/lib/api'
import type { Role } from './settings.types'
import './settings.css'

// TODO: get from auth context
const BUSINESS_ID = 'business_1'

const TEMPLATE_NAMES = [...SYSTEM_ROLE_NAMES] as const

type FetchStatus = 'loading' | 'error' | 'not-found' | 'ready'

// ─── Form skeleton ────────────────────────────────────────────────────────────

function BuilderSkeleton() {
  return (
    <div className="role-builder" aria-busy="true" aria-label="Loading role">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton width="60px" height="0.75rem" borderRadius="var(--radius-sm)" />
        <Skeleton width="100%" height="44px" borderRadius="var(--radius-md)" />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <Skeleton width="80px" height="0.75rem" borderRadius="var(--radius-sm)" />
        <Skeleton width="100%" height="80px" borderRadius="var(--radius-md)" />
      </div>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={`mod-skel-${i}`} width="100%" height="52px" borderRadius="var(--radius-lg)" />
      ))}
    </div>
  )
}

// ─── Inner form — only rendered when role data is resolved ────────────────────

interface BuilderFormProps {
  roleId: string | undefined
  role: Role | undefined
  systemRoles: Role[]
}

function BuilderForm({ roleId, role, systemRoles }: BuilderFormProps) {
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
  } = useRoleBuilder({ businessId: BUSINESS_ID, role })

  return (
    <div className="role-builder">
      {/* Role name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label
          htmlFor="role-name"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-gray-600)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Role Name
        </label>
        <input
          id="role-name"
          type="text"
          className="input"
          placeholder="e.g. Senior Cashier"
          value={form.name}
          onChange={(e) => updateField('name', e.target.value)}
          aria-describedby={errors.name ? 'role-name-error' : undefined}
          aria-invalid={errors.name !== undefined}
          maxLength={80}
          autoComplete="off"
        />
        {errors.name && (
          <p id="role-name-error" className="input-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      {/* Description */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <label
          htmlFor="role-description"
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-gray-600)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Description{' '}
          <span style={{ fontWeight: 400, textTransform: 'none', color: 'var(--color-gray-400)' }}>
            (optional)
          </span>
        </label>
        <textarea
          id="role-description"
          className="input"
          placeholder="Describe what this role can do..."
          value={form.description}
          onChange={(e) => updateField('description', e.target.value)}
          rows={3}
          maxLength={200}
          style={{ resize: 'vertical', minHeight: '80px' }}
        />
      </div>

      {/* Template pills — create mode only */}
      {!isEditMode && systemRoles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <p
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'var(--color-gray-600)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Start from Template
          </p>
          <div className="role-template-pills">
            {TEMPLATE_NAMES.map((name) => {
              const templateRole = systemRoles.find((r) => r.name === name)
              return (
                <button
                  key={name}
                  type="button"
                  className="role-template-pill"
                  onClick={() => {
                    if (templateRole !== undefined) {
                      cloneFromTemplate(templateRole)
                    }
                  }}
                  disabled={templateRole === undefined}
                  aria-label={`Use ${name} template`}
                >
                  {name}
                </button>
              )
            })}
            <button
              type="button"
              className="role-template-pill"
              onClick={() => updateField('permissions', [])}
              aria-label="Start from blank — no permissions"
            >
              Blank
            </button>
          </div>
        </div>
      )}

      {/* Permission matrix */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <p
          style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-gray-600)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Permissions
        </p>
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

      {/* Sticky save bar */}
      <div className="role-save-bar">
        <button
          type="button"
          className="role-save-button"
          onClick={() => {
            // handleSubmit is async; fire-and-forget is safe — hook manages isSubmitting guard
            void handleSubmit()
          }}
          disabled={isSubmitting}
          aria-label={isEditMode ? 'Save role changes' : 'Create role'}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Save Role'}
        </button>
      </div>
    </div>
  )
}

// ─── Page wrapper — handles fetch state, then delegates to BuilderForm ────────

export default function RoleBuilderPage() {
  const { id: roleId } = useParams<{ id: string }>()
  const isEditMode = roleId !== undefined

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(isEditMode ? 'loading' : 'ready')
  const [role, setRole] = useState<Role | undefined>(undefined)
  const [systemRoles, setSystemRoles] = useState<Role[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch system roles for template pills + target role (edit mode only)
  const load = useCallback(() => {
    const controller = new AbortController()

    // Create mode: form is ready immediately, fetch templates in background
    if (!isEditMode) {
      setFetchStatus('ready')
      getRoles(BUSINESS_ID, controller.signal)
        .then((res) => setSystemRoles(res.data.roles.filter((r) => r.isSystem)))
        .catch(() => { /* templates are optional — form still works without them */ })
      return () => controller.abort()
    }

    // Edit mode: must fetch the role before showing form
    setFetchStatus('loading')
    setFetchError(null)

    const rolesPromise = getRoles(BUSINESS_ID, controller.signal)
    const rolePromise = getRole(BUSINESS_ID, roleId!, controller.signal)

    Promise.all([rolesPromise, rolePromise])
      .then(([rolesResponse, roleResponse]) => {
        setSystemRoles(rolesResponse.data.roles.filter((r) => r.isSystem))

        if (roleResponse === null || roleResponse.data.role === undefined) {
          setFetchStatus('not-found')
          return
        }
        setRole(roleResponse.data.role)
        setFetchStatus('ready')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        const message = err instanceof ApiError ? err.message : 'Failed to load role'
        setFetchError(message)
        setFetchStatus('error')
      })

    return () => controller.abort()
  }, [isEditMode, roleId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  const pageTitle = isEditMode ? 'Edit Role' : 'Create Role'

  return (
    <AppShell>
      <Header title={pageTitle} backTo={ROUTES.SETTINGS_ROLES} />

      <PageContainer>
        {fetchStatus === 'loading' && <BuilderSkeleton />}

        {fetchStatus === 'error' && (
          <ErrorState
            title="Could not load role"
            message={fetchError ?? 'Check your connection and try again.'}
            onRetry={load}
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
          />
        )}
      </PageContainer>
    </AppShell>
  )
}
