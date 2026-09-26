/** PayrollWizardStepDates — Phase 6 PR6 FE
 *
 * Step 1: period + optional employee subset + payment mode. Hands the
 * validated PayrollWizardState back via `onContinue`; parent runs preview.
 *
 * Validation: dates required (yyyy-mm-dd), from<=to, range<=92 days
 * (ATTENDANCE_RANGE_MAX_DAYS — keeps preview compute bounded).
 *
 * Employee picker: default "All active" (employeeIds=[]); subset via
 * checkbox chips. Subset > 0 sends ids; "All" toggles back to [].
 *
 * Payment mode: 4 choices (CASH/UPI/BANK_TRANSFER/CHEQUE), default CASH.
 */

import { Text } from '@/components/ui/Text'
import { useMemo, useState } from 'react'
import { Users } from 'lucide-react'
import { DateField } from '@/components/ui/DateField'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import {
  ATTENDANCE_RANGE_MAX_DAYS,
  PAYROLL_MODE_CHOICES,
  PAYROLL_MODE_I18N_KEYS,
  type PayrollPaymentMode,
} from '../hr.constants'
import type { EmployeeLite } from '../hr.types'
import type { PayrollWizardState } from '../payroll.types'
import { Heading } from '@/components/ui/Heading'

interface PayrollWizardStepDatesProps {
  employees: EmployeeLite[]
  initial: PayrollWizardState
  onContinue: (state: PayrollWizardState) => void
  busy?: boolean
}

interface DateErrors {
  fromDate?: string
  toDate?: string
  range?: string
}

function rangeDays(from: string, to: string): number {
  const a = new Date(from + 'T00:00:00')
  const b = new Date(to + 'T00:00:00')
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1
}

export function PayrollWizardStepDates({
  employees,
  initial,
  onContinue,
  busy,
}: PayrollWizardStepDatesProps) {
  const { t } = useLanguage()

  const [fromDate, setFromDate] = useState(initial.fromDate)
  const [toDate, setToDate] = useState(initial.toDate)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initial.employeeIds))
  const [mode, setMode] = useState<PayrollPaymentMode>(initial.mode)
  const [errors, setErrors] = useState<DateErrors>({})

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.active),
    [employees],
  )

  function toggleEmployee(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelectedIds(new Set())
  }

  function handleContinue() {
    const next: DateErrors = {}
    if (!fromDate) next.fromDate = t.payrollErrFromRequired as string
    if (!toDate) next.toDate = t.payrollErrToRequired as string

    if (fromDate && toDate) {
      const days = rangeDays(fromDate, toDate)
      if (Number.isNaN(days)) {
        next.range = t.payrollErrInvalidDate as string
      } else if (days <= 0) {
        next.range = t.payrollErrFromAfterTo as string
      } else if (days > ATTENDANCE_RANGE_MAX_DAYS) {
        next.range = (t.payrollErrRangeTooLong as string).replace(
          '{max}',
          String(ATTENDANCE_RANGE_MAX_DAYS),
        )
      }
    }

    setErrors(next)
    if (Object.keys(next).length > 0) return

    onContinue({
      fromDate,
      toDate,
      employeeIds: Array.from(selectedIds),
      mode,
    })
  }

  const subsetLabel =
    selectedIds.size === 0
      ? (t.payrollAllEmployeesLabel as string)
      : `${selectedIds.size} ${t.payrollSelectedSuffix as string}`

  return (
    <section className="space-y-4">
      {/* Period */}
      <div>
        <Heading level={2} className="text-base font-semibold text-text-primary mb-2">
          {t.payrollStepDatesPeriodHeading as string}
        </Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DateField
            label={t.payrollFromDateLabel as string}
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            required
            error={errors.fromDate}
            disabled={busy}
          />
          <DateField
            label={t.payrollToDateLabel as string}
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            required
            error={errors.toDate}
            disabled={busy}
          />
        </div>
        {errors.range && (
          <Text
            role="alert"
            className="mt-1 text-sm text-error-600"
          >
            {errors.range}
          </Text>
        )}
      </div>

      {/* Employees */}
      <div>
        <Heading level={2} className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Users size={16} aria-hidden="true" className="text-[var(--color-text-tertiary)]" />
          {t.payrollStepDatesEmployeesHeading as string}
        </Heading>
        <Text className="text-sm text-text-secondary mb-2">
          {subsetLabel}
        </Text>
        <div className="flex flex-wrap gap-2">
          <Button variant="none"
            type="button"
            onClick={selectAll}
            disabled={busy}
            aria-pressed={selectedIds.size === 0}
            className={[
              'px-3 py-1.5 rounded-full text-sm border min-h-9',
              selectedIds.size === 0
                ? 'bg-primary-500 text-white border-primary-500'
                : 'bg-surface text-text-primary border-border',
            ].join(' ')}
          >
            {t.payrollAllEmployeesLabel as string}
          </Button>
          {activeEmployees.map((emp) => {
            const selected = selectedIds.has(emp.id)
            return (
              <Button variant="none"
                key={emp.id}
                type="button"
                onClick={() => toggleEmployee(emp.id)}
                disabled={busy}
                aria-pressed={selected}
                className={[
                  'px-3 py-1.5 rounded-full text-sm border min-h-9',
                  selected
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-surface text-text-primary border-border',
                ].join(' ')}
              >
                {emp.name}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Payment mode */}
      <div>
        <Heading level={2} className="text-base font-semibold text-text-primary mb-2">
          {t.payrollStepDatesModeHeading as string}
        </Heading>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.payrollStepDatesModeHeading as string}>
          {PAYROLL_MODE_CHOICES.map((m) => {
            const selected = mode === m
            return (
              <Button variant="none"
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m)}
                disabled={busy}
                className={[
                  'px-3 py-1.5 rounded-full text-sm border min-h-9',
                  selected
                    ? 'bg-primary-500 text-white border-primary-500'
                    : 'bg-surface text-text-primary border-border',
                ].join(' ')}
              >
                {t[PAYROLL_MODE_I18N_KEYS[m] as keyof typeof t] as string}
              </Button>
            )
          })}
        </div>
      </div>

      <div className="pt-2">
        <Button
          variant="primary"
          size="lg"
          onClick={handleContinue}
          loading={busy}
          className="w-full"
        >
          {t.payrollPreviewCta as string}
        </Button>
      </div>
    </section>
  )
}
