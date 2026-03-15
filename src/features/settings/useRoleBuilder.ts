/** Settings — Role builder form hook
 *
 * Handles create / edit form for a custom role.
 * - togglePermission adds / removes a dot-key from the permissions array
 * - toggleModuleAll checks all if any are missing, unchecks all if all present
 * - cloneFromTemplate pre-loads permissions from a provided template Role
 * - handleSubmit calls createRole or updateRole and navigates on success
 *
 * businessId is passed as a parameter.
 */

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { PERMISSION_MODULES } from './settings.constants'
import { formatPermissionKey } from './settings.utils'
import { createRole, updateRole } from './settings.service'
import type { Role, RoleFormData } from './settings.types'

interface UseRoleBuilderOptions {
  businessId: string
  /** Provide for edit mode; omit for create mode */
  role?: Role
}

interface UseRoleBuilderReturn {
  form: RoleFormData
  errors: Record<string, string>
  isSubmitting: boolean
  updateField: <K extends keyof RoleFormData>(key: K, value: RoleFormData[K]) => void
  togglePermission: (key: string) => void
  toggleModuleAll: (moduleKey: string) => void
  cloneFromTemplate: (templateRole: Role) => void
  handleSubmit: () => Promise<void>
}

function buildInitialForm(role?: Role): RoleFormData {
  if (role !== undefined) {
    return {
      name: role.name,
      description: role.description ?? '',
      permissions: [...role.permissions],
      isDefault: role.isDefault,
    }
  }
  return {
    name: '',
    description: '',
    permissions: [],
    isDefault: false,
  }
}

function validate(form: RoleFormData): Record<string, string> {
  const errors: Record<string, string> = {}
  if (form.name.trim() === '') {
    errors.name = 'Role name is required'
  }
  if (form.permissions.length === 0) {
    errors.permissions = 'Select at least one permission'
  }
  return errors
}

export function useRoleBuilder({
  businessId,
  role,
}: UseRoleBuilderOptions): UseRoleBuilderReturn {
  const navigate = useNavigate()
  const toast = useToast()

  const isEditMode = role !== undefined

  const [form, setForm] = useState<RoleFormData>(() => buildInitialForm(role))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const updateField = useCallback(<K extends keyof RoleFormData>(
    key: K,
    value: RoleFormData[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!prev[key as string]) return prev
      const next = { ...prev }
      delete next[key as string]
      return next
    })
  }, [])

  const togglePermission = useCallback((key: string) => {
    setForm((prev) => {
      const has = prev.permissions.includes(key)
      const next = has
        ? prev.permissions.filter((p) => p !== key)
        : [...prev.permissions, key]
      return { ...prev, permissions: next }
    })
    // Clear permissions error on any change
    setErrors((prev) => {
      if (!prev.permissions) return prev
      const next = { ...prev }
      delete next.permissions
      return next
    })
  }, [])

  const toggleModuleAll = useCallback((moduleKey: string) => {
    const module = PERMISSION_MODULES.find((m) => m.key === moduleKey)
    if (module === undefined) return

    const allKeys = module.actions.map((a) => formatPermissionKey(moduleKey, a.key))

    setForm((prev) => {
      const allChecked = allKeys.every((k) => prev.permissions.includes(k))
      let updated: string[]
      if (allChecked) {
        // Uncheck all actions for this module
        updated = prev.permissions.filter((p) => !p.startsWith(`${moduleKey}.`))
      } else {
        // Add any missing actions for this module
        const existing = new Set(prev.permissions)
        allKeys.forEach((k) => existing.add(k))
        updated = Array.from(existing)
      }
      return { ...prev, permissions: updated }
    })
    setErrors((prev) => {
      if (!prev.permissions) return prev
      const next = { ...prev }
      delete next.permissions
      return next
    })
  }, [])

  const cloneFromTemplate = useCallback((templateRole: Role) => {
    setForm((prev) => ({
      ...prev,
      permissions: [...templateRole.permissions],
    }))
    setErrors((prev) => {
      if (!prev.permissions) return prev
      const next = { ...prev }
      delete next.permissions
      return next
    })
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
