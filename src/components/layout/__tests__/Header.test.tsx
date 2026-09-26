import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Header } from '../Header'
import { ROUTES } from '@/config/routes.config'

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({ t: { notifBellTooltip: 'Notifications', notifBellAriaEmpty: 'Notifications' } }),
}))

vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: { notifBellTooltip: 'Notifications', notifBellAriaEmpty: 'Notifications' } }),
}))

vi.mock('@/features/notifications/useNotifications', () => ({
  useUnreadCount: () => ({ data: { unreadCount: 2 } }),
}))

vi.mock('@/sync/SyncManager', () => ({
  SyncManager: {
    getState: () => ({ status: 'SYNCED', pendingCount: 0 }),
    subscribe: vi.fn(() => () => {}),
    triggerSync: vi.fn(),
  },
}))

describe('Header component', () => {
  it('renders brand logo and title on homepage without back button', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Header />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /hisaabpro home/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /go back/i })).not.toBeInTheDocument()
  })

  it('renders sync icon and notification bell on homepage', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Header />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /synced with cloud/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })

  it('does NOT render sync icon or notification bell on sub-pages by default', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.PARTIES]}>
        <Header title="Parties" />
      </MemoryRouter>
    )

    expect(screen.getByText('Parties')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /synced with cloud/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument()
  })

  it('never renders a top-right hamburger menu button', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Header />
      </MemoryRouter>
    )

    expect(screen.queryByRole('button', { name: /open menu/i })).not.toBeInTheDocument()
  })

  it('renders back button and title on detail / sub-pages', () => {
    render(
      <MemoryRouter initialEntries={['/parties/123']}>
        <Header title="Customer Details" subtitle="Active account" backTo={ROUTES.PARTIES} />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument()
    expect(screen.getByText('Customer Details')).toBeInTheDocument()
    expect(screen.getByText('Active account')).toBeInTheDocument()
  })

  it('renders custom actions in the header actions slot', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.PARTIES]}>
        <Header
          title="Parties"
          actions={<button type="button">Import</button>}
        />
      </MemoryRouter>
    )

    expect(screen.getByRole('button', { name: 'Import' })).toBeInTheDocument()
  })
})
