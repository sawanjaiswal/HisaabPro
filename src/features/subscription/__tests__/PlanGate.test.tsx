import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PlanGate } from '../PlanGate'

// Mutable subscription-hook state, mirroring useSubscription's return shape.
const subState = {
  plan: 'FREE' as 'FREE' | 'PRO' | 'BUSINESS' | 'PRO_MAX',
  state: 'NONE' as string,
  isInGrace: false,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => subState,
}))

// Never time out in tests unless a case opts in.
let timedOut = false
vi.mock('@/hooks/useLoadTimeout', () => ({
  useLoadTimeout: () => timedOut,
}))

function renderGate(feature: 'parties' | 'accounting') {
  return render(
    <MemoryRouter>
      <PlanGate feature={feature} featureLabel={feature}>
        <div>feature-content</div>
      </PlanGate>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  subState.plan = 'FREE'
  subState.state = 'NONE'
  subState.isInGrace = false
  subState.isLoading = false
  subState.isError = false
  timedOut = false
})

describe('<PlanGate /> failure-mode contract', () => {
  it('renders a FREE-tier feature when the subscription fetch ERRORS (fail-open to FREE)', () => {
    subState.isError = true
    renderGate('parties')
    expect(screen.getByText('feature-content')).toBeInTheDocument()
    expect(screen.queryByText(/Couldn't verify your plan/i)).not.toBeInTheDocument()
  })

  it('renders a FREE-tier feature while the subscription is LOADING (no "Checking your plan…" flash)', () => {
    subState.isLoading = true
    renderGate('parties')
    expect(screen.getByText('feature-content')).toBeInTheDocument()
  })

  it('renders a FREE-tier feature when the load TIMES OUT', () => {
    subState.isLoading = true
    timedOut = true
    renderGate('parties')
    expect(screen.getByText('feature-content')).toBeInTheDocument()
  })

  it('still shows the error state for a PAID feature when the fetch ERRORS (do not grant paid on uncertainty)', () => {
    subState.isError = true
    renderGate('accounting')
    expect(screen.getByText(/Couldn't verify your plan/i)).toBeInTheDocument()
    expect(screen.queryByText('feature-content')).not.toBeInTheDocument()
  })

  it('renders a FREE-tier feature normally on success', () => {
    renderGate('parties')
    expect(screen.getByText('feature-content')).toBeInTheDocument()
  })
})
