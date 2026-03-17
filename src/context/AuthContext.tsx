import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser } from '../features/auth/auth.types'
import * as authLib from '../lib/auth'

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  handleLogout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount: check for existing session via cached user + server verification
  useEffect(() => {
    const controller = new AbortController()

    async function init() {
      // Load cached user immediately (offline-first hint)
      const cached = authLib.getCachedUser()
      if (cached) {
        setUser(cached)
        setIsLoading(false)
      }

      // Verify with server — cookie sends auth token automatically
      try {
        const response = await authLib.getMe(controller.signal)
        setUser(response.user)
        authLib.setCachedUser(response.user)
      } catch {
        if (!cached) {
          // No cached user AND server verification failed — not authenticated
          authLib.clearAuth()
          setUser(null)
        }
        // If cached user exists but server fails (offline), keep showing cached user
      }

      setIsLoading(false)
    }

    init()
    return () => controller.abort()
  }, [])

  const handleLogout = () => {
    authLib.logout()
    setUser(null)
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      setUser,
      handleLogout,
    }),
    [user, isLoading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
