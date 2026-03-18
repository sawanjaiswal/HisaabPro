import { describe, it, expect, beforeEach, vi } from 'vitest'
import { clearAuth, setCachedUser, getCachedUser, hasCachedSession } from '../auth'
import type { AuthUser } from '../../features/auth/auth.types'

// Mock the api module to avoid real network calls
vi.mock('../api', () => ({
  api: vi.fn(),
  ApiError: class extends Error {
    code: string
    status: number
    constructor(msg: string, code: string, status: number) {
      super(msg)
      this.code = code
      this.status = status
    }
  },
}))

const mockUser: AuthUser = {
  id: 'user-123',
  phone: '9876543210',
  name: 'Sawan',
  email: 'sawan@test.com',
  businessId: 'biz-456',
}

describe('clearAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('removes cachedUser from sessionStorage', () => {
    sessionStorage.setItem('cachedUser', JSON.stringify(mockUser))
    clearAuth()
    expect(sessionStorage.getItem('cachedUser')).toBeNull()
  })

  it('does nothing when no cachedUser exists', () => {
    clearAuth()
    expect(sessionStorage.getItem('cachedUser')).toBeNull()
  })
})

describe('setCachedUser', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('stores user as JSON in sessionStorage', () => {
    setCachedUser(mockUser)
    const stored = sessionStorage.getItem('cachedUser')
    expect(stored).toBeTruthy()
    expect(JSON.parse(stored!)).toEqual(mockUser)
  })

  it('overwrites existing cached user', () => {
    setCachedUser(mockUser)
    const updated = { ...mockUser, name: 'Updated' }
    setCachedUser(updated)
    expect(JSON.parse(sessionStorage.getItem('cachedUser')!).name).toBe('Updated')
  })
})

describe('getCachedUser', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns null when no user cached', () => {
    expect(getCachedUser()).toBeNull()
  })

  it('returns cached user object', () => {
    sessionStorage.setItem('cachedUser', JSON.stringify(mockUser))
    expect(getCachedUser()).toEqual(mockUser)
  })

  it('returns null for invalid JSON', () => {
    sessionStorage.setItem('cachedUser', 'not-json{{{')
    expect(getCachedUser()).toBeNull()
  })

  it('handles user with null fields', () => {
    const noName = { ...mockUser, name: null, email: null, businessId: null }
    sessionStorage.setItem('cachedUser', JSON.stringify(noName))
    expect(getCachedUser()).toEqual(noName)
  })
})

describe('hasCachedSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('returns false when no cached user', () => {
    expect(hasCachedSession()).toBe(false)
  })

  it('returns true when user is cached', () => {
    sessionStorage.setItem('cachedUser', JSON.stringify(mockUser))
    expect(hasCachedSession()).toBe(true)
  })
})
