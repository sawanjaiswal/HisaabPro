import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, BusinessSummary } from '../features/auth/auth.types'
import * as authLib from '../lib/auth'

interface AuthContextType {
  user: AuthUser | null
  businesses: BusinessSummary[]
  isAuthenticated: boolean
  isLoading: boolean
  isSwitching: boolean
  setUser: (user: AuthUser | null) => void
  setBusinesses: (businesses: BusinessSummary[]) => void
  handleLogout: () => void
  switchBusiness: (businessId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSwitching, setIsSwitching] = useState(false)

  // On mount: check for existing session via cached user + server verification
  useEffect(() => {
    const controller = new AbortController()

    async function init() {
      // Load cached user immediately (offline-first hint)
      const cached = authLib.getCachedUser()
      const cachedBiz = authLib.getCachedBusinesses()
      if (cached) {
        setUser(cached)
        if (cachedBiz) setBusinesses(cachedBiz)
        setIsLoading(false)
      }

      // Verify with server — cookie sends auth token automatically
      try {
        const response = await authLib.getMe(controller.signal)
        setUser(response.user)
        setBusinesses(response.businesses)
        authLib.setCachedUser(response.user)
        authLib.setCachedBusinesses(response.businesses)
      } catch {
        if (!cached) {
          authLib.clearAuth()
          setUser(null)
          setBusinesses([])
        }
      }

      setIsLoading(false)
    }

    init()
    return () => controller.abort()
  }, [])

  const handleLogout = useCallback(() => {
    authLib.logout()
    setUser(null)
    setBusinesses([])
  }, [])

  const switchBusiness = useCallback(async (businessId: string) => {
    if (isSwitching) return
    setIsSwitching(true)
    try {
      const result = await authLib.switchBusiness(businessId)
      // Update user with new businessId
      setUser(prev => prev ? { ...prev, businessId: result.business.id } : null)
      authLib.setCachedUser({
        ...user!,
        businessId: result.business.id,
      })
      // Force reload to clear all business-scoped state
      window.location.reload()
    } catch {
      setIsSwitching(false)
    }
  }, [isSwitching, user])

  const value = useMemo(
    () => ({
      user,
      businesses,
      isAuthenticated: !!user,
      isLoading,
      isSwitching,
      setUser,
      setBusinesses,
      handleLogout,
      switchBusiness,
    }),
    [user, businesses, isLoading, isSwitching, handleLogout, switchBusiness]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
