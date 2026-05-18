import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { SuspendBanner } from '../components/SuspendBanner'
import type { BusinessSummary } from '@/features/auth/auth.types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUseAuth = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      suspendBannerFirmTitle: 'This business has been paused',
      suspendBannerFirmBody: 'The owner paused this firm. Reads still work; writes are blocked.',
      suspendBannerMemberTitle: 'Your access to this business is paused',
      suspendBannerMemberBody: 'An owner paused your membership.',
      suspendBannerReactivateCta: 'Reactivate firm',
      suspendBannerSwitchCta: 'Switch business',
      suspendBannerOwnerOnlyHint: 'Only the firm owner can reactivate.',
      reactivateModalTitle: 'Reactivate this firm?',
      reactivateModalBody: 'All members will regain write access.',
      reactivateModalReasonLabel: 'Reason (optional)',
      reactivateModalReasonHint: 'Shown in audit log.',
      reactivateModalConfirm: 'Reactivate firm',
      reactivateModalCancel: 'Cancel',
      reactivateModalSuccess: 'Firm reactivated.',
      reactivateModalError: 'Could not reactivate firm.',
    },
  }),
}))

vi.mock('@/config/events.config', () => ({
  OPEN_SIDE_NAV_EVENT: 'open-side-nav',
}))

vi.mock('@/config/routes.config', () => ({
  ROUTES: { CREATE_BUSINESS: '/business/create' },
}))

const baseBusiness: BusinessSummary = {
  id: 'biz-1',
  name: 'Raju Traders',
  businessType: 'retail',
  role: 'owner',
  roleId: null,
  roleName: 'Owner',
  permissions: [],
  status: 'ACTIVE',
  lastActiveAt: null,
  suspendedAt: null,
  businessSuspendedAt: null,
}

function setupAuth(business: BusinessSummary | null) {
  mockUseAuth.mockReturnValue({
    activeBusiness: business,
    refreshActiveBusiness: vi.fn(),
  })
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <SuspendBanner />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // jsdom doesn't implement <dialog>.showModal/close in old versions
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () { this.open = true }
    HTMLDialogElement.prototype.close = function () { this.open = false }
  }
})

describe('<SuspendBanner /> visibility', () => {
  it('renders nothing when activeBusiness is null', () => {
    setupAuth(null)
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when activeBusiness is active', () => {
    setupAuth(baseBusiness)
    const { container } = renderBanner()
    expect(container).toBeEmptyDOMElement()
  })
})

describe('<SuspendBanner /> firm-suspended state', () => {
  it('shows firm-suspended title + body + Reactivate CTA for owner', () => {
    setupAuth({
      ...baseBusiness,
      role: 'owner',
      businessSuspendedAt: '2026-05-17T11:00:00Z',
    })
    renderBanner()
    expect(screen.getByText('This business has been paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reactivate firm' })).toBeInTheDocument()
    expect(screen.queryByText('Only the firm owner can reactivate.')).not.toBeInTheDocument()
  })

  it('shows owner-only hint + Switch CTA for non-owner on firm-suspended', () => {
    setupAuth({
      ...baseBusiness,
      role: 'staff',
      businessSuspendedAt: '2026-05-17T11:00:00Z',
    })
    renderBanner()
    expect(screen.getByText('Only the firm owner can reactivate.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate firm' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch business' })).toBeInTheDocument()
  })

  it('opens reactivation modal when owner clicks Reactivate', async () => {
    setupAuth({
      ...baseBusiness,
      role: 'owner',
      businessSuspendedAt: '2026-05-17T11:00:00Z',
    })
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Reactivate firm' }))
    expect(screen.getByText('Reactivate this firm?')).toBeInTheDocument()
  })
})

describe('<SuspendBanner /> member-suspended state', () => {
  it('shows member-suspended copy + Switch CTA only', () => {
    setupAuth({
      ...baseBusiness,
      role: 'staff',
      suspendedAt: '2026-05-17T10:00:00Z',
    })
    renderBanner()
    expect(screen.getByText('Your access to this business is paused')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Switch business' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reactivate firm' })).not.toBeInTheDocument()
  })

  it('Switch button dispatches OPEN_SIDE_NAV_EVENT', async () => {
    setupAuth({
      ...baseBusiness,
      suspendedAt: '2026-05-17T10:00:00Z',
    })
    const eventSpy = vi.fn()
    window.addEventListener('open-side-nav', eventSpy)
    const user = userEvent.setup()
    renderBanner()
    await user.click(screen.getByRole('button', { name: 'Switch business' }))
    expect(eventSpy).toHaveBeenCalledOnce()
    window.removeEventListener('open-side-nav', eventSpy)
  })
})
