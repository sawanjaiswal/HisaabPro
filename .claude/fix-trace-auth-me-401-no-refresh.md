---
symptom: PlanGate shows "Checking your plan…" indefinitely, and hard-reloading the app after a period of inactivity silently logs the user out and redirects to /login even though the refresh-token cookie is still valid.
root_cause_file: src/lib/api.ts:159
root_cause_reason: The 401-interceptor's `!path.includes('/auth/')` guard was meant to stop the refresh-retry from recursing on `/auth/refresh` itself, but as written it blanket-excludes every `/auth/*` endpoint — including `/auth/me`, which AuthContext calls on every app boot. A 401 from `/auth/me` (access-token cookie expired, 15m TTL) is thrown straight through with no refresh attempt, so a perfectly recoverable "access token expired, refresh token still good" state is treated as a hard logout.
---
## 5-whys

1. Why does reloading log the user out? — `AuthContext`'s boot effect calls `getMe()` (`/auth/me`); it throws, and when there's no cached user the catch block calls `clearAuth()` + `setUser(null)`, which `ProtectedRoute` turns into a redirect to `/login`.
2. Why does `getMe()` throw instead of transparently refreshing? — `api()`'s 401 interceptor (`src/lib/api.ts:159`) only attempts `attemptTokenRefresh()` when `!path.includes('/auth/')`. `/auth/me` matches `/auth/`, so the interceptor is skipped entirely and the 401 is re-thrown as `ApiError('Session expired', ...)` immediately.
3. Why was `/auth/` blanket-excluded? — The intent (per the inline comment) was to stop `/auth/refresh` from retrying itself forever if refresh 401s, and to not "refresh-then-retry" `/auth/login`/`/auth/dev-login` (a 401 there means bad credentials, not an expired token). The exclusion was implemented as a path-prefix check instead of naming the specific endpoints that actually need to be exempt.
4. Why does this manifest as "Checking your plan…" hanging forever? — `useSubscription()`'s query is `enabled: !!user?.businessId`. Immediately after boot, `user` is still the synchronously-set cached value (has a `businessId`), so the query does fire against `/businesses/:id/subscription` — a non-`/auth/` path, so its own 401 *does* go through the refresh interceptor. But once `AuthContext`'s async `getMe()` catch fires and (with no cache, or stale cache) sets `user` to `null`, `businessId` disappears mid-flight, the subscription query flips back to `enabled: false`, and a disabled TanStack Query stays `isPending: true` forever — there is no fetch in flight to ever resolve `isLoading`/`isError`, and `useLoadTimeout`'s 8s timer keeps restarting every time `isLoading`'s identity is disturbed by the surrounding re-renders, so the fallback ErrorState never gets a clean 8s window to fire.
5. Why wasn't this caught earlier? — `/auth/me` 401s only happen after the 15-minute access-token TTL elapses since the last request, which doesn't show up in quick manual testing or during active use — only after a genuine idle-then-reload, which is exactly the repro the user described.

## Hypothesis

Replace the path-prefix exclusion with a named allowlist of endpoints where a 401 is an *expected, non-recoverable* outcome (`/auth/login`, `/auth/dev-login`, `/auth/register`, `/auth/verify-registration`, `/auth/verify-otp`, `/auth/refresh` itself). Every other endpoint — including `/auth/me`, `/auth/logout`, `/auth/switch-business` — goes through the normal refresh-and-retry interceptor. This lets `/auth/me` transparently refresh the access token using the still-valid refresh-token cookie on reload, so `AuthContext` only logs the user out when the refresh token itself is also invalid/expired.

## Failing test

Added two cases to `src/lib/__tests__/api.test.ts`. Confirmed the primary case failed against the pre-fix code (`ApiError: Request failed (401)` thrown straight through with only 1 fetch call instead of 3) before applying the fix; both cases pass after narrowing the exclusion to `NON_REFRESHABLE_AUTH_PATHS`.

## Re-review

Fixed the cause, not the symptom: the change doesn't catch-and-retry around the "Checking your plan" hang or add a fallback timeout — it corrects the actual boolean condition (`isNonRefreshableAuthPath`) that was silently skipping the refresh-and-retry path for `/auth/me` and other non-credential auth endpoints. A 401 on `/auth/me` now transparently refreshes the access token via the still-valid refresh-token cookie, same as any other endpoint, which is the behavior `AuthContext.init()` always assumed it had.
