import { useState, useEffect, useRef, useCallback } from 'react'
import { FALLBACK_BUSINESS_ID, APP_NAME } from '@/config/app.config'
import { useAuth } from '@/context/AuthContext'
import { inviteStaff } from './staff.service'
import { getRoles } from './role.service'
import { ApiError } from '@/lib/api'
import type { Role, InviteStaffData } from './settings.types'

interface FormErrors {
  name?: string
  phone?: string
  roleId?: string
}

interface SuccessState {
  code: string
  staffName: string
  staffPhone: string
}

export function useStaffInvite() {
  const { user } = useAuth()
  const businessId = user?.businessId ?? FALLBACK_BUSINESS_ID

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [roleId, setRoleId] = useState('')
  const [roles, setRoles] = useState<Role[]>([])
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)
  const submitGuard = useRef(false)

  useEffect(() => {
    const controller = new AbortController()

    getRoles(businessId, controller.signal)
      .then((res) => setRoles(res.data.roles))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        // Non-fatal: form will show empty dropdown
      })

    return () => controller.abort()
  }, [businessId])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!/^\d{10}$/.test(phone.trim())) errs.phone = 'Enter a valid 10-digit phone number'
    if (!roleId) errs.roleId = 'Please select a role'
    return errs
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitGuard.current) return

    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    submitGuard.current = true
    setSubmitting(true)
    setSubmitError(null)

    const data: InviteStaffData = { name: name.trim(), phone: phone.trim(), roleId }

    try {
      const res = await inviteStaff(businessId, data)
      setSuccess({
        code: res.data.invite.code,
        staffName: res.data.invite.staffName,
        staffPhone: res.data.invite.staffPhone,
      })
    } catch (err: unknown) {
      const message = err instanceof ApiError ? err.message : 'Failed to send invite. Please try again.'
      setSubmitError(message)
    } finally {
      setSubmitting(false)
      submitGuard.current = false
    }
  }, [name, phone, roleId, businessId])

  const handleShareWhatsApp = useCallback(() => {
    if (!success) return
    const text = encodeURIComponent(
      `Hi ${success.staffName}, you have been invited to join our business on ${APP_NAME}. Your invite code is: ${success.code}`
    )
    window.open(`https://wa.me/${success.staffPhone}?text=${text}`, '_blank')
  }, [success])

  return {
    name,
    phone,
    roleId,
    roles,
    errors,
    submitting,
    submitError,
    success,
    setName,
    setPhone,
    setRoleId,
    handleSubmit,
    handleShareWhatsApp,
  }
}
