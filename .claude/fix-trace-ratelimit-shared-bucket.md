---
symptom: 25 ordinary API GETs make POST /api/auth/login return 429 (limit 20), even though the global limiter allows 600/min.
root_cause_file: server/src/middleware/rate-limit/factory.ts:18
root_cause_reason: Every IP-keyed limiter derives the same key `rl:<ip>`, so all limiters share ONE counter while each compares it against its own (different) max.
---

## 5-whys

1. Why does login 429 after 25 unrelated GETs? — Because the counter it reads is already at 25, above `RATE_LIMIT_AUTH_MAX = 20`.
2. Why is the counter at 25 when login was called once? — Because `apiRateLimiter` incremented it 25 times on `/api/parties`.
3. Why does the auth limiter see the global limiter's increments? — Both call `store.increment(key)` with the identical key.
4. Why is the key identical? — `createRateLimiter`'s default `keyFn` is `rl:${req.ip}`; it carries no limiter identity.
5. Why does that break rather than just being strict? — The window is owned by whichever limiter created the entry (60s global) while the max is the caller's (20 auth / 3 otp). One bucket, N incompatible policies: the strictest max silently governs all traffic, and `/api/auth/refresh` is on that list, so an active user's token refresh 429s and they get logged out.

## Hypothesis

Namespacing the key per limiter (`rl:<name>:<ip>`) gives each policy its own
counter and its own window, which is what every `max`/`windowMs` pair in
`config/security.ts` already assumes. Nothing else in the chain needs to change:
`keyFn` overrides (crud/sensitive/per-business) already namespace themselves and
are unaffected.

Secondary defect found in the same session and fixed alongside (it is the reason
the E2E suite could not see any of this): `POST /api/__test__/reset-rate-limits`
is rejected by `csrfProtection` with `CSRF_FAILED`, so the E2E reset hook has
never cleared a bucket — every gold spec after the first ~20 auth calls failed
with a 429 that looked like a product bug in whatever case ran next.

## Failing test

server/src/middleware/rate-limit/__tests__/limiter-isolation.test.ts
