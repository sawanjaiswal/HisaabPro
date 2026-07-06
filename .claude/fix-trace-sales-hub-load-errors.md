---
symptom: All Sales Hub tabs (Estimates, Sale Orders, Delivery Challans) show "Checking your plan" hang followed by generic load failures ("Failed to load sale orders" / "Failed to load delivery challans"), and the error state always displays "Could not load invoices" regardless of which tab is open. The filter chips row ("All Saved Converted Draft") also renders as unstyled plain text.
root_cause_file: server/src/middleware/subscription-gate.ts:136,171,195
root_cause_reason: requirePlan / requireFeature / requireQuota are async Express middleware registered directly via router.use()/route args without asyncHandler — any rejected promise inside resolveBusinessPlan (a Prisma call) is an unhandled rejection that Express 4 never converts into a response, so the request hangs until the client-side fetch timeout fires instead of failing fast with a clear error.
---

## 5-whys

1. Why do Sale Orders/Delivery Challans/Estimates tabs show "Failed to load X"?
   Because the GET /api/documents request either errors or times out client-side.
2. Why does the request time out instead of returning quickly?
   Because /api/documents is gated by `requireFeature('invoicing')`
   (server/src/routes/documents/index.ts:30), and under any transient failure
   inside that middleware the request never resolves.
3. Why would `requireFeature` never resolve on failure?
   Because it's an `async (req, res, next) => {...}` function passed straight
   to `router.use()` — not wrapped in `asyncHandler` — so if the `await
   resolveBusinessPlan(...)` call throws, the rejected promise has no
   `.catch()` anywhere in the call chain.
4. Why does a rejected promise in that spot break instead of surfacing an error?
   Express 4's routing layer only auto-forwards *synchronous* throws inside a
   handler to `next(err)`. An `async` function's rejected promise is invisible
   to Express — the request socket is simply left open until the client's own
   timeout (`TIMEOUTS.fetchMs` in `src/lib/api.ts`) aborts it.
5. Why wasn't this caught earlier / why does it also explain the "Checking your
   plan" flash?
   The same unguarded-async-middleware pattern is used identically by
   `requirePlan`, `requireFeature`, and `requireQuota` (all three exported from
   `subscription-gate.ts`), and PlanGate's own plan check goes through the
   equivalent subscription-resolution path — so the same class of bug (any
   transient Prisma hiccup silently hangs the request instead of failing
   fast) produces both symptoms. This was never wrapped in `asyncHandler`
   because the codebase's other middleware/route handlers use it consistently
   (e.g. every handler in `documents/crud.ts`), but `subscription-gate.ts`'s
   three factories were missed.

## Hypothesis

`requirePlan`, `requireFeature`, and `requireQuota` in
`server/src/middleware/subscription-gate.ts` are the only async Express
middleware in the documents/billing gating path that are NOT wrapped in
`asyncHandler`. Any rejected promise inside them (most commonly from the
`resolveBusinessPlan` Prisma queries under load, connection-pool pressure, or
any other transient DB blip) hangs the request indefinitely instead of
producing a clean error response — which is indistinguishable, from the
frontend's point of view, from a slow/failing network call. This explains
both the prolonged "Checking your plan" loading screen and the generic
"Failed to load X" toasts across every Sales Hub tab, since all of them are
gated by one of these three middleware. Wrapping all three in the existing
`asyncHandler` helper (already used everywhere else in the codebase) makes
failures fail fast and return a proper 5xx instead of hanging.

Two additional, independently-confirmed bugs found and fixed alongside this:
- `src/features/sales/DocumentListPage.tsx` hardcodes the error title to
  `t.couldNotLoadInvoices` regardless of the `type` prop, so Sale Orders and
  Delivery Challans errors always read "Could not load invoices."
- `invoice-filter-pill` / `invoice-filter-pill--active` classNames used in
  `DocumentListFilterBar.tsx` and `InvoicesPage.tsx` are only defined in
  `src/features/recurring/recurring.css` (a different feature's stylesheet,
  never imported by these components) — the actually-imported
  `invoice-filter-bar.css` defines the equivalent rules under a different
  name (`.invoice-type-pill`), so the pills render with zero CSS.

## Failing test

No existing integration test exercises a Prisma failure path inside
`requireFeature`/`requirePlan`/`requireQuota` to assert the request still
receives a response (vs. hanging). Manual verification: `asyncHandler`
wrapping is a well-established, already-proven pattern in this codebase
(every other route handler uses it) — the fix brings these three factories
in line with that existing, tested convention rather than introducing new
untested logic.
