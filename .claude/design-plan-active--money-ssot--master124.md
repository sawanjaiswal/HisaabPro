---
status: approved
feature: money-ssot-paise-int
created: 2026-05-27T07:50:00Z
session: master-1244
proposer: claude
revision: 2
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/referral/code.ts
  - server/src/services/referral/fraud.ts
  - server/src/services/referral/index.ts
  - server/src/services/referral/rewards.ts
  - server/src/services/referral/stats.ts
  - server/src/services/referral/withdrawal.ts
  - server/src/routes/referral.ts
  - server/src/schemas/referral.schemas.ts
  - server/src/services/payment/**
  - server/src/services/payments/**
  - server/src/routes/payments.ts
  - server/src/routes/payment*.ts
  - server/src/schemas/payment.schemas.ts
  - server/src/__tests__/**
  - server/src/types/money.ts
  - server/scripts/backfill-money-paise.ts
agents_invoked:
  - architecture-auditor (output: docs/EPIC_money-ssot/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-27T07:47:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 3 MUST_FIX (INT32 math wrong by 10x; NOT NULL DDL lock on User; @map rename collides with prisma migrate dev)
  - ts: 2026-05-27T07:52:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    findings: all MUST_FIX closed; SHOULD_FIX #4-#7 absorbed; no new blockers
acceptance:
  backend:
    - tsc clean
    - all unit + integration tests pass
    - new migration applies forward on shadow DB with `lock_timeout = '3s'` set
    - rollback SQL verified on shadow DB
    - backfill script idempotent (re-run yields 0 row updates)
    - backfill pre-flight overflow check rejects rows > INT32 for INT-typed targets
    - dual-write SQL verifier returns 0 rows for all 6 columns before PR3 ships
    - `prisma migrate status` reports clean on PR3 branch (no pending diff)
    - branded `Paise` type compiles — no plain-number Decimal source flows into a Paise field
    - no remaining `Decimal` money columns in schema; no `Number()` on referral/discount money fields
  frontend:
    - n/a (referral subsystem BE-only; PaymentDiscount.value already arrived as already-calc paise on existing FE flow — no FE consumer of the raw value field today)
approver: sawanjaiswal
approved_at: 2026-05-26T19:50:38.138Z

---

# Money-SSOT Paise-Int Migration — Plan

## 1. Scope

Convert every **money** column in `schema.prisma` from `Decimal`/`Float` to `Int` (paise). HP convention is paise Int on the wire; the only violations live in the referral subsystem and one Float-overloaded discount field.

**In scope (8 columns across 5 models):**

| # | Model.column | Current | Target | Semantic |
|---|---|---|---|---|
| 1 | `User.referralBalance` | Decimal(12,2) rupees | `Int` paise (BIGINT in DB) | wallet live balance |
| 2 | `User.referralBalanceInReview` | Decimal(12,2) rupees | `Int` paise | wallet pending |
| 3 | `User.referralTotalEarned` | Decimal(12,2) rupees | **`BigInt` paise** | wallet lifetime (can exceed INT32 ~Rs 2.14 Cr over years) |
| 4 | `ReferralCode.totalEarned` | Decimal(12,2) rupees | **`BigInt` paise** | code lifetime (same overflow risk) |
| 5 | `ReferralReward.amount` | Decimal(10,2) rupees | `Int` paise | one reward row (single event, bounded) |
| 6 | `ReferralWithdrawal.amount` | Decimal(10,2) rupees | `Int` paise | one withdrawal row (capped Rs 1L) |
| 7 | `PaymentDiscount.value` (FIXED) | Float (rupees) | `Int` paise → renamed `valuePaise` | absolute discount |
| 8 | `PaymentDiscount.value` (PERCENTAGE) | Float (percent) | `Int` bps → renamed `percentBps` | percent discount |

For #7+#8 the existing single overloaded column splits into two nullable columns + the existing `type` discriminator decides which is populated. `calculatedAmount` is already paise Int and stays.

**Out of scope (explicitly NOT money):**

- All `Float` quantity fields (`currentStock`, `quantity`, `factor`, `baseUnitFactor`, `balanceAfter`, `reorderQty`, `threshold`, `currentQty`, `systemQuantity`, `actualQuantity`, `discrepancy`, `quantityProduced`, `quantityConsumed`, `minStockLevel`) — kg/ltr/hours, HP convention, no money interpretation.
- `Decimal(12,3)` quantities at lines 3028, 3136 — same: kg/ltr/hours.
- Percentage Floats (`profitPercent`, `priceChangeThresholdPercent`, `discountThresholdPercent`) — percent semantics, not money. Could become Int bps in a future cleanup; not in this epic.

## 2. Migration strategy — add-column → backfill → drop

Single feature; safest per CLAUDE.md "ordering of add-column → backfill → make-NOT-NULL". Two migrations to keep each step atomic and reviewable.

### Migration A: `add_money_paise_columns` — NULL-first, lock-timeout protected

`User` is the most-FK'd table in the schema. `ALTER TABLE ... ADD COLUMN NOT NULL DEFAULT 0` takes `ACCESS EXCLUSIVE` and on a live API will queue behind any long-running tx, stalling all User reads for the duration. Pattern: add NULL → batched backfill → `SET DEFAULT` + `SET NOT NULL` in a separate fast statement, with a `lock_timeout` so a contended lock fails fast.

```sql
-- Fail fast on lock contention; do not stall the API.
SET lock_timeout = '3s';
SET statement_timeout = '10s';

-- User: NULL-first add. Wallet balances stay INT (capped per-user); lifetime is BIGINT.
ALTER TABLE "User"
  ADD COLUMN "referralBalancePaise"          INTEGER,
  ADD COLUMN "referralBalanceInReviewPaise" INTEGER,
  ADD COLUMN "referralTotalEarnedPaise"     BIGINT;

ALTER TABLE "ReferralCode"
  ADD COLUMN "totalEarnedPaise" BIGINT;

ALTER TABLE "ReferralReward"
  ADD COLUMN "amountPaise" INTEGER;

ALTER TABLE "ReferralWithdrawal"
  ADD COLUMN "amountPaise" INTEGER;

-- PaymentDiscount split — already nullable by design (discriminated by `type`).
ALTER TABLE "PaymentDiscount"
  ADD COLUMN "valuePaise"  INTEGER,
  ADD COLUMN "percentBps"  INTEGER;
```

After the backfill script runs and the verifier reports 0 drift, a separate migration `set_money_paise_not_null` runs:

```sql
SET lock_timeout = '3s';
-- Default + NOT NULL applied as separate fast statements; runs after backfill.
ALTER TABLE "User"
  ALTER COLUMN "referralBalancePaise"          SET DEFAULT 0,
  ALTER COLUMN "referralBalanceInReviewPaise" SET DEFAULT 0,
  ALTER COLUMN "referralTotalEarnedPaise"     SET DEFAULT 0;
ALTER TABLE "User"
  ALTER COLUMN "referralBalancePaise"          SET NOT NULL,
  ALTER COLUMN "referralBalanceInReviewPaise" SET NOT NULL,
  ALTER COLUMN "referralTotalEarnedPaise"     SET NOT NULL;
-- (repeat for ReferralCode, ReferralReward, ReferralWithdrawal)
```

The `SET NOT NULL` statement does a full table scan but does NOT block readers — only blocks writers briefly. For `User` we add `WHERE "referralBalancePaise" IS NULL` pre-scan in the backfill so the constraint check is fast.

### Backfill script (`scripts/backfill-money-paise.ts`)

```ts
// Pre-flight overflow check — abort before writing anything if any row would
// overflow the target type. Lifetime cols are BIGINT (no real-world overflow);
// INT cols asserted < 2_147_483_647.
const maxes = await prisma.$queryRaw<{ table: string; col: string; max_paise: bigint }[]>`
  SELECT 'User' as table, 'referralBalance' as col,
         COALESCE(MAX(ROUND("referralBalance" * 100)::bigint), 0) as max_paise FROM "User"
  UNION ALL SELECT 'User','referralBalanceInReview',
         COALESCE(MAX(ROUND("referralBalanceInReview" * 100)::bigint), 0) FROM "User"
  UNION ALL SELECT 'ReferralReward','amount',
         COALESCE(MAX(ROUND("amount" * 100)::bigint), 0) FROM "ReferralReward"
  UNION ALL SELECT 'ReferralWithdrawal','amount',
         COALESCE(MAX(ROUND("amount" * 100)::bigint), 0) FROM "ReferralWithdrawal"`
for (const m of maxes) {
  if (m.max_paise > 2_147_483_647n) throw new Error(`${m.table}.${m.col}: max ${m.max_paise} > INT32; promote to BIGINT before backfill`)
}

// Idempotent backfill: WHERE paise column is still NULL.
await prisma.$executeRaw`
  UPDATE "User"
  SET "referralBalancePaise"          = ROUND("referralBalance" * 100)::int,
      "referralBalanceInReviewPaise" = ROUND("referralBalanceInReview" * 100)::int,
      "referralTotalEarnedPaise"     = ROUND("referralTotalEarned" * 100)::bigint
  WHERE "referralBalancePaise" IS NULL`

// Repeat for ReferralCode, ReferralReward, ReferralWithdrawal.

// PaymentDiscount.value split (type discriminator decides target):
await prisma.$executeRaw`
  UPDATE "PaymentDiscount"
  SET "valuePaise" = CASE WHEN type = 'FIXED'       THEN ROUND("value" * 100)::int ELSE NULL END,
      "percentBps" = CASE WHEN type = 'PERCENTAGE' THEN ROUND("value" * 100)::int ELSE NULL END
  WHERE "valuePaise" IS NULL AND "percentBps" IS NULL`
```

The script logs a per-table diff: rows scanned vs rows updated vs sum-paise. Re-running on the same DB must update 0 rows (proves idempotency).

### Migration B: `drop_money_decimal_columns` — generated by `prisma migrate diff`, NOT handwritten

Handwriting Migration B (drop legacy + rename via `@map`) lets the next `prisma migrate dev` cycle see a schema-DB diff and emit its OWN destructive migration that undoes the `@map`. The migration MUST be authored by `prisma migrate diff` against the final post-PR3 schema, then committed.

Authoring sequence in PR3:

```bash
# 1. Edit schema.prisma to the final post-PR3 state (drop legacy fields; add @map).
# 2. Generate migration from current DB state → final schema:
npx prisma migrate diff \
  --from-url "$PROD_SHADOW_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script > prisma/migrations/$(date +%Y%m%d%H%M%S)_drop_money_decimal_columns/migration.sql
# 3. CI gate: `npx prisma migrate status` must report "clean" (no pending diff).
# 4. Commit migration + schema atomically.
```

Final post-PR3 schema surface:

```prisma
referralBalance         Int    @default(0) @map("referralBalancePaise")
referralBalanceInReview Int    @default(0) @map("referralBalanceInReviewPaise")
referralTotalEarned     BigInt @default(0) @map("referralTotalEarnedPaise")
// ReferralCode.totalEarned     BigInt @default(0) @map("totalEarnedPaise")
// ReferralReward.amount        Int    @map("amountPaise")
// ReferralWithdrawal.amount    Int    @map("amountPaise")
// PaymentDiscount.valuePaise   Int?   // separate field, no @map needed (DB name matches)
// PaymentDiscount.percentBps   Int?
```

`prisma migrate status` clean on the PR3 branch is an acceptance gate (in CI). PaymentDiscount keeps both columns visible (`valuePaise: Int?`, `percentBps: Int?`).

### Why two migrations

- Migration A is **strictly additive** — safe to deploy independently. Backfill can run on prod over hours/days without blocking traffic.
- Migration B is destructive but tiny. Gated on: backfill verifier reports 0 drift AND a full prod traffic cycle has gone through `valuePaise`-reading code.

## 3. Code changes

### 3a. Referral service (8 files, 831 LOC total today)

`server/src/services/referral/rewards.ts`:
```ts
// before
referralBalance:        { increment: Number(reward.amount) },
referralBalanceInReview: { decrement: Number(reward.amount) },
referralTotalEarned:    { increment: Number(reward.amount) },

// after — reward.amount is now Int paise; no Number() coercion
referralBalance:         { increment: reward.amountPaise },
referralBalanceInReview: { decrement: reward.amountPaise },
referralTotalEarned:     { increment: reward.amountPaise },
```

`stats.ts`:
```ts
// before: Number(user.referralBalance) — Decimal → number (loses precision over 53 bits, but more importantly inconsistent units)
// after: user.referralBalance is already Int paise; pass through unchanged
{
  balance: user.referralBalance,           // paise on the wire (matches HP convention)
  balanceInReview: user.referralBalanceInReview,
  totalEarned: user.referralTotalEarned,
}
```

`withdrawal.ts`:
- `amount` parameter on `requestWithdrawal()` MUST be paise Int (currently rupee number).
- The `$queryRaw` SELECT cast `as number` → keep, but the field is now Int.
- `< 1000` auto-approve threshold → must become `< 100000` (Rs 1000 = 100000 paise). Audit and document constant change.
- Insufficient-balance error message still displays rupees: use `formatRupees(amount)` helper to convert for the user-facing string only.

`schemas/referral.schemas.ts`:
- Withdrawal Zod schema: `amount: z.number().int().positive().max(1_00_00_000)` (Rs 1L cap in paise).

### 3b. PaymentDiscount service & schemas

`server/src/schemas/payment.schemas.ts` (the discount payload):
- Replace `value: z.number()` with discriminated union:
```ts
z.discriminatedUnion('type', [
  z.object({ type: z.literal('FIXED'),      valuePaise:  z.number().int().nonnegative() }),
  z.object({ type: z.literal('PERCENTAGE'), percentBps: z.number().int().min(0).max(10000) }),
])
```
- Payment service: where discount.value is currently read, switch on `discount.type` and read `valuePaise` or `percentBps`. `calculatedAmount` (already paise Int) remains the authoritative number used for ledger writes.

### 3c. Tests

- Unit tests: every `Number(...)` on a money field must go.
- Integration tests: add `referral-money-paise.contract.test.ts` exercising full reward → balance → withdraw flow at paise granularity (verifies the `100` ↔ `1` rupee-paise distinction never leaks).
- PaymentDiscount tests: one row per `type` variant, asserting `calculatedAmount` is consistent with paise input.

## 4. Rollout

1. PR1: Migration A + add `Paise`/`valuePaise`/`percentBps` Prisma fields (legacy fields kept) + dual-write in services (write both columns; read legacy column). tsc + unit + integration green. Merge.
2. Deploy PR1 to staging. Run backfill on staging clone of prod DB. Manually inspect drift (sum-rupees * 100 == sum-paise per table).
3. Deploy PR1 to prod. Run backfill on prod (one-shot, idempotent). Confirm 0 drift.
4. PR2: Flip services to read FROM paise columns (writes still dual). Soak 24h.
5. PR3: Migration B (drop legacy columns) + remove dual-write + `@map`-rename in schema. Merge + deploy.

If anything is wrong at step 2 or 4: legacy column still authoritative, paise is shadow. Revert is one PR.

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Backfill rounds wrong on Decimal(12,2) → Int paise | `ROUND(x * 100)::int` — Decimal(12,2) has exactly 2 frac digits → `* 100` is exact in postgres NUMERIC arithmetic. |
| Sum-balance > INT32 paise overflow | INTEGER max is `2,147,483,647` paise = **~Rs 2.14 Cr** (corrected from prior typo). Per-row caps: `ReferralReward.amount` (single event, in low thousands ₹) and `ReferralWithdrawal.amount` (capped Rs 1L = 1 cr paise) are safe in INT. Lifetime cols (`User.referralTotalEarned`, `ReferralCode.totalEarned`) use **BIGINT** — Priya-persona wholesalers (Rs 5-25L/mo) can plausibly cross Rs 2 Cr lifetime in 3-5 years. Backfill pre-flight aborts if MAX would overflow INT for the wallet-balance column. |
| Dual-write window has a service that forgets to write paise → permanent skew | (a) Service refactor PR is small; covered by integration test. (b) **SQL verifier** as PR2 acceptance gate: `SELECT id FROM "User" WHERE "referralBalancePaise" <> ROUND("referralBalance" * 100)::int LIMIT 10` — must return 0 rows. Same pattern for all 6 dual-write columns. Run on staging clone + prod before PR3 ships. |
| `Number()` coercion sneaks back in (`+x`, `x*1`, `parseFloat`, implicit toString) — grep can't catch all forms | **Branded type**: `export type Paise = number & { readonly __brand: 'paise' }` in `server/src/types/money.ts`. Service signatures take `Paise`; route Zod schemas mint it via `.brand<'paise'>()`. TypeScript then refuses to assign a plain `number` from any Decimal/Float source — compiler-enforced gate, no grep needed. |
| Rupee-literal constants still in code → silent underflow | Acceptance check: `rg -n '\b(100\|500\|1000\|10000)\b' server/src/services/referral/ server/src/services/payment*/` reviewed line-by-line in PR1 description. Known site: `withdrawal.ts` auto-approve cap `< 1000` → `< 100000`. Audit `fraud.ts` thresholds too. |
| FE depends on rupee-shape money | Audit confirms 0 FE consumers of referral stats today; PaymentDiscount.value is not read by FE today (FE reads calculatedAmount). No FE work needed. Re-grep on the PR1 branch to re-confirm. |
| Prisma `migrate dev` drift between PR1 dual-write and PR3 schema | PR3 migration generated via `prisma migrate diff`, not handwritten. CI gate: `prisma migrate status` clean on the PR3 branch. |
| GIN indexes accidentally added on `@@index` | None of the changed columns are text → no risk. |

## 6. File Plan

| Path | Action | Est lines | Layer |
|---|---|---|---|
| server/prisma/schema.prisma | modify (4 model edits) | ~25 changed | schema |
| server/prisma/migrations/202605xx_add_money_paise_columns/migration.sql | create (PR1) | ~30 | migration |
| server/prisma/migrations/202605xx_set_money_paise_not_null/migration.sql | create (PR2) | ~25 | migration |
| server/prisma/migrations/202605xx_drop_money_decimal_columns/migration.sql | create (PR3, `prisma migrate diff`-generated) | ~20 | migration |
| server/src/types/money.ts | create (branded `Paise` type) | ~20 | types |
| server/scripts/backfill-money-paise.ts | create (idempotent + overflow pre-flight) | ~180 | one-off |
| server/src/services/referral/rewards.ts | modify | ~10 changed | service |
| server/src/services/referral/stats.ts | modify | ~10 changed | service |
| server/src/services/referral/withdrawal.ts | modify | ~30 changed | service |
| server/src/services/referral/code.ts | modify | ~5 changed | service |
| server/src/services/referral/fraud.ts | modify | ~5 changed | service |
| server/src/services/referral/index.ts | modify | ~5 changed | service |
| server/src/routes/referral.ts | modify | ~10 changed | route |
| server/src/schemas/referral.schemas.ts | modify | ~10 changed | zod |
| server/src/schemas/payment.schemas.ts | modify (discriminated union) | ~30 changed | zod |
| server/src/services/payment/*.ts | modify (discount value reads) | ~30 changed | service |
| server/src/__tests__/integration/referral-money-paise.contract.test.ts | create | ~200 | test |
| server/src/__tests__/integration/payment-discount-paise.contract.test.ts | create | ~150 | test |

All ≤ 250 lines per file.

## 7. Open questions for reviewer

1. Acceptable to ship as 3 PRs (additive → flip-read → drop) vs 1 big PR? Plan assumes 3-PR rollout for safety.
2. Is there appetite to also convert `profitPercent` + `*ThresholdPercent` Floats to Int bps in a follow-up? (Out of scope here but logical sibling cleanup.)
3. `ReferralReward.amount` constant `REWARD_AMOUNT` in rewards.ts — needs to be redeclared in paise (currently rupees). Confirm new value.
