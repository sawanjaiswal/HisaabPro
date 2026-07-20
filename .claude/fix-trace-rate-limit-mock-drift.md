---
symptom: 8 server test files fail at import with `[vitest] No "switchBusinessRateLimiter" export is defined on the "../middleware/rate-limit.js" mock`, silently skipping 92 tests
root_cause_file: server/src/__tests__/parties.test.ts:17
root_cause_reason: each suite's vi.mock factory returns a hand-written object literal enumerating rate-limit's exports, so any export added to middleware/rate-limit/index.ts invalidates all 8 literals at once
---
## 5-whys
1. Why do the 8 suites fail? — they never reach a test; the file throws during import, so vitest reports `(0 test)` and marks the file failed.
2. Why does the import throw? — `src/routes/auth/switch-business.ts:25` references `switchBusinessRateLimiter`, and the mocked `middleware/rate-limit.js` has no such export. Vitest raises on access to a key the factory did not return.
3. Why is the key missing from the mock? — each suite's factory returns an object literal that hand-lists the module's exports (`createRateLimiter`, `authRateLimiter`, `otpRateLimiter`, …). `switchBusinessRateLimiter` was added to `middleware/rate-limit/auth-limiters.ts` and re-exported from `rate-limit/index.ts`, but no literal was updated.
4. Why did adding a real export not force the mocks to be updated? — nothing links the two. The literal is a structural copy of the module's export list with no type relationship to it; TypeScript does not check a `vi.mock` factory's return against the mocked module, so the drift is invisible until runtime import.
5. Why is the copy duplicated 8 times rather than shared? — the mock predates any shared test-helper convention for middleware passthrough, so each suite grew its own copy. That multiplies the blast radius: one new limiter breaks every suite that mounts the auth router, and each copy has to be found and edited by hand.

## Hypothesis
The defect is the hand-maintained export list, not the missing key. Adding `switchBusinessRateLimiter` to 8 literals would clear today's failure and reproduce it verbatim on the next limiter. The fix is to derive the mock surface from the real module: a shared `rateLimitPassthrough(importOriginal)` helper reads the actual export names via `importOriginal()` and maps each to passthrough middleware (`createRateLimiter`, the one factory export, maps to a function returning passthrough). A newly added limiter is then covered with no test edit at all.

Note on shape: the helper cannot be referenced via a top-level import inside a `vi.mock` factory — `vi.mock` is hoisted above imports and fails with `Cannot access '__vi_import_N__' before initialization`. It is pulled in with a dynamic `await import()` inside the (lazily invoked) async factory instead.

Loading the real module in the factory is side-effect-safe: its only timer is `MemoryStore`'s sweeper at `middleware/rate-limit/store.ts:36`, which is `.unref()`'d and cannot hold the runner open.

## Failing test
The 8 suites are themselves the failing test — they failed at import before the change and pass after it, restoring 92 previously-unrun tests (1177 → 1269 passing).

Drift-proofness was verified separately rather than assumed: a temporary `__driftProbeLimiter` export was added to `middleware/rate-limit/index.ts` and the suites re-run — 24/24 passed with no mock error, where the old literals would have thrown. Probe reverted; `git diff` on `src/middleware/` is clean.

server/src/__tests__/helpers.ts — `rateLimitPassthrough`
