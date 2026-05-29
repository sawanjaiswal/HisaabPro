verdict: PASS

# Architecture Critique (re-audit, revision 3) — SSOT stored-vs-derived (LedgerAccount.balance)

Re-audited 2026-05-29 13:33. Grounded in the real code, not the plan's prose:
`server/src/services/fy-closure/close.ts` (lines 80-204),
`server/src/services/accounting/helpers.ts` (`balanceDelta`, line 24-29),
`server/src/services/fy-closure/reopen.ts`,
`server/src/services/fy-closure/__tests__/close.test.ts`.

This is the third pass. Revisions 1 and 2 both returned REVISE. Revision 2 left
exactly ONE open MUST_FIX (#1 — contra-income / expense-refund accounts stranded
non-flat after deleting the set-0 updateMany). Revision 3 closed it via option
(b). I re-traced the arithmetic against the **real** `balanceDelta`
implementation for all four sign cases and verified journal-entry balance and
the reopen mirror. The hole is genuinely closed. No new MUST_FIX was introduced.
**Verdict: PASS.**

## Arithmetic verification (the load-bearing check)

`balanceDelta` (helpers.ts:24-29) real convention:
- `DEBIT_NORMAL_TYPES = {ASSET, EXPENSE}` → returns `debit − credit`
- everything else (INCOME, EQUITY, LIABILITY) → returns `credit − debit`

The plan's assumed conventions (INCOME: `credit − debit`; EXPENSE: `debit −
credit`) **match the real helper exactly.** No sign mismatch → not a BLOCK.

Pre-close stored balance = accumulated balanceDelta over FY lines: INCOME
balance = `netIncome = totalCredit − totalDebit`; EXPENSE balance = `netExpense
= totalDebit − totalCredit`. Closing line drives each to 0:

| Case | pre-close bal | closing line (plan) | balanceDelta of line | post |
|------|---------------|---------------------|----------------------|------|
| INCOME net-credit (netIncome>0) | +netIncome | debit=netIncome, credit=0 | credit−debit = −netIncome | **0** |
| INCOME net-debit (contra/return, netIncome<0) | netIncome (neg) | credit=abs(netIncome), debit=0 | credit−debit = +abs(netIncome) = −netIncome | **0** |
| EXPENSE net-debit (netExpense>0) | +netExpense | credit=netExpense, debit=0 | debit−credit = −netExpense | **0** |
| EXPENSE net-credit (refund, netExpense<0) | netExpense (neg) | debit=abs(netExpense), credit=0 | debit−credit = +abs(netExpense) = −netExpense | **0** |

All four zero exactly. The class of accounts that broke revision 2 (the bottom
two rows) now zeroes derivably through the single writer. ✓

## Journal-entry balance after expansion (net-profit AND net-loss)

netProfit = totalIncomeNet − totalExpenseNet (close.ts:97), where
totalIncomeNet=Σ(netIncome), totalExpenseNet=Σ(netExpense) (close.ts:89-95).
Summing the per-account closing-line (debit − credit) contributions across all
four cases collapses to `Σ(netIncome) − Σ(netExpense) = netProfit`. The RE
transfer line (close.ts:150-166) contributes exactly `−netProfit` to (debit −
credit) in both branches (credit=netProfit when >0, debit=abs when <0). Total
entry debit − credit = netProfit − netProfit = **0**. Holds for net-loss
identically. Expanding the aggregate into per-account reversals does NOT
unbalance the entry. ✓

## Deleting the set-0 updateMany (close.ts:191-196) is now safe

Every account in accountMap is INCOME or EXPENSE (enforced by the findMany type
filter, close.ts:50-51) and now receives a closing line whenever netX≠0; when
netX==0 the account is already at 0 (its balanceDelta sum is 0), so the absent
line is correct, not a miss. The old set-0 was a no-op for those and a forced-0
for the rest — both now achieved derivably. Set-0 is genuinely redundant. ✓

## Reopen mirror still correct — but coupled to MUST_FIX #2

Option (b) changed the SHAPE of contra-account closing lines. The **current**
reopen.ts (lines 40-58) uses ad-hoc branches that read only the normal-direction
leg: INCOME `increment line.debit` (reopen.ts:44), EXPENSE `increment
line.credit` (reopen.ts:50). Against the new contra shapes those increment **0**
and would FAIL to restore contra-income (case 2) and expense-refund (case 4)
accounts on reopen. The plan correctly addresses this: MUST_FIX #2 deletes the
ad-hoc branches and applies `−balanceDelta(type, debit, credit)` per line, which
reverses all four shapes (close delta was +abs → reopen −abs → restores the
negative pre-close balance). So #1's correctness is *contingent on #2 shipping
as specified* — the two are coupled and the plan ties them together. Confirmed
closed in the plan. The only residual is a test-coverage gap (see SHOULD_FIX-1).

## Previously-closed MUST_FIX — re-confirmed not regressed

- **#2 reopen ad-hoc branches** — still slated for deletion → generic
  `−balanceDelta`; revision 3 did not touch reopen.ts, claim intact. CLOSED.
- **#3 chart-of-accounts genesis allowlist** — enforce.js writer-allowlist
  (`ledger-deltas.ts` + `chart-of-accounts.ts` genesis `balance:0` only)
  unchanged by revision 3. CLOSED.
- **#4 serializable reconcile** — `$transaction(fn,{isolationLevel:
  'Serializable'})` snapshot-consistent compare+repair, unchanged. CLOSED.

## Findings

### MUST_FIX
_(none — all four prior MUST_FIX closed; revision-3 change verified arithmetically sound)_

### SHOULD_FIX
| # | Finding | Location | Why |
|---|---------|----------|-----|
| SHOULD_FIX-1 | The wrong-sign + net-loss closure regression test (plan lines 147-154) must ALSO assert correctness through a full close→reopen cycle on the contra accounts, not just post-close flatness. #1 and #2 are coupled (contra closing-line shape ↔ generic reopen); an end-of-close-only assertion would pass even if reopen left contra accounts unrestored. The per-step `reconcile-balances.test.ts` (plan lines 142-146) should include a reopen-after-contra-close step asserting `stored==derived` AND each contra account restored to its pre-close balance. | `reconcile-balances.test.ts` / `ledger-deltas.test.ts` (to be created) | Guards the #1↔#2 coupling against a future reopen edit silently dropping contra legs. |
| SHOULD_FIX-2 | accountMap aggregates lines date-windowed to `[from,to]` (close.ts:48) but stored `balance` reflects ALL-time posted lines. The deleted set-0 previously force-zeroed regardless of window; per-account closing lines only zero the in-window net. If an INCOME/EXPENSE account carries posted lines from a prior UNCLOSED FY, it won't reach 0 after this close. Sequential FY closure (prior years closed first) makes this safe in practice, and the reconcile `stored==derived` invariant still holds (derived is also line-based) — but "account flat after close" now depends on the no-out-of-window-residue assumption the set-0 used to mask. | close.ts:48-63, 123-147 | Document the sequential-close assumption; the closure validator could assert no posted income/expense lines exist outside the closing window for the target accounts. |

### FUTURE_EPIC
| # | Finding |
|---|---------|
| FUTURE-1 | `Product.currentStock` reconciler — Float, needs tolerance-based comparison, materially different design. Already deferred in the plan (auditor-confirmed). |
| FUTURE-2 | Scheduled reconcile cron calling `POST /api/accounting/reconcile-balances` — plan defers to FUTURE; no cron this slice. |

## Bottom line

The revision-3 change is mathematically correct for all four sign cases against
the real `balanceDelta`, keeps the closing journal entry balanced for both
net-profit and net-loss, and makes the set-0 deletion safe. The reopen mirror is
correctly coupled and addressed by MUST_FIX #2. The two SHOULD_FIX items are
test-coverage and a documented-assumption hardening — neither blocks. PASS.
