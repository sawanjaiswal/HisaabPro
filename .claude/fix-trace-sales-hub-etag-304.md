---
symptom: After the subscription-gate hang fix, Sales Hub tabs (Estimates, Sale Orders, Delivery Challans) load once then permanently show "Could not load X" on any refetch (tab revisit, window focus, retry). Console repeats "Query data cannot be undefined ... Affected query key: sales-documents".
repro: curl -D - -H "Cookie: <session>" http://localhost:5001/api/documents?type=SALE_ORDER twice in a row, second call echoing the first response's ETag via If-None-Match — pre-fix returns "304 Not Modified" with a 0-byte body; getSalesDocuments() then resolves to `undefined`, which TanStack Query v5 rejects with its own "Query data cannot be undefined" invariant.
root_cause_file: server/src/app.ts:33 (missing app.set('etag', false))
root_cause_reason: Express enables weak ETag generation by default on every res.json() response; the API set no Cache-Control header anywhere, so the browser treats GET /api/documents as HTTP-cacheable and sends If-None-Match on repeat identical requests, which Express answers with an empty-body 304 — a response shape src/lib/api.ts's NO_BODY_STATUSES branch (built for legitimate 204/205 no-body responses) was never designed to also absorb.
class: http-cache-contract-violation
regression_since: always-broken — app.ts never configured etag/Cache-Control since its creation; masked by the unwrapped subscription-gate.ts async middleware (fixed in fix-trace-sales-hub-load-errors.md), which hung every request before it could ever reach a completed response and get ETag-cached by the browser.
flip_proof: manual — bin/fix-prove does not exist in this repo. Verified via curl against the live dev server (localhost:5001): pre-fix, a repeat identical GET returned "304 Not Modified" with an empty body and an `ETag: W/"..."` header; post-fix (app.set('etag', false) + Cache-Control: no-store), the identical repeat GET returns "200 OK" with the full JSON body every time and no ETag header at all. The integration test (documents-etag.contract.test.ts) pins this contract but cannot currently execute — the hisaabpro_test DB has pre-existing, unrelated Prisma migration drift (P3018 "type AdminRole already exists") that blocks `prisma migrate deploy` against it; tracked as separate infra debt, out of scope for this fix.
---

## 5-whys

1. Why does Sale Orders/Estimates/Challans show "Could not load X" after the
   first successful load?
   Because the TanStack Query for `['sales-documents', filters]` enters
   `error` state on the refetch, even though the server is healthy.
   [read src/features/sales/useDocumentList.ts — status derived from query.isError]
2. Why does the refetch produce an error when the first fetch succeeded with
   the exact same request?
   Because `getSalesDocuments()` resolves the query function's promise with
   `undefined` instead of the document list, and TanStack Query v5 throws its
   own invariant ("Query data cannot be undefined") whenever a queryFn
   resolves to `undefined` — it converts that into a hard error.
   [read src/features/sales/sales-list.service.ts — returns response.data unconditionally]
3. Why does `getSalesDocuments()` resolve to `undefined` on the refetch?
   Because `src/lib/api.ts`'s `NO_BODY_STATUSES` branch (204/205/304)
   synthesizes `{ success: true, data: undefined }` whenever the HTTP
   response status is 304.
   [read src/lib/api.ts:204-207]
4. Why does the server ever respond 304 to a plain `GET /api/documents` call
   that isn't doing conditional-GET on purpose?
   Because Express enables weak `ETag` generation by default for every
   `res.json()` call — confirmed via `curl -D -` on the live dev server:
   `ETag: W/"55-..."` present, no `Cache-Control` header at all. The browser
   caches that ETag against the request URL and automatically attaches
   `If-None-Match` on the next identical GET, which Express matches and
   answers with an empty 304 body.
   [curl evidence: pre-fix headers showed ETag present, no Cache-Control]
5. Why did this only start showing up now, for these three tabs specifically?
   Because the earlier bug fixed in `.claude/fix-trace-sales-hub-load-errors.md`
   (unwrapped async `subscription-gate.ts` middleware hanging the request)
   was masking it — a request that never resolves never reaches Express's
   response layer, so no ETag was ever computed or cached. Once that hang was
   fixed, requests started completing and repeating (tab revisit,
   `refetchOnWindowFocus: true` in src/lib/query-client.ts), which is exactly
   when the identical-URL 304 path gets exercised.
   [git log --oneline -- server/src/app.ts: etag never configured since file creation;
    git show cb60e4a: NO_BODY_STATUSES introduced Mar 26, predates this exposure]

## Hypothesis

`server/src/app.ts` never disabled Express's default ETag generation and
never set `Cache-Control` on API responses. This is a JSON API where
TanStack Query already owns client-side caching/invalidation — HTTP
conditional-GET caching serves no purpose here and actively corrupts every
GET endpoint's contract, because `src/lib/api.ts`'s 204/205/304 handling
(built for legitimate no-body responses like DELETE) was never designed to
absorb an unsolicited 304 from browser-driven revalidation. Fix: disable
conditional-GET caching at the source (`app.set('etag', false)`) plus an
explicit `Cache-Control: no-store` on every response as defense-in-depth
against browser heuristic caching, since every GET route in this API
returns JSON that TanStack Query re-fetches and diffs itself.

## Bug class & fix shape

class: http-cache-contract-violation
shape: contract-pin
why-not-SSOT: This isn't drift across N call sites — it's a single global
Express app-config gap (one process-wide `etag`/`Cache-Control` setting)
that every route inherits. There is exactly one place to fix it
(`server/src/app.ts`, the app factory), so there is no second call site to
consolidate away. The fix + the integration test together pin the contract
("this API never answers a GET with an empty conditional-cache body") at
the one point where it can be violated.

## Failing test

`server/src/__tests__/integration/documents-etag.contract.test.ts` — issues
two identical `GET /api/documents?type=SALE_ORDER` calls with the second one
echoing back the first response's `ETag` via `If-None-Match`, and asserts
the second response is NOT a 304/empty-body — it must return the full JSON
body every time, matching what `src/lib/api.ts` and TanStack Query actually
require from this API. Confirmed failing against pre-fix code via manual
curl (see `flip_proof`); cannot execute via vitest in this environment
because the `hisaabpro_test` DB has unrelated pre-existing migration drift.

## Mask sweep

`grep -rn "etag\|ETag" server/src --include="*.ts"` — only the new
`app.set('etag', false)` line/comment and the test file; no duplicate ETag
logic elsewhere. `grep -rn "NO_BODY_STATUSES\|status === 304\|=== 204" src
--include="*.ts"` — only the single instance in `src/lib/api.ts`; that
handling is correct and stays as-is for genuine 204/205 responses (e.g.
DELETE), it was just never designed to also see a 304. No other masks found.
