# Phase 6 — Operational Runbook

> Companion to [ROLLOUT_PHASE6.md](./ROLLOUT_PHASE6.md). When that doc
> says "see the runbook", land here.
> Architecture: [ARCHITECTURE_PHASE6_STAFF_HR.md](./ARCHITECTURE_PHASE6_STAFF_HR.md).
> Last updated: 2026-05-18.

This runbook lists every page-able and ticket-able alert that Phase 6
introduces, along with the diagnostic steps and remediations. The
intent: anyone with Render + Neon + Sentry access can resolve the
incident class without paging Sawan, by walking the steps top-to-bottom.

Format for each entry:

- **Trigger** — what fires the alert (metric / log shape)
- **Severity** — Sev-1 (page immediately) / Sev-2 (page within 1h) /
  Sev-3 (ticket, work next business day)
- **Likely cause** — what we believe is happening based on past incidents
- **Diagnose** — commands / queries / dashboard URLs to confirm
- **Mitigate** — short-term action to stop the bleeding
- **Resolve** — root-cause fix + postmortem trigger

---

## 1. `payment_already_reversed_total` spike

### Trigger

Prometheus rule:

```
rate(payment_already_reversed_total[5m]) /
rate(payroll_reverse_calls_total[5m]) > 0.01 for 10m
```

i.e., more than 1% of reverse-payroll calls are bouncing off the
Prisma P2002 → `AppError(VALIDATION_ERROR, 409, 'PAYMENT_ALREADY_REVERSED')`
translation that PR6 BE added in
`server/src/services/payroll/payroll-run-reverse.ts`.

### Severity

**Sev-3** by default. The 409 IS the correct safety response — the
unique constraint on `Payment.reversesPaymentId` is doing its job, no
data is being corrupted. The spike is a UX or race-condition signal,
not a data-integrity signal.

Promote to **Sev-2** if:
- Spike correlates with a UI deploy timestamp (likely double-submit
  regression in PayrollReverseButton.tsx), OR
- Any single user is hitting 409 more than 3× in 5 minutes (suggests
  background sync queue is replaying the request).

### Likely cause

| Pattern | Cause | Confidence |
|---|---|---|
| 409s concentrated on one userId, all within seconds | UI double-click — `<PayrollReverseButton>` lost its `disabled={isSubmitting}` guard | High |
| 409s scattered across many userIds, low absolute rate | Offline mutation queue replaying after reconnect (HP `api()` retries on transient failure) | Medium |
| 409s correlating with cron job timestamps | Background reconciliation job double-reversing | Low (no such job in Phase 6) |

### Diagnose

1. Pull a sample of 10 recent 409 traces from Sentry, filtering on
   `error.code == 'PAYMENT_ALREADY_REVERSED'`
2. Inspect the request URL → extract `payrollRunId` from the path
3. Run:
   ```sql
   SELECT pr.id, pr."businessId", pr."status",
          COUNT(p.id) AS reversal_count
   FROM "PayrollRun" pr
   LEFT JOIN "Payment" p ON p."reversesPaymentId" IN (
     SELECT id FROM "Payment" WHERE "businessId" = pr."businessId"
       AND "type" = 'PAYROLL_OUT'
       -- and joined via Payroll → PayrollRun
   )
   WHERE pr.id IN ('<id1>', '<id2>', ...)
   GROUP BY pr.id;
   ```
   If `reversal_count > 1` for any row, the constraint actually blocked
   a duplicate — system worked correctly.
4. Cross-check the offending request's userId against Sentry's
   `request.headers['x-idempotency-key']`. If two adjacent requests
   share the same idempotency key, the 409 is the second request
   hitting the cache; expected behaviour.
5. Check FE Sentry for paired client-side errors: `PayrollReverseButton
   submit failed` followed within < 1s by another submit attempt
   indicates a double-click that escaped the button's disabled-state
   guard.

### Mitigate

- **If double-click pattern confirmed**: roll FE back to the previous
  build (Render dashboard → Static Site → "Rollback Deploy") that has
  the working disabled-state guard. Code fix follows.
- **If offline-queue replay confirmed**: nothing to mitigate at the
  flag level — the 409 is exactly the right response. File a backlog
  task to add `Idempotency-Key` propagation to the `api()` retry
  layer if it doesn't already.

### Resolve

1. Reproduce locally:
   ```bash
   # spin up dev server, finalize a run, hit Reverse twice in <100ms
   # via DevTools Network → throttle to 3G
   ```
2. Fix in `src/features/hr/components/PayrollReverseButton.tsx` —
   confirm `setIsSubmitting(true)` runs *before* the `await
   reversePayroll()` call, not after.
3. Add a unit test that mounts the button, fires two `click` events
   synchronously, asserts only one `reversePayroll` call is made.
4. Postmortem trigger per architecture §20:
   > `payment_already_reversed_total` spikes — UI is letting users
   > double-click the Reverse button OR background-job is racing.

---

## 2. `pin_gate.cookie_tamper_detected` alert fires

### Trigger

Prometheus rule (from architecture §14 + Q2 verdict):

```
rate(pin_gate_cookie_tamper_total[5m]) > 5/min sustained 5m
on any single client_ip OR any single userId
```

Each tamper event emits a structured log line:

```json
{
  "event": "pin_gate.cookie_tamper_detected",
  "userId": "...",
  "clientIp": "...",
  "subtype": "domain_prefix_mismatch | hmac_mismatch | cross_user
              | cross_tenant | pf_stale | iat_expired",
  "ts": "ISO-8601"
}
```

### Severity

**Sev-1** unless the subtype is `pf_stale` or `iat_expired` — those are
benign (architecture §17.5: `pf_stale` is explicitly excluded from the
tamper alert).

- `domain_prefix_mismatch` → **Sev-1**: someone is presenting a
  JWT-shaped token without the `pin-grace-cookie-v1:` prefix. Possible
  leaked JWT replay attempt.
- `hmac_mismatch` → **Sev-1**: cookie signature doesn't verify.
  Either a determined attacker or a JWT_SECRET rotation race.
- `cross_user` → **Sev-1**: cookie issued for user A presented in user
  B's session. Means a cookie leaked between users — possibly via
  shared-device misuse or a CDN caching bug.
- `cross_tenant` → **Sev-2**: cookie issued for biz1 presented after
  switch-business. Lower because the switch-business audit row tells
  us exactly when the cookie became stale; still worth investigating.
- `pf_stale` / `iat_expired` → **filtered out of the alert** at the
  rule level; observed in dashboards but not paging.

### Likely cause

| Subtype | Cause | Confidence |
|---|---|---|
| `hmac_mismatch` clustered around a deploy timestamp | JWT_SECRET rotated and stale cookies are now being rejected — expected, will decay in 8h (grace window) | High during rotations |
| `hmac_mismatch` sustained, no recent deploy | Active tampering attempt (rare); inspect client_ip distribution | Medium |
| `domain_prefix_mismatch` | A leaked JWT being replayed as a cookie OR a 3rd-party library accidentally setting `pin_gate_grace` from another claim | Low, page-worthy |
| `cross_user` clustered on a single IP | Family/staff sharing a phone after PIN-verify; not malicious | Common at retail tenants |
| `cross_user` distributed across many IPs | Real session leak — possible CDN bug, XSS, or supply-chain compromise of the FE bundle | Page Sev-1 immediately |
| `cross_tenant` | User switched business; cookie issued for biz1 presented after switch — UX bug, not an attack | Common, low Sev |

### Diagnose

1. Open Grafana `phase6-pin` dashboard → "Tamper events by subtype"
   panel. Note which subtype is driving the spike.
2. Switch panel to "Tamper events by IP" → distribution shape:
   - **Single IP dominates** → likely a single misbehaving device or
     a targeted attacker. Geo-locate the IP. If it's in a known
     attacker country and the userId is a high-value account, escalate
     to Sev-1 and force-logout the account via:
     ```sql
     UPDATE "User" SET "tokenVersion" = "tokenVersion" + 1
     WHERE id = '<userId>';
     ```
     This invalidates every refresh token. PIN cookies (8h) will
     decay on their own.
   - **Distributed across IPs** → systemic issue (deploy race,
     library bug). Read recent commits to
     `server/src/middleware/require-recent-pin.ts` and
     `server/src/lib/security-events.ts`.
3. Cross-reference with deploy timeline:
   ```bash
   # Render API service deploy log
   render deploys list --service hisaabpro-api --limit 10
   ```
   A spike that starts within 60s of a deploy and decays linearly is
   almost always a JWT_SECRET rotation or middleware change.
4. Pull 5 sample log lines via Sentry / Loki:
   ```
   {event="pin_gate.cookie_tamper_detected"} |= "subtype="
   ```
   Inspect the cookie payload (Decode the base64-ish part with `node
   scripts/decode-pin-cookie.mjs <cookie>` — internal tool, lives in
   the server repo).

### Mitigate

- **JWT_SECRET rotation aftermath**: do nothing; the spike will decay
  as users naturally re-verify PIN over the next 8h. Annotate the
  dashboard with the deploy timestamp so future on-calls don't
  panic.
- **Active attacker on single account**: force-logout via
  `tokenVersion++` (above) AND set
  `FEATURE_TRANSACTION_PIN_COHORT_PCT=0` for that user only via the
  per-user override mechanism (TBD — for Phase 6 v1, force-logout is
  the lever).
- **Systemic FE-side leak suspected**: roll the FE to the previous
  deploy. Do NOT disable PIN globally unless the systemic issue is
  proven to be in `require-recent-pin.ts` itself.
- **Last resort — disable PIN globally**: see
  `ROLLOUT_PHASE6.md:4.3 PIN rollback`. Use ONLY if the PIN gate is
  net-harmful (e.g., false-positive rate so high that legitimate
  users can't FINALIZE payroll).

### Resolve

1. Postmortem within 48h regardless of root cause (per architecture §20:
   `pin_grace_cookie_tamper_total` spikes are postmortem-triggering).
2. Add a fuzz / negative-path test that exercises the specific subtype
   to `__tests__/require-recent-pin.test.ts`.
3. If root cause is a leaked JWT_SECRET, follow standard secret-rotation
   playbook in `docs/SECRET_ROTATION.md` (not part of Phase 6 deliverable;
   create if missing).
4. Update this runbook's "Likely cause" table with the new pattern.

---

## 3. General Phase-6 operational guidance

### 3.1 Audit-log search slowness

If audit-search p95 > 400ms (architecture §17.3 SLO):

1. Check Neon dashboard → "Slow queries" → look for `websearch_to_tsquery`
   queries
2. Verify the GIN index is present:
   ```sql
   SELECT indexname FROM pg_indexes
   WHERE tablename = 'AuditLog' AND indexdef LIKE '%gin%';
   ```
   Should show `AuditLog_searchVector_idx`. If missing, the migration
   was incompletely applied — re-run `npx prisma migrate deploy`.
3. If the index is present but slow: `EXPLAIN ANALYZE` the offending
   query, look for `Seq Scan` instead of `Bitmap Heap Scan`. May
   need `ANALYZE "AuditLog";` if statistics are stale.

### 3.2 Payroll FINALIZE timing out

If `payroll_finalize_duration_seconds_p95 > 5s`:

1. Count employees in the offending business:
   ```sql
   SELECT COUNT(*) FROM "Employee"
   WHERE "businessId" = '<bizId>' AND "deletedAt" IS NULL;
   ```
   FINALIZE wraps PayrollRun + N Payroll + N Payment + N PayslipSnapshot
   + N AuditLog in ONE transaction. With N > 200, the transaction
   timeout (10s on Render) is close.
2. Mitigation: for businesses with > 200 employees, batch the FINALIZE
   into chunks of 100 (server-side). This is a Phase 7 backlog item,
   not a Phase 6 hotfix.

### 3.3 Multi-firm switch returns wrong business data

If a user reports "I switched to Biz B but I see Biz A's data":

1. Confirm the activeBusiness cookie/session was updated:
   ```bash
   curl -i -b "at=<token>" https://api.hisaabpro.in/api/me
   # response should include businessUser.businessId = Biz B
   ```
2. If response shows Biz B but a follow-up `/api/parties` returns
   Biz A rows, the bug is in `requireActiveBusiness` — it should be
   reading the active membership row by `req.user.userId`, NOT
   `req.user.id` (architecture §3.6 + §17.1 + A01.1 closure).
3. Mitigation: force-logout the user (`tokenVersion++`), have them
   re-login. Bug fix is code-level — re-read PR1B middleware diff.

### 3.4 Audit row missing for a known mutation

If a postmortem reveals a mutation happened but no `AuditLog` row
appears:

1. Confirm the service file is listed in
   `server/src/lib/audit/audit-coverage.ts` (SSOT)
2. If listed, the audit-write was either skipped or transactionally
   rolled back. Check Sentry for an error in the audit-write call
   site — most likely the developer wrote `prisma.auditLog.create`
   instead of `tx.auditLog.create` inside the `$transaction`, so the
   outer rollback didn't take the audit row with it
3. Run `node scripts/enforce-audit-coverage.mjs --block` on the
   offending file diff — it should have failed at pre-commit. If it
   passed, the enforcer has a hole; file a Sev-3 to widen the
   detection regex
4. Postmortem trigger per architecture §20: "An audit row is missing
   for a service in `audit-coverage.ts`"

---

## 4. Escalation tree

```
Sev-3 (ticket) → handle next business day → ping Sawan only if blocked
Sev-2 (1h page) → handle within 1h → if can't, page Sawan
Sev-1 (immediate page) → page Sawan immediately, work in parallel
```

Sawan is the only paging target for Phase 6 incidents. There is no
secondary on-call until the team grows. The runbook is the substitute —
exhaust the diagnose/mitigate steps before paging.

---

## 5. Postmortem template

For every Sev-1 and any Sev-2 that triggered a rollback:

```
## Phase 6 Incident — <one line>

- **Date/time (UTC):** <start> → <end>
- **Trigger:** <alert name + value>
- **Severity:** Sev-1 / Sev-2
- **Cohort affected:** Internal / 10% / 50% / 100%
- **User-visible impact:** <one sentence>

### Timeline
- HH:MM — alert fired
- HH:MM — on-call ack'd
- HH:MM — mitigation applied (e.g. cohort rollback)
- HH:MM — root cause identified
- HH:MM — fix deployed
- HH:MM — alert cleared

### Root cause
<two paragraphs max>

### What went well
- ...

### What went poorly
- ...

### Action items
- [ ] Code fix landed (PR #...)
- [ ] Test added at <path>
- [ ] Runbook updated (this doc, section X)
- [ ] Architecture doc updated if invariant changed
```

File postmortems under `docs/postmortems/PHASE6_<YYYY-MM-DD>_<slug>.md`.
