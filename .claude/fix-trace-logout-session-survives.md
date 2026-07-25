---
symptom: Tapping Logout returns the user to /login but the server session stays alive — cookies at/rt survive and GET /api/auth/me still returns 200.
root_cause_file: src/lib/api-request.ts:35
root_cause_reason: needsCsrf() exempts every path starting with /auth/, but the server only exempts a specific list of unauthenticated auth routes — /auth/logout and /auth/switch-business are authenticated and DO require the CSRF header, so those two POSTs always fail with 403 CSRF_FAILED.
---

## Symptom

`e2e/gold/auth.spec.ts` TC-AUTH-06 drives the real UI logout (bottom nav More →
Logout → confirm). The URL becomes `/login`, but:

```
RES 403 POST /api/auth/logout
  BODY {"success":false,"error":{"code":"CSRF_FAILED","message":"Invalid CSRF token"}}
URL     http://localhost:5002/login
COOKIES rt,csrf-token,at
ME      200
```

## 5-whys

1. **Why does a session survive logout?** Because `POST /api/auth/logout`
   returned 403 — the tokens were never blacklisted and the cookies were never
   cleared (`clearTokenCookies` lives after the middleware chain).
2. **Why 403?** `csrfProtection` (server/src/middleware/csrf.ts:86) demands a
   `x-csrf-token` header matching the `csrf-token` cookie on every POST that is
   not in `CSRF_EXEMPT_AUTH_PATHS`. `/api/auth/logout` is not in that set — and
   correctly so: it is an authenticated, session-mutating request, exactly what
   CSRF protects.
3. **Why did the client not send the header?** `buildRequestHeaders` only
   fetches a token when `needsCsrf(method, path)` is true, and
   `needsCsrf` returns `false` for anything under `/auth/`.
4. **Why does `needsCsrf` blanket-exempt `/auth/`?** Its comment states "Auth
   endpoints are exempt server-side". That was true of the auth surface when the
   helper was written — login/register/refresh/reset are all unauthenticated and
   all exempt. `logout` and `switch-business` are authenticated and were added
   to the same URL prefix, inheriting an exemption that does not apply to them.
5. **Why did nobody notice?** `src/lib/auth.ts:143` wraps the call in
   `try { … } catch {}` ("Logout should succeed client-side even if server
   fails") and then clears local state, so the UI navigates to /login exactly as
   it would on success. The failure is invisible without watching the network.

Root cause: the client mirrors the server's CSRF exemption rule with a *prefix*
where the server uses an *explicit path list*. The two drifted the moment an
authenticated route joined the `/auth/` prefix.

## Blast radius

Two endpoints match "authenticated POST under /auth/":

- `POST /auth/logout` — logout never ends the server session. On a shared phone
  (the Raju persona's normal case) the next person to open the app is still
  signed in as the previous user, and a stolen device keeps a valid refresh
  token for its full 7-day TTL.
- `POST /auth/switch-business` — multi-business users (Priya/Amit) cannot switch
  tenants at all; the call 403s.

## Hypothesis

Replacing the prefix test in `needsCsrf` with the same explicit exempt-path list
the server uses makes the client send `x-csrf-token` on `/auth/logout` and
`/auth/switch-business` while leaving the genuinely unauthenticated auth routes
(login, register, refresh, reset, biometric) header-free. `/api/auth/logout`
then reaches its handler, blacklists both tokens and clears cookies, and
`/auth/me` starts returning 401.

## Failing test

- `src/lib/__tests__/api-csrf-paths.test.ts` — unit: `needsCsrf` must be true
  for the authenticated auth mutations and false for the unauthenticated ones,
  asserted against the server's own exempt list.
- `e2e/gold/auth.spec.ts` TC-AUTH-06 — end-to-end: after a real UI logout,
  `/auth/me` must fail and sessionStorage must be empty.
