# Runbook — scoped-Prisma shadow harness

> Operator-facing. Everything here is executable: a flag to set, a query to run,
> or a decision to make from a row you are looking at.
>
> Design: `docs/ARCHITECTURE_scoped-prisma-shadow.md`. Plan ledger:
> `.claude/plans/scoped-prisma-shadow.md`. This runbook is File #48.

---

## 1. What the harness is, in one paragraph

Under `SCOPED_PRISMA_ENFORCE=shadow`, every **sampled read** on a tenant-scoped
model runs twice: once as the caller wrote it (the answer the caller gets, always
unchanged) and once with `where: { businessId }` injected. The two id sets are
compared and the verdict is written to two tables. **The harness never changes
what a caller sees** — it is an observer, and every one of its own failures is
swallowed. Its output is the evidence a future `enforce` epic needs: a list of
call sites whose answers would change if tenant scoping became mandatory.

The harness is *not* a security control. It detects nothing in real time and
blocks nothing. Treat a green dashboard as "we have measured", never as "we are
isolated".

---

## 2. Flags and knobs

Read **once at boot**. Changing any of them requires a restart; there is no
half-applied window and no hot reload. Every accessor clamps rather than throws —
a mistyped tuning value must not be able to take the API down.

| Env var | Default | Range | What it does |
|---|---|---|---|
| `SCOPED_PRISMA_ENFORCE` | `off` | `off` \| `shadow` \| `enforce` | `off` = harness absent, `prisma` is the soft-delete client. `shadow` = scoped client + port. `enforce` is **not authorised by this epic**. |
| `SCOPED_PRISMA_SHADOW_SAMPLE` | `0.01` | `0`–`1` | Fraction of eligible reads observed. Default is deliberately **not** `1`: if this var goes missing on a redeploy while the mode flag survives, forgetting fails at 1% rather than at 100%. |
| `SCOPED_PRISMA_SHADOW_TIMEOUT_MS` | `250` | `1`–`5000` | Per-probe timeout. The probe loses the race rather than holding a pool slot. |
| `SCOPED_PRISMA_SHADOW_MAX_INFLIGHT` | `2` | `0`–`5` | Concurrent probe cap. `0` = probes disabled while the mode stays on. |
| `SCOPED_PRISMA_SHADOW_SINK_MAX_INFLIGHT` | `2` | `0`–`5` | Concurrent **sink-write** cap, gauged separately from the probe: a no-context read skips the probe and still writes a row, so the sink's pool usage is budgeted, not assumed free. |
| `SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID` | unset | business id | Synthetic tenant the canary reads under. **Unset = canary disabled**, which is the correct default — a canary pointed at a real business would write that tenant's row ids into the divergence table every 15 minutes forever. |
| `SCOPED_PRISMA_CUTOVER_DONE` | unset | `true` | Post-cutover latch. When `true` in production, boot **fails** unless the mode is `enforce`. Do not set it during shadow. |

Worst-case pool footprint: **4 of 10 connections** (2 probe + 2 sink). Both gauges
**shed** rather than queue, which is why the ceiling is a ceiling and not a hope.

### Kill switch

```
SCOPED_PRISMA_ENFORCE=off   # then restart
```

Env change only — no deploy, no migration reversal. `prisma` returns to
`clients.softDeleted`, the port is never installed, both tables go inert and keep
their existing rows. Confirm from the boot log:

```
Database connection initialized (soft-delete active, scoped-prisma mode=off, client=softDeleted)
```

If that line says `mode=shadow, client=scoped`, the restart did not pick up the
change. The log is the SSOT here — never infer the mode from the dashboard.

---

## 3. Rollout stages

| Stage | Flags | Advance only when |
|---|---|---|
| 0 · Merge dark | unset | migration applied; both suites green; boot log shows `mode=off` |
| 1 · Staging | `shadow`, sample `1`, canary set | canary row present; `sampled` non-zero; `distinctFramedRoutes` ≥ 20; frame-lost = 0; **`sinkWriteFailed` = 0**; p95 within +10% at sample 1.0 |
| 2 · Pre-ramp gate | — | **Neon pooler connection limit** read from the dashboard and written into §8 below — the pooler limit, not `max_connections` |
| 3 · Prod toe-dip | `shadow`, sample `0.01` | 24h latency watch, p95 within +10% |
| 4 · Ramp | `0.01 → 0.05 → 0.25 → 1.0` | ≥24h per step; advance only while p95 ≤ +10% |
| 5 · Watch | `shadow`, sample ≥ `0.25` | 7 days; §6 exit criteria all met |
| 6 · `enforce` | — | **separate epic. Not authorised by this document.** |

Breach response at any stage: sample `0.001`, then `off`. Env change + restart, no
deploy.

---

## 4. Reading the status endpoint

```
GET /api/admin/scoped-shadow/status      # platform admin only
```

Returns `404 SHADOW_DISABLED` when the mode is not `shadow` — deliberately, rather
than an all-zero `200`. A zero payload from a harness that was never installed is
indistinguishable from a harness that observed nothing, and this epic exists
because four components that "grepped clean" were called by nothing. Absence is
made loud.

The read is `auditAdminAction`-logged. That is not ceremony: the payload carries
hashed tenant ids plus up to 50 × 40 row ids from across the platform, which is a
cross-tenant read by any reasonable definition.

Fields worth knowing before you need them:

- **`shadowPortInstalled` + `boundClient`** — the two wiring facts. `true` +
  `scoped` is the only healthy combination under `shadow`. A port with
  `boundClient: softDeleted` means the extension is not on the path and every
  other number on the page is measuring nothing.
- **`configuredSample` vs `effectiveSample`** — a gap means the harness
  auto-throttled under load. Expected; it bears on the volume floor, not on
  integrity.
- **`sinkWriteFailed` vs `sinkShed`** — see §5. Never sum them.
- **`breakerOpen`** — the sink's own circuit breaker. Open means writes are being
  refused; the window under way is incomplete and cannot qualify a watch period.
- **`rawSqlSitesUnaudited: true`** — a constant, not a measurement. Raw-SQL call
  sites are outside the extension's reach entirely, so **no amount of shadow
  evidence covers them**. It is on the payload so nobody reads a clean dashboard
  as coverage it does not have.
- **`includeBlindFraction`** — the fraction of in-window divergence rows carrying
  `include`. The diff compares **top-level ids only**, so included relations were
  not compared at all. A high value means the comparison was partly blind over
  much of the observed population; it does not mean those reads are clean.

---

## 5. `sinkWriteFailed` is an alarm; `sinkShed` is not

Both are **in-process counters**, never rows in the divergence table. That is
deliberate: an alert emitted on the path whose failure it detects cannot fire when
that path is what broke. A "sink is down" record written by the sink would be the
purest possible instance of the mistake.

| Counter | Meaning | Response |
|---|---|---|
| `sinkWriteFailed` | A write was **rejected** — broken pipe, constraint violation, dead pool | **Page.** A window ending with a non-zero value does not qualify the `enforce` epic, however clean the divergence table looks. An empty table and a broken pipe look identical without this number. |
| `sinkShed` | A write was **dropped by the inflight gauge** — backpressure, working as designed | Report, never gate. Gating it would be unachievable at sample 1.0 and would train the operator to wave the pair through. High `sinkShed` bears on the **volume floor**: the window observed less than `sampled` suggests. |

Sentry group to watch: `['shadow','sink-write-failed']`.

---

## 6. Exit criteria for the `enforce` epic

All computed from the durable sink over the watch window. **Use `lastSeenAt`, not
`createdAt`** — the dedupe upsert pins `createdAt` at first sight, so a row that
has been firing continuously for a month still has a month-old `createdAt`.

```sql
-- 1. Volume floor: sampled ≥ 50 000 over ≥ 20 distinct scoped models.
SELECT sum(count) AS sampled
FROM   scoped_shadow_stat
WHERE  kind = 'sampled' AND "hourBucket" >= now() - interval '7 days';

SELECT count(DISTINCT model) FROM scoped_shadow_divergence
WHERE  "lastSeenAt" >= now() - interval '7 days';
```

```sql
-- 2. Frame coverage — the durable production analogue of A3b. Must be ≥ 20.
--    Collapses toward 0 if enterTenantFrame stops opening frames.
SELECT count(DISTINCT "routeHint")
FROM   scoped_shadow_stat
WHERE  kind = 'observed-framed'
  AND  "routeHint" <> ''
  AND  "hourBucket" >= now() - interval '7 days';
```

```sql
-- 3. Frame LOSS — must be exactly 0. A request that arrived carrying a tenant
--    and lost it before the query is a bug in the frame, not a backlog item.
SELECT count(*) FROM scoped_shadow_divergence
WHERE  kind = 'no-context'
  AND  provenance = 'http'
  AND  "hadBusinessOnToken" = true
  AND  "lastSeenAt" >= now() - interval '7 days';
```

```sql
-- 4. Real divergence — must be 0 for 72 consecutive hours. The two excluded
--    kinds are reported by count, never folded into this number.
SELECT kind, count(*) FROM scoped_shadow_divergence
WHERE  "lastSeenAt" >= now() - interval '72 hours'
GROUP BY kind;
```

```sql
-- 5. The no-context BACKLOG. Not a threshold — a written list. This is the
--    inventory of call sites that need runUnscoped()/a frame before enforce.
SELECT model, operation, provenance, count(*), sum(suppressed)
FROM   scoped_shadow_divergence
WHERE  kind = 'no-context'
GROUP BY model, operation, provenance
ORDER BY sum(suppressed) DESC;
```

Also required, and not expressible as SQL over these tables:

- **canary present in every 45-minute window** of the watch (§7);
- **`sinkWriteFailed` = 0** across the window, and no
  `['shadow','sink-write-failed']` Sentry group in the same period (§5);
- `shadow-error` < **0.1%** of `sampled`;
- every `diverged` row in the window classified as *missing service filter*
  (fixed) or *legitimately global* (added to the passthrough list) — §9.

---

## 7. The canary, and seeding its fixture

The canary is the positive control: every 15 minutes it runs the **real injection
core** on a real model and asserts that scoping filtered a row it knows is there.
Without it, "zero divergences" and "the harness died three days ago" produce the
same dashboard.

It reads a **bounded synthetic fixture**, not an unbounded `findMany`. An unbounded
canary would return other tenants' rows by design and persist a 20-id sample of
real production ids every 15 minutes forever — the control itself would become the
largest recurring source of the cross-tenant linkage §9.3 exists to bound.

Seeding, once per environment, before setting `SCOPED_PRISMA_SHADOW_CANARY_BUSINESS_ID`:

1. Create (or pick) a **synthetic** business to be the canary tenant. It must hold
   no real data. Note its id — that is the env var's value.
2. Create two `Party` rows with **exactly** these ids:
   - `shadow-canary-fixture-self` — in the canary business.
   - `shadow-canary-fixture-foreign` — in **any other** business. This is the row
     scoping must filter out.
3. Restart, then confirm within 15 minutes:
   ```sql
   SELECT "lastSeenAt", "onlyUnscoped" FROM scoped_shadow_divergence
   WHERE kind = 'canary' ORDER BY "lastSeenAt" DESC LIMIT 1;
   ```

Canary log lines and what they mean:

| Log | Meaning | Response |
|---|---|---|
| `shadow.canary.fixture_missing` | The `self` row is absent — the fixture was deleted or never seeded | Re-seed. Until then the canary proves nothing; the assertion is exact in both directions precisely so a half-seeded fixture cannot pass. |
| `shadow.canary.NOT_DETECTED` | The scoped read **returned the foreign row** | **Page.** Scoping is not filtering. This is the harness's entire reason to exist appearing in its own control. |
| `shadow.canary.plan_shape` | `injectScope` returned something other than a `sameOp` merge | The injector changed shape underneath the control. Treat the canary as untrustworthy until explained. |

A canary older than **45 minutes** trips the watchdog, which reads durable rows
rather than the env var whose loss is one of the failures it detects.

---

## 8. Environment facts to record here

Fill in at stage 2, before ramping. These are the numbers the pool arithmetic in §2
assumes and cannot verify from inside the process.

| Fact | Value | Read from | Date |
|---|---|---|---|
| Neon **pooler** connection limit (not `max_connections`) | _TBD_ | Neon dashboard | — |
| Prisma pool size (`connection_limit`) | 10 | `DATABASE_URL` | — |
| 24h p95 baseline, top-5 scoped read endpoints | _TBD_ | pre-deploy metrics | — |

---

## 9. Triage — you are looking at a divergence row

### Record kinds

| kind | Writes a row? | Gated at 0? |
|---|---|---|
| `clean` | **no** — stat bump only | n/a |
| `diverged` | yes | **yes** |
| `unstable-window` | yes | no — counted, reported |
| `skew-suspect` | yes | no — counted, reported |
| `no-context` | yes | frame-lost sub-population only |
| `shadow-error` | yes (`errorName` only) | no — < 0.1% of sampled |
| `unsupported-shape` | yes | no |
| `canary` | yes | must be **present** |

A clean comparison writes **no** divergence row. That is what keeps the table an
anomaly table: if healthy comparisons wrote rows, the cutover decision would be
read off noise. Healthy volume lives in `scoped_shadow_stat`.

### Is it real, or is it write skew?

The two sides run against a moving database, and promise-reuse fixes the control
first and the candidate second — so an insert landing between them always surfaces
as `onlyScoped` and a delete always as `onlyUnscoped`. Directional skew here is
**systematic, not random**, which is what makes the signature usable:

| Signal | Write skew | A real missing filter |
|---|---|---|
| Size | small (≤ 3 ids) | whole-tenant-shaped |
| Direction | one-directional | either, often both |
| Reproducible | no | **yes** |
| Endpoint | a hot **write** endpoint | any read path |
| `onlyUnscoped` contents | ids of the same tenant | **another tenant's ids** |
| `observationIntervalMs` | larger | irrelevant |

Small + one-directional + non-reproducible + hot write path = skew; `classify`
will usually have labelled it `skew-suspect` already. Whole-tenant-shaped and
reproducible = a real missing filter, whatever its size.

### Decision

1. **`diverged`, another tenant's ids in `onlyUnscoped`** → the call site is
   missing its `businessId` filter. Fix the service, then confirm the row stops
   re-firing (`suppressed` stops climbing, `lastSeenAt` goes stale).
2. **`diverged`, and the query is genuinely platform-global** (a cron, a lookup
   table, an admin surface) → add it to the passthrough list. Write down *why* it
   is global; "it looked intentional" is not a classification.
3. **`unstable-window`** → the query carried `take`/`skip`/`cursor`. The two sides
   read different windows of a moving list, so the difference carries no
   information about scoping. No action.
4. **`no-context` + `provenance='http'` + `hadBusinessOnToken=true`** → **frame
   loss.** A request arrived with a tenant and lost it. This is a bug, not backlog.
5. **`no-context`, anything else** → backlog. Pre-business traffic and job paths
   legitimately have no frame today; they need `runUnscoped()` or a frame before
   `enforce`. Query 5 in §6 is the inventory.
6. **`unsupported-shape`** → the query used `select` without `id`, so there was
   nothing to diff. Not a defect; it outranks `clean` precisely so an id-less
   result cannot certify itself as agreement.

---

## 10. DPDP erasure inventory

Both tables below hold personal data under DPDP and must be included in any
erasure or data-subject request. Recording them here is the point of this section —
a future request needs a documented location, not a code search.

| Table | What it holds | Retention |
|---|---|---|
| `scoped_shadow_divergence` | `subjectBusinessId` (the querying tenant) paired with up to **20 row ids belonging to other tenants** per array, `routeHint`, counts | Deleted when `lastSeenAt < 30 days` **or** `createdAt < 180 days` — whichever fires first |
| `scoped_shadow_stat` | Aggregate counts by `[hourBucket, kind, routeHint]`. **No identifiers.** | `hourBucket < 180 days` |

State it plainly: `scoped_shadow_divergence` is a durable, platform-global,
**cross-tenant identifier-linkage store**. Each row pairs one tenant with row ids
belonging to others — that pairing *is* the payload the epic exists to produce.
Row ids are pseudonymous under DPDP, but they re-identify trivially by joining back
to the live database, which every reader of this table already has.

Four controls bound it, and all four are load-bearing:

1. **Volume** — 20 ids per array (`SHADOW_MAX_IDS`). `unscopedCount`/`scopedCount`
   carry the magnitude and `truncated` records that the cap bit, so nothing
   diagnostic is lost by capping.
2. **Time** — the dual ceiling above. `lastSeenAt` alone never deletes a
   still-firing row, which would mean an indefinitely-retained linkage. A row still
   firing at day 180 has been an open incident for six months; deleting it loses
   nothing an operator does not already know, and the next occurrence re-creates it
   with a fresh `createdAt`.
3. **Access** — platform admin only, `requireAdmin` + `auditAdminAction`, with
   `subjectBusinessId` hashed at the API boundary.
4. **The canary must not manufacture linkage** — hence the bounded synthetic
   fixture in §7.

Never in a record, log line, metric label, DB row, or API response: any row field
other than `id`; the query `args`; `err.message` (Prisma embeds failing field
values — `errorName` only); `req.originalUrl` / `params` / `query`; `businessId` as
a metric label.

---

## 11. Escalation

| Symptom | First check | Then |
|---|---|---|
| Status endpoint 404s | Boot log mode line | Expected when mode ≠ `shadow`. If the mode *is* shadow, the process did not restart with the env you think it did. |
| `shadowPortInstalled: true`, `boundClient: softDeleted` | `lib/prisma.ts` ternary | The extension is not on the path. Every number on the dashboard is measuring nothing — treat as an outage of the harness, not of the API. |
| `sampled` flat at zero | `effectiveSample`, then `SCOPED_PRISMA_SHADOW_SAMPLE` | A `0` sample with mode `shadow` is a harness that is on and blind. |
| p95 regression > +10% | `effectiveSample`, inflight gauges | Sample `0.001`, then `off`. Do not tune timeouts under load. |
| `sinkWriteFailed` climbing | §5 | Page. Do not read the divergence table's emptiness as evidence while this is non-zero. |
| Canary stale > 45 min | Watchdog alert, then §7 log table | The harness may be alive and unable to prove it. Both are treated as failure. |

**Under no circumstance** does mitigation involve editing `lib/prisma.ts`,
`lib/prisma-scoped*.ts`, or `lib/scoped-models.ts` during an incident. Those files
are the tenant-isolation choke point and are gated behind an approved design plan.
The kill switch in §2 is the incident tool.
