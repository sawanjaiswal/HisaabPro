/** FE-2 smoke test for CreateAppointmentDrawer.
 *  Mocks the picker dependencies so we can render without hitting api()/db.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockToast = { success: vi.fn(), error: vi.fn(), info: vi.fn() }
vi.mock('@/hooks/useToast', () => ({
  useToast: () => mockToast,
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: new Proxy({}, { get: (_t, k: string) => k }),
  }),
}))

vi.mock('@/hooks/useVertical', () => ({
  useVertical: () => ({ type: 'general' }),
}))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string; status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const mockCreate = vi.fn()
vi.mock('../appointment.service', () => ({
  createAppointment: (...args: unknown[]) => mockCreate(...args),
  patchAppointmentStatus: vi.fn(),
}))

// Mock the picker shells so the test doesn't need party.service / hr endpoints.
vi.mock('../components/PartyPickerField', () => ({
  PartyPickerField: ({ partyId, onChange }: { partyId: string; onChange: (id: string, name: string) => void }) => (
    <div>
      <input
        aria-label="party-id"
        value={partyId}
        onChange={(e) => onChange(e.target.value, e.target.value ? 'TestParty' : '')}
      />
    </div>
  ),
}))
vi.mock('../components/EmployeePicker', () => ({
  EmployeePicker: () => <div data-testid="employee-picker" />,
}))

import { CreateAppointmentDrawer } from '../components/CreateAppointmentDrawer'
import { createTestWrapper } from '@/test/query-wrapper'

const Wrapper = createTestWrapper()

function renderDrawer(open = true) {
  return render(<CreateAppointmentDrawer open={open} onClose={vi.fn()} />, { wrapper: Wrapper })
}

describe('CreateAppointmentDrawer (FE-2)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the title when open', () => {
    renderDrawer()
    expect(screen.getAllByText(/newAppointment/i).length).toBeGreaterThan(0)
  })

  it('renders the RecurrenceFields section (FE-2)', () => {
    renderDrawer()
    expect(screen.getAllByText(/recurrence/i).length).toBeGreaterThan(0)
  })

  it('disables Save until a party id is entered', () => {
    renderDrawer()
    const save = screen.getByRole('button', { name: /^save$/i })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('party-id'), { target: { value: 'p1' } })
    expect(save).not.toBeDisabled()
  })
})
