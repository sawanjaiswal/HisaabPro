import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PinGateProvider } from '../PinGateProvider'
import { getApi403Handler, setApi403Handler } from '@/lib/api-pin-gate'
import { ApiError } from '@/lib/api'

// ── Mocks ────────────────────────────────────────────────────────────────
//
// verifyPin is the network boundary of the sheet — stub it so we can drive
// success / failure paths without standing up a backend.

const mockVerifyPin = vi.fn()
vi.mock('@/features/pin-gate/pin-gate.service', () => ({
  verifyPin: (...args: unknown[]) => mockVerifyPin(...args),
  requestPinReset: vi.fn(),
}))

vi.mock('@/hooks/useLanguage', () => ({
  useLanguage: () => ({
    t: {
      pinPadTitleAuth: 'Confirm with PIN',
      pinPadTitleMutation: 'Authorize this change',
      pinPadTitleFinalize: 'Confirm sensitive action',
      pinPadSubtitle: 'Enter your PIN',
      pinPadCancel: 'Cancel',
      pinPadVerify: 'Verify',
      pinPadVerifying: 'Verifying...',
      pinPadForgotPin: 'Forgot PIN?',
      pinPadIncorrectTryAgain: 'Incorrect PIN',
      pinPadLocked: 'PIN locked',
      pinPadLockedRetryIn: 'Try again in',
      pinPadConnectionError: 'Offline',
      pinPadKeyAria: 'PIN digit',
      pinPadBackspaceAria: 'Delete last digit',
      pinPadDotsAria: 'PIN entered',
      pinPadKeypadAria: 'PIN keypad',
    },
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  // Ensure each test starts with a clean handler slot.
  setApi403Handler(null)
  // jsdom defaults navigator.onLine to true; explicit for clarity.
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
})

afterEach(() => {
  setApi403Handler(null)
})

// Helper — type a 4-digit PIN through the keypad.
async function typePin(user: ReturnType<typeof userEvent.setup>, pin: string) {
  for (const d of pin) {
    await user.click(screen.getByRole('button', { name: `PIN digit ${d}` }))
  }
}

describe('PinGateProvider — handler registration', () => {
  it('registers a handler with api-pin-gate on mount', () => {
    expect(getApi403Handler()).toBeNull()
    render(<PinGateProvider><div>child</div></PinGateProvider>)
    expect(getApi403Handler()).toBeInstanceOf(Function)
  })

  it('clears the handler on unmount', () => {
    const { unmount } = render(<PinGateProvider><div>child</div></PinGateProvider>)
    expect(getApi403Handler()).not.toBeNull()
    unmount()
    expect(getApi403Handler()).toBeNull()
  })

  it('renders its children pass-through', () => {
    render(<PinGateProvider><div data-testid="kid">hello</div></PinGateProvider>)
    expect(screen.getByTestId('kid')).toHaveTextContent('hello')
  })
})

describe('PinGateProvider — challenge flow', () => {
  it('does not show the sheet at idle', () => {
    render(<PinGateProvider><div /></PinGateProvider>)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the sheet when the handler is invoked', async () => {
    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()
    expect(handler).not.toBeNull()

    // Trigger as if api.ts saw a 403 PIN_REQUIRED.
    handler!(vi.fn().mockResolvedValue({ ok: true }), 'mutation').catch(() => {})

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Authorize this change')).toBeInTheDocument()
  })

  it('runs the retry and resolves the outer promise on PIN success', async () => {
    mockVerifyPin.mockResolvedValue({ success: true })
    const user = userEvent.setup()

    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    const retry = vi.fn().mockResolvedValue({ data: 'mutated!' })

    const outerPromise = handler(retry, 'mutation')

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    // Type a 4-digit PIN then press Verify.
    await typePin(user, '1234')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await expect(outerPromise).resolves.toEqual({ data: 'mutated!' })
    expect(mockVerifyPin).toHaveBeenCalledWith('1234')
    expect(retry).toHaveBeenCalledOnce()
  })

  it('auto-submits when the user types the 6th digit', async () => {
    mockVerifyPin.mockResolvedValue({ success: true })
    const user = userEvent.setup()

    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    const retry = vi.fn().mockResolvedValue('done')

    const outerPromise = handler(retry, 'mutation')
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await typePin(user, '123456')

    await expect(outerPromise).resolves.toBe('done')
    expect(mockVerifyPin).toHaveBeenCalledWith('123456')
  })

  it('rejects the outer promise with PIN_CANCELLED on Cancel', async () => {
    const user = userEvent.setup()
    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    const retry = vi.fn()

    const outerPromise = handler(retry, 'mutation')
    // Pre-attach a no-op to mark the rejection as handled synchronously; the
    // real assertion still runs via `await expect().rejects` below.
    outerPromise.catch(() => {})
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await expect(outerPromise).rejects.toBeInstanceOf(ApiError)
    await expect(outerPromise).rejects.toMatchObject({
      code: 'PIN_CANCELLED',
      status: 403,
    })
    expect(retry).not.toHaveBeenCalled()
  })

  it('surfaces retry failures to the original caller', async () => {
    mockVerifyPin.mockResolvedValue({ success: true })
    const user = userEvent.setup()

    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    const retryError = new ApiError('Server hiccup', 'INTERNAL_ERROR', 500)
    // Use mockImplementation so the rejected Promise is created on each call,
    // not eagerly at mock-creation time (which Node flags as unhandled).
    const retry = vi.fn(() => Promise.reject(retryError))

    const outerPromise = handler(retry, 'mutation')
    outerPromise.catch(() => {})
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await typePin(user, '1234')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await expect(outerPromise).rejects.toBe(retryError)
  })

  it('shows the wrong-PIN error when verifyPin returns 401', async () => {
    const user = userEvent.setup()
    mockVerifyPin.mockRejectedValue(
      new ApiError('Invalid PIN', 'UNAUTHORIZED', 401, { reason: 'INVALID_PIN' }),
    )

    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    handler(vi.fn().mockResolvedValue('ok'), 'mutation').catch(() => {})

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await typePin(user, '1234')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(screen.getByText('Incorrect PIN')).toBeInTheDocument())
  })

  it('shows the locked banner when verifyPin returns 429', async () => {
    const user = userEvent.setup()
    mockVerifyPin.mockRejectedValue(
      new ApiError('PIN locked', 'RATE_LIMITED', 429, { retryAfter: 60 }),
    )

    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    handler(vi.fn().mockResolvedValue('ok'), 'mutation').catch(() => {})

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    await typePin(user, '1234')
    await user.click(screen.getByRole('button', { name: 'Verify' }))

    await waitFor(() => expect(screen.getByText('PIN locked')).toBeInTheDocument())
  })

  it('picks the auth title when routeClass is "auth"', async () => {
    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    handler(vi.fn().mockResolvedValue('ok'), 'auth').catch(() => {})

    await waitFor(() => expect(screen.getByText('Confirm with PIN')).toBeInTheDocument())
  })

  it('picks the finalize title when routeClass is "finalize"', async () => {
    render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    handler(vi.fn().mockResolvedValue('ok'), 'finalize').catch(() => {})

    await waitFor(() => expect(screen.getByText('Confirm sensitive action')).toBeInTheDocument())
  })

  it('rejects pending challenge on unmount', async () => {
    const { unmount } = render(<PinGateProvider><div /></PinGateProvider>)
    const handler = getApi403Handler()!
    const outerPromise = handler(vi.fn(), 'mutation')
    outerPromise.catch(() => {})

    unmount()

    await expect(outerPromise).rejects.toMatchObject({ code: 'PIN_CANCELLED' })
  })
})
