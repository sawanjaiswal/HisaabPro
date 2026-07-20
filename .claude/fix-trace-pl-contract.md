---
symptom: /reports/profit-loss throws "Cannot read properties of undefined (reading 'amount')" and renders the error boundary
root_cause_file: src/features/reports/finance.types.ts:11
root_cause_reason: The frontend ProfitLossData interface describes a payload shape the server has never returned — the page reads data.revenue/costOfGoods/otherIncome, but /api/reports/financial/profit-loss returns income/expenses/grossProfit/netProfit.
---

## 5-whys

1. **Why does the page crash?** `SectionCard` dereferences `section.amount` on `data.revenue`, which is `undefined`.
2. **But why is `data.revenue` undefined?** The API response has no `revenue` key — it returns
   `{ period, income: { sales, otherIncome, totalIncome, breakdown }, expenses: { purchases, directExpenses, indirectExpenses, totalExpenses, breakdown }, grossProfit, netProfit }`.
3. **But why did the page read a key that isn't there?** `getProfitLoss()` is typed
   `Promise<ProfitLossData>`, and `ProfitLossData` declares `revenue: ProfitLossSection`. TypeScript
   confirmed the read was safe against a type that describes nothing real.
4. **But why does the type describe nothing real?** It was hand-written on the client from an imagined
   contract. `api<T>()` casts the JSON to `T` with no runtime validation, so nothing ever compared the
   declared shape to the served shape.
5. **But why did nobody notice?** The route sits behind `requireFeature('advancedReports')`. On a FREE
   local business the page short-circuits to the upgrade prompt and never reaches the render that
   crashes — the bug is invisible until the business is on PRO/BUSINESS.

Root cause is therefore a **client-declared contract with no link to the server**, hidden by a plan gate.

## Hypothesis

Rewriting `ProfitLossData` to mirror `getProfitAndLoss()`'s actual return value — and deriving the
page's rows from that shape — removes the crash at its source. No defensive `?.` chains: the fix is
that the type tells the truth, so the compiler is checking something real again.

## Failing test

Reproduced in the browser rather than a unit test (the crash needs the plan gate open):
grant the local business a BUSINESS subscription, load `/reports/profit-loss`, and the page throws
`TypeError: Cannot read properties of undefined (reading 'amount')` at `ProfitLossPage.tsx`.
After the change the same load renders the statement. Captured as `pl-before.png` / `pl-375.png`.

## Did I fix the symptom or the cause?

Cause. The symptom was one undefined deref; the cause was a fictional type. Every field the page now
reads exists in `profit-and-loss.ts`'s return statement, and the two are named identically so a future
server change surfaces as a type error instead of a runtime crash.

## Same class, elsewhere (not fixed here)

`BalanceSheetData` and `CashFlowData` in the same file are also hand-written. Cash Flow is mockup #69,
the next page in Wave 5 — its contract gets the same treatment there.
