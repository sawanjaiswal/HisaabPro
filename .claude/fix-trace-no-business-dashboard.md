---
symptom: A freshly-registered user (account created, zero businesses) lands on /dashboard which shows "Couldn't load dashboard / No active business selected" instead of the onboarding flow.
repro: Register a new account → verify OTP → reload app / visit "/" → GuestRoute bounces authenticated user to /dashboard → every business-scoped GET returns 403 NO_BUSINESS. Confirmed in DB: User row exists, Business table empty.
root_cause_file: src/app.guards.tsx:36
root_cause_reason: ProtectedRoute gates on isAuthenticated only; it has no guard for "authenticated but businesses.length === 0", so a businessless user reaches every business-scoped page (dashboard included) which then 403s.
class: missing-guard
regression_since: always-broken (guard never checked business membership)
flip_proof: manual — vitest run of the new ProtectedRoute redirect test fails at HEAD (no redirect), passes after the guard lands
---
## 5-whys
1. Why does /dashboard show "No active business selected"?
   → require-active-business middleware returns 403 NO_BUSINESS because the JWT/session has no businessId [server/src/middleware/require-active-business.ts:84].
2. Why does the user have no businessId?
   → verifyRegistration creates the User but NO Business; businessId resolves null [server/src/services/auth/register.ts:112-118], and DB confirms zero Business rows.
3. Why is a businessless user on /dashboard at all (verify navigates to /onboarding)?
   → GuestRoute redirects ANY authenticated user to DASHBOARD [src/app.guards.tsx:45], so a reload / visit to "/" bounces the businessless user onto a business-scoped page.
4. Why doesn't /dashboard send them back to onboarding?
   → ProtectedRoute only checks isAuthenticated; it has no businesses.length===0 → onboarding redirect [src/app.guards.tsx:36-41].
5. Why did nothing catch it?
   → no guard/test pins the invariant "business-scoped routes require ≥1 business"; the gate is purely server-side (403) with no client redirect.
## Hypothesis
Add the missing membership guard at the single contract layer (ProtectedRoute): when authenticated and businesses.length === 0, redirect to /onboarding — unless already on /onboarding (avoid loop). Fixes the whole class (every business-scoped route), not just dashboard.
## Bug class & fix shape
class: missing-guard
shape: guard (at the ProtectedRoute contract layer — one choke point wraps all business-scoped routes)
why-not-SSOT: not drift; single guard already the SSOT for route-auth. The fix is adding the missing condition there.
## Failing test
src/__tests__/app.guards.test.tsx
