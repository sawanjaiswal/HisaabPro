---
status: approved
feature: s1-gl-auto-posting
created: 2026-05-29T00:34:41Z
approved_at: 2026-05-29T00:43:30Z
approver: Sawan (delegated — "auto mode bypass all permissions", 2026-05-29)
session: bare-055707
proposer: claude
high_risk_paths_touched:
  - server/prisma/migrations/**
files_planned:
  - server/prisma/migrations/20260529_gl_posting_idempotency_index/migration.sql
  - server/src/services/accounting/chart-of-accounts.ts
  - server/src/services/accounting/posting/posting.types.ts
  - server/src/services/accounting/posting/account-resolver.ts
  - server/src/services/accounting/posting/entry-number.ts
  - server/src/services/accounting/posting/posting.maps.ts
  - server/src/services/accounting/posting/post-document.ts
  - server/src/services/accounting/posting/post-payment.ts
  - server/src/services/accounting/posting/post-expense.ts
  - server/src/services/accounting/posting/reverse-entry.ts
  - server/src/services/accounting/posting/index.ts
  - server/src/services/accounting/posting/__tests__/posting.test.ts
  - server/src/services/document/create.ts
  - server/src/services/document/update.ts
  - server/src/services/document/delete.ts
  - server/src/services/payment/create.ts
  - server/src/services/payment/update-delete.ts
  - server/src/services/expense/expense-confirm.service.ts
  - server/scripts/backfill-gl.ts
  - docs/HISAABPRO.md
agents_invoked:
  - architecture-auditor (output: docs/EPIC_s1-gl-auto-posting/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-29T00:27:07Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 4 MUST_SHIP (M1 atomicity-vs-resilience contradiction, M2 entryNumber missing, M3 reversal sourceId collision, M4 SALE map unbalanced) + 4 SHOULD_SHIP
  - ts: 2026-05-29T00:34:41Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 2
    findings: M1/M2/M3 closed (code-verified); M4 still open (grandTotal excludes tds/tcs, revenue must post from subtotal not taxableValue)
  - ts: 2026-05-29T00:43:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 3
    findings: M4 closed — maps rebuilt from real Document columns, 3 worked examples balance, subtotal confirmed net-of-discount (document-calc.ts:32). Zero MUST_SHIP.
acceptance:
  backend:
    - tsc clean
    - vitest: posting maps balanced (Σdebit == Σcredit), idempotent double-post = no-op, reversal nets to zero, COGS posts at WAC
    - manual: POST a SALE invoice + a payment, then GET P&L / Balance Sheet — both reflect the txn (were empty before)
  frontend:
    - n/a (no new UI; existing accounting report pages now show real data)
---

# S1 — GL Auto-Posting — Plan

## Problem

The double-entry engine (#83–#88) is real and balances, but **no transaction
service posts to it**. Only manual JEs + FY-closure + party-ledger write
`JournalEntry`. So #84 P&L, #85 Balance Sheet, #86 Cash Flow, #87 Day Book
report on a journal that normal app usage never fills. #102 Profitability is
unaffected (reads `Document` rows directly), which is why the gap went
unnoticed. Confirmed in `docs/audit/FEATURE_AUDIT_SUMMARY.md` (S1).

The schema was **designed** for this: `JournalEntry.sourceType` / `sourceId` /
`sourceNumber` exist, the `type` enum already lists SALES/PURCHASE/RECEIPT/
PAYMENT/EXPENSE/CREDIT_NOTE/DEBIT_NOTE, and there is an `@@index([sourceType,
sourceId])`. The wiring was simply never built.

## Approach — synchronous, HARD-ATOMIC, idempotent, in-transaction posting

**Decision (M1 resolved): post synchronously inside the same `$transaction` as
each mutation, HARD-ATOMIC.** A posting failure throws and rolls back the entire
mutation (invoice + line items + stock + outstanding + the JE) as one unit.
There is **no "save the invoice, log the gap, recover later" mode** — that was
self-contradictory with atomicity (the critic's M1) and is removed. Rationale:

- Atomic — the JE and the source row commit or roll back together; no drift
  window where reports lag reality, and no class of "saved but unposted" rows.
- Mirrors the existing `closeFY` pattern (posts within `$transaction`) and the
  document `create.ts` tx (`create.ts:103-235` wraps invoice+lines+stock+
  outstanding+commission in one `prisma.$transaction`).
- Posting **cannot** fail for a correctly-seeded business: the only failure
  modes are (a) a missing system account — eliminated by a pre-flight
  `assertSystemAccounts(tx, businessId)` that the resolver runs once per post,
  surfacing a loud config error in dev/seed, never in steady state; (b) an
  unbalanced map — caught by unit tests, never reaches prod.

The historical `backfill-gl.ts` script is for **pre-feature records only** (the
journal is empty today). It is NOT a runtime failure-recovery path.

Rejected: async GL projection job. Introduces an eventual-consistency window on
money reports and a second source of truth for "is this posted yet" — worse for
a billing app. Offline double-post is already prevented upstream by
`Document.offlineId @unique` + the idempotency middleware, so sync posting
inherits that guard (confirmed by critic).

## Idempotency & entry numbering (M2 + M3 resolved)

**Idempotency index (M3):** partial unique index on
`(businessId, sourceType, sourceId) WHERE sourceType IS NOT NULL AND status =
'POSTED'`. Including `status='POSTED'` is the key change — it means a VOIDed JE
no longer occupies the slot, which makes reverse-in-place work without an
sourceId discriminator.

**Reversal = VOID-in-place, never delete (M3):** on edit-of-posted or
delete/void of a source row, `reverse-entry.ts`:
1. sets the original JE `status: POSTED → VOID` (row preserved for audit), and
2. reverses its denormalised `LedgerAccount.balance` effects (decrement what it
   incremented), then
3. for an *edit*, posts a fresh `POSTED` JE for the new values — which no longer
   collides because the original is now VOID and excluded from the partial index.

This removes the open-Q5 sourceId-suffix hack entirely. CN/DN keep their own
row id as `sourceId` (distinct from the parent doc), so they never collided in
the first place.

**Entry number (M2):** `JournalEntry.entryNumber` is non-null with
`@@unique([businessId, entryNumber])` (`schema.prisma:2243,2270`). Every posted
JE allocates one via `entry-number.ts:allocateEntryNumber(tx, businessId)` —
same in-tx sequence pattern as `generateNextNumber` (`create.ts:106`), format
`JE-YYYYYY-NNNNN`. Runs inside the mutation tx so concurrent posts can't collide.

## Posting maps (paise, double-entry; resolve accounts by seeded code = SSOT)

All account resolution goes through `account-resolver.ts`, which looks up the
system account by its stable seeded `code` (same SSOT fix applied in N4). No
`subType`/name matching.

**M4 resolved (rev 2) — maps built from the REAL Document columns, verified
against `document-calc.ts:118-135`.** Ground truth confirmed by schema grep:
`grandTotal = subtotal + totalAdditionalCharges + totalTax + roundOff` and
**does NOT include `tdsAmount`/`tcsAmount`** (those are separate Document
columns). `totalTaxableValue` only sums GST-rated lines (zero under composition
scheme) and is therefore the WRONG revenue basis — **revenue is posted from
`subtotal`**, which is the sum of all line amounts regardless of GST. `totalTax
= totalCgst + totalSgst + totalIgst + totalCess`. COGS uses the
already-computed **`Document.totalCost`** (no per-line WAC recompute), falling
back to `Product.weightedAvgCostPaise × qty` only in the backfill when
`totalCost` is 0.

| Source | Debit lines | Credit lines |
|--------|-------------|--------------|
| SALE invoice | AR `1200` = grandTotal − tdsAmount + tcsAmount ; TDS Receivable `1250` = tdsAmount ; RoundOff `5400` = −roundOff if roundOff<0 | Sales Revenue `4000` = subtotal ; Tax Payable `2100` = totalTax ; Other Income `4100` = totalAdditionalCharges ; TCS Payable `2300` = tcsAmount ; RoundOff `5400` = roundOff if roundOff>0 |
| SALE — cost side (skip if totalCost=0) | COGS `5050` = totalCost | Inventory `1300` = totalCost |
| PURCHASE invoice | Inventory `1300` = subtotal + totalAdditionalCharges ; Tax `2100` (ITC) = totalTax ; RoundOff `5400` = −roundOff if <0 | AP `2000` = grandTotal − tdsAmount + tcsAmount ; TDS Payable `2200` = tdsAmount ; RoundOff `5400` = roundOff if >0 |
| RECEIPT (payment in) | Cash `1000` / Bank `1100` = amount | AR `1200` = amount |
| PAYMENT (payment out) | AP `2000` = amount | Cash `1000` / Bank `1100` = amount |
| EXPENSE (confirmed) | Direct/Indirect Expense `5100`/`5200` (default 5200) + Tax `2100` (ITC) | Cash/Bank `1000`/`1100` (paid) or AP `2000` (unpaid) |
| CREDIT NOTE | mirror of SALE, sides swapped (own row id as sourceId) | |
| DEBIT NOTE | mirror of PURCHASE, sides swapped | |

New seeded accounts this epic adds: COGS `5050`, TDS Receivable `1250`, TCS
Payable `2300`, RoundOff `5400`. The general identity that makes SALE balance:
Σdebit = (grandTotal−tds+tcs) + tds + max(−roundOff,0) = grandTotal + tcs +
max(−roundOff,0); Σcredit = subtotal + totalTax + charges + tcs +
max(roundOff,0); and since grandTotal = subtotal + charges + totalTax +
roundOff, both sides reduce to **subtotal + charges + totalTax + tcs +
|roundOff_split|** — balanced for any sign of roundOff and any tds/tcs.

**Worked example A — standard GST SALE** (subtotal ₹1,000 = 100000p, GST 18% =
18000p, additional charge 5000p, roundOff 0, no TDS/TCS): grandTotal = 100000 +
5000 + 18000 + 0 = 123000. Debit AR 123000 ; Credit Revenue 100000 + Tax 18000
+ Other Income 5000 = **123000 ✓**.

**Worked example B — composition scheme** (subtotal 100000p, GST 0, no charges,
roundOff 0): `totalTaxableValue=0` (the old bug), but Revenue posts from
subtotal. grandTotal = 100000. Debit AR 100000 ; Credit Revenue 100000 = **✓**.
(Posting from `taxableValue` would have credited 0 → unbalanced.)

**Worked example C — TDS on SALE** (subtotal 100000p, GST 0, TDS 2% = 2000p):
grandTotal = 100000 (TDS not in grandTotal). Debit AR 98000 + TDS Receivable
2000 = 100000 ; Credit Revenue 100000 = **✓**.

Edge handling: reverse-charge → ITC + liability both to Tax `2100`;
multi-currency → post in base currency; **zero-value components emit no line**.

**SHOULD_SHIP dispositions (rev 2):**
- **S1 (WAC):** use `Document.totalCost` directly (correct field; `avgCost` was
  a misname). Backfill falls back to `weightedAvgCostPaise×qty`. RESOLVED.
- **S2 (expense category→account):** `ExpenseCategory` has no ledger FK, so all
  expenses post to `5200 Indirect` by default, with a name-heuristic bump to
  `5100 Direct` for known direct categories. A proper `ExpenseCategory.ledgerAccountId`
  FK is **FUTURE_EPIC** (schema change out of this epic's scope) — does not block
  reports, just classifies all expense in one bucket initially.

**SHOULD_SHIP resolutions baked in:**
- **S1 (WAC source):** COGS posts `Document.totalCost` (already computed at
  invoice time), NOT a sale-side recompute. Backfill falls back to
  `Product.weightedAvgCostPaise × qty`. If totalCost is 0 the COGS line pair is
  **skipped + warned** (open-Q4), never fabricated.
- **S2 (expense category → account):** `post-expense.ts` maps Expense.category →
  `5100` Direct vs `5200` Indirect via a small table in `posting.maps.ts`;
  default `5200` when unmapped.
- **S4 (denormalised balance):** every post/reverse updates `LedgerAccount.balance`
  in the same tx (increment on post, decrement on void) so the stored balance
  and the line-sum stay consistent — this is the SAME field the FY-closure and
  reports read.

## New system accounts

Seed currently has Purchases `5000` but no COGS and no TDS-receivable / TCS /
round-off accounts. Add to `seedDefaultAccounts`:
- `5050 'Cost of Goods Sold' (EXPENSE)`
- `1250 'TDS Receivable' (ASSET)`
- `2300 'TCS Payable' (LIABILITY)`
- `5400 'Round Off' (EXPENSE)`

New businesses get them automatically (createMany + skipDuplicates is already
idempotent). Existing businesses are provisioned by `backfill-gl.ts`
(ensure-accounts step) before any line referencing them posts. `account-resolver`
runs `assertSystemAccounts` so a missing account is a loud config error, never a
silent skip.

## File Plan

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| prisma/migrations/.../migration.sql | create | ~12 | migration (partial unique index incl. status='POSTED', raw SQL — Prisma can't express partial unique) |
| accounting/chart-of-accounts.ts | edit | +6 | seed (add 5050 COGS, 1250 TDS-Recv, 2300 TCS, 5400 RoundOff) |
| accounting/posting/posting.types.ts | create | ~60 | types |
| accounting/posting/account-resolver.ts | create | ~90 | utils (resolve by code + assertSystemAccounts, cached per-txn) |
| accounting/posting/entry-number.ts | create | ~50 | utils (in-tx JE sequence allocator) |
| accounting/posting/posting.maps.ts | create | ~190 | pure (source → balanced lines, leg-by-leg decomposition) |
| accounting/posting/post-document.ts | create | ~150 | service (SALE/PURCHASE/CN/DN + COGS) |
| accounting/posting/post-payment.ts | create | ~90 | service |
| accounting/posting/post-expense.ts | create | ~80 | service |
| accounting/posting/reverse-entry.ts | create | ~70 | service (void/edit reversal) |
| accounting/posting/index.ts | create | ~40 | barrel + dispatch |
| accounting/posting/__tests__/posting.test.ts | create | ~220 | tests |
| document/create.ts | edit | +8 | hook postDocument on POST |
| document/update.ts | edit | +12 | reverse + repost on edit-of-posted |
| document/delete.ts | edit | +8 | reverse on delete/void |
| payment/create.ts | edit | +8 | hook postPayment |
| payment/update-delete.ts | edit | +10 | reverse on delete |
| expense/expense-confirm.service.ts | edit | +8 | hook postExpense on confirm |
| scripts/backfill-gl.ts | create | ~180 | one-shot historical backfill (idempotent, batched) |
| docs/HISAABPRO.md | edit | +5 | clear S1 caveats on #84–#87, #104 once shipped |

All files ≤250L. Posting service is the new code; hooks are ≤12-line additions
inside the existing mutation `$transaction` blocks.

## Migration sequence

1. **Add partial unique index** (raw SQL, plain `CREATE UNIQUE INDEX ... ON
   "JournalEntry" ("businessId","sourceType","sourceId") WHERE "sourceType" IS
   NOT NULL AND "status" = 'POSTED'`; CONCURRENTLY can't run in a migration txn
   and the table is small per-tenant). No existing duplicate rows because
   nothing posts yet → index builds clean.
2. **Add the 4 system accounts to seed** — new businesses only.
3. **Wire posting hooks** — HARD-ATOMIC inside each mutation's existing
   `$transaction`; a posting failure rolls the whole mutation back (M1). No
   degrade-to-warning path.
4. **Backfill** — run `backfill-gl.ts` per business: ensure the 4 accounts
   exist, then post all POSTED documents / completed payments / confirmed
   expenses in date order; the partial unique index makes re-runs no-ops.

## Security cuts

- Every posted JE carries the mutation's `businessId`; `account-resolver`
  filters by `businessId` — no cross-tenant account resolution.
- Posting runs inside the mutation's existing `$transaction` (already
  businessId-scoped + auth-gated upstream). No new routes, no new auth surface.
- Backfill script takes an explicit `--business <id>` or `--all` and logs a
  per-business summary; never deletes, only inserts idempotently.

## Open questions — RESOLVED after revision 1

1. **Posting failure policy (M1)** — RESOLVED: hard-atomic, roll back the whole
   mutation. No "save + log gap" mode. Failure modes eliminated by
   `assertSystemAccounts` (config) + balanced-map unit tests.
2. **Edit-of-posted-document (M3)** — RESOLVED: VOID original JE in place
   (preserve for audit, reverse its balance effect) + post fresh. No
   delta-adjust. Partial index on `status='POSTED'` makes this collision-free.
3. **Backfill scope** — RESOLVED: all-time POSTED records, batched (1k docs/tx),
   since the journal is empty today.
4. **COGS without WAC data** — RESOLVED: skip the cost line + warn; never
   fabricate a cost (uses stored `Product.avgCost`/batch WAC, not a recompute).
5. **Idempotency for CN/DN (M3)** — RESOLVED: CN/DN use their own row id as
   `sourceId`, distinct from the parent doc — no collision. Reversals are
   VOID-in-place, not new contra rows, so no sourceId suffix scheme needed.
