import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle, CheckCircle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ROUTES } from '@/config/routes.config'
import { inviteStaff, getRoles } from './settings.service'
import { ApiError } from '@/lib/api'
import type { Role, InviteStaffData } from './settings.types'
import './settings.css'

// TODO: get from auth context
const BUSINESS_ID = 'business_1'

/** WhatsApp brand green — no CSS variable equivalent in design system */
const WHATSAPP_GREEN = '#25D366'

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

export default function StaffInvitePage() {
  const navigate = useNavigate()

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

    getRoles(BUSINESS_ID, controller.signal)
      .then((res) => setRoles(res.data.roles))
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        // Non-fatal: form will show empty dropdown
      })

    return () => controller.abort()
  }, [])

  function validate(): FormErrors {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!/^\d{10}$/.test(phone.trim())) errs.phone = 'Enter a valid 10-digit phone number'
    if (!roleId) errs.roleId = 'Please select a role'
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
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
      const res = await inviteStaff(BUSINESS_ID, data)
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
  }

  function handleShareWhatsApp() {
    if (!success) return
    const text = encodeURIComponent(
      `Hi ${success.staffName}, you have been invited to join our business on HisaabApp. Your invite code is: ${success.code}`
    )
    window.open(`https://wa.me/${success.staffPhone}?text=${text}`, '_blank')
  }

  return (
    <AppShell>
      <Header title="Invite Staff" backTo={ROUTES.SETTINGS_STAFF} />
      <PageContainer className="staff-page">

        {success !== null ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12) var(--space-4)' }}>
            <CheckCircle
              size={56}
              aria-hidden="true"
              style={{ color: 'var(--color-success-600)', marginBottom: 'var(--space-4)' }}
            />
            <p style={{ fontWeight: 700, fontSize: '1.0625rem', color: 'var(--color-gray-900)', marginBottom: 'var(--space-2)' }}>
              Invite Sent!
            </p>
            <p style={{ color: 'var(--color-gray-500)', marginBottom: 'var(--space-6)', lineHeight: 1.5 }}>
              Share this code with {success.staffName}
            </p>
            <div
              style={{
                display: 'inline-block',
                padding: 'var(--space-3) var(--space-6)',
                background: 'var(--color-primary-50)',
                borderRadius: 'var(--radius-lg)',
                border: '1.5px dashed var(--color-primary-300)',
                fontSize: '1.5rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                color: 'var(--color-primary-700)',
                marginBottom: 'var(--space-8)',
              }}
              aria-label={`Invite code: ${success.code}`}
            >
              {success.code}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <button
                type="button"
                className="role-save-button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)', background: WHATSAPP_GREEN, borderColor: WHATSAPP_GREEN }}
                onClick={handleShareWhatsApp}
              >
                <MessageCircle size={18} aria-hidden="true" />
                Share via WhatsApp
              </button>
              <button
                type="button"
                className="role-save-button"
                style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-700)' }}
                onClick={() => navigate(ROUTES.SETTINGS_STAFF)}
              >
                Back to Staff
              </button>
            </div>
          </div>
        ) : (
          <form className="staff-invite-form" onSubmit={handleSubmit} noValidate>
            <p className="staff-invite-form-title">New Staff Member</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
              <label
                htmlFor="invite-name"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-700)' }}
              >
                Name
              </label>
              <input
                id="invite-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Staff member's name"
                autoComplete="name"
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${errors.name ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
                  fontSize: '1rem',
                  fontFamily: 'var(--font-primary)',
                  minHeight: 44,
                  outline: 'none',
                  color: 'var(--color-gray-900)',
                }}
              />
              {errors.name && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-error-600)' }} role="alert">
                  {errors.name}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
              <label
                htmlFor="invite-phone"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-700)' }}
              >
                Phone Number
              </label>
              <input
                id="invite-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                autoComplete="tel"
                inputMode="numeric"
                maxLength={10}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${errors.phone ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
                  fontSize: '1rem',
                  fontFamily: 'var(--font-primary)',
                  minHeight: 44,
                  outline: 'none',
                  color: 'var(--color-gray-900)',
                }}
              />
              {errors.phone && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-error-600)' }} role="alert">
                  {errors.phone}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
              <label
                htmlFor="invite-role"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-gray-700)' }}
              >
                Role
              </label>
              <select
                id="invite-role"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                style={{
                  width: '100%',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  border: `1.5px solid ${errors.roleId ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
                  fontSize: '1rem',
                  fontFamily: 'var(--font-primary)',
                  minHeight: 44,
                  outline: 'none',
                  color: roleId ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
                  background: 'var(--color-gray-0, #fff)',
                }}
              >
                <option value="">Select a role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.roleId && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-error-600)' }} role="alert">
                  {errors.roleId}
                </p>
              )}
            </div>

            {submitError && (
              <p
                style={{ fontSize: '0.875rem', color: 'var(--color-error-600)', padding: 'var(--space-3)', background: 'var(--color-red-50)', borderRadius: 'var(--radius-md)' }}
                role="alert"
              >
                {submitError}
              </p>
            )}

            <button
              type="submit"
              className="role-save-button"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? 'Sending Invite...' : 'Send Invite'}
            </button>
          </form>
        )}

      </PageContainer>
    </AppShell>
  )
}
