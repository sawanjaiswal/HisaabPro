verdict: PASS

# Security Re-Audit — Auto-reconciliation (#147)

Re-audit of revised plan `design-plan-active--auto-reconciliation--bare-143115.md`
(security rev 2). Prior verdict: REVISE (6 MUST_FIX). All six are now resolved
and verified against live source. No genuine money/tenant-safety MUST_FIX remains.

## MUST_FIX — all CLEARED

- **M1 — businessId `?? ''` fallback (CLEARED).** Confirmed the live footgun:
  `server/src/middleware/auth.ts:75` sets `businessId: payload.businessId ?? ''`.
  An empty-string tenant scope would silently widen Prisma `where` clauses.
  Plan §API contracts S-M1: `const businessId = req.user!.businessId; if (!businessId)
  throw new AppError('NO_BUSINESS', 401)` in EVERY handler. Correct mitigation —
  fail-closed on the exact value the middleware emits. Verified.

- **M2 — TOCTOU (CLEARED, exceeds reference).** Plan re-scopes in BOTH lookup AND
  mutation: `updateMany({ where: { id: lineId, businessId, status: <expected> }, data })`
  + assert `count === 1`. Note: the cited `server/src/services/payment/update-delete.ts`
  actually does findFirst(id,businessId)→update(id) inside a $transaction and does
  NOT re-scope businessId+status in the mutation where. The revised plan is
  STRICTER than its own reference — it closes the row-state race the payment path
  leaves open. Candidate pool is also businessId-scoped (§A-M2 query). Accepted.

- **M3 — bankAccountId tenant validation (CLEARED).** `findFirst({ where: { id,
  businessId } })` before use, 404 on miss; `businessId` always stamped from token,
  never from body; `paymentId` re-scoped to businessId in the match handler.
  Standard tenant-ownership validation. Verified.

- **M4 — idempotency mis-claim (CLEARED).** Rev 1 conflated X-Request-Nonce with
  idempotency. Confirmed against source: `middleware/replay-protection.ts`
  (X-Request-Nonce/Timestamp) is replay defense; `middleware/idempotency.ts`
  (X-Idempotency-Key + IdempotencyLog) is dedup. Plan now correctly relies on a
  DB-level control: `ReconciliationMatch.lineId @unique` → P2002 → 409. The global
  P2002 handler exists (`lib/errors.ts:210` → conflictError/409). This is a sound,
  middleware-independent dedup — actually more robust than a header. Verified.

- **M5/M6 — strict Zod, field allowlist, caps (CLEARED).** All body schemas
  `.strict()`; `rows.max(2000)`; per-field type/length/enum caps (amount int >0,
  direction enum, description ≤500, referenceNumber ≤100); server NEVER spreads
  `data: req.body`; client-supplied `status`/`confidence`/`method`/`businessId`
  rejected. Matches the project's no-mass-assignment posture. CSV parsed client-side
  → server takes bounded JSON, no multipart/file handling on server. Verified.

## SHOULD_FIX — acceptable dispositions

- **CSV formula injection** — deferred correctly: stored cells are raw strings
  (safe at rest), v1 has NO export path, so no `=+-@` prefix sink exists yet. Plan
  explicitly tags the future export epic to prefix cells. Acceptable; track as a
  hard requirement on the export epic, not a v1 blocker.
- **PII in logs** — bank description/referenceNumber (names/UPI handles) never
  logged; ids + counts only. Aligns with project no-PII-in-logs rule. Good.
- **Double-match** — server-side control is the `@unique` (409), UI flag is
  cosmetic. Correct ordering (server authoritative). Good.

## Confirmed-correct supporting facts
- `Payment.isDeleted` + `Payment.date` exist → §A-M2 pool query (`isDeleted:false`,
  date-window, `id notIn reconciled`, `orderBy id asc`, `take 5000`) is valid and
  tenant-scoped.
- `requirePlan('PRO')` (subscription-gate.ts:135) and `requirePermission`
  (permission.ts:20) exist → route guard chain is real.
- Schema is additive create-table-only with line-side `lineId @unique`; confidence
  stored as Int (no float on money-adjacent value). No ledger mutation — reconciliation
  only annotates via the join table; un-reconcile is a row delete. No money-corruption
  surface.

## NEW findings
None rising to MUST_FIX. One NIT (non-blocking): the service should map P2002 to a
domain-specific `LINE_ALREADY_RECONCILED` 409 rather than relying on the generic
`"<field> already exists"` message from `lib/errors.ts:210`, so the client can
distinguish "already reconciled" from other unique violations. Cosmetic — does not
hold the verdict.

verdict: PASS
