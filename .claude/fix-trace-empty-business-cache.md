---
symptom: After creating (or joining) a business, reopening the app strands the owner on the "Welcome to HisaabPro" onboarding screen even though the shop exists.
root_cause_file: src/context/AuthContext.tsx:45
root_cause_reason: Boot renders on a cached business list of length 0 and ends the loading state, so the business gate redirects to /onboarding before /auth/me can answer — and /onboarding is exempt from the gate, so the correction never navigates back.
---

## 5-whys

1. **Why does the owner land on onboarding?** `ProtectedRoute` sees
   `businesses.length === 0` and redirects to `ROUTES.ONBOARDING`.
2. **But why is the list empty — the server has the business?** The redirect
   happens before `/auth/me` resolves. State was seeded from the sessionStorage
   cache written at login, when the account genuinely had no business.
3. **But why did the gate get to run that early?** `init()` calls
   `setIsLoading(false)` as soon as a cached *user* exists. `isLoading` is what
   holds the gate off; ending it publishes the cached (empty) list as fact.
4. **But why does the correction not fix it?** `/onboarding` is exempt from the
   gate, so when `/auth/me` fills the list a moment later nothing re-evaluates
   the route. The user stays where the wrong answer put them.
5. **But why was an empty list treated as an answer at all?** The cache is an
   offline-first hint, and no distinction was drawn between "the cache says the
   user has shop X" (useful) and "the cache says nothing" (the same bytes a new
   account produces). Absence of evidence was read as evidence of absence.

## Hypothesis

Seeding from an EMPTY cached business list buys nothing — there is nothing to
render — and costs a wrong redirect the app never recovers from. Ending the
loading state should require an actual cached business; otherwise wait the one
round-trip for `/auth/me`. The identity hint (`cachedUser`) is still applied
immediately, so nothing about the offline-first behaviour changes for a user
whose shop is in the cache.

## Failing test

src/__tests__/auth-context.empty-business-cache.test.tsx
