import React from 'react'
import { Input } from '@/components/ui/Input'
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

      <Input
        id="invite-name"
        label={t.name}
        type="text"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t.staffName}
        autoComplete="name"
        error={errors.name}
      />

      <Input
        id="invite-phone"
        label={t.phone}
        type="tel"
        value={phone}
        onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
        placeholder={t.tenDigitMobile}
        autoComplete="tel"
        inputMode="numeric"
        maxLength={10}
        error={errors.phone}
      />

      <div className={`input-group${errors.roleId ? ' input-group-error' : ''}`}>
        <label htmlFor="invite-role" className="input-label">{t.roles}</label>
        <select
          id="invite-role"
          className="input"
          value={roleId}
          onChange={(e) => onRoleChange(e.target.value)}
          aria-invalid={!!errors.roleId}
          aria-describedby={errors.roleId ? 'invite-role-error' : undefined}
        >
          <option value="">{t.selectARoleOption}</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        {errors.roleId && (
          <p id="invite-role-error" className="input-error" role="alert">
            {errors.roleId}
          </p>
        )}
      </div>

      {submitError && (
        <p className="staff-invite-error-banner" role="alert">
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
