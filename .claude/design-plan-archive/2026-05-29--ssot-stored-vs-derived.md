---
status: approved
feature: ssot-stored-vs-derived
created: 2026-05-29T08:01:52Z
session: bare-131903
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/accounting/posting/ledger-deltas.ts
  - server/src/services/accounting/posting/index.ts
  - server/src/services/accounting/journal-entries.ts
  - server/src/services/accounting/posting/reverse-entry.ts
  - server/src/services/fy-closure/close.ts
  - server/src/services/fy-closure/reopen.ts
  - server/src/services/accounting/reconcile-balances.ts
  - server/src/routes/accounting.ts
  - server/src/services/accounting/__tests__/reconcile-balances.test.ts
  - server/src/services/accounting/__tests__/ledger-deltas.test.ts
  - scripts/enforce.js
agents_invoked:
  - architecture-auditor (output: docs/EPIC_ssot-stored-vs-derived/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-29T07:51:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 4 MUST_FIX (fy-closure set-not-increment, reopen 3rd sign convention, chart-of-accounts uncounted writer, reconcile read race) + 3 SHOULD_FIX (route path, permission string, end-only test assertion)
  - ts: 2026-05-29T07:58:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 2
    findings: 1 MUST_FIX still open (#1 — close.ts only emits closing lines for net-positive income/expense; contra-income net-debit & expense-refund net-credit accounts get no line, so deleting set-0 strands them non-flat). #2,#3,#4 + all SHOULD_FIX confirmed CLOSED.
  - ts: 2026-05-29T08:01:52Z
    critic: claude
    verdict: REVISE-APPLIED
    revision: 3
    findings: "MUST_FIX #1 closed via option (b): close.ts emits a per-account closing line for EVERY non-zero income/expense account regardless of sign (contra-income net-debit → credit line; expense-refund net-credit → debit line); set-0 now genuinely redundant. Added wrong-sign + net-loss closure test. Awaiting re-audit."
  - ts: 2026-05-29T08:03:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 3
    findings: "0 MUST_FIX. Re-traced arithmetic against real balanceDelta (helpers.ts:24-29) — all 4 sign cases zero the account; journal stays balanced (per-account lines net to netProfit, RE line cancels); set-0 deletion safe (every accountMap entry is INCOME/EXPENSE and gets a line when netX≠0). #2/#3/#4 not regressed. 2 non-blocking SHOULD_FIX folded into plan (close→reopen cycle test on contra accounts; windowed-vs-all-time-balance note)."
acceptance:
  backend:
    - tsc clean
    - reconcile drift-detector test: stored balance == SUM(JournalLine) after a post→reverse→fy-close sequence
    - curl 200 reconcile (authed), 401 (no token), 403 (non-owner / wrong business)
    - all existing accounting + fy-closure tests still green
  frontend:
    - none (backend-only epic; reconcile is an admin/maintenance endpoint, no UI this slice)
approver: sawanjaiswal
approved_at: 2026-05-29T08:44:53.917Z

---

# SSOT: stored-vs-derived reconciliation — Plan

## Problem (from 2026-05-29 feature audit, SSOT section)

Two denormalised values are persisted *and* independently derivable, so two
writers can silently diverge:

1. **`LedgerAccount.balance`** (`Int`, paise, schema:2216) — "running balance,
   updated on each journal entry post." Derivable from
   `SUM(JournalLine.debit − JournalLine.credit)` for the account. **Multiple
   uncoordinated writers today:**
   - `services/accounting/posting/index.ts:72` — `{ balance: { increment: delta } }`
   - `services/accounting/journal-entries.ts:106,164` — increment / −increment
   - `services/accounting/posting/reverse-entry.ts:32` — −increment
   - `services/fy-closure/close.ts:195,202` — set 0, increment netProfit
   - `services/fy-closure/reopen.ts:44,50,57` — increment/decrement
   Each computes `delta` itself. A bug in any one (sign, rounding, missed leg)
   diverges `balance` from the journal-line truth with no detector.

2. **`Product.currentStock`** (`Float`, schema:793) — derivable from
   `SUM(StockMovement.quantity)`. Written by stock/batch/BOM paths. Audit rated
   this "atomic/acceptable" (single-row increments inside txns). **Lower tier.**

## Decision: SSOT = the line tables; balance/stock = *verified* denormalised cache

We do **NOT** drop the columns. `LedgerAccount.balance` is read on every report
(`accounting/reports.ts`, trial balance, balance sheet, fy-closure). Deriving on
read would turn O(1) reads into O(lines) aggregates across the hottest reporting
paths. Instead:

- **Single writer, ONE delta convention (REV1 — was the core hole).**
  Introduce `postLedgerDeltas(tx, lines)` in `posting/ledger-deltas.ts` — the
  ONLY function permitted to mutate `LedgerAccount.balance`. It takes journal
  lines `{ accountId, accountType, debit, credit }[]` and applies
  `balanceDelta(accountType, debit, credit)` (the existing canonical helper at
  `accounting/helpers.ts:24`) as a signed `{ balance: { increment } }` per line.
  **Delta-only — no set-mode.** Every writer below is rewritten to feed its
  journal lines through this one helper using the canonical convention:
  - `posting/index.ts:72` — already delta-based; route through helper.
  - `journal-entries.ts:104,162` — route through helper.
  - `posting/reverse-entry.ts:30` — route through helper.
  - **`fy-closure/close.ts:123-147,193-196` (MUST_FIX #1 — REV2):** Two coupled
    changes, because the existing closing entry does NOT zero every account:
    1. **Emit a closing line for EVERY income/expense account with a non-zero
       balance, regardless of sign** (was: `if netIncome > 0` / `if netExpense > 0`
       only — close.ts:126,137). An INCOME account carrying a net *debit*
       (sales-returns / contra-income) or an EXPENSE account carrying a net
       *credit* (expense refund) currently gets NO closing line, so deleting the
       blanket set-0 would strand it non-flat. New per-account rule:
       - INCOME, `netIncome = credit − debit ≠ 0`: line `debit=netIncome, credit=0`
         when `>0`, else `credit=abs(netIncome), debit=0`. Either way
         `balanceDelta(INCOME,…)=credit−debit=−netIncome` → account → 0.
       - EXPENSE, `netExpense = debit − credit ≠ 0`: line `credit=netExpense, debit=0`
         when `>0`, else `debit=abs(netExpense), credit=0`. `balanceDelta(EXPENSE,…)
         =debit−credit=−netExpense` → account → 0.
       - `netX == 0`: no line (already flat; emitting a zero line is noise).
       The RE transfer line (close.ts:150-166) is unchanged — it already balances
       the entry to `netProfit` (debits=credits), and expanding the aggregate into
       exact per-account reversals doesn't change the totals.
    2. **DELETE the `updateMany { balance: 0 }` set (close.ts:193-196).** With (1),
       every income/expense account now has a closing line that drives it to 0
       through `balanceDelta` via the single writer — so set-0 is genuinely
       redundant, not a silent third semantics. The RE `increment netProfit`
       (close.ts:200-202) is likewise just the RE closing line flowing through the
       helper — no separate write. Result: balances stay a pure function of POSTED
       journal lines (SSOT holds) AND every income/expense account is flat after
       close (closing semantics preserved — no regression for contra accounts).
  - **`fy-closure/reopen.ts:42-58` (MUST_FIX #2):** DELETE the per-type
    `if INCOME/EXPENSE/EQUITY` ad-hoc branches. Reopen reverses the closing
    entry, so apply `−balanceDelta(type, debit, credit)` for each closing line
    through the same helper. Kills the third independent sign convention.
- **Genesis write is not a divergence writer (MUST_FIX #3).**
  `chart-of-accounts.ts:51,87` set `balance: 0` at account *creation*. With zero
  journal lines the derived sum is also 0, so stored==derived holds by identity —
  this is the genesis value, not a mutation, and stays. To stop a *sixth* runtime
  writer from reappearing, add an **enforce.js check** (`scripts/enforce.js`)
  that greps for `ledgerAccount` `balance:` writes (`update`/`updateMany`/
  `increment`/`decrement`/`upsert`) and allowlists exactly two files:
  `posting/ledger-deltas.ts` (the writer) and `chart-of-accounts.ts` (genesis
  `balance: 0` only). Any new writer fails the build.
- **Reconciler / drift detector — snapshot-consistent (MUST_FIX #4).**
  `reconcile-balances.ts` exposes `computeDerivedBalances(businessId, tx)`
  (SUM over POSTED `JournalLine` via `balanceDelta`) and
  `reconcileLedgerBalances(businessId, { repair })`. Compare AND repair run
  inside a single `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`:
  derived sum and stored balance are read in the same snapshot, and any repair
  write lands in that tx — so a concurrent `persistPosting` committing mid-run
  can't make `repair` clobber a correct balance with a stale value (the
  serializable tx aborts/retries instead). Journal lines are authoritative;
  balance is only ever repaired toward them, never the reverse.
- **Test-enforced invariant (SHOULD_FIX #3 + MUST_FIX #1 closure test).**
  `reconcile-balances.test.ts` asserts `stored == derived` for every account
  **after each step** — after a post, after a reverse, after fy-close, after
  reopen — not just at the end (an end-only assertion lets a wrong-close +
  wrong-reopen cancel out and pass). It also includes a freshly-created account
  to prove genesis consistency. **Plus a dedicated wrong-sign + net-loss closure
  case (MUST_FIX #1):** seed an INCOME account with a net *debit* (contra-income /
  sales-return) and an EXPENSE account with a net *credit* (refund) such that
  total expense > total income (net LOSS), run fy-close, and assert (a) BOTH
  contra accounts are driven to `balance == 0` (proves a closing line was emitted
  regardless of sign), (b) `stored == derived` for every account, and (c) RE moved
  by `netProfit` (negative). Existing `close.test.ts:31-32` is single-sided
  net-positive, so it misses exactly this path — this case is the regression guard.
  The wrong-sign case runs a full **close → reopen** cycle and asserts the contra
  accounts are restored to their pre-close balances (SHOULD_FIX, rev3 auditor):
  option (b) changes the *shape* of contra-account closing lines, so reopen must
  reverse them via the generic `−balanceDelta` from MUST_FIX #2 — the current
  ad-hoc `increment 0` branches in reopen.ts:44,50 would silently fail to restore
  contra legs. #1's correctness therefore depends on #2 shipping as specified;
  the cycle test pins both.

- **Windowed-aggregate vs all-time-balance (SHOULD_FIX, rev3 auditor).** The old
  blanket `set balance:0` masked an assumption: closing lines are computed from
  journal lines *within the FY date window* (close.ts:80-97), but `balance` is the
  account's all-time running total. They coincide only if no POSTED line for an
  income/expense account falls outside the FY being closed (the normal case — FY
  closure runs after the period, and prior FYs were themselves closed to 0). The
  per-account closing line zeroes the *windowed* net; if out-of-window POSTED lines
  exist on an income/expense account, the derived all-time balance would not be 0
  post-close. This is pre-existing behaviour (the set-0 hid it by force), not a
  regression — but the reconciler's per-step assertion will now surface it if it
  ever occurs, which is strictly better than silent masking. No code change needed
  this slice; documented so a future "partial-period close" feature accounts for it.

`currentStock`: **FUTURE_EPIC (auditor-confirmed).** It's `Float`, written by
atomic single-row increments inside txns, and the audit rates it acceptable.
A correct reconciler for it needs tolerance-based comparison (float summation),
not the strict-equality invariant used for integer paise — a materially
different design. Deferred to a follow-up; out of scope for this slice.

## Schema impact

Likely **none** (no column add/drop) under the cache+reconcile approach. The
schema.prisma + migrations globs are claimed defensively in case the auditor
requires a tracking column (e.g. `LedgerAccount.balanceReconciledAt DateTime?`)
to record last-reconcile time. If no schema field is needed, no migration is
written and the high-risk schema edit simply doesn't occur. If one IS needed:
add-column (nullable) → no backfill required (advisory timestamp) → done; no
NOT-NULL flip, so no multi-step migration risk.

## File plan

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/src/services/accounting/posting/ledger-deltas.ts | create | ~70 | service (single-writer) |
| server/src/services/accounting/reconcile-balances.ts | create | ~140 | service (derive + diff + repair) |
| server/src/routes/accounting.ts | modify | ~+30 | add reconcile endpoint (flat, existing file) |
| server/src/services/accounting/posting/index.ts | modify | ~−5/+5 | route deltas via helper |
| server/src/services/accounting/journal-entries.ts | modify | ~−8/+8 | route deltas via helper |
| server/src/services/accounting/posting/reverse-entry.ts | modify | ~−3/+3 | route deltas via helper |
| server/src/services/fy-closure/close.ts | modify | ~−8/+18 | per-account closing line (any sign) + delete set-0 + route via helper |
| server/src/services/fy-closure/reopen.ts | modify | ~−17/+8 | delete ad-hoc branches, route via helper |
| server/src/services/accounting/__tests__/ledger-deltas.test.ts | create | ~90 | test |
| server/src/services/accounting/__tests__/reconcile-balances.test.ts | create | ~140 | test (per-step + genesis) |
| scripts/enforce.js | modify | ~+25 | guard: balance-writer allowlist |
| server/prisma/schema.prisma | unlikely | ~+2 | schema (only if tracking col needed) |
| server/prisma/migrations/** | unlikely | — | migration (only if schema col added) |

All files ≤ 250 lines. NOTE: schema/migrations now **not expected to change** —
cache+reconcile + single-writer needs no new column. Claimed defensively only;
if the build touches neither, the high-risk schema edit simply never occurs.

## API contract (reconcile endpoint — owner-only maintenance)

Added to the existing flat `server/src/routes/accounting.ts` (no subdir — that
path does not exist in this repo).

`POST /api/accounting/reconcile-balances`
Middleware: `auth, requireOwner(), requireRecentPin('mutation')` (existing
primitives — `permission.ts:89`, `require-recent-pin.ts:77`). The recent-PIN
gate applies because `repair:true` mutates financial balances.
- body: `{ repair?: boolean }`
- 200: `{ checked: number, drifted: Array<{accountId, code, stored, derived, diff}>, repaired: number }`
- 401: no/invalid token
- 403: authed but not owner of the active business (requireOwner) / PIN stale
- Scoped to `req.user.businessId`; never crosses tenants.

## Migration sequence (only if a tracking column is approved)

1. `npx prisma migrate dev --name ledger_balance_reconciled_at` — add nullable
   `balanceReconciledAt DateTime?` to `LedgerAccount`.
2. No backfill (nullable advisory field). No NOT-NULL flip.
3. `migrate dev` blocked-path note: uses `prisma migrate dev`, never `db push`.

## Rollout

- Backend-only, additive. Existing writers keep working — they just delegate the
  mutation to `postLedgerDeltas`. No behaviour change to balances on the happy
  path; the win is one writer + a detector.
- Reconcile route is opt-in maintenance; no scheduled job this slice (a cron
  could call it later — FUTURE).

## Security cuts

- Reconcile must be `businessId`-scoped (owner-only) — it reads/repairs financial
  balances; cross-tenant exposure or unauthorised repair would be high-impact.
- `repair: true` is a financial mutation → owner permission, audit-logged.
- No new secrets, no auth/token-shape change → no `security` critic required by
  HIGH_RISK_PATHS (schema-only trigger → `architect`).

## Open questions — RESOLVED in revision 1 (architecture-auditor)

1. cache+reconcile vs drop-column → **cache+reconcile confirmed** (auditor: deriving
   on read would O(lines) the hottest report paths; `reports.ts:60-62` already
   reads `balance`). No column drop.
2. `currentStock` tier → **FUTURE_EPIC** (auditor-confirmed; needs tolerance-based
   float reconciler, different design). Deferred.
3. `balanceReconciledAt` tracking column → **skipped.** Reconcile returns its
   result without persisting a timestamp; no schema change, no migration.
4. `repair` permission → **`requireOwner()` + `requireRecentPin('mutation')`**
   (existing primitives), not an invented `owner/admin` string.

All four MUST_FIX from revision 1 are addressed above (single delta convention via
`balanceDelta`; fy-close set-0 deleted; reopen ad-hoc branches deleted; genesis
write allowlisted via enforce.js guard; serializable snapshot-consistent reconcile).

**Revision 2→3 (this revision):** auditor flagged that deleting fy-close set-0 was
unsafe while close.ts only emitted closing lines for net-positive income/expense —
contra-income (net-debit) and expense-refund (net-credit) accounts would be stranded
non-flat. Closed via option (b): close.ts now emits a per-account closing line for
EVERY non-zero income/expense account regardless of sign, so the journal lines drive
every such account to 0 through the single writer (set-0 genuinely redundant; SSOT
*and* closing semantics both hold). Added a wrong-sign + net-loss closure regression
test. Option (a) (a `set`-mode leg in `postLedgerDeltas`) was rejected: a set-0 not
backed by journal lines would itself violate stored==derived for contra accounts.
