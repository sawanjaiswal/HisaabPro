import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TenantChip } from '../components/TenantChip'
import type { BusinessSummary } from '@/features/auth/auth.types'

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      tenantChipActive: 'Active firm',
      tenantChipMemberSuspended: 'Your access is paused',
      tenantChipFirmSuspended: 'Firm paused',
      tenantChipSwitching: 'Switching…',
    },
  }),
}))

const baseBusiness: BusinessSummary = {
  id: 'biz-raju',
  name: 'Raju Traders',
  businessType: 'retail',
  role: 'owner',
  roleId: 'role-owner',
  roleName: 'Owner',
  permissions: [],
  status: 'ACTIVE',
  lastActiveAt: '2026-05-17T10:00:00Z',
  suspendedAt: null,
  businessSuspendedAt: null,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<TenantChip /> states', () => {
  it('renders active state with business name + role', () => {
    render(<TenantChip business={baseBusiness} variant="full" />)
    expect(screen.getByText('Raju Traders')).toBeInTheDocument()
    expect(screen.getByText('Owner')).toBeInTheDocument()
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('data-state', 'active')
  })

  it('renders firm-suspended state (highest priority over member)', () => {
    render(
      <TenantChip
        business={{
          ...baseBusiness,
          suspendedAt: '2026-05-17T10:00:00Z',
          businessSuspendedAt: '2026-05-17T11:00:00Z',
        }}
        variant="full"
      />,
    )
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('data-state', 'firm-suspended')
    expect(screen.getByText('Firm paused')).toBeInTheDocument()
    expect(screen.queryByText('Owner')).not.toBeInTheDocument()
  })

  it('renders member-suspended state when only member suspendedAt is set', () => {
    render(
      <TenantChip
        business={{
          ...baseBusiness,
          suspendedAt: '2026-05-17T10:00:00Z',
          businessSuspendedAt: null,
        }}
        variant="full"
      />,
    )
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('data-state', 'member-suspended')
    expect(screen.getByText('Your access is paused')).toBeInTheDocument()
  })

  it('renders loading state (spinner + "Switching…" label)', () => {
    render(<TenantChip business={baseBusiness} loading variant="full" />)
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('data-state', 'loading')
    expect(screen.getByText('Switching…')).toBeInTheDocument()
    // Business name is replaced by "Switching…" label
    expect(screen.queryByText('Raju Traders')).not.toBeInTheDocument()
  })

  it('renders null business gracefully with active aria-label', () => {
    render(<TenantChip business={null} variant="full" />)
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('aria-label', 'Active firm')
  })
})

describe('<TenantChip /> aria-label per state', () => {
  it('member-suspended aria-label combines name + state', () => {
    render(
      <TenantChip
        business={{ ...baseBusiness, suspendedAt: '2026-05-17T10:00:00Z' }}
      />,
    )
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Raju Traders — Your access is paused',
    )
  })

  it('firm-suspended aria-label uses firm copy', () => {
    render(
      <TenantChip
        business={{
          ...baseBusiness,
          businessSuspendedAt: '2026-05-17T11:00:00Z',
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Raju Traders — Firm paused',
    )
  })
})

describe('<TenantChip /> onClick variant', () => {
  it('renders as a button when onClick is provided', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(<TenantChip business={baseBusiness} onClick={handleClick} />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('data-state', 'active')

    await user.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('disables the button while loading', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    render(
      <TenantChip business={baseBusiness} loading onClick={handleClick} />,
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })
})

describe('<TenantChip /> compact variant', () => {
  it('still surfaces state via data-state attribute', () => {
    render(
      <TenantChip
        business={{
          ...baseBusiness,
          businessSuspendedAt: '2026-05-17T11:00:00Z',
        }}
        variant="compact"
      />,
    )
    const chip = screen.getByRole('status')
    expect(chip).toHaveAttribute('data-state', 'firm-suspended')
  })
})
