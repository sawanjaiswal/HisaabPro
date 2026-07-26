import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { AuthUser, BusinessSummary } from '../features/auth/auth.types'
import * as authLib from '../lib/auth'
import { ApiError } from '../lib/api-error'

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
      // An empty cached list is not evidence of anything: it looks the same for
      // a brand-new account and for one whose first business was created (or
      // joined) after the cache was written. Rendering on it hands the business
      // gate a false "no businesses", which redirects to /onboarding — a route
      // the gate exempts, so the correction /auth/me brings back a moment later
      // never navigates anywhere and the owner is stranded on the welcome
      // screen. Wait for the server in that case; keep the instant render, the
      // whole point of the cache, whenever it actually holds a business.
      // See .claude/fix-trace-empty-business-cache.md.
      if (cached) {
        setUser(cached)
        if (cachedBiz?.length) {
          setBusinesses(cachedBiz)
          setIsLoading(false)
        }
      }

      // Verify with server — cookie sends auth token automatically
      try {
        const response = await authLib.getMe(controller.signal)
        setUser(response.user)
        setBusinesses(response.businesses)
        setActiveBusiness(response.activeBusiness)
        authLib.setCachedUser(response.user)
        authLib.setCachedBusinesses(response.businesses)
      } catch (err) {
        // An aborted request is not a failure — it is the absence of an answer.
        // The effect that started it has already been torn down (React does
        // that on every remount, and deliberately on the first mount under
        // StrictMode in dev), and the effect that replaced it is running its
        // own init() which will publish the real state. Concluding anything
        // here — above all ending isLoading, the only thing holding the
        // business gate off — publishes an empty, unverified business list and
        // redirects the owner to /onboarding, a route the gate exempts, so the
        // answer arriving a moment later never navigates back.
        // See .claude/fix-trace-aborted-auth-verify.md.
        if (controller.signal.aborted) return

        // The cached user is an offline-first hint, not proof of a session. Keep
        // it when the request never got an answer (no network, server down) —
        // that is the 2G case the cache exists for. Drop it on a 401: the
        // refresh interceptor has already retried and failed, so the session is
        // authoritatively gone (revoked, expired, logged out elsewhere) and
        // trusting the cache strands the user on a dashboard that can only
        // render errors, with no route back to /login.
        // See .claude/fix-trace-dead-session-stranded.md.
        const sessionIsGone = err instanceof ApiError && err.status === 401
        if (!cached || sessionIsGone) {
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
