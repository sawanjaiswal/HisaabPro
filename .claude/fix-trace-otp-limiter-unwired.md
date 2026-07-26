---
symptom: A phone number can be sent OTP after OTP with no cap — the only brake is a 30-second resend cooldown, so one number takes ~120 messages an hour, all billed to us.
root_cause_file: server/src/routes/auth/register.ts:24
root_cause_reason: The OTP-specific limiter (3 per 10 minutes) is defined and exported but wired to no route, so every OTP-issuing endpoint is guarded only by the generic 20-per-minute auth limiter.
---

## 5-whys

1. Six OTP requests for one number in a row are never refused with 429. But why?
2. Nothing on the route counts OTP requests — the responses after the first are
   400s from the handler's own 30s cooldown, not a limiter. But why is there no
   limiter?
3. `/auth/register`, `/auth/resend-otp` and `/auth/forgot-password` mount
   `authRateLimiter` only. But why, when an OTP limiter exists?
4. `otpRateLimiter` (RATE_LIMIT_OTP_MAX = 3 per 10 min) is exported from
   `middleware/rate-limit/auth-limiters.ts` and re-exported from the barrel —
   and imported by nothing outside the test setup. It was written and never
   attached. But why did that go unnoticed?
5. Because a limiter that is not wired fails silently and permissively: the
   config file still reads as though OTP is capped at 3/10min, the constant is
   referenced, and the only thing missing is the one line that puts it in a
   request path. Nothing tests a middleware's absence.

## Hypothesis

Wire `otpRateLimiter` onto the three routes that actually send an SMS, and key
it by the phone in the validated body rather than by IP. The resource being
protected is a specific person's handset and our per-message cost, and both are
identified by the number, not the caller. Per-IP keying at 3/10min would also
lock out every shared connection — a shop with three staff registering on one
wifi — which is why the generic 20/min per-IP auth limiter stays as the burst
brake alongside it.

## Failing test

e2e/gold/security-hardening.spec.ts — TC-SEC-07 (six OTP requests for one
number, expecting a 429; currently 200,400,400,400,400,400)
