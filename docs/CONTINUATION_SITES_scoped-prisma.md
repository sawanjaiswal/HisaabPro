# Async-continuation sites — where the tenant frame is not present

> File #49 (G-14). Companion to `docs/RUNBOOK_scoped-shadow.md`.
>
> The tenant frame is an `AsyncLocalStorage` slot opened inside `auth`. This
> document enumerates the places where a Prisma read happens **without** that
> frame, why, and what each one needs before an `enforce` epic can run.
>
> Written at the end of the shadow epic from the code as it stands, so it is a
> starting inventory, not a substitute for the durable one. The authoritative
> list is query 5 in the runbook — `GROUP BY model, operation, provenance` over
> `kind='no-context'` — which measures production rather than my reading.

---

## The headline number

```
$ grep -rn "runUnscoped\|runInBusinessContext" server/src/services server/src/jobs
# 4 matches, all inside server/src/services/shadow/
```

**Zero call sites outside this epic's own files use either helper.** Every
`no-context` record the harness writes today is therefore expected, and the
backlog below is the whole of it. That is also why the frame-loss criterion
(`no-context ∧ provenance='http' ∧ hadBusinessOnToken`) is gated at **0** while
the rest of the `no-context` population is only enumerated: the first is a bug in
the frame, the second is work nobody has done yet.

---

## Class D first — the one that silently misfiles a framed read

```ts
// ✗ recorded as no-context, despite being inside a frame
runInBusinessContext(ctx, () => prisma.party.findMany(...))

// ✓
runInBusinessContext(ctx, async () => await prisma.party.findMany(...))
```

Prisma promises are **lazy**: constructing one does no work, so a callback that
*returns* the promise unawaited lets `.run()` exit before the query is issued. The
query then runs outside the frame, the extension reads an empty slot, and a
correctly-framed read is filed under the unframed backlog.

This is not hypothetical — it is how `scoped-shadow.integration.test.ts` first
failed, producing `no-context` for a read that was demonstrably inside a frame.
It is listed first because it is the only class here that makes the *measurement*
wrong rather than merely incomplete, and because it fails silently in the
direction that looks like more work to do rather than less.

Every frame-opening site must be `async () => await …`.

---

## Class A — the frame is never opened (cron / job paths)

`provenance: 'job'`. There is no request, so `auth` never ran and there is nothing
to inherit. This is the largest population and the real backlog.

| Site | Notes |
|---|---|
| `services/notifications/notification-cron.ts:189-230` | Six registered ticks — drain, overdue scan, subscription expiry, retention purge, month roll, reminder tick — plus a marketing retention purge. Each iterates tenants. |
| `services/gst/backfill.service.ts:116` | `setImmediate` continuation off an admin-triggered backfill. |
| `jobs/shadow-retention.cron.ts`, `jobs/shadow-watchdog.cron.ts`, `jobs/shadow-canary.cron.ts` | This epic's own crons. They write to the two shadow tables, which are **not** tenant-scoped, and the canary opens its own frame deliberately. No action. |

**Strategy per site — pick one, and write down which:**

1. **Per-tenant loop → open a frame.** A cron that already iterates businesses
   should wrap each iteration in `runInBusinessContext({ businessId, userId })`.
   This is the preferred outcome: it converts a job-path read into a scoped one
   and shrinks the enforce-epic's exception list.
2. **Genuinely platform-global → `runUnscoped('<reason>')`.** A retention purge or
   a cross-tenant aggregate has no single tenant. The reason string is the point;
   `runUnscoped()` with no argument is an unaudited exemption wearing a helper's
   name.

Do not resolve these by adding models to the passthrough list. A model exempted
for a cron's sake is exempted for every request path too.

---

## Class B — the frame propagates, but the request is gone

`AsyncLocalStorage` follows async-resource creation, so a callback scheduled
*inside* a frame still sees it. These sites are therefore **not** frame-loss —
they are frame-outliving-its-request, which matters only for `routeHint`.

| Site | Shape |
|---|---|
| `routes/imports/create.route.ts:182` → `services/import/parse.service.ts` | ≥500 KB uploads: `setImmediate(() => runParseAndStage(...))`, respond 202. |
| `services/stock-alert.service.ts:112` | `void notifyStockAlert({...})` |
| `services/marketing/campaign-dispatch.service.ts:95` | `void enqueueAllRecipients(...)` |
| `services/collections/promise-to-pay-eval.service.ts:240` | `void notifyPtpBroken({...})` |

**Strategy: none required for scoping.** Verify rather than assume — if any of
these shows up in the `no-context` backlog with `provenance='http'` and
`hadBusinessOnToken=true`, the assumption above is wrong for that site and it is a
gated frame-loss bug, not a backlog row.

The `void f()` shape has a separate, non-scoping problem: a rejection there is
unhandled — the process-level handler in `index.ts` logs it, but context-free.
**Resolved 2026-07-23** (commit `3afbe930`): `stock-alert.service.ts:112` and
`promise-to-pay-eval.service.ts:240` now attach a tagged `.catch()`;
`campaign-dispatch.service.ts:95` already had one. The two `setImmediate` sites
(`imports/create.route.ts`, `import/parse.service.ts`) run their own try/catch
inside the scheduled work, so they are already attributed.

---

## Class C — no scoped read on the path

Reads that will never be observed because the model is not tenant-scoped:
`Session` (keyed by `userId`), admin/platform tables, the two shadow tables. These
produce no record of any kind and need no strategy. They are listed so that a
future reader does not mistake their absence from the sink for missing coverage.

---

## A3b shortfall — the six routers that produce no `routeHint`

A3b asserts that ≥15 of 22 exercised routers record a non-empty `routeHint`. The
measured number is **16**. Enumerated by name rather than rounded, because a
shortfall belongs in this list and not in a lowered threshold:

| Router probed | Why no hint | Real gap? |
|---|---|---|
| `GET /api/dashboard/today` | No such route — the dashboard router exposes `/home` and `/stats`. The probe 404s before any handler matches. | **No — test-fixture artifact.** Fix the probe URL. |
| `GET /api/reports/sales` | No such route — reports exposes `/invoices`, `/day-book`, `/stock-summary`, `/payments`, `/stock-value`, `/party-statement/:partyId`, `/export`. | **No — test-fixture artifact.** |
| `GET /api/batches` | The router has no `GET /`; its list route is `/products/:productId/batches`. | **No — test-fixture artifact.** |
| `GET /api/godowns` | `router.use(requirePlan('BUSINESS'))` answers before the handler layer matches, so `req.route` is never populated. | **No** — correct behaviour of a router-level gate. |
| `GET /api/documents` | `router.use(requireFeature('invoicing'))`, same shape. | **No** — same. |
| `GET /api/sessions` | Matches its route and runs, but reads `Session`, which is not a tenant-scoped model — nothing is eligible for observation. | **No** — Class C. |

So: **none of the six is a defect in route-hint resolution.** Three are wrong URLs
in the probe list, two are router-level gates working as designed, one is a
non-scoped model. The honest reading of "16 of 22" is that route-hint capture
works wherever a scoped read reaches a matched handler.

Two consequences worth carrying forward:

- The **≥ 20 distinct `routeHint`** production exit criterion is not endangered by
  this shortfall — production traffic hits real URLs, and the two gated routers
  will populate hints for users whose plan and features permit them.
- A `routeHint` is absent whenever a **router-level** gate answers first. Any
  future criterion phrased as "every router must appear" would be unmeetable by
  construction, not by omission.
