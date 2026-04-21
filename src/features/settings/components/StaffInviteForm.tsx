import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { Role } from '../settings.types'

interface FormErrors {
  name?: string
  phone?: string
  roleId?: string
}

interface StaffInviteFormProps {
  name: string
  phone: string
  roleId: string
  roles: Role[]
  errors: FormErrors
  submitting: boolean
  submitError: string | null
  onNameChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onRoleChange: (value: string) => void
  onSubmit: (e: React.FormEvent) => void
}

export function StaffInviteForm({
  name,
  phone,
  roleId,
  roles,
  errors,
  submitting,
  submitError,
  onNameChange,
  onPhoneChange,
  onRoleChange,
  onSubmit,
}: StaffInviteFormProps) {
  const { t } = useLanguage()

  return (
    <form className="staff-invite-form" onSubmit={onSubmit} noValidate>
      <p className="staff-invite-form-title">{t.newStaffMember}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
        <label
          htmlFor="invite-name"
          style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)' }}
        >
          {t.name}
        </label>
        <input
          id="invite-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t.staffName}
          autoComplete="name"
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${errors.name ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
            fontSize: 'var(--fs-base)',
            fontFamily: 'var(--font-primary)',
            minHeight: 44,
            outline: 'none',
            color: 'var(--color-gray-900)',
          }}
        />
        {errors.name && (
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-error-600)' }} role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
        <label
          htmlFor="invite-phone"
          style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)' }}
        >
          {t.phone}
        </label>
        <input
          id="invite-phone"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder={t.tenDigitMobile}
          autoComplete="tel"
          inputMode="numeric"
          maxLength={10}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${errors.phone ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
            fontSize: 'var(--fs-base)',
            fontFamily: 'var(--font-primary)',
            minHeight: 44,
            outline: 'none',
            color: 'var(--color-gray-900)',
          }}
        />
        {errors.phone && (
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-error-600)' }} role="alert">
            {errors.phone}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1-5)' }}>
        <label
          htmlFor="invite-role"
          style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-gray-700)' }}
        >
          {t.roles}
        </label>
        <select
          id="invite-role"
          value={roleId}
          onChange={(e) => onRoleChange(e.target.value)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: `1.5px solid ${errors.roleId ? 'var(--color-error-500)' : 'var(--color-gray-300)'}`,
            fontSize: 'var(--fs-base)',
            fontFamily: 'var(--font-primary)',
            minHeight: 44,
            outline: 'none',
            color: roleId ? 'var(--color-gray-900)' : 'var(--color-gray-400)',
            background: 'var(--color-gray-0, #fff)',
          }}
        >
          <option value="">{t.selectARoleOption}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        {errors.roleId && (
          <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-error-600)' }} role="alert">
            {errors.roleId}
          </p>
        )}
      </div>

      {submitError && (
        <p
          style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-error-600)', padding: 'var(--space-3)', background: 'var(--color-red-50)', borderRadius: 'var(--radius-md)' }}
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
        {submitting ? t.sendingInvite : t.sendInviteBtn}
      </button>
    </form>
  )
}
