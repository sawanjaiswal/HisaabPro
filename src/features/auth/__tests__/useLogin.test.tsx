import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useLogin } from '../useLogin'

const mockNavigate = vi.fn()
const mockSetUser = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockSetBusinesses = vi.fn()
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ setUser: mockSetUser, setBusinesses: mockSetBusinesses }),
}))

const mockDevLogin = vi.fn()
const mockSetCachedUser = vi.fn()
const mockSetCachedBusinesses = vi.fn()
vi.mock('@/lib/auth', () => ({
  devLogin: (...args: unknown[]) => mockDevLogin(...args),
  setCachedUser: (...args: unknown[]) => mockSetCachedUser(...args),
  setCachedBusinesses: (...args: unknown[]) => mockSetCachedBusinesses(...args),
}))

vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {
    code: string
    status: number
    constructor(m: string, c: string, s: number) { super(m); this.code = c; this.status = s }
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
)

beforeEach(() => { vi.clearAllMocks() })

describe('useLogin', () => {
  it('starts with idle state', () => {
    const { result } = renderHook(() => useLogin(), { wrapper })
    expect(result.current.username).toBe('')
    expect(result.current.password).toBe('')
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('')
  })

  it('sets username and password', () => {
    const { result } = renderHook(() => useLogin(), { wrapper })
    act(() => { result.current.setUsername('admin') })
    act(() => { result.current.setPassword('pass123') })
    expect(result.current.username).toBe('admin')
    expect(result.current.password).toBe('pass123')
  })

  it('navigates to dashboard on successful login', async () => {
    mockDevLogin.mockResolvedValue({ user: { id: '1' }, businesses: [{ id: 'b1' }], isNewUser: false })
    const { result } = renderHook(() => useLogin(), { wrapper })

    act(() => { result.current.setUsername('admin') })
    act(() => { result.current.setPassword('pass') })
    await act(() => result.current.handleLogin())

    expect(mockSetCachedUser).toHaveBeenCalledWith({ id: '1' })
    expect(mockSetUser).toHaveBeenCalledWith({ id: '1' })
    expect(mockNavigate).toHaveBeenCalled()
  })

  it('sets error on failed login', async () => {
    mockDevLogin.mockRejectedValue(new Error('Invalid credentials'))
    const { result } = renderHook(() => useLogin(), { wrapper })

    act(() => { result.current.setUsername('bad') })
    act(() => { result.current.setPassword('bad') })
    await act(() => result.current.handleLogin())

    expect(result.current.error).toBe('Invalid credentials')
    expect(result.current.loading).toBe(false)
  })

  it('sets captchaRequired on CAPTCHA_REQUIRED error', async () => {
    const { ApiError } = await import('@/lib/api')
    mockDevLogin.mockRejectedValue(new ApiError('captcha', 'CAPTCHA_REQUIRED', 429))
    const { result } = renderHook(() => useLogin(), { wrapper })

    await act(() => result.current.handleLogin())

    expect(result.current.captchaRequired).toBe(true)
  })
})
