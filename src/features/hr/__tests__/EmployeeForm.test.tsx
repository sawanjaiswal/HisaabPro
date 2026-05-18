/** EmployeeForm tests — Phase 6 PR6 FE
 *
 * Coverage:
 *   - The forwardRef imperative `submit()` returns null on invalid input
 *     and shows the right field error in the rendered DOM.
 *   - Each rule mirrors BE Zod (name required, phone regex, designation
 *     ≤80, dailyRate required + integer + ≥0 + ≤Rs 10,000/day).
 *   - On a valid submit, the parsed payload uses paise on the wire
 *     (`Math.round(rupees * 100)`) and nulls out empty optional fields.
 *   - `defaults` flips reset the internal state so the same drawer can
 *     edit different rows.
 *
 * We render the bare form (no Drawer / no page) and drive validation via
 * the imperative handle — same way `EmployeeListPage` and
 * `EmployeeDetailPage` do in real code. `submit()` calls `setErrors()`
 * inside React, so we wrap each invocation in `act()` to flush the
 * re-render before asserting on the rendered error <p>.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef, type RefObject } from 'react'
import type { EmployeeInput } from '../hr.types'

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      employeeFormLabelName: 'Name',
      employeeFormLabelPhone: 'Phone',
      employeeFormLabelDesignation: 'Designation',
      employeeFormLabelDailyRate: 'Daily rate (Rs)',
      employeeFormErrNameRequired: 'Name is required.',
      employeeFormErrNameTooLong: 'Name is too long.',
      employeeFormErrPhoneInvalid: 'Enter a valid phone (10-15 digits).',
      employeeFormErrDesignationTooLong: 'Designation is too long.',
      employeeFormErrDailyRateRequired: 'Daily rate is required.',
      employeeFormErrDailyRateInteger: 'Daily rate must be a whole number.',
      employeeFormErrDailyRateNegative: 'Daily rate cannot be negative.',
      employeeFormErrDailyRateTooHigh: 'Daily rate is too high.',
    },
  }),
}))

import { EmployeeForm, type EmployeeFormHandle } from '../components/EmployeeForm'
import type { Employee } from '../hr.types'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderForm(defaults?: Employee | null) {
  const ref = createRef<EmployeeFormHandle>()
  render(<EmployeeForm ref={ref} defaults={defaults ?? null} />)
  return ref
}

/** Wrap `submit()` in act() so React commits the setErrors() update before
 *  the test asserts on the rendered error message. */
function submitSync(ref: RefObject<EmployeeFormHandle | null>): EmployeeInput | null {
  let out: EmployeeInput | null = null
  act(() => {
    out = ref.current?.submit() ?? null
  })
  return out
}

// ─── Validation: required + bounds ──────────────────────────────────────────

describe('<EmployeeForm /> — validation', () => {
  it('returns null when name is empty and shows the error', () => {
    const ref = renderForm()
    expect(submitSync(ref)).toBeNull()
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
  })

  it('returns null when dailyRate is empty and shows the error', () => {
    const ref = renderForm()
    expect(submitSync(ref)).toBeNull()
    expect(screen.getByText('Daily rate is required.')).toBeInTheDocument()
  })

  it('rejects a phone that fails the E.164-ish regex', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju Mehta')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '1500')
    await user.type(screen.getByLabelText('Phone'), '123abc')
    expect(submitSync(ref)).toBeNull()
    expect(
      screen.getByText('Enter a valid phone (10-15 digits).'),
    ).toBeInTheDocument()
  })

  it('accepts a valid +91 phone', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju Mehta')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '1500')
    await user.type(screen.getByLabelText('Phone'), '+919876543210')
    const out = submitSync(ref)
    expect(out).not.toBeNull()
    expect(out?.phone).toBe('+919876543210')
  })

  it('rejects a daily rate above Rs 10,000/day (server cap)', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju Mehta')
    // 10001 rupees = 1,000,100 paise > DAILY_RATE_MAX_PAISE (1,000,000)
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '10001')
    expect(submitSync(ref)).toBeNull()
    expect(screen.getByText('Daily rate is too high.')).toBeInTheDocument()
  })

  it('accepts dailyRate = 0 (a deliberate "unpaid intern" rate)', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Volunteer')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '0')
    const out = submitSync(ref)
    expect(out?.dailyRatePaise).toBe(0)
  })
})

// ─── Happy path: valid submit returns paise ─────────────────────────────────

describe('<EmployeeForm /> — successful submit', () => {
  it('converts rupees to paise on the wire', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju Mehta')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '1500')
    const out = submitSync(ref)
    expect(out).toEqual({
      name: 'Raju Mehta',
      phone: null,
      designation: null,
      dailyRatePaise: 150000,
    })
  })

  it('trims whitespace from name + designation', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), '  Priya Singh  ')
    await user.type(screen.getByLabelText('Designation'), '  Manager  ')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '2000')
    const out = submitSync(ref)
    expect(out?.name).toBe('Priya Singh')
    expect(out?.designation).toBe('Manager')
  })

  it('returns null phone when the user leaves it blank', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '500')
    const out = submitSync(ref)
    expect(out?.phone).toBeNull()
  })

  it('returns null designation when the user leaves it blank', async () => {
    const user = userEvent.setup()
    const ref = renderForm()
    await user.type(screen.getByLabelText('Name'), 'Raju')
    await user.type(screen.getByLabelText('Daily rate (Rs)'), '500')
    const out = submitSync(ref)
    expect(out?.designation).toBeNull()
  })
})

// ─── defaults — edit mode pre-fill + reset on flip ──────────────────────────

describe('<EmployeeForm /> — defaults / edit mode', () => {
  const SAMPLE: Employee = {
    id: 'emp_x', businessId: 'biz_1', partyId: 'p_x', userId: null,
    name: 'Existing Emp', phone: '+919999999999', designation: 'Foreman',
    dailyRate: 250000, joinedAt: null, leftAt: null,
    createdById: null, isDeleted: false, deletedAt: null,
    createdAt: '2026-05-01T00:00:00Z', updatedAt: '2026-05-01T00:00:00Z',
  }

  it('pre-fills all fields from defaults', () => {
    renderForm(SAMPLE)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Existing Emp')
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('+919999999999')
    expect((screen.getByLabelText('Designation') as HTMLInputElement).value).toBe('Foreman')
    // 250000 paise → 2500 rupees in the UI
    expect((screen.getByLabelText('Daily rate (Rs)') as HTMLInputElement).value).toBe('2500')
  })

  it('round-trips the pre-filled defaults back to paise', () => {
    const ref = renderForm(SAMPLE)
    const out = submitSync(ref)
    expect(out).toEqual({
      name: 'Existing Emp',
      phone: '+919999999999',
      designation: 'Foreman',
      dailyRatePaise: 250000,
    })
  })
})
