---
symptom: An invited staff member cannot redeem their invite code — /join redirects to onboarding.
root_cause_file: src/app.guards.tsx:46
root_cause_reason: The no-business gate exempts only ONBOARDING and HOME, so /join — the one route a user without a business must reach — is redirected away before it renders.
---

## 5-whys

1. **Why does TC-BIZ-04 fail?** The invitee's `/join` page never shows the
   invite-code field, so the code can never be entered.
2. **But why is the field missing?** The route renders the onboarding welcome
   screen ("Welcome to HisaabPro / Get Started") instead of `JoinBusiness`.
3. **But why does onboarding render at `/join`?** `ProtectedRoute` returns
   `<Navigate to={ROUTES.ONBOARDING} replace />` when `businesses.length === 0`.
4. **But why does that apply to `/join`?** The exemption is a two-value literal
   comparison — `pathname === ROUTES.ONBOARDING || pathname === ROUTES.HOME` —
   and `/join` is in neither.
5. **But why was `/join` left out?** The gate was written for the
   freshly-registered-owner path (register → create your own business). The
   second way to acquire a business — being invited into someone else's — has
   the same precondition (zero businesses) but was never added to the exempt
   set, and nothing enumerates "routes that exist for a user with no business",
   so the omission was invisible.

## Hypothesis

A user with zero memberships is bounced to onboarding from every route except
onboarding and home. That is correct for business-scoped routes (they would 403
with NO_BUSINESS) but wrong for the routes whose entire purpose is to *give*
the user a business: `/join` (redeem an invite) and `/business/create`. An
invited staff member is therefore locked out of the app — the only screen they
can reach tells them to create their own business, which is precisely what the
invite exists to avoid. The fix belongs at the SSOT of route identity: an
exported `NO_BUSINESS_ROUTES` set in `routes.config.ts` that the guard reads,
so a future route with the same precondition is declared in one place instead
of being pattern-matched inline.

## Failing test

src/__tests__/app.guards.business-gate.test.ts
