---
audit_of: SCOPE_PHASE7_IMPORT_7_1A_PARTIES.md
auditor: scope-auditor
audited_at: 2026-05-18T20:36:00+05:30
audit_version: v2
prior_audit_version: v1 (same file, archived inline below)
verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 0
future_epic_recommendations: 3
---

# SCOPE Audit v2 — Phase 7 #149 · Slice 7.1A Parties Import

## Verdict

**PASS.** All 9 MUST_SHIP gaps and all 6 SHOULD_SHIP gaps from v1 are
materially closed in SCOPE text — not just acknowledged. The revision
moved the synchronous-parse cap to 2k (the only defensible answer on
Render Starter), added a server-issued single-use `commitToken` plus
row-level commit guard (kills the double-commit ledger-doubling bug),
locked tenancy to `req.activeBusiness.id` everywhere, and introduced
byte-level XXE + zip-bomb + CSV-injection defences with concrete
fixtures and acceptance tests. The 7-action audit table + 24h raw-PII
purge + DPDP erasure cascade satisfy the DPDP forensics + minimisation
duo that v1 flagged.

Architect may proceed. The high-risk-path gate will still fire on
`prisma/schema.prisma` + new auth-touching routes — architect is the
correct next agent.

---

## Closed gaps (v1 → v2) — one-line summary

| v1 # | Title | Closed by (SCOPE location) |
|------|-------|----------------------------|
| 1 | Tenancy `tenantId` → `businessId` | Data Model L240-262, Security L478-479; `req.user.userId` everywhere |
| 2 | Commit not idempotent | `commitToken` single-use + `Idempotency-Key` + SELECT FOR UPDATE + row-level `createdPartyId IS NULL` guard (Security L486-487, Risks #15) |
| 3 | 30s budget math wrong for 10k | Sync cap = 2,000 rows w/ measured 5+5+5+15s budget; >2k = 202+poll; `PARSING` orphan cleanup (Decisions #2, UF L86-87) |
| 4 | Audit coverage incomplete | 7 action keys tabulated + `enforce-audit-coverage.mjs --block` gate (Security L505-515) |
| 5 | XXE / billion-laughs | 64KB byte pre-scan + `processEntities: false` + 10s timeout + fixture (Security XXE block, Acceptance L637) |
| 6 | Zip-bomb on .xlsx | `yauzl` enumerate + 100MB uncompressed + ratio 100 + fixture (Security zip-bomb block) |
| 7 | CSV-injection in error-CSV | OWASP prefix-quote `=+-@\t\r` + worked example + fixture (Security CSV-injection block) |
| 8 | PII retention undefined | 24h post-commit `raw`+`normalized` purge; DPDP cascade in Cross-feature Impact + 25h acceptance |
| 9 | Failure modes 4/5 weak | Scenario 4 + `clientVersion ≥ 7.1.0` + 1-active-job-per-business; Scenario 5 DPDP §13 cascade runbook |
| S1 | Offline-queue exclusion | `excludeFromOfflineQueue: true` flag + Cross-feature Impact + acceptance |
| S2 | Industry exemplars | New column in Resolved Decisions table |
| S3 | Shared-device cross-admin leak | Uploader-scoped job list + counts-only re-upload warning |
| S4 | Metrics label clash | All metrics use `business_id` (Observability block) |
| S5 | Cron silent no-op | `import_cleanup.no_rows_processed` metric + Sentry P3 |
| S6 | Lockout scope | `(businessId, userId)` upload cooldown; per-`businessId` commit concurrency |

---

## Adversarial re-check — new gaps introduced by the revision

Walked all 7 failure scenarios and stress-tested the new async-poll path,
the `commitToken` lifecycle, and the DPDP cascade. No new MUST_SHIP or
SHOULD_SHIP class gap surfaced. Findings worth noting (not blockers):

- **`setImmediate` async path durability.** The 2k–10k path runs parse
  after HTTP response via `setImmediate`. Render Starter dyno cycling
  during parse leaves the job in `PARSING`; the 5-min orphan cleanup
  reaps it. SCOPE acknowledges this explicitly and routes >10k to 7.1E
  worker. Defensible MVP trade-off.
- **`commitToken` TTL** is implicit (cleared on `COMMITTING`, otherwise
  bounded by 7d STAGED expiry). No need to add explicit TTL row.
- **`eraseImportData` may not exist yet** — SCOPE handles the conditional
  honestly ("IF absent, this slice MUST add it"). Architect will verify
  on entry.
- **High-risk-path gate** will fire on `prisma/schema.prisma` +
  auth-touching routes; required-agent list (architect, security) is
  already implied by this slice's reach.

---

## Future-epic recommendations (carried forward, not for this scope)

- **FE-1: GSTN-live-validation.** Defer fine; when it lands, dedup must
  treat "cancelled at GSTN" as soft-warning not block.
- **FE-2: Saved column-mapping templates.** Already FUTURE_EPIC.
- **FE-3: Address parsing.** Defer; will resurrect for 7.1B Products
  (Place-of-Supply rules need state/pincode).

---

## What the SCOPE got right (preserved through revision)

- Per-row staging model (DH's hard-won lesson).
- 500/tx chunk size with cited empirical source.
- Server-issued `commitToken` modeled on Square's pattern.
- 24h raw-PII window with audit-shell preserved — minimisation done
  correctly without breaking forensics.
- File Plan with 62 files, every row ≤250L estimate.
- Reserved adversarial fixtures (billion-laughs, zip-bomb,
  csv-injection) checked into `tests/fixtures/import/` — testable
  without burning anything.
- Acceptance criteria are concrete and curl-able.
- Explicit "Accepted Trade-offs" section — future ICs will know what
  was deliberate vs accidental.

---

## Cross-session learnings applied

- **A01.1 `req.user.userId` not `req.user.id`** (`feedback_auth_req_user_shape.md`)
  → v1 Gap 1; v2 confirmed closed.
- **DH offline-queue retrofit pain** → v1 Gap S1; v2 `excludeFromOfflineQueue` flag.
- **DH idempotency for new POSTs** (`OFFLINE_RULES.md` checklist line 7)
  → v1 Gap 2; v2 `commitToken` + `Idempotency-Key` middleware.
- **HisaabPro multi-business `business_id` tenancy** → v1 Gap 1 + S4; v2 closed.
- **DPDP §13 erasure cascade** (regulatory baseline) → v1 Gap 8 + 9; v2 closed.

No new blindspot patterns emerged in this revision worth writing to
`~/.claude/learnings/scope-writer-blindspots-2026-05-18.md`. The author
addressed each callout with code-level specificity (file paths, regex,
table-level operations) rather than hand-waving — exactly the revision
quality v2 is meant to verify.

---

## Required next sequence

1. **architect** — emits `ARCHITECTURE_phase7_import.md` with File Plan,
   migration order (add columns nullable → backfill not required for
   greenfield → no make-NOT-NULL), commit-tx ordering, `setImmediate`
   parse contract.
2. **security** — emits `SECURITY_AUDIT_phase7_import.md` focusing on
   XXE pre-scan regex correctness, zip-bomb thresholds vs Render heap,
   `commitToken` entropy + replay window, audit-coverage matrix.
3. **task-manager** — gates Backend → Frontend → QA with the curl +
   fixture + screenshot evidence already itemised in Acceptance.
4. Then code (high-risk gate clears via approved
   `<project>/.claude/design-plan-active.md`).
