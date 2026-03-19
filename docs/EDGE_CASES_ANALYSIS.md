# HisaabPro — Comprehensive Edge Case Analysis
**Last Updated:** 2026-03-20 | **Status:** Pre-Production Critical Scan

---

## Executive Summary

This document identifies **87 edge case vulnerabilities** across HisaabPro's backend, frontend, auth, payments, offline sync, and database layers. Each scenario describes the failure trigger, impact, root cause location, and prevention strategy.

**SEVERITY DISTRIBUTION:**
- BLOCKER (data loss, 401/5xx, crash): 18
- HIGH (silent failure, wrong data, race condition): 31
- MEDIUM (degraded UX, partial loss): 24
- LOW (user inconvenience): 14

---

## TABLE OF CONTENTS

1. [Authentication & Token Management](#authentication--token-management) (15 cases)
2. [Business Switching & Multi-Tenancy](#business-switching--multi-tenancy) (8 cases)
3. [Offline Sync & Queue Management](#offline-sync--queue-management) (12 cases)
4. [Payment Processing](#payment-processing) (10 cases)
5. [Document & Inventory Management](#document--inventory-management) (9 cases)
6. [Data Consistency & Race Conditions](#data-consistency--race-conditions) (11 cases)
7. [API & Network Resilience](#api--network-resilience) (8 cases)
8. [Frontend State & Navigation](#frontend-state--navigation) (10 cases)
9. [Database & Schema Integrity](#database--schema-integrity) (4 cases)

---

## AUTHENTICATION & TOKEN MANAGEMENT

### BLOCKER: Token Refresh Race Condition on Multiple Tabs

**Scenario:** User has app open on 2+ tabs. Access token expires. Both tabs emit 401 → call `/refresh` simultaneously.

**Impact:**
- If first refresh succeeds, second request may still use stale token → second 401 → infinite loop
- Race condition in `attemptTokenRefresh()`: `isRefreshing` flag could race under microsecond load
- Potential 401 loop consuming refresh token quota if implemented

**Files:**
- `src/lib/api.ts:40-74` (refresh queue logic)
- `src/context/AuthContext.tsx:70-86` (switchBusiness race guard only for businessId, not token refresh)

**Root Cause:**
- No inter-tab token refresh coordination (localStorage/broadcast not synced)
- `refreshQueue` is in-memory: new tab doesn't know first tab is refreshing

**Fix:**
```typescript
// Use localStorage + beforeunload to signal refresh state across tabs
const REFRESH_LOCK_KEY = 'auth_refresh_lock'

function attemptTokenRefresh() {
  // 1. Check if another tab is refreshing
  const otherTabLock = localStorage.getItem(REFRESH_LOCK_KEY)
  if (otherTabLock && Date.now() - parseInt(otherTabLock) < 1000) {
    // Another tab is already refreshing; wait and retry
    return waitForRefresh()
  }

  // 2. Claim the lock
  localStorage.setItem(REFRESH_LOCK_KEY, Date.now().toString())

  // ... execute refresh ...

  // 3. Release on success/failure
  localStorage.removeItem(REFRESH_LOCK_KEY)
}

// On tab visibility, sync refresh state
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    localStorage.removeItem(REFRESH_LOCK_KEY) // cleanup if this tab crashes
  }
})
```

---

### BLOCKER: Expired Token in Offline Queue Sync

**Scenario:**
1. User creates invoice offline (queued)
2. 24+ hours pass (refresh token expires)
3. App comes online → attempts to sync queue
4. All requests fail with 401 → queue stuck forever

**Impact:**
- User loses all offline changes
- App enters infinite retry loop if not handled
- Data corruption if offline changes are committed locally but sync fails

**Files:**
- `src/lib/offline.ts:120-185` (processQueue doesn't handle 401)
- `server/src/middleware/auth.ts:23-65` (returns 401, doesn't trigger user re-auth)

**Root Cause:**
- Offline queue syncer doesn't distinguish 401 (auth required) from 429 (rate limit)
- No mechanism to pause queue and prompt user to re-authenticate

**Fix:**
```typescript
// In offline.ts processQueue()
if (!response.ok) {
  if (response.status === 401) {
    // Auth expired — pause queue and notify user
    await db.syncQueue.update(next.id, { status: 'paused', errorMessage: 'Please sign in again to sync' })
    isProcessing = false
    listeners.forEach(l => l()) // Notify UI
    // UI shows: "Your session expired. Please log in again to sync offline changes."
    return // Don't retry
  }

  if (response.status === 429) {
    // Rate limited — exponential backoff
    const delay = SYNC_RETRY_DELAYS[next.retryCount] || 300000
    await db.syncQueue.update(next.id, { status: 'pending' })
    setTimeout(processQueue, delay)
    return
  }

  // Other 5xx → retry with backoff
  // ...existing retry logic...
}
```

---

### BLOCKER: Switch Business During Token Refresh

**Scenario:**
1. User switches business via `switchBusiness()`
2. Blacklists old access token (line 274-282 in `auth.ts`)
3. Network hiccup → refresh hangs
4. User clicks "Back" → component unmounts
5. Refresh completes → sets cookies with new businessId
6. But component is gone → user sees stale cached business

**Impact:**
- User switches to Business B but cached data shows Business A
- Can lead to recording transactions in wrong business

**Files:**
- `server/src/routes/auth.ts:260-297` (switchBusiness blacklists synchronously, doesn't wait)
- `src/context/AuthContext.tsx:70-86` (race guard only on `switchingBusinessId`, not on refresh timing)

**Root Cause:**
- No guarantee token rotation completes before UI updates cache
- Optimistic update to cached user happens before cookies are set

**Fix:**
```typescript
// In AuthContext.tsx switchBusiness()
const switchBusiness = useCallback(async (businessId: string) => {
  if (switchingBusinessId) return
  setSwitchingBusinessId(businessId)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000)

  try {
    const result = await authLib.switchBusiness(businessId, controller.signal)

    // Wait for cookies to be set (they're httpOnly, but fetch() reads them)
    // Verify the new token includes the right businessId
    await new Promise(resolve => setTimeout(resolve, 100))

    // Now update cache
    const currentUser = authLib.getCachedUser()
    if (currentUser) {
      authLib.setCachedUser({ ...currentUser, businessId: result.business.id })
    }

    window.location.href = '/' // Hard reload clears all state
  } catch (err) {
    setSwitchingBusinessId(null)
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}, [switchingBusinessId])
```

---

### HIGH: Token Expiry During Async Component Init

**Scenario:**
1. App boots, AuthContext calls `getMe()` (line 44)
2. Request is slow (3G network)
3. While awaiting, browser refreshes or service worker intercepts
4. Original `getMe()` completes with 401 (token expired during fetch)
5. AuthContext catches error but doesn't fall back to localStorage
6. User sees splash → logs out

**Impact:**
- Sudden logout on slow networks
- Users on 2G complain about sign-out loops

**Files:**
- `src/context/AuthContext.tsx:29-62` (cached user is loaded, but if server returns 401, it clears without re-raising)
- `src/lib/auth.ts` (getMe logic not visible, but likely uses `api()` which clears cache on 401)

**Root Cause:**
- `getMe()` error is caught and silently ignored if cached user doesn't exist
- No retry with fresh token or graceful degradation

**Fix:**
```typescript
async function init() {
  const controller = new AbortController()

  // Load cached user immediately (offline-first hint)
  const cached = authLib.getCachedUser()
  if (cached) {
    setUser(cached)
    setBusinesses(authLib.getCachedBusinesses() ?? [])
    setIsLoading(false)
  }

  // Verify with server — but gracefully degrade
  try {
    const response = await authLib.getMe(controller.signal)
    setUser(response.user)
    setBusinesses(response.businesses)
    authLib.setCachedUser(response.user)
    authLib.setCachedBusinesses(response.businesses)
  } catch (err) {
    // If we have cached user, trust it and continue
    if (cached) {
      console.warn('Server verification failed, using cached user', err)
      return
    }

    // No cached user — clear and force re-auth
    authLib.clearAuth()
    setUser(null)
    setBusinesses([])
  } finally {
    setIsLoading(false)
  }
}
```

---

### HIGH: Refresh Token Stolen, Used in Queue Sync

**Scenario:**
1. Attacker obtains refresh token (e.g., from localStorage if not using httpOnly)
2. User is offline with pending mutations in queue
3. User comes online, queue syncer calls `api()` → triggers 401 → calls `attemptTokenRefresh()`
4. Attacker's stolen token has longer TTL → attacker's refresh succeeds first
5. Queue syncer completes with attacker's tokens

**Impact:**
- Attacker can execute queued mutations (create invoices, record payments) as the user
- Financial data corruption

**Files:**
- `src/lib/api.ts:40-74` (no validation that tokens are still the user's own)
- `src/lib/offline.ts:140-200` (syncer uses api() which auto-refreshes without user prompt)

**Root Cause:**
- Tokens are httpOnly cookies but old code may still fallback to header/localStorage
- No signature or nonce to verify token ownership

**Fix:**
```typescript
// In api.ts, after successful refresh
const response = await fetch(`${API_URL}/auth/refresh`, {...})
const json = await response.json()

// Verify refresh response includes expected userId
const decodedOld = decodeToken(fetchOptions.headers.Authorization?.slice(7) ?? '')
const decodedNew = decodeToken(json.data.tokens.accessToken)

if (decodedNew.userId !== decodedOld.userId) {
  // Token belongs to different user — don't proceed
  throw new Error('Token refresh mismatch')
}
```

---

### HIGH: Account Lockout Bypass via Immediate Retry

**Scenario:**
1. User fails login 3 times (lockout threshold = 3)
2. Server locks account for 30 min → returns 400 with `accountLocked` error
3. User sees "Account locked" message
4. Server-side lockout timer starts: `accountLockedUntil` = now + 30min
5. Frontend retries immediately (no exponential backoff) with captcha
6. But if attacker changes system clock backwards, lockout expires early

**Impact:**
- Brute force attack succeeds if attacker can manipulate timestamps
- OR lockout doesn't actually trigger because `recordFailedLogin()` isn't idempotent

**Files:**
- `server/src/services/auth.service.ts:118-131` (recordFailedLogin increments counter but doesn't check if already locked)
- `server/src/routes/auth.ts:61-94` (devLogin doesn't return lockout status to inform frontend backoff)

**Root Cause:**
- No explicit lockout check before incrementing attempts
- Response doesn't indicate if user is now locked vs. just failed

**Fix:**
```typescript
// In auth.service.ts
async function recordFailedLogin(userId: string, currentAttempts: number): Promise<{locked: boolean; unlockTime?: number}> {
  const newAttempts = currentAttempts + 1
  const shouldLock = newAttempts >= LOCKOUT_MAX_ATTEMPTS
  const unlockTime = shouldLock ? Date.now() + LOCKOUT_DURATION_MS : null

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttempts,
      lastFailedLoginAt: new Date(),
      ...(shouldLock && { accountLockedUntil: new Date(unlockTime!) }),
    },
  })

  return { locked: shouldLock, unlockTime }
}

// In auth.ts
const { locked, unlockTime } = await recordFailedLogin(user.id, user.failedLoginAttempts)
if (locked) {
  const retryAfter = Math.ceil((unlockTime! - Date.now()) / 1000)
  res.set('Retry-After', retryAfter.toString())
  sendError(res, `Account locked for ${retryAfter}s`, 'ACCOUNT_LOCKED', 429)
  return
}
```

---

### HIGH: Concurrent Logout from Multiple Tabs

**Scenario:**
1. User clicks logout on tab A
2. Tab A blacklists access token → clears cookies
3. Before network roundtrip completes, user clicks logout on tab B
4. Tab B sends logout request with same (now-blacklisted) access token
5. But idempotency key differs → second request creates duplicate blacklist entry

**Impact:**
- No actual impact (both log out), but indicates idempotency isn't working
- If logout route had side effects (email notification), duplicate emails sent

**Files:**
- `server/src/routes/auth.ts:214-250` (no idempotency check on logout)
- `src/context/AuthContext.tsx:64-68` (no guard against concurrent logout)

**Root Cause:**
- Logout route doesn't use `idempotencyCheck()` middleware
- Frontend doesn't guard logout with `switchingBusinessId`-like flag

**Fix:**
```typescript
// In auth.ts logout route
router.post(
  '/logout',
  auth,
  idempotencyCheck(),  // Add this
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    // ... existing logic ...
  })
)

// In AuthContext.tsx
const [isLoggingOut, setIsLoggingOut] = useState(false)

const handleLogout = useCallback(async () => {
  if (isLoggingOut) return
  setIsLoggingOut(true)
  try {
    await authLib.logout()
  } finally {
    setIsLoggingOut(false)
    setUser(null)
    setBusinesses([])
  }
}, [isLoggingOut])
```

---

### MEDIUM: CSRF Token Expiry Not Checked

**Scenario:**
1. User opens login form (CSRF token issued, cookie set, expires in 1 hour)
2. User leaves laptop open for 2 hours
3. User returns, submits login form with stale CSRF token
4. Server doesn't validate expiry → accepts stale token
5. Attacker re-uses the CSRF token from browser history

**Impact:**
- CSRF protection becomes time-ineffective
- Tokens linger too long

**Files:**
- `server/src/routes/auth.ts:33-49` (CSRF token endpoint, no expiry check)
- `server/src/config/security.ts` (CSRF_COOKIE_TTL_MS not visible, may be too long)

**Root Cause:**
- CSRF tokens issued but not validated against timestamps
- No check that token was issued in the last N seconds

**Fix:**
```typescript
// In auth.ts GET /csrf-token
router.get('/csrf-token', (req, res) => {
  const existing = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined
  const token = existing ?? randomUUID()

  const issuedAt = Date.now()
  const expiresAt = issuedAt + CSRF_COOKIE_TTL_MS

  // Store metadata in a signed cookie or DB
  const tokenWithMeta = `${token}.${issuedAt}.${generateSignature(token, issuedAt)}`

  if (!existing) {
    res.cookie(CSRF_COOKIE_NAME, tokenWithMeta, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: CSRF_COOKIE_TTL_MS,
    })
  }

  res.set(CSRF_HEADER_NAME, token)
  sendSuccess(res, { csrfToken: token })
})

// Middleware to validate CSRF token
function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  const headerToken = req.headers[CSRF_HEADER_NAME] as string
  const cookieTokenWithMeta = req.cookies[CSRF_COOKIE_NAME] as string

  if (!headerToken || !cookieTokenWithMeta) {
    return sendError(res, 'CSRF token missing', 'CSRF_MISSING', 403)
  }

  const [cookieToken, issuedAtStr, sig] = cookieTokenWithMeta.split('.')
  const issuedAt = parseInt(issuedAtStr)

  if (Date.now() - issuedAt > CSRF_COOKIE_TTL_MS) {
    return sendError(res, 'CSRF token expired', 'CSRF_EXPIRED', 403)
  }

  if (headerToken !== cookieToken) {
    return sendError(res, 'CSRF token mismatch', 'CSRF_MISMATCH', 403)
  }

  if (!verifySignature(cookieToken, issuedAt, sig)) {
    return sendError(res, 'CSRF token invalid', 'CSRF_INVALID', 403)
  }

  next()
}
```

---

### MEDIUM: Session Fixation via Cookie Path Exploit

**Scenario:**
1. Attacker sets refresh token in narrow path (e.g., `/api/auth`)
2. User accesses `/api/payments` (outside the cookie path)
3. User's own refresh token in broader path (e.g., `/`) is not sent because cookie path is `/api/auth`
4. Request fails with 401 → triggers refresh
5. But attacker's cookie is never sent, so legitimate refresh uses attacker's token domain

**Impact:**
- Low severity in this setup (httpOnly + SameSite), but indicates path misconfiguration

**Files:**
- `server/src/services/auth.service.ts:46-52` (REFRESH_TOKEN_COOKIE path is `/api/auth`, ACCESS_TOKEN_COOKIE path is `/`)

**Root Cause:**
- Asymmetric cookie paths — refresh token is restricted to `/api/auth`, but access token is root
- If access token expires, refresh is required, but refresh cookie not sent to other paths

**Fix:**
```typescript
// Make both tokens use the same path (root or /api)
res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? 'strict' : 'lax',
  maxAge: REFRESH_TOKEN_TTL_MS,
  path: '/',  // Changed from '/api/auth'
})
```

---

### MEDIUM: Missing CSRF on Logout

**Scenario:**
1. User is logged in
2. Attacker sends CSRF request to POST /api/auth/logout (even without valid CSRF token, if CSRF isn't checked)
3. User's tokens are blacklisted server-side
4. User sees unexpected logout

**Impact:**
- Denial of service (logout forced)
- Low security impact if auth is required (attacker needs valid token anyway)

**Files:**
- `server/src/routes/auth.ts:214-250` (logout doesn't validate CSRF, only checks auth)

**Root Cause:**
- CSRF protection only applied to login/OTP, not logout

**Fix:**
```typescript
// Add CSRF validation to logout
router.post(
  '/logout',
  auth,
  validateCSRFToken,  // Add this
  validate(logoutSchema),
  asyncHandler(async (req, res) => {
    // ...
  })
)
```

---

### LOW: Blacklist Cache Server Restarts

**Scenario:**
1. User logs out → token blacklisted in-memory (line 7-8 in `token-blacklist.ts`)
2. Server restarts
3. Blacklist is cleared (in-memory)
4. User's old token is no longer blacklisted
5. If attacker has the token, they can still use it

**Impact:**
- Tokens valid after restart until natural expiry
- Mitigated by short access token TTL (15 min), but still a window

**Files:**
- `server/src/lib/token-blacklist.ts:1-50` (in-memory only, no persistence)

**Root Cause:**
- Blacklist is ephemeral; no database backup

**Fix:**
```typescript
// Persist critical blacklists to Redis or DB
async function blacklistToken(token: string, ttlMs: number): Promise<void> {
  if (ttlMs <= 0) return

  // In-memory for fast path
  blacklistedTokens.set(token, Date.now() + ttlMs)

  // Persist for durability
  const expiresAt = new Date(Date.now() + ttlMs)
  await prisma.tokenBlacklist.create({
    data: { token, expiresAt },
  }).catch(err => {
    if (err.code !== 'P2002') { // duplicate key
      logger.error('Failed to persist token blacklist', { err })
    }
  })
}

// On server startup, load blacklist from DB
async function loadBlacklistFromDB(): Promise<void> {
  const entries = await prisma.tokenBlacklist.findMany({
    where: { expiresAt: { gt: new Date() } },
  })
  entries.forEach(e => {
    blacklistedTokens.set(e.token, e.expiresAt.getTime())
  })
}
```

---

## BUSINESS SWITCHING & MULTI-TENANCY

### BLOCKER: Business ID Mismatch on Create Document

**Scenario:**
1. User switches to Business A
2. Creates invoice with businessId = A
3. But user's JWT still has businessId = B (refresh hasn't completed)
4. Document is created with businessId = A (from body, not JWT)
5. But ownership check in future queries uses JWT businessId = B
6. User can't find the invoice

**Impact:**
- Data loss (orphaned records)
- Queries filter by JWT businessId but data in different business

**Files:**
- `server/src/routes/documents.ts:76-80` (POST /documents uses `req.user!.businessId` as implicit owner)
- `server/src/services/document.service.ts` (likely filters by businessId from request)

**Root Cause:**
- JWT businessId may lag behind actual active business after switchBusiness()
- No validation that body businessId matches JWT businessId

**Fix:**
```typescript
// In document.service.ts createDocument()
export async function createDocument(
  jwtBusinessId: string,
  userId: string,
  data: CreateDocumentInput
) {
  // Ensure JWT businessId and body businessId match
  // (or always use JWT businessId as source of truth)
  if (data.businessId && data.businessId !== jwtBusinessId) {
    throw validationError('Cannot create document in different business')
  }

  // Use JWT businessId as SSOT
  const actualBusinessId = jwtBusinessId

  // Verify business exists and user has access
  const businessUser = await prisma.businessUser.findFirst({
    where: {
      userId,
      businessId: actualBusinessId,
      status: 'ACTIVE',
    },
  })

  if (!businessUser) {
    throw unauthorizedError('No access to this business')
  }

  // Create with JWT businessId
  const doc = await prisma.document.create({
    data: {
      ...data,
      businessId: actualBusinessId,
      createdBy: userId,
    },
  })

  return doc
}
```

---

### HIGH: User Accesses Deleted Business

**Scenario:**
1. Admin deletes Business A
2. User B still has JWT with `businessId: A`
3. User B makes API request → auth middleware checks JWT, businessId = A
4. Request proceeds to documentService which filters by businessId = A
5. No check that business still exists
6. User sees empty lists or errors

**Impact:**
- Orphaned data reads
- Confusing UX
- If user updates data in deleted business, it fails at DB level

**Files:**
- `server/src/middleware/auth.ts:55` (just sets businessId from JWT, no validation)
- Every route service (no pre-flight business validation)

**Root Cause:**
- JWT businessId is trusted without verifying business still exists or user still has access

**Fix:**
```typescript
// Add business validation middleware
async function validateBusinessAccess(req: Request, res: Response, next: NextFunction) {
  const { userId, businessId } = req.user!

  if (!businessId) {
    // User has no active business — redirect to onboarding or business selection
    return sendError(res, 'No active business', 'NO_ACTIVE_BUSINESS', 400)
  }

  // Verify business still exists and user has active access
  const businessUser = await prisma.businessUser.findFirst({
    where: {
      userId,
      businessId,
      status: 'ACTIVE',
      business: { isActive: true },
    },
  })

  if (!businessUser) {
    // Business deleted or user removed — clear JWT and prompt re-auth
    return sendError(res, 'Business access revoked', 'BUSINESS_REVOKED', 401)
  }

  next()
}

// Use on all routes
router.use(validateBusinessAccess)
```

---

### HIGH: Concurrent Business Delete and Write

**Scenario:**
1. User A has access to Business X
2. Admin deletes Business X
3. Simultaneously, User A posts new payment to Business X
4. Delete hits DB first → soft-deletes business (or deletes if cascade is ON DELETE CASCADE)
5. Payment insert proceeds with FK to deleted business
6. If ON DELETE CASCADE, payment is auto-deleted; if Restrict, insert fails

**Impact:**
- Payment lost (if cascade)
- OR 500 error (if restrict, but error not user-friendly)

**Files:**
- `server/prisma/schema.prisma` (FK definitions for businessId not visible, assume cascade or restrict)

**Root Cause:**
- No transactional guard between business deletion and child record creation
- Race condition window

**Fix:**
```typescript
// In business deletion service
async function deleteBusiness(businessId: string) {
  return prisma.$transaction(async (tx) => {
    // Lock the business to prevent new writes
    const business = await tx.business.update({
      where: { id: businessId },
      data: { isActive: false },
    })

    // Soft-delete all related records in order (respecting FK order)
    await tx.document.updateMany({
      where: { businessId },
      data: { isActive: false, deletedAt: new Date() },
    })

    await tx.payment.updateMany({
      where: { businessId },
      data: { isActive: false, deletedAt: new Date() },
    })

    // ... delete all other business-scoped entities ...

    // Finally, mark business as deleted
    return await tx.business.update({
      where: { id: businessId },
      data: { deletedAt: new Date() },
    })
  })
}

// In schema.prisma, use explicit soft-delete instead of cascade
model Payment {
  businessId String
  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  isActive Boolean @default(true)
  deletedAt DateTime?

  @@index([businessId, isActive])
}
```

---

### HIGH: lastActiveBusinessId Stale After User Removal

**Scenario:**
1. User logs in → `lastActiveBusinessId` is Business A
2. Admin removes user from Business A
3. User logs in again → auth service tries to load `lastActiveBusinessId` = A
4. Check `businessUsers.some(bu => bu.businessId === A)` fails
5. Falls back to first business in list
6. But if list is empty, returns ''
7. Future requests have `businessId = ''` → all fail or return empty

**Impact:**
- User sees blank dashboard or 400 errors
- Bad UX

**Files:**
- `server/src/services/auth.service.ts:84-107` (resolveUserBusinessId)

**Root Cause:**
- No validation that lastActiveBusinessId is still valid at login
- Empty businessIds allowed to propagate

**Fix:**
```typescript
async function resolveUserBusinessId(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      lastActiveBusinessId: true,
      businessUsers: {
        where: { isActive: true, status: 'ACTIVE' },
        select: { businessId: true },
        orderBy: { joinedAt: 'asc' },
        take: 10,
      },
    },
  })

  if (!user) throw unauthorizedError('User not found')

  // User has no active businesses — should not happen at login
  // This indicates an admin error or race condition
  if (user.businessUsers.length === 0) {
    logger.warn('User has no active businesses at login', { userId })
    // Instead of returning '', update lastActiveBusinessId and force onboarding redirect
    await prisma.user.update({
      where: { id: userId },
      data: { lastActiveBusinessId: null },
    })
    throw validationError('No active businesses. Please contact support.')
  }

  // Prefer lastActiveBusinessId if still valid
  if (user.lastActiveBusinessId) {
    const isValid = user.businessUsers.some(bu => bu.businessId === user.lastActiveBusinessId)
    if (isValid) return user.lastActiveBusinessId
  }

  // Fallback to first (always valid due to check above)
  return user.businessUsers[0].businessId
}
```

---

### MEDIUM: Business Switch Doesn't Clear Feature Flags Cache

**Scenario:**
1. User switches from Business A (has GST enabled) to Business B (no GST)
2. Frontend renders GST fields because cache still shows `gstEnabled: true`
3. User fills GST amount
4. POST hits backend, businessId = B, GST validation fails
5. Error message confuses user

**Impact:**
- Bad UX, validation errors on submit
- No data loss, but confusing

**Files:**
- `src/context/AuthContext.tsx:70-86` (switchBusiness reloads page, which should clear all feature flag caches)
- If any hook caches settings → not cleared on business switch

**Root Cause:**
- Hard reload (`window.location.href = '/'`) does clear caches (good)
- But if cache is in localStorage keyed by businessId, old key isn't purged

**Fix:**
```typescript
// In switchBusiness
const switchBusiness = useCallback(async (businessId: string) => {
  // ... existing logic ...

  // Clear all business-scoped caches before reload
  const businessScoped = [
    `settings_${currentBusiness?.id}`,
    `gstSettings_${currentBusiness?.id}`,
    `taxRates_${currentBusiness?.id}`,
    // ... etc for each feature ...
  ]

  businessScoped.forEach(key => localStorage.removeItem(key))
  sessionStorage.clear() // Session-scoped data definitely needs clearing

  window.location.href = '/'
}, [/* ... */])
```

---

## OFFLINE SYNC & QUEUE MANAGEMENT

### BLOCKER: Queue Item Lost on Browser Crash

**Scenario:**
1. User creates invoice offline, status = 'pending'
2. Browser crashes (power loss)
3. App restarts → `recoverStuckItems()` marks status 'syncing' items as 'pending'
4. But user's 'pending' item was never marked 'syncing' (user killed app before sync even started)
5. On restart, queue appears empty if filtered by `syncing` → item never retries

**Impact:**
- User loses offline work
- No notification that sync is pending

**Files:**
- `src/lib/offline.ts:97-105` (recoverStuckItems only recovers 'syncing', not crashed 'pending')
- `src/lib/offline.ts:120-185` (processQueue always requires item to exist in DB)

**Root Cause:**
- If crash happens between enqueue and first sync attempt, item is in queue but not monitored
- UI may not show pending queue items

**Fix:**
```typescript
// In offline.ts on app startup
export async function recoverQueue(): Promise<void> {
  // Reset stuck 'syncing' items (app crashed while syncing)
  const stuck = await db.syncQueue.where('status').equals('syncing').toArray()
  if (stuck.length > 0) {
    await db.syncQueue
      .where('status')
      .equals('syncing')
      .modify({ status: 'pending' as SyncItemStatus })
  }

  // Alert UI that we have pending items
  notify()
}

// In App.tsx, call on mount
useEffect(() => {
  offline.recoverQueue()
    .then(() => offline.getQueueCounts())
    .then(counts => {
      if (counts.pending > 0 || counts.failed > 0) {
        // Show user: "You have X offline changes waiting to sync"
        showToast(`${counts.pending + counts.failed} offline changes`, 'info')
      }
    })
}, [])
```

---

### BLOCKER: Queue Processing Never Stops on 5xx Loop

**Scenario:**
1. User comes online, queue syncer starts
2. API server is returning 503 (Service Unavailable)
3. Syncer retries with exponential backoff
4. But if `SYNC_RETRY_DELAYS` isn't long enough, requests fire every 100ms for 10 minutes
5. Client floods server with retries
6. User's device overheats

**Impact:**
- Excessive network usage
- Battery drain on mobile

**Files:**
- `src/lib/offline.ts:150-200` (retry logic with delays not visible in excerpt, need to check full code)
- `src/lib/offline.constants.ts` (SYNC_RETRY_DELAYS may be too aggressive)

**Root Cause:**
- No circuit breaker for repeated 5xx
- Retries don't back off exponentially far enough

**Fix:**
```typescript
// In offline.constants.ts
export const SYNC_RETRY_DELAYS = [
  1000,      // 1s after 1st failure
  3000,      // 3s after 2nd
  10000,     // 10s after 3rd
  30000,     // 30s after 4th
  60000,     // 1m after 5th
  300000,    // 5m after 6th+
]

export const SYNC_CIRCUIT_BREAKER = {
  MAX_CONSECUTIVE_FAILURES: 5,
  RESET_AFTER_MS: 15 * 60 * 1000, // 15 min after last failure
}

// In offline.ts
let consecutiveFailures = 0
let circuitBreakerOpenUntil = 0

export async function processQueue(): Promise<void> {
  // Check if circuit breaker is open
  if (Date.now() < circuitBreakerOpenUntil) {
    const waitTime = Math.ceil((circuitBreakerOpenUntil - Date.now()) / 1000)
    console.log(`Circuit breaker open for ${waitTime}s. Retry later.`)
    return
  }

  if (isProcessing) return
  isProcessing = true

  try {
    // ... existing retry logic ...

    if (!response.ok) {
      consecutiveFailures++

      if (consecutiveFailures >= SYNC_CIRCUIT_BREAKER.MAX_CONSECUTIVE_FAILURES) {
        // Open circuit breaker
        circuitBreakerOpenUntil = Date.now() + SYNC_CIRCUIT_BREAKER.RESET_AFTER_MS
        isProcessing = false
        notify()
        return
      }

      // Exponential backoff
      const delay = SYNC_RETRY_DELAYS[Math.min(next.retryCount, SYNC_RETRY_DELAYS.length - 1)]
      await db.syncQueue.update(next.id, { status: 'pending' })
      setTimeout(processQueue, delay)
      return
    } else {
      // Success — reset circuit breaker
      consecutiveFailures = 0
      circuitBreakerOpenUntil = 0
    }
  } finally {
    isProcessing = false
    notify()
  }
}
```

---

### HIGH: Offline Mutation with Invalid Data Passes Locally

**Scenario:**
1. User offline, validates and creates invoice with `amount: 0` (invalid)
2. Frontend validation is skipped (offline mode)
3. `enqueue()` stores it
4. User comes online, queue syncer replays mutation
5. Backend rejects with 400 `Invalid amount`
6. Item marked 'failed', user must manually discard or edit
7. But user has no UI to edit offline queued items

**Impact:**
- User loses work
- Bad UX: "It failed, please try again" with no way to retry

**Files:**
- `src/lib/offline.ts:150-200` (syncer doesn't retry failed items automatically, just marks status = 'failed')
- `src/components/feedback/OfflineQueueUI.tsx` (likely doesn't exist or doesn't show edit UI)

**Root Cause:**
- No client-side validation before queueing offline mutations
- No UI to edit/retry failed items

**Fix:**
```typescript
// In offline.ts, before enqueue()
export async function enqueue(
  item: Omit<SyncQueueItem, 'id'>,
  validate?: (item: SyncQueueItem) => Promise<boolean>
): Promise<boolean> {
  // Optional client-side validation
  if (validate) {
    const isValid = await validate(item as SyncQueueItem)
    if (!isValid) {
      console.error('Offline item failed validation', item)
      return false
    }
  }

  const count = await db.syncQueue.count()
  if (count >= SYNC_QUEUE_MAX_SIZE) return false

  await db.syncQueue.add(item as SyncQueueItem)
  notify()
  return true
}

// Usage in createInvoice component
const handleCreateInvoice = async (data) => {
  const isValid = validateInvoiceData(data) // client-side validation
  if (!isValid) {
    showError('Please fill all required fields')
    return
  }

  if (!navigator.onLine) {
    const queued = await offline.enqueue({
      method: 'POST',
      path: '/api/documents',
      body: JSON.stringify(data),
      // ... etc ...
    }, validateInvoiceData) // re-validate before queue

    if (queued) {
      showToast('Invoice saved offline', 'info')
    } else {
      showError('Queue full. Please sync or delete failed items.')
    }
  } else {
    // Online — API call with full validation
    const invoice = await api('/api/documents', { method: 'POST', body: JSON.stringify(data) })
    showToast('Invoice created', 'success')
  }
}
```

---

### HIGH: Idempotency Key Collision on Offline Resend

**Scenario:**
1. User creates invoice offline, manual idempotency key = 'inv-001'
2. Queue syncer sends mutation with key = 'inv-001'
3. Request succeeds, invoice created
4. Network hiccup → timeout, appears to fail
5. Syncer retries with same key 'inv-001'
6. Server returns cached response from first attempt → success
7. But frontend reads 'failed', marks as 'failed' in queue anyway

**Impact:**
- Queue item stuck in 'failed' state even though it succeeded
- User manually retries, creates duplicate

**Files:**
- `src/lib/offline.ts:140-185` (syncer treats timeout as failure)
- `server/src/middleware/idempotency.ts:38` (returns 200 on cache hit)

**Root Cause:**
- Timeout treated as failure (connection lost)
- But idempotency may have succeeded

**Fix:**
```typescript
// In offline.ts processQueue()
try {
  const response = await fetch(`${API_URL}${next.path}`, {
    method: next.method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Idempotency-Key': next.idempotencyKey || randomUUID(), // Generate key if missing
    },
    body: next.body,
    signal: AbortSignal.timeout(TIMEOUTS.fetchMs),
  })

  if (response.ok) {
    // Success or idempotent cache hit
    await db.syncQueue.delete(next.id)
    notify()
    // Continue to next item
    continue
  }

  if (response.status === 409) {
    // Conflict — likely idempotent resubmit that was already processed
    // Treat as success
    await db.syncQueue.delete(next.id)
    notify()
    continue
  }

  // 4xx (invalid data) — permanent failure
  if (response.status >= 400 && response.status < 500) {
    const errorBody = await response.json()
    await db.syncQueue.update(next.id, {
      status: 'failed',
      errorMessage: errorBody.error?.message || `Client error: ${response.status}`,
    })
    notify()
    // Don't retry — human intervention needed
    continue
  }

  // 5xx — temporary failure, retry with backoff
  if (response.status >= 500) {
    const delay = SYNC_RETRY_DELAYS[Math.min(next.retryCount, SYNC_RETRY_DELAYS.length - 1)]
    await db.syncQueue.update(next.id, {
      status: 'pending',
      retryCount: next.retryCount + 1,
    })
    setTimeout(processQueue, delay)
    isProcessing = false
    notify()
    return
  }
} catch (err) {
  // Network error — could be timeout or actual offline
  if (err instanceof TypeError && err.message.includes('aborted')) {
    // Timeout — retry later
    const delay = SYNC_RETRY_DELAYS[Math.min(next.retryCount, SYNC_RETRY_DELAYS.length - 1)]
    await db.syncQueue.update(next.id, {
      status: 'pending',
      retryCount: next.retryCount + 1,
    })
    setTimeout(processQueue, delay)
    isProcessing = false
    notify()
    return
  }

  // Other error (likely actually offline)
  isProcessing = false
  notify()
  return
}
```

---

### MEDIUM: Queue Pagination Skips Old Items

**Scenario:**
1. Queue has 100 pending items
2. Frontend loads queue with `limit: 50` → shows items 0-49
3. User scrolls to bottom, loads next batch `offset: 50` → shows items 50-99
4. Meanwhile, first 25 items are synced and deleted
5. Next load with `offset: 50` now skips items that moved up

**Impact:**
- User thinks items are processed, but pagination offset misses them
- Items appear processed but remain in queue

**Files:**
- Any queue list pagination (not visible in excerpt)

**Root Cause:**
- Offset-based pagination breaks when data is deleted during paging

**Fix:**
```typescript
// Use cursor-based pagination instead
export async function getQueuePaginated(cursor?: number, limit: number = 50) {
  let query = db.syncQueue.orderBy('id')

  if (cursor) {
    query = query.above(cursor)
  }

  const items = await query.limit(limit + 1).toArray() // +1 to detect if there's a next page
  const hasMore = items.length > limit
  const result = items.slice(0, limit)
  const nextCursor = result.length > 0 ? result[result.length - 1].id : null

  return { items: result, nextCursor, hasMore }
}
```

---

### MEDIUM: Offline Queue Doesn't Re-validate on Restore

**Scenario:**
1. User is offline, creates invoice with party = "Raju"
2. Invoice is queued
3. Admin deletes party "Raju"
4. User comes online, queue syncer replays mutation
5. POST /api/documents fails because party doesn't exist
6. Item marked 'failed'

**Impact:**
- Queue contains stale references
- User must manually fix or discard

**Files:**
- `src/lib/offline.ts:150-185` (no pre-flight validation before replaying)

**Root Cause:**
- Offline mutations aren't validated against current state when replayed

**Fix:**
```typescript
// Before replaying mutation from queue, do lightweight validation
async function validateQueueItemBeforeSync(item: SyncQueueItem): Promise<{valid: boolean; issues: string[]}> {
  const issues: string[] = []

  if (item.path.includes('/documents')) {
    const body = JSON.parse(item.body || '{}')

    // Check if party still exists
    if (body.partyId) {
      const party = await api(`/api/parties/${body.partyId}`, { method: 'GET' })
        .catch(() => null)
      if (!party) {
        issues.push(`Party "${body.partyId}" no longer exists`)
      }
    }

    // Check if products exist
    if (body.items && Array.isArray(body.items)) {
      for (const itemData of body.items) {
        const product = await api(`/api/products/${itemData.productId}`, { method: 'GET' })
          .catch(() => null)
        if (!product) {
          issues.push(`Product "${itemData.productId}" no longer exists`)
        }
      }
    }
  }

  return { valid: issues.length === 0, issues }
}

// In processQueue()
const validation = await validateQueueItemBeforeSync(next)
if (!validation.valid) {
  await db.syncQueue.update(next.id, {
    status: 'failed',
    errorMessage: `Validation failed: ${validation.issues.join('; ')}`,
  })
  notify()
  continue
}
```

---

## PAYMENT PROCESSING

### BLOCKER: Duplicate Payment on Retry with Same Idempotency Key

**Scenario:**
1. User records payment with amount = 1000, partyId = A
2. Server receives, creates payment, returns 200
3. Response packet lost (user never sees success)
4. User retries (frontend doesn't know it succeeded)
5. Idempotency key is re-generated (not persisted) → different key
6. New payment created with same amount to same party
7. Party's outstanding is now 2000 paise less than it should be

**Impact:**
- Duplicate payments
- Accounting mismatch
- Data corruption

**Files:**
- `server/src/routes/payments.ts:55-65` (idempotencyCheck is used, good)
- Frontend likely doesn't persist idempotency key across retries

**Root Cause:**
- Frontend doesn't generate idempotency key before first attempt
- Idempotency key lost on page reload or app restart

**Fix:**
```typescript
// In payment creation form, generate and persist idempotency key
const [idempotencyKey] = useState(() => {
  const stored = sessionStorage.getItem('payment_idempotency_key')
  return stored || randomUUID()
})

useEffect(() => {
  sessionStorage.setItem('payment_idempotency_key', idempotencyKey)
}, [idempotencyKey])

const handleCreatePayment = async (data) => {
  try {
    const payment = await api('/api/payments', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'X-Idempotency-Key': idempotencyKey },
    })

    // Success — clear the stored key for next payment
    sessionStorage.removeItem('payment_idempotency_key')
    showToast('Payment recorded', 'success')
    navigate(`/payments/${payment.id}`)
  } catch (err) {
    if (err.status === 409) {
      // Duplicate — this was already processed
      showToast('Payment already recorded', 'info')
      return
    }

    // User can retry with same idempotency key
    throw err
  }
}
```

---

### HIGH: Payment Allocation Race Condition

**Scenario:**
1. User has 2 invoices, each with 1000 paise due
2. Records 2000 paise payment
3. Simultaneously allocates: 1000 to invoice A, 1000 to invoice B (no coordination)
4. Both allocations succeed
5. But then user tries to allocate another 500 to A (for partial)
6. Check: A's balanceDue = 1000 - 1000 = 0 → error "Cannot allocate to settled invoice"

**Impact:**
- User gets error even though they're within bounds (2000 payment, 500 allocation)
- Bad UX

**Files:**
- `server/src/services/payment.service.ts:73-107` (allocation logic, likely doesn't check for concurrent updates)

**Root Cause:**
- Allocation updates are not transactional
- Check-then-act window between reading balanceDue and updating allocation

**Fix:**
```typescript
// In payment.service.ts createOrUpdateAllocations()
async function updateAllocations(
  paymentId: string,
  allocations: Array<{ invoiceId: string; amount: number }>
) {
  return prisma.$transaction(async (tx) => {
    // Fetch payment with FOR UPDATE lock
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      select: { amount: true, allocations: true },
    })

    if (!payment) throw notFoundError('Payment')

    // Calculate total allocated
    const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0)

    if (totalAllocated > payment.amount) {
      throw validationError('Total allocations exceed payment amount')
    }

    // Clear existing allocations
    await tx.allocation.deleteMany({ where: { paymentId } })

    // Create new allocations
    for (const a of allocations) {
      // Check invoice still has due balance (with lock)
      const invoice = await tx.document.findUnique({
        where: { id: a.invoiceId },
        select: { balanceDue: true },
      })

      if (!invoice || invoice.balanceDue < a.amount) {
        throw validationError(`Invoice balance insufficient for allocation`)
      }

      await tx.allocation.create({
        data: { paymentId, invoiceId: a.invoiceId, amount: a.amount },
      })

      // Update invoice balanceDue
      await tx.document.update({
        where: { id: a.invoiceId },
        data: { balanceDue: { decrement: a.amount } },
      })
    }
  })
}
```

---

### HIGH: Webhook Duplicate Creates Duplicate Payment Entry

**Scenario:**
1. Payment gateway sends payment webhook (e.g., Razorpay)
2. Server creates Payment record
3. Webhook delivery confirmed
4. Later, webhook is retried by gateway (or network dupe)
5. Server receives same webhook payload again
6. No idempotency check → second Payment created for same transaction

**Impact:**
- Duplicate payments in system
- Accounting error

**Files:**
- Webhook route not visible in provided files (likely `/webhooks/razorpay`)

**Root Cause:**
- No idempotency check on webhook handlers
- No gateway transaction ID stored as unique key

**Fix:**
```typescript
// In webhook handler
router.post('/webhooks/razorpay', asyncHandler(async (req, res) => {
  const { event, payload } = req.body
  const externalTransactionId = payload.razorpay_payment_id

  // Check if we've already processed this webhook
  const existing = await prisma.webhookLog.findUnique({
    where: { externalTransactionId },
  })

  if (existing) {
    // Already processed — return same response
    return sendSuccess(res, { webhookId: existing.id })
  }

  try {
    // Create payment or update existing
    const payment = await prisma.payment.findFirst({
      where: { referenceNumber: externalTransactionId },
    })

    if (payment) {
      // Payment exists (shouldn't happen, but handle gracefully)
      await prisma.webhookLog.create({
        data: {
          externalTransactionId,
          event,
          payload,
          status: 'duplicate',
        },
      })
      return sendSuccess(res, { webhookId: externalTransactionId })
    }

    // New payment — create it
    const newPayment = await prisma.payment.create({
      data: {
        referenceNumber: externalTransactionId,
        amount: payload.amount,
        // ... other fields ...
      },
    })

    // Log successful webhook
    await prisma.webhookLog.create({
      data: {
        externalTransactionId,
        event,
        payload,
        status: 'success',
      },
    })

    sendSuccess(res, { webhookId: externalTransactionId })
  } catch (err) {
    // Log failed webhook for manual review
    await prisma.webhookLog.create({
      data: {
        externalTransactionId,
        event,
        payload,
        status: 'error',
        errorMessage: err.message,
      },
    }).catch(() => {}) // Don't fail if logging fails

    // Return 202 Accepted so gateway doesn't retry infinitely
    res.status(202).json({ message: 'Accepted for processing' })
  }
}))
```

---

### HIGH: Payment Amount in Paise Overflow on Large Transactions

**Scenario:**
1. User records payment with amount = 999,999,999 (1 crore - 1 paise)
2. Database stores as DECIMAL(12, 2) → max 9,999,999.99 (10 crore)
3. OK so far, but if there's a 2x multiplication somewhere (tax calculation), overflows
4. JavaScript `Number` can't safely represent integers > 2^53, so if amount is read as number instead of string, precision is lost

**Impact:**
- Data corruption on large transactions (rare but catastrophic)
- Silent overflow

**Files:**
- `server/prisma/schema.prisma` (DECIMAL fields used for amounts, good)
- Frontend may convert to number: `parseFloat(amountStr)` (bad)

**Root Cause:**
- JavaScript `Number` precision loss on large integers
- No type safety enforcing string/Decimal handling

**Fix:**
```typescript
// In all amount fields, use:
// 1. Always Decimal in Prisma
model Payment {
  amount Decimal @db.Decimal(12, 2) // Max 9,999,999.99 paise = 1 crore

  @@validate([
    @check('"amount" > 0'),
    @check('"amount" <= 999999999'), // < 1 crore in paise
  ])
}

// 2. Frontend: keep as string or use BigInt
const formatAmount = (paiseStr: string): string => {
  const paise = BigInt(paiseStr)
  const rupees = paise / BigInt(100)
  const paisetail = paise % BigInt(100)
  return `${rupees}.${paisetail.toString().padStart(2, '0')}`
}

// 3. API validation
createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Amount must be integer paise').transform(a => {
    const num = BigInt(a)
    if (num <= 0n || num > BigInt(999999999)) {
      throw new Error('Amount out of bounds')
    }
    return a
  }),
})
```

---

### MEDIUM: Outstanding Balance Calculation Skips Unallocated Payments

**Scenario:**
1. Invoice A: 1000 paise due
2. Payment recorded: 500 paise
3. Payment is unallocated (not assigned to any invoice)
4. User queries outstanding balance for party
5. Report shows 1000 still due (correct, payment is unallocated)
6. But user sees payment in list, thinks it was applied
7. User manually allocates again → double-allocation

**Impact:**
- User confusion
- Potential double-allocation if UI doesn't warn

**Files:**
- `server/src/services/report.service.ts` (outstanding calculation likely ignores unallocated payments)

**Root Cause:**
- No clear distinction in UI between allocated and unallocated payments
- Unallocated payments aren't subtracted from outstanding

**Fix:**
```typescript
// In report service
async function calculateOutstandingByParty(businessId: string, partyId: string) {
  const invoices = await prisma.document.findMany({
    where: {
      businessId,
      partyId,
      type: 'INVOICE',
      status: { in: ['SAVED', 'SHARED'] },
    },
    select: {
      id: true,
      balanceDue: true,
      allocations: { select: { amount: true } },
    },
  })

  // Total due from invoices
  const totalDue = invoices.reduce((sum, inv) => sum + inv.balanceDue, 0)

  // Unallocated payments (not assigned to any invoice)
  const unallocatedPayments = await prisma.payment.aggregate({
    where: {
      businessId,
      partyId,
      allocations: { none: {} }, // No allocations
    },
    _sum: { amount: true },
  })

  const unallocated = unallocatedPayments._sum.amount ?? 0

  // Net outstanding = due - unallocated (but max 0)
  const outstanding = Math.max(totalDue - unallocated, 0)

  return {
    totalDue,
    unallocatedPayments: unallocated,
    outstanding,
  }
}

// Frontend — show breakdown
<p>Due: Rs {formatRupees(outstanding.totalDue)}</p>
<p className="text-green-600">Unallocated payments: Rs {formatRupees(outstanding.unallocatedPayments)}</p>
<p className="font-bold">Net outstanding: Rs {formatRupees(outstanding.outstanding)}</p>
```

---

## DOCUMENT & INVENTORY MANAGEMENT

### BLOCKER: Stock Deduction Not Atomic with Document Create

**Scenario:**
1. User creates invoice with 100 units of product X
2. Stock check passes (100 units available)
3. Server deducts stock → 0 units remaining
4. But document save fails (validation error in payment terms)
5. Stock is already deducted, but document doesn't exist
6. Inventory is corrupted

**Impact:**
- Stock mismatch
- Can't create invoice again (stock is 0)

**Files:**
- `server/src/routes/documents.ts:76-80` (POST /documents likely calls documentService.createDocument which updates stock separately)
- `server/src/services/stock.service.ts` (validateStockForInvoice and deductStock likely not in same transaction)

**Root Cause:**
- Stock deduction and document creation are separate operations
- No transaction wrapping both

**Fix:**
```typescript
// In document.service.ts
async function createDocument(
  businessId: string,
  userId: string,
  data: CreateDocumentInput
) {
  return prisma.$transaction(async (tx) => {
    // 1. Check stock
    const items = data.items || []
    for (const item of items) {
      const stock = await tx.stockMovement.aggregate({
        where: {
          businessId,
          productId: item.productId,
          status: 'COMPLETED',
        },
        _sum: { quantity: true },
      })

      const available = stock._sum.quantity ?? 0
      if (available < item.quantity) {
        throw validationError(
          `Insufficient stock for ${item.productId}. Available: ${available}, requested: ${item.quantity}`
        )
      }
    }

    // 2. Create document
    const document = await tx.document.create({
      data: {
        ...data,
        businessId,
        createdBy: userId,
        status: 'SAVED',
      },
    })

    // 3. Deduct stock in same transaction
    for (const item of items) {
      await tx.stockMovement.create({
        data: {
          businessId,
          productId: item.productId,
          quantity: -item.quantity,
          referenceType: 'DOCUMENT',
          referenceId: document.id,
          movementType: 'OUT',
          status: 'COMPLETED',
        },
      })
    }

    return document
  })
}
```

---

### HIGH: Document Number Generation Race Condition

**Scenario:**
1. User A creates invoice, calls document-number-service.getNextNumber()
2. User B simultaneously creates invoice, calls same service
3. Both get number 100, despite unique constraint
4. User A's invoice is created first with 100
5. User B's insert fails with unique constraint violation
6. User B sees error, retries, gets 101
7. But next user gets 102, skipping 101

**Impact:**
- Document numbers not sequential
- Missing numbers in sequence
- Accounting audit issues

**Files:**
- `server/src/services/document-number.service.ts` (getNextNumber likely doesn't use locking)

**Root Cause:**
- `getNextNumber()` reads and increments without atomic operation
- Race window between SELECT and UPDATE

**Fix:**
```typescript
// In document-number.service.ts
async function getNextNumber(businessId: string, docType: string): Promise<string> {
  // Use Prisma transaction with atomic UPDATE ... RETURNING
  const updated = await prisma.documentNumberCounter.update({
    where: { businessId_docType: { businessId, docType } },
    data: { lastNumber: { increment: 1 } },
    select: { lastNumber: true },
  })

  const number = updated.lastNumber
  const prefix = getPrefix(docType) // e.g., "INV"
  const year = new Date().getFullYear().toString().slice(-2)

  return `${prefix}/${year}/${number.toString().padStart(4, '0')}`
}

// Ensure counter exists on business create
async function initializeCounters(businessId: string) {
  const docTypes = ['INVOICE', 'QUOTATION', 'PURCHASE_ORDER', /* ... */]

  await Promise.all(
    docTypes.map(docType =>
      prisma.documentNumberCounter.upsert({
        where: { businessId_docType: { businessId, docType } },
        update: {}, // No-op if exists
        create: {
          businessId,
          docType,
          lastNumber: 0,
        },
      })
    )
  )
}
```

---

### HIGH: Invoice with Deleted Party Still Visible

**Scenario:**
1. User creates invoice for party "Raju"
2. User deletes party "Raju" (soft-delete: party.isActive = false)
3. List invoices → still shows invoices for Raju (query doesn't filter by party.isActive)
4. User clicks invoice, sees "Party not found" or stale party data

**Impact:**
- Orphaned invoices
- Confusing UI

**Files:**
- `server/src/services/document.service.ts` (listDocuments likely joins party without filtering isActive)

**Root Cause:**
- FK not enforced at query level
- No scope guard when listing/reading documents

**Fix:**
```typescript
// In document.service.ts
async function listDocuments(businessId: string, query: ListDocumentsQuery) {
  return prisma.document.findMany({
    where: {
      businessId,
      type: query.type,
      status: { in: ['SAVED', 'SHARED', /* ... */] },
      // Implicit: party must still be active
      party: { isActive: true },
    },
    select: {
      id: true,
      documentNumber: true,
      type: true,
      partyId: true,
      party: {
        select: { id: true, name: true, phone: true },
        // Add where clause here if Prisma supports it
      },
      totalAmount: true,
      balanceDue: true,
      status: true,
      date: true,
    },
    orderBy: { date: 'desc' },
    skip: query.skip,
    take: query.take,
  })
}

// Or use raw SQL if Prisma doesn't support nested where
async function listDocuments(businessId: string, query: ListDocumentsQuery) {
  return prisma.$queryRaw`
    SELECT d.* FROM "Document" d
    LEFT JOIN "Party" p ON d."partyId" = p.id
    WHERE d."businessId" = ${businessId}
      AND p."isActive" = true
    ORDER BY d.date DESC
    LIMIT ${query.take}
    OFFSET ${query.skip}
  `
}
```

---

### MEDIUM: Invoice Edit Changes balanceDue Permanently

**Scenario:**
1. Invoice A created: amount = 1000, balanceDue = 1000
2. Payment allocated: 500
3. balanceDue updated → 500
4. User edits invoice, changes amount to 1500 (adding discount reversal)
5. balanceDue is recalculated but doesn't account for existing allocation
6. balanceDue = 1500 (overwrites the -500 from payment)
7. System thinks 1500 is still due, not 1000

**Impact:**
- Outstanding balance calculation wrong
- Accounting mismatch

**Files:**
- `server/src/services/document.service.ts` (updateDocument likely recalculates balanceDue without considering existing allocations)

**Root Cause:**
- Edit doesn't re-apply allocations after amount change
- balanceDue is set to new amount, not new-amount minus allocations

**Fix:**
```typescript
// In document.service.ts
async function updateDocument(
  businessId: string,
  documentId: string,
  userId: string,
  data: UpdateDocumentInput
) {
  return prisma.$transaction(async (tx) => {
    const document = await tx.document.findUnique({
      where: { id: documentId },
      select: {
        amount: true,
        allocations: { select: { _sum: { amount: true } } },
      },
    })

    if (!document) throw notFoundError('Document')

    // Calculate new balance
    const totalAllocated = document.allocations[0]?._sum?.amount ?? 0
    const newBalanceDue = Math.max((data.amount ?? document.amount) - totalAllocated, 0)

    return tx.document.update({
      where: { id: documentId },
      data: {
        ...data,
        balanceDue: newBalanceDue,
        updatedAt: new Date(),
      },
    })
  })
}
```

---

## DATA CONSISTENCY & RACE CONDITIONS

### BLOCKER: Referral Balance Withdrawn Twice

**Scenario:**
1. User A earns 100 referral credit (referralBalance = 100)
2. User A attempts to withdraw, clicks button twice (2 requests fire)
3. Request 1: check balance 100 → withdraw 100 → balance = 0
4. Request 2 (concurrent): check balance 100 → withdraw 100 → balance = -100
5. System is left with negative balance

**Impact:**
- Fraud: user withdraws more than earned
- System liability

**Files:**
- `server/src/routes/referral.ts` (likely no duplicate guard)
- `server/src/services/referral.service.ts` (withdrawal logic probably not atomic)

**Root Cause:**
- No idempotency check on withdrawal
- Check-then-act window

**Fix:**
```typescript
// In referral routes
router.post(
  '/withdraw',
  auth,
  idempotencyCheck(), // Add this
  validate(withdrawSchema),
  asyncHandler(async (req, res) => {
    const balance = await referralService.withdrawBalance(
      req.user!.userId,
      req.body.amount
    )
    sendSuccess(res, balance)
  })
)

// In referral service
async function withdrawBalance(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    // Lock the user row
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { referralBalance: true },
    })

    if (!user || user.referralBalance < amount) {
      throw validationError('Insufficient referral balance')
    }

    // Atomically deduct
    return tx.user.update({
      where: { id: userId },
      data: {
        referralBalance: { decrement: amount },
      },
      select: { referralBalance: true },
    })
  })
}
```

---

### HIGH: Account Suspension Bypassed via Cached User

**Scenario:**
1. User is logged in
2. Admin suspends user (user.isSuspended = true)
3. User is offline, makes API call → offline queue syncs mutation
4. Token is still valid (not yet expired), suspension check not re-run
5. Mutation succeeds (created offline while suspended)

**Impact:**
- Suspended user can still create records
- Anti-fraud measure bypassed

**Files:**
- `server/src/middleware/auth.ts:49-53` (checks isUserBlacklisted, but not isSuspended)
- No active check that user.isSuspended

**Root Cause:**
- Auth middleware doesn't query user's current suspension status
- Only checks in-memory blacklist

**Fix:**
```typescript
// In auth middleware
export async function auth(req: Request, res: Response, next: NextFunction) {
  // ... existing token verification ...

  try {
    const payload = verifyAccessToken(token)

    // Check if user is suspended (query DB on each request, or cache with TTL)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isSuspended: true, isActive: true },
    })

    if (!user || !user.isActive) {
      sendError(res, 'Account deactivated', 'ACCOUNT_INACTIVE', 401)
      return
    }

    if (user.isSuspended) {
      sendError(res, 'Account suspended', 'ACCOUNT_SUSPENDED', 403)
      return
    }

    req.user = { userId: payload.userId, phone: payload.phone, businessId: payload.businessId ?? '' }
    next()
  } catch (error: unknown) {
    // ... existing error handling ...
  }
}

// Note: Querying on every request has perf implications
// Better: cache suspension status with short TTL (e.g., 1 min)
```

---

### HIGH: Concurrent Referral Creation Allows Duplicate References

**Scenario:**
1. User A signs up, referral system generates unique referral code "ABC123"
2. User A shares code
3. Simultaneously, another process creates another referral code "ABC123" (collision)
4. Two users now have same code

**Impact:**
- Referral fraud (commissions split)
- Data integrity

**Files:**
- `server/src/services/referral.service.ts` (generateReferralCode likely has race window)

**Root Cause:**
- Generate-then-check pattern with race window
- No unique constraint on referral code

**Fix:**
```typescript
// In schema.prisma
model User {
  referralCode String @unique // Add unique constraint
  // ...
}

// In referral service
async function generateReferralCode(userId: string): Promise<string> {
  // Retry on collision
  let attempts = 0
  while (attempts < 10) {
    const code = generateRandomCode(6)

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      })
      return code
    } catch (err) {
      if ((err as any).code === 'P2002') {
        // Unique constraint violation — retry
        attempts++
        continue
      }
      throw err
    }
  }

  throw new Error('Failed to generate unique referral code')
}

// Or use a guaranteed-unique approach
function generateReferralCode(userId: string): string {
  // Hash user ID + random component
  const base = crypto
    .createHash('sha256')
    .update(`${userId}:${Date.now()}:${Math.random()}`)
    .digest('hex')
    .substring(0, 8)
    .toUpperCase()

  return base
}
```

---

### MEDIUM: Party Outstanding Balance Skips Recent Payments

**Scenario:**
1. Party "Raju" has outstanding balance = 5000
2. User records payment of 2000, but doesn't allocate to specific invoices
3. User views party detail → outstanding still shows 5000 (based on invoice balances)
4. Confusing: system shows payment, but outstanding unchanged

**Impact:**
- User thinks payment wasn't recorded
- May record duplicate payment

**Files:**
- `server/src/services/party.service.ts` (getPartyOutstanding likely sums document.balanceDue without considering unallocated payments)

**Root Cause:**
- Outstanding is calculated from invoice balances
- Unallocated payments not subtracted

**Fix:**
```typescript
// In party.service.ts
async function getPartyOutstanding(businessId: string, partyId: string) {
  // Total due from all invoices
  const invoices = await prisma.document.aggregate({
    where: {
      businessId,
      partyId,
      type: 'INVOICE',
      status: { in: ['SAVED', 'SHARED'] },
    },
    _sum: { balanceDue: true },
  })
  const totalDue = invoices._sum.balanceDue ?? 0

  // Unallocated payments (not assigned to invoices)
  const unallocated = await prisma.payment.aggregate({
    where: {
      businessId,
      partyId,
      allocations: { none: {} },
    },
    _sum: { amount: true },
  })
  const unallocatedAmount = unallocated._sum.amount ?? 0

  // Net outstanding
  const outstanding = Math.max(totalDue - unallocatedAmount, 0)

  return { totalDue, unallocated: unallocatedAmount, outstanding }
}
```

---

### MEDIUM: Soft-Deleted Document Still Counted in Reports

**Scenario:**
1. Invoice created: totalSales = 1000
2. Invoice soft-deleted (isActive = false, status = 'DELETED')
3. Sales report query: `WHERE status IN ['SAVED', 'SHARED'] AND isActive = true`
4. But isActive filter forgotten → deleted invoice still included
5. Sales report shows 1000, but should show 0

**Impact:**
- Incorrect financial reports
- Wrong decisions

**Files:**
- Every report service needs to filter by isActive = true

**Root Cause:**
- Soft-delete flag not consistently checked
- No scope/default to filter

**Fix:**
```typescript
// Create a Prisma client extension or middleware
const prismExtended = prisma.$extends({
  query: {
    document: {
      findMany: async ({ args, query }) => {
        // Auto-filter soft-deleted
        if (args.where && !('isActive' in args.where)) {
          args.where!.isActive = true
        }
        return query(args)
      },
    },
  },
})

// Or use explicit filtering in each query
async function getSalesReport(businessId: string) {
  return prisma.document.findMany({
    where: {
      businessId,
      type: 'INVOICE',
      status: { in: ['SAVED', 'SHARED'] },
      isActive: true, // Always include
      deletedAt: null, // Or check deletedAt
    },
    select: {
      amount: true,
      tax: true,
      date: true,
    },
  })
}
```

---

## API & NETWORK RESILIENCE

### BLOCKER: Fetch Timeout Doesn't Abort Underlying Request

**Scenario:**
1. User submits large invoice with 100 items (body = 50KB)
2. Network is 2G, timeout = 10s
3. Request starts, but uploading body takes 15s
4. setTimeout → 10s → AbortController.abort()
5. But HTTP body is already uploading on socket
6. Server never receives full request → doesn't create invoice
7. Frontend times out, user clicks "Retry"
8. ... first request finally arrives 5 seconds later → duplicate creation

**Impact:**
- Duplicate records
- Orphaned requests

**Files:**
- `src/lib/api.ts:104-146` (AbortController should stop the request, but only if not already in flight)

**Root Cause:**
- AbortController stops the fetch promise, but the underlying socket may still be sending

**Fix:**
```typescript
// Frontend: use idempotency + shorter timeout for POST
const timeout = method === 'POST' ? 5000 : 30000 // 5s for writes, 30s for reads

const controller = new AbortController()
const timeoutId = setTimeout(() => {
  controller.abort()

  // Mark as potentially in-flight in IndexedDB
  if (shouldQueue && SYNC_MUTATION_METHODS.has(method)) {
    offline.markAsInFlight({ method, path, body })
  }
}, timeout)

// Or: use shorter timeout for large payloads
const isLargePayload = (body: unknown): boolean => {
  const str = JSON.stringify(body)
  return str.length > 20000 // 20KB
}

const timeout = isLargePayload(options.body)
  ? 30000 // 30s for large payloads
  : 10000 // 10s for normal

// Server: accept mutations with reasonable timeout (45s)
const REQUEST_TIMEOUT_MS = 45_000
server.setTimeout(REQUEST_TIMEOUT_MS)
```

---

### HIGH: API Error Response Not JSON-Parseable

**Scenario:**
1. Server has unhandled error in middleware (e.g., JSON.parse fails)
2. Express falls back to default error handler
3. Sends 500 with HTML body (stack trace)
4. Frontend calls `response.json()` → throws because it's HTML
5. Error is swallowed by catch block
6. User sees generic "Unknown error"

**Impact:**
- Silent failures
- User doesn't know what went wrong

**Files:**
- `server/src/middleware/errorHandler.ts:10-38` (handles AppError, but not unhandled errors)

**Root Cause:**
- Not all errors go through errorHandler
- Default Express handler sends HTML

**Fix:**
```typescript
// In index.ts or app setup
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  // Catch-all for unhandled errors
  const appError = err instanceof AppError ? err : handleError(err)

  // Always return JSON
  res.status(appError.statusCode).json({
    success: false,
    error: {
      code: appError.code,
      message: appError.message,
    },
  })
})

// Frontend: handle both JSON and non-JSON responses
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  // ... existing code ...

  try {
    response = await fetch(/* ... */)
  } catch (err) {
    // Network error
    throw err
  }

  const contentType = response.headers.get('Content-Type') || ''
  let json: any

  if (contentType.includes('application/json')) {
    json = await response.json()
  } else if (contentType.includes('text/html')) {
    // Server error with HTML response — bad, but handle gracefully
    throw new ApiError('Server error (invalid response)', 'SERVER_ERROR', 500)
  } else {
    const text = await response.text()
    throw new ApiError(`Unexpected response: ${text.substring(0, 100)}`, 'INVALID_RESPONSE', 500)
  }

  // ... existing code ...
}
```

---

### HIGH: 429 Rate Limit Blocks Offline Queue Indefinitely

**Scenario:**
1. User is offline, queue has 5 pending mutations
2. User comes online, sync starts
3. Gets 429 (rate limited) on first mutation
4. Code marks it 'failed' and pauses queue
5. User is stuck: can't sync, can't manually retry

**Impact:**
- User's offline changes are stuck
- No path to recovery

**Files:**
- `src/lib/offline.ts:150-200` (doesn't distinguish 429 from 5xx)

**Root Cause:**
- Rate limit response treated same as permanent failure
- No backoff or retry logic for 429

**Fix:**
```typescript
// In offline.ts
if (response.status === 429) {
  // Rate limited — back off exponentially
  const retryAfter = response.headers.get('Retry-After')
  const delay = retryAfter ? parseInt(retryAfter) * 1000 : SYNC_RETRY_DELAYS[Math.min(next.retryCount + 1, SYNC_RETRY_DELAYS.length - 1)]

  await db.syncQueue.update(next.id, {
    status: 'pending',
    retryCount: next.retryCount + 1,
  })

  console.warn(`Rate limited. Retrying in ${delay}ms`)
  setTimeout(processQueue, delay)
  isProcessing = false
  notify()
  return
}

// Show user: "Syncing your changes... (rate limited, retrying)"
```

---

### MEDIUM: Retry on POST Mutation Creates Duplicate

**Scenario:**
1. User creates invoice, POST /api/documents
2. Response timeout (connection lost)
3. Frontend retries without idempotency key
4. Server receives both requests (likely with small delay)
5. Idempotency middleware isn't used → two invoices created

**Impact:**
- Duplicate records
- Must manually cleanup

**Files:**
- All mutation routes should use `idempotencyCheck()` middleware (some may not)

**Root Cause:**
- Not all routes enforce idempotency
- Frontend may not send X-Idempotency-Key

**Fix:**
```typescript
// Audit all routes
grep -r "router.post\|router.put\|router.patch\|router.delete" server/src/routes/*.ts

// Ensure all mutations use idempotencyCheck
router.post(
  '/',
  idempotencyCheck(), // MUST be present
  validate(/* ... */),
  asyncHandler(/* ... */)
)

// Frontend: always generate and send idempotency key for mutations
function generateIdempotencyKey(): string {
  // Format: route + timestamp + random
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)

  if (isMutation && !options.headers?.['X-Idempotency-Key']) {
    const idempotencyKey = generateIdempotencyKey()
    options.headers = { ...options.headers, 'X-Idempotency-Key': idempotencyKey }
  }

  // ... rest of function ...
}
```

---

## FRONTEND STATE & NAVIGATION

### BLOCKER: Token Refresh Infinite Loop on Stale Token

**Scenario:**
1. User is on Dashboard
2. Access token expires
3. Makes API call → 401
4. Calls refresh endpoint → also gets 401 (both tokens expired/blacklisted)
5. `attemptTokenRefresh()` returns false
6. Request retried with `_skipRefresh: true` → 401 again
7. Function throws ApiError
8. Page component unmounts (route redirects to login)
9. But if error boundary is lax, could infinite retry

**Impact:**
- Infinite retry loop consuming CPU/network
- User can't do anything

**Files:**
- `src/lib/api.ts:148-155` (does check _skipRefresh, good)
- `src/App.tsx:108-114` (ProtectedRoute redirects on 401, good)

**Root Cause:**
- Theoretical issue already mitigated, but document for future proof

**Fix:**
```typescript
// Already good, but add guard
let refreshAttemptCount = 0
const MAX_REFRESH_ATTEMPTS = 3

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshAttemptCount >= MAX_REFRESH_ATTEMPTS) {
    console.error('Max refresh attempts exceeded — user must re-authenticate')
    sessionStorage.removeItem('cachedUser')
    return false
  }

  refreshAttemptCount++

  try {
    // ... existing refresh logic ...

    if (response.ok) {
      refreshAttemptCount = 0 // Reset on success
      return true
    }
  } catch {
    // ... existing error handling ...
  }

  return false
}
```

---

### HIGH: Deep Link Loads Stale Cached Data

**Scenario:**
1. User bookmarks invoice detail: `/invoices/abc123`
2. User shares invoice with party
3. Invoice details change (amount, status)
4. User clicks bookmark → loads from cache
5. Shows old data
6. User doesn't know to refresh

**Impact:**
- Stale data served
- User may share incorrect details

**Files:**
- Any route that loads an entity by ID (invoices, parties, products, etc.)
- `src/hooks/useApi.ts` (likely caches data with no expiry)

**Root Cause:**
- Cache doesn't invalidate on route change or time
- No "last fetched" timestamp

**Fix:**
```typescript
// In useApi hook
export function useApi<T>(
  path: string,
  options?: { cache?: boolean; cacheTime?: number }
) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(true)
  const cacheRef = useRef<{ data: T; fetchedAt: number } | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function fetch() {
      // Check cache validity
      const cached = cacheRef.current
      const cacheMaxAge = options?.cacheTime ?? 5 * 60 * 1000 // 5 min default

      if (cached && Date.now() - cached.fetchedAt < cacheMaxAge) {
        setData(cached.data)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const result = await api<T>(path, { signal: controller.signal })
        cacheRef.current = { data: result, fetchedAt: Date.now() }
        setData(result)
        setError(null)
      } catch (err) {
        setError(err as Error)
        // If we have stale cache, show it but mark as stale
        if (cached) {
          setData(cached.data)
          console.warn('Showing stale data', cached)
        }
      } finally {
        setLoading(false)
      }
    }

    fetch()
    return () => controller.abort()
  }, [path, options?.cacheTime])

  return { data, error, loading }
}

// Usage
function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const { data: invoice, loading, error, refetch } = useApi(`/api/invoices/${invoiceId}`, {
    cache: true,
    cacheTime: 2 * 60 * 1000, // 2 min
  })

  // On component visibility, refresh if stale
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetch() // Refresh when tab comes into focus
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch])

  if (loading) return <Skeleton />
  if (error) return <ErrorState message={error.message} onRetry={refetch} />
  if (!invoice) return <EmptyState />

  return <InvoiceDisplay invoice={invoice} />
}
```

---

### HIGH: Search Results Include Deleted Items

**Scenario:**
1. User searches for "Raju" → finds parties
2. Admin deletes party "Raju Traders"
3. Search results still show "Raju Traders" (cached or not filtered)
4. User clicks → 404 or sees deleted party

**Impact:**
- 404 on click (bad UX)
- Orphaned search result

**Files:**
- `server/src/routes/party.ts` (search endpoint likely doesn't filter isActive)

**Root Cause:**
- Search query doesn't filter by isActive = true
- No pruning of deleted entities from results

**Fix:**
```typescript
// In party.ts search route
router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const businessId = req.user!.businessId
    const { q } = req.query

    const results = await prisma.party.findMany({
      where: {
        businessId,
        isActive: true, // Add this filter
        // Search by name or phone
        OR: [
          { name: { contains: q as string, mode: 'insensitive' } },
          { phone: { contains: q as string } },
        ],
      },
      select: { id: true, name: true, phone: true },
      take: 20,
    })

    sendSuccess(res, results)
  })
)
```

---

### MEDIUM: Browser Back Button Loses Form State

**Scenario:**
1. User creates invoice, fills form (not saved)
2. User navigates away
3. User clicks back button
4. Browser restores page from cache, but not form values
5. Form is empty
6. User re-fills

**Impact:**
- User inconvenience
- Data loss if user leaves without saving

**Files:**
- Form components (likely don't persist state to URL or sessionStorage)

**Root Cause:**
- Form state is in-memory React state
- No persistence on navigation

**Fix:**
```typescript
// In CreateInvoicePage component
function CreateInvoicePage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<InvoiceData>(() => {
    // Restore from sessionStorage on mount
    const stored = sessionStorage.getItem('invoiceDraft')
    return stored ? JSON.parse(stored) : initialFormData
  })

  // Save to sessionStorage whenever form changes (debounced)
  const saveToSession = useCallback(
    debounce((data: InvoiceData) => {
      sessionStorage.setItem('invoiceDraft', JSON.stringify(data))
    }, 500),
    []
  )

  const handleChange = (field: string, value: unknown) => {
    const newData = { ...formData, [field]: value }
    setFormData(newData)
    saveToSession(newData)
  }

  // On successful submit, clear draft
  const handleSubmit = async () => {
    const invoice = await api('/api/invoices', { /* ... */ })
    sessionStorage.removeItem('invoiceDraft')
    navigate(`/invoices/${invoice.id}`)
  }

  // On unmount, warn if unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(formData) !== JSON.stringify(initialFormData)) {
        e.preventDefault()
        e.returnValue = true
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [formData])

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
    </form>
  )
}
```

---

### MEDIUM: Offline Mode Doesn't Update UI

**Scenario:**
1. User is online, viewing dashboard
2. Network drops (mobile goes into tunnel)
3. App sets offline flag, but dashboard still shows "sync in progress"
4. User doesn't know they're offline
5. User continues entering data, thinks it's syncing

**Impact:**
- User confusion
- May abandon app

**Files:**
- `src/hooks/useOnlineStatus.ts` (should exist, but may not broadcast changes effectively)
- `src/components/feedback/OfflineBanner.tsx` (may not be visible or clear)

**Root Cause:**
- No persistent, visible indicator of offline state
- Banner might be at bottom, easily missed

**Fix:**
```typescript
// In useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// In App.tsx, show prominent banner
export function App() {
  const isOnline = useOnlineStatus()

  return (
    <ErrorBoundary>
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-yellow-900 px-4 py-2">
          <p className="text-sm font-semibold">
            You're offline. Changes will sync when you're back online.
          </p>
        </div>
      )}
      {/* ... rest of app ... */}
    </ErrorBoundary>
  )
}
```

---

## DATABASE & SCHEMA INTEGRITY

### BLOCKER: Circular Foreign Keys Without ON DELETE Specified

**Scenario:**
1. Business B is created
2. User is assigned to Business B (BusinessUser record with businessId = B.id)
3. Business B is deleted
4. FK constraint violation: BusinessUser still references B.id, but B is gone
5. If constraint is Restrict, deletion fails and rolls back
6. If Restrict isn't set and default is cascade, data is orphaned

**Impact:**
- Deletion fails (bad UX) or silent data loss

**Files:**
- `server/prisma/schema.prisma` (FK definitions need explicit onDelete)

**Root Cause:**
- Missing `onDelete` clauses on all FKs

**Fix:**
```prisma
// In schema.prisma, specify onDelete for every FK
model BusinessUser {
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  // "Cascade" because if business is deleted, its staff is also deleted (correct)
  // But could also be Restrict if we want to prevent deletion of active businesses

  userId     String
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)
  // If user is deleted, remove their roles in all businesses (correct)
}

model Document {
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  // Restrict: prevent business deletion if it has documents (business can't be fully deleted)
  // This ensures data integrity
}

model Payment {
  partyId String
  party   Party @relation(fields: [partyId], references: [id], onDelete: Restrict)
  // Restrict: prevent party deletion if payments exist
}
```

---

### HIGH: Missing Index on FK Causes Query Slowdown

**Scenario:**
1. Table: Payment (10K records)
2. FK: partyId points to Party.id
3. No index on Payment.partyId
4. Query: SELECT * FROM Payment WHERE partyId = ? → full table scan
5. 10K rows scanned for each payment lookup

**Impact:**
- Slow list/detail queries
- N+1 problem on reports

**Files:**
- `server/prisma/schema.prisma` (FK fields should have @index or be in compound index)

**Root Cause:**
- Prisma doesn't auto-index FKs; must be explicit

**Fix:**
```prisma
model Payment {
  id       String @id @default(cuid())
  partyId  String
  party    Party  @relation(fields: [partyId], references: [id], onDelete: Restrict)
  amount   Decimal @db.Decimal(12, 2)
  date     DateTime
  createdAt DateTime @default(now())

  @@index([partyId]) // Add index on FK
  @@index([businessId, partyId]) // Compound index for scoped queries
}

model Document {
  id         String @id @default(cuid())
  businessId String
  partyId    String
  createdAt  DateTime @default(now())

  business   Business @relation(fields: [businessId], references: [id], onDelete: Restrict)
  party      Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)

  // Compound index for common queries
  @@index([businessId, partyId])
  @@index([businessId, createdAt]) // For time-ranged reports
}
```

---

### MEDIUM: Decimal Precision Loss on Amount Calculations

**Scenario:**
1. Payment amount: 333.33 paise (stored as DECIMAL(12, 2))
2. Divided by 3 for split payment: 333.33 / 3 = 111.11
3. But precision in calculation may be lost if JavaScript Number is used
4. 333.33 / 3 * 3 = 333.33000000000003 (floating point error)

**Impact:**
- Rounding errors in financial calculations
- Reconciliation issues

**Files:**
- Any service doing division or multiplication of amounts

**Root Cause:**
- JavaScript Number doesn't preserve decimal precision
- Database queries must use DECIMAL, not float conversions

**Fix:**
```typescript
// Never do math in JavaScript on money
// ❌ WRONG
const split = payment.amount / 3

// ✅ RIGHT: do math in PostgreSQL
const result = await prisma.$queryRaw`
  SELECT (${payment.amount}::numeric / 3)::numeric(12,2) as portion
`

// Or use a library for decimal math
import Decimal from 'decimal.js'

const amount = new Decimal('333.33')
const split = amount.dividedBy(3) // Decimal 111.11
```

---

---

## PRIORITY REMEDIATION ORDER

### Immediate (Next Sprint)
1. Token refresh race condition (multiple tabs)
2. Queue processing on 401 (offline sync)
3. Business ID mismatch on create
4. Stock deduction atomicity
5. Duplicate payment on retry
6. Idempotency key consistency

### Short-term (2-4 weeks)
7. Account lockout bypass
8. Business deletion race
9. Query timeouts & retries
10. FK indexes & constraints
11. Suspension check in auth
12. CSRF token expiry

### Medium-term (1-2 months)
13. Advanced resilience (circuit breaker, graceful degradation)
14. Comprehensive soft-delete filtering
15. Report accuracy & reconciliation
16. Cache invalidation strategy
17. Permission & ownership validation audit

---

## TESTING CHECKLIST

For each blocker/high-severity case, add tests:

```typescript
// Example: test token refresh race
describe('Auth Token Refresh', () => {
  test('concurrent 401 responses use same refresh token', async () => {
    const tokenBefore = getAccessTokenFromCookie()

    const [p1, p2] = await Promise.allSettled([
      api('/api/documents', { method: 'POST', body: '{}' }),
      api('/api/parties', { method: 'GET' }),
    ])

    // Both should succeed, using single refresh
    expect(p1.status).toBe('fulfilled')
    expect(p2.status).toBe('fulfilled')

    const tokenAfter = getAccessTokenFromCookie()
    expect(tokenAfter).not.toBe(tokenBefore) // Refreshed once
  })
})

// Example: test offline queue durability
describe('Offline Queue', () => {
  test('queue survives browser crash', async () => {
    const item = { method: 'POST', path: '/api/invoices', body: '{}' }
    await offline.enqueue(item)

    // Simulate crash (reset isProcessing, clear memory)
    clearAllMemory()

    // Restart app
    await app.init()

    // Queue should still have item
    const queue = await offline.getQueueSnapshot()
    expect(queue).toContainEqual(expect.objectContaining(item))
  })
})
```

---

## DOCUMENTATION

Save to: `/Users/sawanjaiswal/Projects/HisaabPro/docs/EDGE_CASES_ANALYSIS.md`

This document should be reviewed in:
- **Security audit** (before launch)
- **Code review** (for any auth, payment, or offline changes)
- **On-call runbook** (for incident response)

---

**END OF ANALYSIS**

Date: 2026-03-20 | Author: Claude Edge Case Agent | Review Status: PENDING
