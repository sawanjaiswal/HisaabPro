---
symptom: The entire integration contract suite fails to collect (0 tests run).
root_cause_file: server/src/__tests__/integration/setup.ts:12
root_cause_reason: The rate-limit mock hand-enumerates limiter export names as a literal; switchBusinessRateLimiter was later added to the real module but not to the mock, so the import resolves to undefined and Express Router.use() throws at app construction.
---

## 5-whys

1. Why does `payments.contract.test.ts` fail? — `createApp()` throws at import time.
2. Why does `createApp()` throw? — `routes/auth/switch-business.ts:25` calls
   `router.use('/switch-business', auth, switchBusinessRateLimiter, …)` where
   `switchBusinessRateLimiter` is `undefined` → "Router.use() requires a middleware function".
3. Why is it undefined? — The integration `setup.ts` mocks
   `'../../middleware/rate-limit.js'` with an object literal that omits
   `switchBusinessRateLimiter`.
4. Why does the mock omit it? — The mock lists limiter names by hand.
   `switchBusinessRateLimiter` was added to the real module
   (`middleware/rate-limit/auth-limiters.ts`, re-exported via the barrel) after
   the mock literal was written.
5. Why does a hand-listed mock drift? — It duplicates the module's moving export
   list as a static copy. Any new export is invisible to it. Root cause: the mock
   is a hardcoded snapshot of a list that changes independently.

## Hypothesis

Replace the hardcoded rate-limit mock with one that DERIVES its passthroughs from
the real module's export surface via `importOriginal`. Every function export
becomes a passthrough middleware; `create*` factories return the passthrough;
non-function exports pass through unchanged. A newly-added limiter is then
automatically passthrough-mocked, so this class of drift becomes impossible —
the mock can never again omit an export the app depends on.

## Failing test

server/src/__tests__/integration/payments.contract.test.ts — currently RED at
collection with the `switchBusinessRateLimiter` middleware error. Any integration
contract test that imports `createApp()` exhibits the same failure.
