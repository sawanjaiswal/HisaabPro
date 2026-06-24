import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '../app.guards'
import { ROUTES } from '@/config/routes.config'

const authState = {
  isAuthenticated: false,
  isLoading: false,
  businesses: [] as Array<{ id: string }>,
}

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<div>login-page</div>} />
        <Route path={ROUTES.ONBOARDING} element={<div>onboarding-page</div>} />
        <Route
          path={ROUTES.DASHBOARD}
          element={<ProtectedRoute><div>dashboard-content</div></ProtectedRoute>}
        />
        <Route
          path={ROUTES.ONBOARDING + '/guarded'}
          element={<ProtectedRoute><div>onboarding-guarded</div></ProtectedRoute>}
        />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  authState.isAuthenticated = false
  authState.isLoading = false
  authState.businesses = []
})

describe('<ProtectedRoute /> business-membership guard', () => {
  it('redirects an authenticated user with zero businesses to onboarding', () => {
    authState.isAuthenticated = true
    authState.businesses = []
    renderAt(ROUTES.DASHBOARD)
    expect(screen.getByText('onboarding-page')).toBeInTheDocument()
    expect(screen.queryByText('dashboard-content')).not.toBeInTheDocument()
  })

  it('renders the page when the user has at least one business', () => {
    authState.isAuthenticated = true
    authState.businesses = [{ id: 'biz-1' }]
    renderAt(ROUTES.DASHBOARD)
    expect(screen.getByText('dashboard-content')).toBeInTheDocument()
  })

  it('redirects an unauthenticated user to login', () => {
    authState.isAuthenticated = false
    renderAt(ROUTES.DASHBOARD)
    expect(screen.getByText('login-page')).toBeInTheDocument()
  })
})
