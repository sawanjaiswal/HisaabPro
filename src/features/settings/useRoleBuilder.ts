/** Settings — Role builder hooks
 *
 * useRoleBuilderPage — page-level: fetches role + system roles, manages fetch status
 * useRoleBuilder     — form-level: manages form state, validation, submit
 *
 * - togglePermission adds / removes a dot-key from the permissions array
 * - toggleModuleAll checks all if any are missing, unchecks all if all present
 * - cloneFromTemplate pre-loads permissions from a provided template Role
 * - handleSubmit calls createRole or updateRole and navigates on success
 *
 * businessId is passed as a parameter.
 */

import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { PERMISSION_MODULES } from './permission.constants'
import { formatPermissionKey } from './settings.utils'
import { createRole, updateRole, getRole, getRoles } from './role.service'
import { ApiError } from '@/lib/api'
import type { Role, RoleFormData } from './settings.types'

// ---- Page-level hook: fetch role + system roles ----

type FetchStatus = 'loading' | 'error' | 'not-found' | 'ready'

interface UseRoleBuilderPageOptions {
  roleId: string | undefined
  businessId: string
}

interface UseRoleBuilderPageReturn {
  fetchStatus: FetchStatus
  fetchError: string | null
  role: Role | undefined
  systemRoles: Role[]
  retry: () => void
}

export function useRoleBuilderPage({
  roleId,
  businessId,
}: UseRoleBuilderPageOptions): UseRoleBuilderPageReturn {
  const isEditMode = roleId !== undefined

  const [fetchStatus, setFetchStatus] = useState<FetchStatus>(isEditMode ? 'loading' : 'ready')
  const [role, setRole] = useState<Role | undefined>(undefined)
  const [systemRoles, setSystemRoles] = useState<Role[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)

  const load = useCallback(() => {
    const controller = new AbortController()

    if (!isEditMode) {
      setFetchStatus('ready')
      getRoles(businessId, controller.signal)
        .then((res) => setSystemRoles(res.data.roles.filter((r) => r.isSystem)))
        .catch(() => { /* templates are optional */ })
      return () => controller.abort()
    }

    setFetchStatus('loading')
    setFetchError(null)

    const rolesPromise = getRoles(businessId, controller.signal)
    const rolePromise = getRole(businessId, roleId!, controller.signal)

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
  }, [isEditMode, roleId, businessId])

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [load])

  return { fetchStatus, fetchError, role, systemRoles, retry: load }
}

// ---- Form-level hook: manages role form state, validation, submit ----

interface UseRoleBuilderOptions {
  businessId: string
  /** Provide for edit mode; omit for create mode */
  role?: Role
}

function buildInitialForm(role?: Role): RoleFormData {
  if (role !== undefined) {
    return { name: role.name, description: role.description ?? '', permissions: [...role.permissions], isDefault: role.isDefault }
  }
  return { name: '', description: '', permissions: [], isDefault: false }
}

function validate(form: RoleFormData): Record<string, string> {
  const errs: Record<string, string> = {}
  if (form.name.trim() === '') errs.name = 'Role name is required'
  if (form.permissions.length === 0) errs.permissions = 'Select at least one permission'
  return errs
}

/** Remove a specific key from the errors record (returns same ref if key absent). */
function clearError(prev: Record<string, string>, key: string): Record<string, string> {
  if (!prev[key]) return prev
  const next = { ...prev }
  delete next[key]
  return next
}

export function useRoleBuilder({
  businessId,
  role,
}: UseRoleBuilderOptions) {
  const navigate = useNavigate()
  const toast = useToast()
  const isEditMode = role !== undefined

  const [form, setForm] = useState<RoleFormData>(() => buildInitialForm(role))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = useCallback(<K extends keyof RoleFormData>(key: K, value: RoleFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => clearError(prev, key as string))
  }, [])

  const togglePermission = useCallback((key: string) => {
    setForm((prev) => {
      const has = prev.permissions.includes(key)
      const next = has ? prev.permissions.filter((p) => p !== key) : [...prev.permissions, key]
      return { ...prev, permissions: next }
    })
    setErrors((prev) => clearError(prev, 'permissions'))
  }, [])

  const toggleModuleAll = useCallback((moduleKey: string) => {
    const mod = PERMISSION_MODULES.find((m) => m.key === moduleKey)
    if (mod === undefined) return
    const allKeys = mod.actions.map((a) => formatPermissionKey(moduleKey, a.key))

    setForm((prev) => {
      const allChecked = allKeys.every((k) => prev.permissions.includes(k))
      if (allChecked) return { ...prev, permissions: prev.permissions.filter((p) => !p.startsWith(`${moduleKey}.`)) }
      const existing = new Set(prev.permissions)
      allKeys.forEach((k) => existing.add(k))
      return { ...prev, permissions: Array.from(existing) }
    })
    setErrors((prev) => clearError(prev, 'permissions'))
  }, [])

  const cloneFromTemplate = useCallback((templateRole: Role) => {
    setForm((prev) => ({ ...prev, permissions: [...templateRole.permissions] }))
    setErrors((prev) => clearError(prev, 'permissions'))
  }, [])

  const handleSubmit = useCallback(async () => {
    const validationErrors = validate(form)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return
    if (isSubmitting) return

    setIsSubmitting(true)

    const payload: RoleFormData = {
      ...form,
      name: form.name.trim(),
      description: form.description.trim(),
    }

    try {
      if (isEditMode && role !== undefined) {
        await updateRole(businessId, role.id, payload)
        toast.success('Role updated')
        navigate(ROUTES.SETTINGS_ROLES)
      } else {
        await createRole(businessId, payload)
        toast.success('Role created')
        navigate(ROUTES.SETTINGS_ROLES)
      }
    } catch {
      toast.error('Failed to save role. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [form, isSubmitting, isEditMode, role, businessId, toast, navigate])

  return {
    form,
    errors,
    isSubmitting,
    updateField,
    togglePermission,
    toggleModuleAll,
    cloneFromTemplate,
    handleSubmit,
  }
}
