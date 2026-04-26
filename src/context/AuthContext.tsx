import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, BusinessSummary } from '../features/auth/auth.types'
import * as authLib from '../lib/auth'
import { API_URL } from '../config/app.config'

interface AuthContextType {
  user: AuthUser | null
  businesses: BusinessSummary[]
  isAuthenticated: boolean
  isLoading: boolean
  isSwitching: boolean
  switchingBusinessId: string | null
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
  const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null)
  const isSwitching = switchingBusinessId !== null

  // On mount: fire a best-effort health ping to wake a cold-start server
  // (e.g. Render free tier spins down after inactivity). This runs in parallel
  // with the session check so the server is warm when the user clicks Sign In.
  useEffect(() => {
    void fetch(`${API_URL}/health`, { credentials: 'include' }).catch(() => {})
  }, [])

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
    if (switchingBusinessId) return
    setSwitchingBusinessId(businessId)
    try {
      const result = await authLib.switchBusiness(businessId)
      // Update cached user with new businessId before redirect
      const currentUser = authLib.getCachedUser()
      if (currentUser) {
        authLib.setCachedUser({ ...currentUser, businessId: result.business.id })
      }
      // Navigate to dashboard — reload clears all business-scoped caches
      window.location.href = '/'
    } catch (err) {
      setSwitchingBusinessId(null)
      throw err
    }
  }, [switchingBusinessId])

  const value = useMemo(
    () => ({
      user,
      businesses,
      isAuthenticated: !!user,
      isLoading,
      isSwitching,
      switchingBusinessId,
      setUser,
      setBusinesses,
      handleLogout,
      switchBusiness,
    }),
    [user, businesses, isLoading, isSwitching, switchingBusinessId, handleLogout, switchBusiness]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
