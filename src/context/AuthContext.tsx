import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, BusinessSummary } from '../features/auth/auth.types'
import * as authLib from '../lib/auth'

interface AuthContextType {
  user: AuthUser | null
  businesses: BusinessSummary[]
  /** Phase 6 #138 — the BusinessSummary for the current activeBusinessId (carries suspendedAt + businessSuspendedAt). */
  activeBusiness: BusinessSummary | null
  isAuthenticated: boolean
  isLoading: boolean
  isSwitching: boolean
  switchingBusinessId: string | null
  setUser: (user: AuthUser | null) => void
  setBusinesses: (businesses: BusinessSummary[]) => void
  /** Phase 6 #138 — replace the activeBusiness reference in-place (after suspend/reactivate flips a flag). */
  refreshActiveBusiness: () => Promise<void>
  handleLogout: () => void
  switchBusiness: (businessId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [businesses, setBusinesses] = useState<BusinessSummary[]>([])
  const [activeBusiness, setActiveBusiness] = useState<BusinessSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [switchingBusinessId, setSwitchingBusinessId] = useState<string | null>(null)
  const isSwitching = switchingBusinessId !== null

  // On mount: wake a cold-start server (e.g. Render free tier) before login.
  useEffect(() => { authLib.warmupServer() }, [])

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
        setActiveBusiness(response.activeBusiness)
        authLib.setCachedUser(response.user)
        authLib.setCachedBusinesses(response.businesses)
      } catch {
        if (!cached) {
          authLib.clearAuth()
          setUser(null)
          setBusinesses([])
          setActiveBusiness(null)
        }
      }

      setIsLoading(false)
    }

    init()
    return () => controller.abort()
  }, [])

  /**
   * Phase 6 #138 PR2 — refetch /me so the active business's suspendedAt fields
   * flip after a suspend/reactivate action. Cheap (<50ms over local), doesn't
   * change the auth token, doesn't redirect.
   */
  const refreshActiveBusiness = useCallback(async () => {
    try {
      const response = await authLib.getMe()
      setUser(response.user)
      setBusinesses(response.businesses)
      setActiveBusiness(response.activeBusiness)
      authLib.setCachedUser(response.user)
      authLib.setCachedBusinesses(response.businesses)
    } catch {
      // /me failed — leave existing state; the next page navigation will
      // surface the 401/403 via the global error handler.
    }
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
      activeBusiness,
      isAuthenticated: !!user,
      isLoading,
      isSwitching,
      switchingBusinessId,
      setUser,
      setBusinesses,
      refreshActiveBusiness,
      handleLogout,
      switchBusiness,
    }),
    [user, businesses, activeBusiness, isLoading, isSwitching, switchingBusinessId, refreshActiveBusiness, handleLogout, switchBusiness]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
