/** EmployeeForm — Phase 6 PR6 FE
 *
 * Shared form body for create + edit. Lives INSIDE a `<Drawer>` rendered by
 * `EmployeeListPage` / `EmployeeDetailPage` — those pages own the drawer
 * chrome and submit-cancel buttons (in the drawer footer), so this file is
 * just the fields + the validation + the onSubmit shim.
 *
 * Validation mirrors the BE Zod (server/src/schemas/employee.schemas.ts):
 *   - name        — required, 1..120 trimmed
 *   - phone       — optional, regex /^\+?[0-9]{10,15}$/ when present
 *   - designation — optional, max 80 trimmed
 *   - dailyRate   — required, 0..1_000_000 paise (Rs 0..10,000)
 *
 * Money entry is in RUPEES (UI) → paise (wire) — the user types "1500" not
 * "150000". A blur-time conversion + display formatter keeps the UX human.
 *
 * Number input blocks `e/E/+/-` on keydown and hides the native spinner so
 * the touchpad doesn't accidentally bump the rate.
 */

import { useState, useImperativeHandle, forwardRef, useEffect } from 'react'
import { User, Phone, IndianRupee, Briefcase } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import {
  DAILY_RATE_MAX_PAISE,
  DESIGNATION_MAX,
  EMPLOYEE_NAME_MAX,
  PHONE_REGEX,
} from '../hr.constants'
import type { Employee, EmployeeInput } from '../hr.types'

export interface EmployeeFormHandle {
  /** Returns parsed input if valid, else null (and the form shows errors). */
  submit(): EmployeeInput | null
}

interface EmployeeFormProps {
  /** Pre-fill values for edit mode; omit for create. */
  defaults?: Employee | null
  disabled?: boolean
}

interface FieldErrors {
  name?: string
  phone?: string
  designation?: string
  dailyRate?: string
}

const NUMERIC_BLOCKED_KEYS = ['e', 'E', '+', '-']

export const EmployeeForm = forwardRef<EmployeeFormHandle, EmployeeFormProps>(
  function EmployeeForm({ defaults, disabled }, ref) {
    const { t } = useLanguage()

    const [name, setName] = useState(defaults?.name ?? '')
    const [phone, setPhone] = useState(defaults?.phone ?? '')
    const [designation, setDesignation] = useState(defaults?.designation ?? '')
    // dailyRateRupees: user-facing rupees string (allow empty during typing).
    const [dailyRateRupees, setDailyRateRupees] = useState(
      defaults ? String(Math.floor(defaults.dailyRate / 100)) : '',
    )
    const [errors, setErrors] = useState<FieldErrors>({})

    // Refresh values when `defaults` flips (edit drawer reuse for different rows).
    useEffect(() => {
      setName(defaults?.name ?? '')
      setPhone(defaults?.phone ?? '')
      setDesignation(defaults?.designation ?? '')
      setDailyRateRupees(defaults ? String(Math.floor(defaults.dailyRate / 100)) : '')
      setErrors({})
    }, [defaults])

    function validate(): EmployeeInput | null {
      const next: FieldErrors = {}
      const trimmedName = name.trim()
      if (trimmedName.length === 0) next.name = t.employeeFormErrNameRequired as string
      else if (trimmedName.length > EMPLOYEE_NAME_MAX) next.name = t.employeeFormErrNameTooLong as string

      const trimmedPhone = phone.trim()
      if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
        next.phone = t.employeeFormErrPhoneInvalid as string
      }

      const trimmedDesignation = designation.trim()
      if (trimmedDesignation.length > DESIGNATION_MAX) {
        next.designation = t.employeeFormErrDesignationTooLong as string
      }

      const rupeesParsed = Number(dailyRateRupees)
      if (dailyRateRupees.trim().length === 0 || Number.isNaN(rupeesParsed)) {
        next.dailyRate = t.employeeFormErrDailyRateRequired as string
      } else if (!Number.isInteger(rupeesParsed)) {
        next.dailyRate = t.employeeFormErrDailyRateInteger as string
      } else if (rupeesParsed < 0) {
        next.dailyRate = t.employeeFormErrDailyRateNegative as string
      } else if (rupeesParsed * 100 > DAILY_RATE_MAX_PAISE) {
        next.dailyRate = t.employeeFormErrDailyRateTooHigh as string
      }

      setErrors(next)
      if (Object.keys(next).length > 0) return null

      return {
        name: trimmedName,
        phone: trimmedPhone.length > 0 ? trimmedPhone : null,
        designation: trimmedDesignation.length > 0 ? trimmedDesignation : null,
        dailyRatePaise: Math.round(rupeesParsed * 100),
      }
    }

    useImperativeHandle(ref, () => ({ submit: validate }), [name, phone, designation, dailyRateRupees])

    return (
      <form
        onSubmit={(e) => e.preventDefault()}
        className="space-y-4"
        noValidate
      >
        <Input
          label={t.employeeFormLabelName as string}
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User size={16} aria-hidden="true" />}
          maxLength={EMPLOYEE_NAME_MAX}
          required
          autoComplete="off"
          error={errors.name}
          disabled={disabled}
        />
        <Input
          label={t.employeeFormLabelPhone as string}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          icon={<Phone size={16} aria-hidden="true" />}
          inputMode="tel"
          maxLength={15}
          autoComplete="off"
          placeholder="+91 98765 43210"
          error={errors.phone}
          disabled={disabled}
        />
        <Input
          label={t.employeeFormLabelDesignation as string}
          value={designation}
          onChange={(e) => setDesignation(e.target.value)}
          icon={<Briefcase size={16} aria-hidden="true" />}
          maxLength={DESIGNATION_MAX}
          autoComplete="off"
          error={errors.designation}
          disabled={disabled}
        />
        <Input
          label={t.employeeFormLabelDailyRate as string}
          value={dailyRateRupees}
          onChange={(e) => setDailyRateRupees(e.target.value)}
          icon={<IndianRupee size={16} aria-hidden="true" />}
          type="number"
          inputMode="numeric"
          min={0}
          max={Math.floor(DAILY_RATE_MAX_PAISE / 100)}
          step={1}
          required
          onKeyDown={(e) => {
            if (NUMERIC_BLOCKED_KEYS.includes(e.key)) e.preventDefault()
          }}
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          error={errors.dailyRate}
          disabled={disabled}
        />
      </form>
    )
  },
)
