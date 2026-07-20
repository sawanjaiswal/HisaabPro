---
symptom: "Request was cancelled" red toast appears on party detail (Ledger tab) on load / tab-switch
root_cause_file: src/lib/api.ts:135
root_cause_reason: api() wraps a genuine (reason-less) AbortError into ApiError('ABORTED'),
  whose .name is 'ApiError' — so every consumer's `err.name === 'AbortError'` guard misses
  it and the abort is toasted instead of swallowed.
---

## 5-whys
1. Why the toast? → usePartyDetail's `.catch` reaches `toast.error(err.message)` with
   message "Request was cancelled".
2. Why didn't the abort guard swallow it? → The guard is `err instanceof Error &&
   err.name === 'AbortError'`, but the thrown error's `.name` is `'ApiError'`.
3. Why is it an ApiError? → api.ts (line 135) catches the fetch AbortError and rethrows
   `new ApiError('Request was cancelled', 'ABORTED', 0)`, discarding the AbortError name.
4. Why does an abort fire at all on a normal page view? → React 19 StrictMode double-invokes
   effects in dev: mount → fetch starts → cleanup runs `controller.abort()` → effect re-runs.
   The first fetch is cancelled by design. (Also fires on real tab-switch / navigation / refresh.)
5. Why does the wrap exist? → To give TIMEOUTS a friendly message. But it wrapped BOTH
   timeout and plain cancellation, breaking the cancellation contract every caller relies on.

## Root cause
api.ts loses the AbortError identity for reason-less cancellations. The timeout abort
carries a reason (`DOMException('Request timed out','TimeoutError')`); a real cancellation
via `options.signal` → `controller.abort()` carries NO reason → default `AbortError`. Both
were collapsed into ApiError, so all 28 `name === 'AbortError'` guards across the app
(reports, invoices, payments, parties, dashboard, …) silently stopped working.

## Fix (single site — fixes the whole class)
In api.ts, split the two cases:
- Timeout (`name === 'TimeoutError'` OR message 'Request timed out') → `ApiError(..., 'TIMEOUT')`
  (a real failure worth surfacing).
- Plain cancellation → **rethrow the raw AbortError** so `name === 'AbortError'` guards
  everywhere swallow it. No ApiError, no toast.

## Failing test (manual)
1. Open /parties/:id (Ledger tab is default) in dev (StrictMode on).
   - BEFORE: red "Request was cancelled" toast on first paint.
   - AFTER: no toast; ledger loads normally.
2. Rapidly switch party detail tabs / navigate away mid-load → no toast.
