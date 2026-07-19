---
audit_of: SCOPE_tenant-isolation.md
auditor: scope-auditor
audited_at: 2026-07-19T14:23:00+05:30
verdict: PASS
must_ship_gaps: 0
should_ship_gaps: 0
future_epic_recommendations: 4
revision: 2 (re-audit of in-place revision)
carry_to_architect: 2
---

# SCOPE Audit — Data-Layer Tenant Isolation (Scoped Prisma) · Re-audit

## Verdict

**PASS.** All six MUST_SHIP gaps from the first audit are closed with real,
testable mechanisms — verified against the live schema, not the prose. Two items
carry forward to the architect as must-fix-before-build corrections (one verified
FK-map error, one test-precision tightening); neither is a shippable leak because
each fails closed at CI. The architect + security sequence can now run.

I re-verified the load-bearing claims by grepping `server/prisma/schema.prisma`
directly. The FK map — the single highest-leverage leak vector — is 27/28 correct.

---

## Closure verification (each original MUST_SHIP gap)

### Gap 1 — Child many-write hole → CLOSED
- **Mechanism:** `CHILD_SCOPED` two-step parent-id planner (B9, File #4): resolve
  in-scope parent ids under ctx, rewrite to scalar `where:{ <fk>:{ in } }` inside one
  tx. Correctly acknowledges Prisma's relation-filter ban on `updateMany`/`deleteMany`.
  Red-team case #15 covers foreign-parent-id → 0 rows.
- **Spot-check (live schema):** verified all 28 rows of the pinned FK map. **27 map
  to a real FK scalar on a `businessId`-bearing parent** — incl. the two the
  coordinator named: `JournalEntryLine.journalEntryId → JournalEntry` (businessId ✓),
  `PaymentAllocation.paymentId → Payment` (businessId ✓). See carry-forward CF-1 for
  the one exception.
- **Verdict:** mechanism sound and implementable for every listed child.

### Gap 2 — Nested connect/connectOrCreate → CLOSED
- **Mechanism:** B13 connect-guard walks `data` for `connect`/`connectOrCreate` on
  scoped relation fields (`SCOPED_RELATION_FIELDS`, DMMF-derived, File #3/#5),
  resolves each target via a scoped `findFirst`, foreign → `NOT_FOUND` no write.
  `CONNECT_REJECT` metric + red-team case. `connectOrCreate` create-branch defaults to
  reject (fail-closed). This is explicit, not inherited from extension behavior.
- **Verdict:** the vector the extension cannot cover implicitly is now covered explicitly.

### Gap 3 — Completeness = correctness → CLOSED
- **Mechanism:** Test #14 derives the must-scope set **mechanically from Prisma DMMF**
  (`businessId` scalar presence) and asserts `businessId-models ⊆ SCOPED_MODELS`;
  `GLOBAL_ALLOWLIST` cannot exempt a `businessId`-bearing model (must carry a documented
  `globalReason` and have no `businessId` scalar). This is coverage **and** correctness,
  exactly as demanded.
- **Spot-check:** ran the partition myself — all 51 no-`businessId` models resolve to
  either the 27-row child map or 24 platform-globals; **zero unclassified**. The
  partition the test enforces is genuinely achievable. See CF-2 for a precision tighten.

### Gap 4 — Unproven rewrite mechanism → CLOSED
- **Mechanism:** Phase-0 spike (#17, Rollout Phase -1) is a **hard gate BEFORE any
  production wiring**, on real Postgres, proving (a) findUnique→findFirst rewrite,
  (b) delete/update→two-step, (c) soft-delete `isDeleted` still applies to the rewritten
  op, (d) firing inside `$transaction`. Chooses a **client `$extends` component** (not a
  bare query extension) and carries a documented fallback (delegate wrapper) with a
  Phase -1 "abandon design if infeasible" rollback. CI-has-Postgres is now a **named hard
  prerequisite** (`services: postgres:16` → `DATABASE_URL_TEST`), not a hedge; #15/#16/#17
  are required gates. Directly answers the contradiction with the live soft-delete
  module's own warning.
- **Verdict:** the epic can no longer ship on an unproven premise; the premise is a gate.

### Gap 5 — Raw SQL → CLOSED
- **Mechanism:** One-time audit of all 86 raw-SQL sites promoted to `[MUST_SHIP]`
  (`raw-sql-audit.allowlist.json`, File #12), each classified, **"0 unwaived" is the gate
  to enter Phase 2 (enforce)**. New-raw-SQL CI lint ban. The "structural isolation" /
  DPDP claim is **explicitly withheld** until the audit clears (Failure Mode A5). This is
  the correct scoping: audit-the-surface is MUST, auto-parse-SQL stays FUTURE.
- **Verdict:** the largest un-coverable surface now has a cutover-blocking audit gate.

### Gap 6 — ALS async-continuation loss → CLOSED
- **Mechanism:** B14 + integration test #16 drives a **real route** scheduling a scoped
  query on `res.on('finish')` / streamed-PDF, asserting it sees ctx or throws
  `CONTEXT_UNSET` (never silently unscoped). Continuation sites enumerated;
  `response.continuation` reason added. Cites blindspot 2026-05-31 SS-2 by name.
- **Verdict:** the documented prior blindspot now has an explicit, failing-closed test.

### SHOULD_SHIP (SS-1..SS-5) — all addressed
- SS-1: count corrected to 96; `PayslipSnapshot` missing index confirmed by me and a
  migration (`@@index([businessId, createdAt])`) added. SS-2: two-step detects an active
  tx client, no nested interactive tx. SS-3: `auth.audit-write` reason for
  `/api/auth/*` `AuditLog` writes. SS-4: File #20 stubs `__basePrismaUnsafe` in
  `setup.ts`. SS-5: shadow flags `NO_MANUAL_SCOPE` write ops.

---

## Carry-forward to architect (must fix before build — NOT blocking, fail closed at CI)

### CF-1: One FK-map row is wrong — `ImportJobRow`
- **Verified against `schema.prisma`:** `ImportJobRow`'s FK scalar is **`jobId`**
  (`job ImportJob @relation(fields: [jobId], references: [id])`), **not `importJobId`**
  as the Data-Model table states. Every other row (27/28) is correct.
- **Why not a MUST_SHIP block:** the SCOPE explicitly mandates the architect re-derive
  `CHILD_SCOPED` from the DMMF, and completeness test #14 fails closed on a map that
  doesn't resolve to a real relation — so a broken map cannot reach enforce. This is a
  transcription error in an explicitly-architect-owned table, caught at CI, not a
  shippable leak. Fix the row to `ImportJobRow | jobId | ImportJob`.

### CF-2: Tighten test #14 to assert the FK COLUMN resolves, not just the parent model
- CF-1 is exactly the class #14 must catch. As worded ("maps to a real relation whose
  target is businessId-bearing"), #14 could be implemented to check only the parent
  model's `businessId` and miss a wrong FK-column string. Make #14 assert, for every
  `CHILD_SCOPED` entry, that the stored FK column exists as a relation scalar on the
  child AND its relation target is `businessId`-bearing. This turns CF-1 into a guaranteed
  CI failure rather than a possible runtime error in the child-many planner.

---

## New MUST_SHIP gaps introduced by the revision

None. The child-many planner's empty-`where` `deleteMany` case (large in-scope parent
`IN` list) is a bounded-to-one-tenant performance concern, correctly flagged to the
architect (Notes #4), not a leak. The connect-guard's `connectOrCreate` create-branch
defaults to reject (fail-closed). The spike's failure path has a documented fallback +
Phase -1 abandon rollback. No new leak vector surfaced.

## Future-epic (correctly deferred)
- 406-service manual-scope migration; raw-SQL auto-parser (audit stays MUST); per-user
  scoping of user globals; child-model `businessId` denormalization (planner is the
  now-path, denorm is the scale fallback). All correctly tiered.

---

## What the SCOPE got right (preserve)
- The revision did not just add prose — it added **mechanisms with tests and gates**:
  a DMMF-derived completeness test, a pre-wiring proof spike as a hard gate, a
  cutover-blocking raw-SQL audit, a real-route continuation test, and a pinned FK map
  the architect must regenerate. Fail-closed default, AND-intersect merge, and the
  env-flag rollback at every rollout phase carried through intact.
- Honest limits stated plainly (raw SQL not auto-scoped; query-extension op-rewrite
  unproven → spike; child relation-filter ban → scalar FK-`in`). No hand-waving.

## Cross-session learnings applied
- `architecture-blindspots-2026-05-31.md` (SS-2 ALS-frame escape) → confirmed closed by
  Gap 6 (B14 + test #16), now cited by name in the SCOPE.
- `architecture-blindspots-2026-06-07.md` (no-context tenant-scoped audit writes) →
  confirmed closed by SS-3 (`auth.audit-write` reason).
- `scope-writer-blindspots-2026-07-19-media-storage.md` Class (c) ("a tenant-scoping
  change is NEVER 'breaks nothing at the app layer' — enumerate every ORM call site") →
  reinforced by the SCOPE's per-call-site rewrite plan + FK-map re-derivation mandate;
  CF-1 is a live example of why that mandate matters.
- Recommend seeding `scope-writer-blindspots-2026-07-19-tenant-isolation.md` with the two
  gap classes not previously recorded (surfaced during this loop): (1) child rows without
  a tenant key can't be scoped by a relation filter in `updateMany`/`deleteMany` — Prisma
  rejects relation filters there; (2) query extensions do not recurse into nested
  `connect`/`connectOrCreate` — and add a note that a pinned FK map must be DMMF-validated
  at the column level, not the parent-model level (CF-1/CF-2).
