---
symptom: Sales Hub tabs intermittently show "Could not load X" / console "Query data cannot be undefined" for sales-documents, recurring unpredictably even long after the server-side etag/no-store fix was confirmed live and healthy. Chrome Network tab (filtered to documents?type=ESTIMATE) showed 47 requests alternating (canceled)/200 for that single query, accumulated over a long-lived tab session.
repro: Filtered Network tab to `documents?type=ESTIMATE` on a long-open Sales Hub tab — every failed attempt showed as browser-level "(canceled)", not a 4xx/5xx/timeout. A canceled fetch (not a server error) can only be produced by something in-page calling AbortController.abort() on an in-flight request. Grepped for unscoped `queryClient.invalidateQueries()` (no queryKey arg = invalidates+refetches every mounted query, aborting whatever was in flight) and found src/App.tsx:74-80 firing exactly that on every `document.visibilitychange` → visible event — i.e. every time the user tabs away (e.g. to take a screenshot, check DevTools in a separate window, switch apps) and back.
root_cause_file: src/App.tsx:74-80 (removed) — `document.addEventListener('visibilitychange', () => { if (visible) queryClient.invalidateQueries() })`
root_cause_reason: query-client.ts already sets `refetchOnWindowFocus: true` as a TanStack Query default, which correctly refetches only stale queries on focus/visibility restore without forcibly cancelling in-flight fetches. App.tsx additionally hand-rolled a second, cruder mechanism — an unscoped `invalidateQueries()` (no queryKey filter) on the same visibility signal — that unconditionally invalidates and refetches EVERY active query app-wide, including one that may already be mid-fetch. Every tab-away/tab-back cycle (screenshotting, alt-tabbing to DevTools' separate window, switching apps) fired this a second time, aborting the sales-documents fetch already in flight and starting a fresh one — visible in Network as the canceled/200 pairs.
class: duplicate-cache-invalidation-mechanism (unscoped global invalidate racing TanStack's own focus-refetch)
regression_since: always-broken since this handler was added (git log -S "visibilitychange" -- src/App.tsx → c8e1099, "feat(gold-standard): 10/10 — close every remaining gap") — likely added defensively without realizing refetchOnWindowFocus already covered this, and without scoping it to specific query keys.
flip_proof: manual — removed the redundant handler entirely (App.tsx now relies solely on query-client.ts's refetchOnWindowFocus/refetchOnReconnect, which refetch per-query respecting staleTime instead of hard-invalidating everything). tsc + enforce + ssot re-run post-fix.
---

## 5-whys

1. Why does the Sales Hub error recur unpredictably, well after the server
   was proven healthy (curl + 5 clean DEBUG_TRACE log lines)?
   Because the browser's own Network tab shows the sales-documents request
   itself being cancelled client-side, not failing server-side.
   [Network tab: documents?type=ESTIMATE rows alternating (canceled)/200,
   47 total on one long-lived tab]
2. Why would a same-origin fetch to a healthy server show as "(canceled)"
   in DevTools instead of 200/4xx/5xx?
   Because something in the page is calling `AbortController.abort()` on
   that specific in-flight request before it can complete — that status is
   client-initiated, not a server response.
3. What calls abort() on a query that's just sitting there, no user action
   on that tab?
   `queryClient.invalidateQueries()` with no key filter — TanStack's
   invalidation for an in-flight query cancels the current fetch and starts
   a replacement. Grepped for unscoped invalidateQueries() calls; found one
   in src/App.tsx:76 wired to `document.visibilitychange`.
   [grep "invalidateQueries(\s*)\|invalidateQueries()" src --include=*.ts*]
4. Why does visibilitychange fire often enough to matter, given the user
   isn't switching browser tabs?
   Any transition to `document.visibilityState === 'visible'` fires it —
   including returning to the Chrome window after using a separate
   screenshot tool, alt-tabbing to check an undocked DevTools window, or
   switching apps — all of which happened repeatedly across this debugging
   session, each one re-triggering a full unscoped invalidate+refetch of
   every mounted query, including the one already fetching sales-documents.
5. Why was this app-wide invalidate ever added given TanStack Query already
   ships `refetchOnWindowFocus: true` (src/lib/query-client.ts:14), which
   is designed for exactly this scenario?
   It's a duplicate, cruder mechanism layered on top — TanStack's own
   focus-refetch respects staleTime and only refetches queries that are
   actually stale, without force-aborting in-flight fetches; the hand-rolled
   listener bypassed all of that and hit every query indiscriminately.
   [read src/lib/query-client.ts:14 — refetchOnWindowFocus already true]

## Hypothesis

Two independent client-side mechanisms were both trying to keep queries
fresh on tab-focus-return: TanStack Query's built-in `refetchOnWindowFocus`
(scoped, staleTime-aware, non-destructive) and a hand-rolled
`visibilitychange` listener in App.tsx doing an unscoped
`queryClient.invalidateQueries()` (global, forces every query — including
ones mid-fetch — to abort and restart). The second one is pure duplication
of the first, done more crudely, and its collateral damage (aborting
in-flight fetches on every tab-focus event) is what produced the
observed cancel/refetch churn on the Sales Hub queries during a long
debugging session with frequent tab/app switching. Fix: delete the
redundant handler; the built-in `refetchOnWindowFocus` option already
does this correctly.

## Bug class & fix shape

class: duplicate-cache-invalidation-mechanism
shape: minimal (delete duplicate code, no SSOT extraction needed — the
canonical mechanism, `refetchOnWindowFocus`, already exists in
query-client.ts; this fix just removes the second, redundant, unscoped
copy). [no-class-guard: single call site found via exhaustive grep for
unscoped invalidateQueries(); the other two hits (useSSE.ts:54,
useConflictReconcile.ts:55) are legitimately scoped to real
disconnect/conflict events, not a duplicate of a built-in option — left
as-is]

## Failing test

No automated repro — this required a live, long-running browser session
with real tab-focus churn to observe via Network tab; not practical to
assert in a unit/integration test. Verified via code-level elimination:
`src/App.tsx:74-80` was the only code path capable of producing a
client-side "(canceled)" status on a healthy, otherwise-idle query.

## Mask sweep

`grep -rn "invalidateQueries(\s*)\|invalidateQueries()" src` — 3 hits
total: this one (removed), useSSE.ts's 30s SSE-disconnected fallback poll
(legitimate — only runs when SSE is actually down), and
useConflictReconcile.ts (legitimate — fires only on an actual detected
conflict). No other unscoped/duplicate invalidation mechanisms found.
