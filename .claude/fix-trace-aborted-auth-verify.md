---
symptom: An owner who navigates straight to a business-scoped URL (hard load) lands on the "Welcome to HisaabPro" onboarding screen and stays there, even though /auth/me returns their business.
root_cause_file: src/context/AuthContext.tsx:88
root_cause_reason: The boot effect ends the loading state unconditionally, including when its own cleanup aborted the /auth/me it was waiting on — so an unverified, empty business list is published as fact and the business gate redirects to /onboarding, a route it exempts.
---

## 5-whys

1. **Why does the owner land on onboarding?** `ProtectedRoute` sees
   `businesses.length === 0` with `isLoading === false` and redirects.
2. **But why is the list empty — /auth/me returned the business?** The state was
   published before any answer arrived. The list is still the initial `[]`.
3. **But why did loading end with no answer?** `init()` runs
   `setIsLoading(false)` on the way out of the try/catch regardless of which
   branch it took. An aborted request lands in the catch like any failure.
4. **But why was the request aborted at all?** Effect cleanup calls
   `controller.abort()`. React runs that on every remount — and deliberately, on
   the very first mount, under StrictMode in dev. The first `getMe` is *designed*
   to be cancelled; the second one is the real one.
5. **But why does the abort produce a signed-in-with-nothing state?** The catch
   only distinguishes 401 (session gone) from everything else, and "everything
   else" keeps the cached user. An abort is neither: nothing was learned, so
   nothing should be concluded. It was treated as a completed request that
   failed, and the completion is what ended the wait.

## Hypothesis

An aborted verification carries no information — neither that the session is
alive nor that it is dead. `init()` must return before touching state when
`controller.signal.aborted` is set: the effect that aborted it is already gone,
and the remount that caused the abort is running its own `init()` which will
publish the real answer. Ending the loading state is the specific harm, because
`isLoading` is the only thing holding the business gate off, and the gate's
redirect target (/onboarding) is exempt from the gate — so the correction that
lands milliseconds later never navigates back.

Complements .claude/fix-trace-empty-business-cache.md, which fixed the same
stranding via the cache path. Both routes to "loading is over, businesses is
empty, nothing verified it" are now closed.

## Failing test

src/__tests__/auth-context.aborted-verify.test.tsx
