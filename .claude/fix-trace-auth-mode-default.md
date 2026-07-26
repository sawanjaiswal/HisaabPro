---
symptom: A production build points the sign-in form at /api/auth/dev-login, which the server refuses — nobody can log in
root_cause_file: src/config/app.config.ts:32
root_cause_reason: VITE_AUTH_MODE falls back to 'dev-login', so a variable missing from .env.production selects a dev-only route
---

## 5-whys

1. Why can nobody sign in on a production build? — The form posts `/api/auth/dev-login`.
2. Why that route? — `AUTH_MODE` resolved to `'dev-login'`, which `useLogin` branches on.
3. Why did it resolve to that? — `import.meta.env.VITE_AUTH_MODE || 'dev-login'`, and the var is
   absent from `.env`, `.env.production` and `.env.example`.
4. Why does the server refuse it? — `/api/auth/dev-login` is served only when `ALLOW_DEV_LOGIN=true`,
   which production must never set.
5. Why did nobody notice? — The default is correct in the only environment anyone runs interactively
   (dev), and the E2E web server forces `VITE_AUTH_MODE: 'otp'`. The broken path is exactly the one
   nobody exercises before shipping.

## Hypothesis

The fallback is the defect, not the missing variable. Unset must mean the real flow (OTP); the
dev-only flow must be an explicit opt-in, and must not be honoured in a production build at all —
otherwise the same lockout returns the first time someone copies a dev `.env`. Setting the variable
in `.env.production` fixes today's build; making the default safe fixes every future one.

## Failing test

src/config/__tests__/app.config.test.ts — `never ships a dev-only default` (AUTH_MODE with
VITE_AUTH_MODE unset) and `refuses dev-login in a production build`.
