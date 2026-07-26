---
symptom: Anything created while offline never reaches the server — the queued mutation is dead-lettered the moment connectivity returns.
root_cause_file: src/lib/offline.processor.ts:120
root_cause_reason: processQueue hand-rolled its replay headers (Content-Type + idempotency key only), omitting the CSRF token and replay nonce/timestamp that every mutation needs, so the server answered 4xx and the processor's non-retryable branch marked the item dead.
---

## Symptom

TC-PTY-11: create a party with the network off, turn it back on, wait 30s.
`GET /parties?search=<name>` returns nothing — the party never synced. In the
app the sync queue shows the item as failed rather than applied.

## 5-whys

1. **Why is the party missing after reconnect?** — the queued item was
   dead-lettered instead of applied.
2. **Why was it dead-lettered?** — `processQueue` treats any 4xx as
   non-retryable (`offline.processor.ts:151`) and sets `status: 'dead'`.
3. **Why did the replay get a 4xx?** — it sent no `X-CSRF-Token` (the csrf
   middleware answers 403 CSRF_FAILED) and no `X-Request-Nonce` /
   `X-Request-Timestamp` (replayProtection answers 400
   MISSING_REQUEST_HEADERS). Both were reproduced by hand against the running
   server while writing this trace.
4. **Why were those headers missing?** — the processor built its own header
   object: `{ 'Content-Type': 'application/json' }` plus the idempotency key.
5. **Why didn't it use the client's header builder?** — `buildRequestHeaders`
   (`src/lib/api-request.ts:57`) exists precisely so "services never have to
   remember" the nonce, and it already carried a comment saying so. The
   processor predates it and was never migrated; being a vanilla module (no
   React tree) it looked like it had to roll its own, but the builder is a plain
   async function with no such dependency.

Root cause: two implementations of "the headers a mutation needs", one of which
was missing two of them.

## Hypothesis

Routing the replay through `buildRequestHeaders` — passing the idempotency key
as a caller header so it still wins — makes a replayed mutation byte-identical
in headers to a live one, and deletes the second implementation. `getCsrfToken`
memoises in-module, so the whole queue drain costs at most one extra GET.

## Failing test

`src/lib/__tests__/offline-replay.test.ts` — "replays with the CSRF token and
replay-protection headers the live client sends". Red before the change
(`X-CSRF-Token` undefined), green after. E2E: TC-PTY-11 in
`e2e/gold/parties-list.spec.ts`.

## Did I fix the symptom or the cause?

The cause. The symptom fixes — exempting the queue's paths from CSRF, or
retrying 403s — would either open a CSRF hole or spin forever on a request that
can never succeed. The offline queue is the app's headline promise on 2G, so it
has to send what the server actually requires, from the one place that knows
what that is.
