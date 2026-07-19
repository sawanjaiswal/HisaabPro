---
symptom: A multi-store owner switching between businesses hits 429 "Too many attempts" and gets locked out after a handful of switches in a minute
root_cause_file: server/src/routes/auth/switch-business.ts:25
root_cause_reason: switch-business (an authenticated action) was gated by authRateLimiter — the shared login/OTP brute-force bucket (20/min/IP) — so normal store-hopping shares a lockout budget meant for unauthenticated attackers
---

## 5-whys
1. Why does switching stores 429? — The route's rate limiter rejects the request.
2. Why so soon? — It uses authRateLimiter, capped at 20/min per IP (RATE_LIMIT_AUTH_MAX).
3. Why is that cap so low? — It's sized for unauthenticated brute-force protection on login/send-otp, where 20 attempts/min is already generous for an attacker.
4. Why is switch-business on that bucket? — It was mounted with the same limiter for convenience; but switch-business runs AFTER `auth`, so there is no unauthenticated brute-force to protect against.
5. Why does that hurt real users? — A multi-store owner (Amit persona) legitimately hops stores several times a minute; they share the attacker-sized budget and get locked out during normal use.

## Hypothesis
An already-authenticated, high-frequency action must not share the unauthenticated login bucket. Give switch-business its own limiter with a generous cap (60/min) that still stops a runaway client but never locks out a real multi-store owner.

## Failing test
server/src/routes/auth/__tests__/switch-business-limiter.test.ts — assert the switch-business limiter is a distinct instance from authRateLimiter and its configured max is RATE_LIMIT_SWITCH_BUSINESS_MAX (60), not RATE_LIMIT_AUTH_MAX (20).
