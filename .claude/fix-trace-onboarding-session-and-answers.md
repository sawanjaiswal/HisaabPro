---
symptom: A shopkeeper who finishes onboarding lands on a dashboard where every business-scoped API call answers 403 NO_BUSINESS, and the answers the wizard collected (location, chosen start path) are thrown away
root_cause_file: src/features/onboarding/useOnboarding.ts:33
root_cause_reason: The access token carries businessId, and creating the first business changes which business is active — but onSuccess only re-reads /auth/me into React state; nothing re-issues the token, so the server still sees a user with no active business
---

## 5-whys

1. Why does the dashboard show nothing after onboarding? — every business-scoped
   request answers `403 NO_BUSINESS` (`GET /api/dashboard/today` verified by probe).
2. Why NO_BUSINESS when `/auth/me` clearly lists the new business? — `/auth/me` reads the
   database; every other route reads `req.user.businessId`, which comes from the JWT.
3. Why is it missing from the JWT? — the token was minted at registration, before the business
   existed. Nothing mints a new one when the first business is created.
4. Why did `refreshActiveBusiness()` not cover it? — it calls `getMe()` and sets React state. It
   updates what the client *believes*; the server's view of the session is the token, untouched.
5. Why is there no shared step? — `POST /auth/switch-business` is exactly that step (new JWT,
   rotated cookies, old token blacklisted) and the business switcher already uses it. Onboarding
   creates an active business without ever going through it.

Two smaller losses ride along the same call:

- `businessLocation` is collected on step 2 and never sent. `createBusinessSchema` accepts `city`,
  so the field exists — the payload simply omits it. Asking a shopkeeper for their location and
  discarding it is worse than not asking: they believe it is on file.
- `startPath` is collected on step 5, and both buttons on the Ready screen go to the dashboard.
  "Import my existing data" is the *recommended* option, so the user most likely to have data to
  bring in is the one dropped on an empty dashboard with no hint the importer exists.

`dataSource` (notebook / excel / tally / otherApp / other) has nowhere to go: `Business` has no
column for it. Persisting it is a schema change and needs the high-risk design-plan sequence, so
it stays collected-and-dropped for now and is recorded as a finding rather than silently patched.

## Hypothesis

The endpoint that changes which business is active owns the token that encodes it. Onboarding must
go through the same activation path the switcher uses (`authLib.switchBusiness`) rather than
inventing a second, weaker one — then the session the user finishes onboarding with is a session
the server recognises. The payload and the destination are the same call's two other outputs, and
belong with it.

## Failing test

e2e/gold/onboarding.spec.ts — TC-ONB-01/03/04 (`GET /businesses/:id` 403 "Business mismatch" after
the wizard completes) and TC-ONB-05 (lands on /dashboard instead of the import flow). All fail
before the fix.

## Did I fix the symptom or the cause?

The cause. The symptom is one 403 on one screen; the cause is a session whose token was never
re-issued after the fact it encodes changed.
