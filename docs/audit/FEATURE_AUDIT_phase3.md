phase: 3 Accounting (features 83-104)

> Adversarial code-vs-doc verification of the Phase 3 "Accounting & Finance"
> rows in the Feature Status Matrix (`docs/HISAABPRO.md` lines 991–1014).
> Audit only — no source code modified.

## Summary of verdicts

- VERIFIED: 17
- PARTIAL: 1 (#92)
- DRIFT: 4 (#90, #91, #100, #104)
- MISSING: 0

The accounting **engine** is genuinely implemented (double-entry validation,
DRAFT→POST→VOID state machine with balance reversal, 15 seeded system
accounts, trial balance, day book, P&L, balance sheet, cash flow, FY closure).
The systemic problem is **integration**, not implementation — see SSOT
violation S1: nothing in the app auto-posts real business transactions
(invoices, payments, sales, purchases) to the journal. The ledger is populated
ONLY by manual journal entries (`POST /accounting/journal-entries`) and the
FY-closure entry. Consequently P&L / Balance Sheet / Cash Flow / Trial Balance
/ Day Book all read a journal that ordinary use never fills, while
Profitability (#102) reads real `Document` rows. The endpoints exist and the
math is correct, but they report on an empty book in practice.

## Matrix

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 83 | Double-entry ledger / 15 system accounts | VERIFIED | `services/accounting/chart-of-accounts.ts:19-53`, `journal-entries.ts`, `helpers.ts`, schema `LedgerAccount`/`JournalEntry`/`JournalEntryLine` | 15 `isSystem` accounts seeded idempotently. `balanceDelta` correctly debit-normal for ASSET/EXPENSE, credit-normal otherwise. |
| 84 | P&L | VERIFIED | `services/reports/profit-and-loss.ts`, route `financial-reports.ts:32`, `ProfitLossPage` | INCOME credit-net − EXPENSE debit-net; gross/net split correct. Reads journal (see S1). Evidence column path is stale (says `financial-reports.service.ts`; real impl `reports/profit-and-loss.ts`) — barrel re-export so functionally fine. |
| 85 | Balance Sheet | VERIFIED | `services/reports/balance-sheet.ts`, route `:44` | Classifies asset/liability/equity, folds INCOME/EXPENSE into retained earnings, asserts A = L + E. |
| 86 | Cash Flow | VERIFIED | `services/reports/cash-flow.ts`, route `:55` | Indirect method; opening/closing CASH+BANK from `getBalancesAsOf`. |
| 87 | Accounting Day Book | VERIFIED | `services/accounting/reports.ts:156`, `DayBookPage` | Per-day POSTED entries with full lines + day totals. |
| 88 | Journal Entries DRAFT→POST→VOID | VERIFIED | `services/accounting/journal-entries.ts:34-179` | Debit=credit enforced on create; post applies deltas in `$transaction`; void reverses deltas; draft-void skips reversal. Real state machine. |
| 89 | Bank Reconciliation (claims "inside #147") | VERIFIED | `services/bank-reconciliation/` (match-engine, statement-parser, import.service, repository) + `routes/bank-reconciliation.routes.ts` | Claim holds — it really lives in the #147 bank-reconciliation service. Not DRIFT. |
| 90 | Receipt vouchers / voucher print | DRIFT | `routes/payments.ts` (all 13 endpoints inspected), FE `src/features/payments/` | Evidence claims "`routes/payments.ts` voucher endpoint" — NO endpoint, no PDF, no print path named voucher exists. Only matches are import parsers (Tally). |
| 91 | Payment vouchers / voucher print | DRIFT | same as #90 | Same missing voucher endpoint. |
| 92 | Cheque register | PARTIAL | `services/cheque.service.ts:48-90`, schema `Cheque`, `cheques` feature | State machine real, but doc claims `PENDING/CLEARED/BOUNCED/CANCELLED`; code's guard list uses `CLEARED/CANCELLED/RETURNED` (line 60) — "RETURNED" not "BOUNCED" in the terminal guard (BOUNCED handled at line 76). Status-name drift. |
| 93 | Multiple bank accounts | VERIFIED | schema `BankAccount`, `routes/bank.ts`, `bank-accounts` feature | Per-business banks present. |
| 94 | Cash-in-hand | VERIFIED | schema `CashEntry`/`CashEntryEvent`, `routes/cash-entries.route.ts`, `cash-register` feature | Models + event log + route present. |
| 95 | Cash book / Bank book | VERIFIED | `services/accounting/reports.ts:80` ledger report, `bank-accounts` UI | Per-account ledger with running balance. |
| 96 | Expense tracking / 10 categories | VERIFIED | `services/expense/*` (8 files), schema `Expense`/`ExpenseCategory`, `expenses` feature | Full expense module (budget, OCR, recurring, templates, trend). |
| 97 | Other income | VERIFIED | `services/other-income.service.ts` (163L), schema `OtherIncome`, `other-income` feature | Real CRUD. |
| 98 | Loans LOAN_GIVEN/TAKEN + EMI | VERIFIED | `services/loan.service.ts`, `loan/loan-select.ts`, `routes/loans.ts`, schema `LoanAccount`/`LoanTransaction` | Models + route present. |
| 99 | FY closure / carry to RE | VERIFIED | `services/fy-closure/close.ts:25-234` | Aggregates INCOME/EXPENSE POSTED lines, transfers net P&L to Retained Earnings via posted closing JE, resets balances, upserts `FinancialYearClosure`. See N4 — RE lookup bug. |
| 100 | Tally Export / XML | DRIFT | `services/reports/tally-export.ts` | Real XML exporter exists & works, but evidence claims `routes/export.ts` + `export.service tally branch`; actual impl is `reports/tally-export.ts` exposed via `financial-reports` route. Wrong file cited. |
| 101 | Aging reports / 4 buckets | VERIFIED | `services/reports/aging.ts`, `routes/collections/aging.route.ts`, `services/collections/aging.service.ts` | Implemented, but duplicated — see S2. |
| 102 | Profitability | VERIFIED | `services/reports/profitability.ts:27,79,135` | Groups by PARTY/PRODUCT/DOCUMENT. NB: reads `Document`/`DocumentLineItem` (real invoices), NOT the journal — so it works even though the journal is empty (highlights S1 inconsistency). |
| 103 | Discount reports | VERIFIED | `services/reports/discount.ts` | Per-doc + per-party discount report. Evidence cites `report.service.ts` discount endpoint; real impl is `reports/discount.ts` (path drift, function present). |
| 104 | COGS tracking / WAC | DRIFT | `services/accounting/helpers.ts` (full file read) | Evidence claims COGS lives in `accounting/helpers.ts` "cogs branch" — that file has only `DEBIT_NORMAL_TYPES`, `getFySuffix`, `balanceDelta`. No COGS/WAC anywhere in accounting. WAC actually lives in `inventory/reorder.service.ts:71` and `bom/production-run-execute.service.ts:130`. Wrong evidence; no COGS journal posting. |

## SSOT violations

- **S1 (severe) — ledger has two disconnected truth sources for "what happened".** Business transactions are recorded in `Document`/`DocumentLineItem`/`Payment` tables, but NOTHING auto-posts them to `JournalEntry`. The only journal creators are `services/accounting/journal-entries.ts` (manual API) and `services/fy-closure/close.ts:170`. Result: P&L/BS/CF/TrialBalance/DayBook (journal-sourced) diverge from Profitability/Aging (Document-sourced). `server/src/services/accounting/journal-entries.ts:56`, `server/src/services/reports/profitability.ts:27`.
- **S2 — account balance stored AND derived.** `LedgerAccount.balance` is mutated on post/void (`journal-entries.ts:104,162`) AND independently re-derived from journal lines in the trial balance (`reports.ts:45-49`) and ledger report (`reports.ts:117-119`). Two computations of the same number that can silently drift if any mutation path is missed. `server/src/services/accounting/reports.ts:45`, `server/src/services/accounting/journal-entries.ts:104`.
- **S3 — aging logic duplicated (#41 vs #101).** Two implementations: `server/src/services/reports/aging.ts:1` and `server/src/services/collections/aging.service.ts` + `collections/aging-query.ts`. Confirms the suspected #41/#101 duplication.
- **S4 — paise→rupee formatting duplicated.** `tallyAmount` re-implements paise formatting locally (`server/src/services/reports/tally-export.ts:28`) instead of the money SSOT.

## Non-standard code

- **N4 (bug) — FY-closure can't find the seeded Retained Earnings account.** `close.ts:100-108` looks up RE with `subType: 'CAPITAL'`, but the seed sets RE (code 3100) `subType: null` (`chart-of-accounts.ts:29`). The `findFirst` filter will not match the system RE account, so closeFY throws "Retained Earnings account not found" unless the user manually created a second CAPITAL-subtype RE account. `server/src/services/fy-closure/close.ts:104`.
- **N5 — #92 cheque terminal-status guard uses `RETURNED` while doc/UI expect `BOUNCED`.** `server/src/services/cheque.service.ts:60`.
- File-length / `as any` / `@ts-ignore` / raw `fetch` in Phase-3 backend services: none found (all audited service files ≤ 250L; largest is `reports/profitability.ts` at 187L).
