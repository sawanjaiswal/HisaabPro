---
symptom: A session that is dead server-side (revoked, expired, logged out on another device) keeps the app on /dashboard showing "Couldn't load dashboard — check your connection" instead of returning the user to /login.
root_cause_file: src/context/AuthContext.tsx:58
root_cause_reason: The boot catch treats every /auth/me failure as "offline" and keeps the cached user authenticated, so a 401 — which means the session is genuinely gone — is indistinguishable from a lost network and never clears auth.
---

## Symptom

`e2e/gold/auth.spec.ts` TC-AUTH-06b logs in, drops both auth cookies (the
browser-side equivalent of a revoked session), and navigates to `/dashboard`:

```
Expected pattern: /\/login$/
Received string:  "http://localhost:5002/dashboard"
```

The page renders the app shell with a connectivity error. No tenant data leaks
(every scoped call 401s), but the user is stranded: nothing on screen says
"signed out", and the only escape is clearing site data.

## 5-whys

1. **Why does the user stay on /dashboard?** `ProtectedRoute` redirects only
   when `isAuthenticated` is false, and it is true.
2. **Why is it true with no valid cookies?** `AuthContext` seeds `user` from
   `sessionStorage.cachedUser` on mount (the offline-first hint) and never
   clears it.
3. **Why is it never cleared?** The verification call `authLib.getMe()` throws,
   and the catch at AuthContext.tsx:58 clears auth only `if (!cached)`.
4. **Why is the catch written that way?** To keep an offline user signed in —
   correct behaviour when the phone has no network (Raju on 2G is the norm).
   But the catch cannot tell the two cases apart: a network failure and an
   `ApiError` with `status: 401` land in the same branch.
5. **Why does a 401 reach it at all?** The refresh interceptor already retried
   and failed (`api-refresh.ts` — refresh 400/401 → `attemptTokenRefresh()`
   returns false). By the time the error surfaces, "not authenticated" is a
   settled fact, not a transient one.

Root cause: an offline-tolerance rule written as "any failure ⇒ trust the
cache", when the correct rule is "any failure *except an authoritative
401* ⇒ trust the cache".

## Hypothesis

Branching the catch on `err instanceof ApiError && err.status === 401` clears
the cached identity for a genuinely dead session (so `ProtectedRoute` bounces to
/login) while leaving offline behaviour untouched — a fetch that never reaches
the server throws a plain `Error`/`TypeError`, not an `ApiError`, and a 5xx
carries a different status.

## Failing test

- `e2e/gold/auth.spec.ts` TC-AUTH-06b — cookies cleared, `/dashboard` must
  redirect to `/login`.
- `src/__tests__/auth-context.dead-session.test.tsx` — unit: a 401 from
  `getMe` clears the cached user; a network error keeps it.
