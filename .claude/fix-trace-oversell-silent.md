---
symptom: A POS sale for 5 units of a product with 1 on hand goes through, the stock lands at -4, and nothing anywhere tells the cashier.
root_cause_file: server/src/services/stock/core.ts:85
root_cause_reason: adjustStock only acts on a negative resulting balance when the policy is HARD_BLOCK; under WARN_ONLY it writes the negative stock and returns no warning, so no caller has anything to report.
---

## 5-whys

1. A WARN_ONLY oversell produces an empty `warnings[]` on the POS sale. But why?
2. `claimInventory` only appends warnings from the batch/FEFO path; the plain
   stock path calls `adjustStock` and ignores its result. But why does it ignore it?
3. Because `adjustStock` returns `{ movement, previousStock, newStock }` — nothing
   that says "this went negative and I allowed it". A caller would have to
   re-derive the judgement from `newStock`. But why is the judgement not there?
4. `adjustStock` resolves the validation mode and compares `newStock < 0` in one
   place (step 2), then uses that comparison for exactly one outcome: throwing
   under HARD_BLOCK. WARN_ONLY falls through the same branch with no else. The
   "warn" half of WARN_ONLY was never implemented. But why did that survive?
5. Because the policy name carries the promise and nothing checks it: the POS
   DTO even documents `warnings: string[] // non-fatal warnings (e.g. WARN_ONLY
   oversell)`, and the invoice stock path advertises the same array. Both are
   wired end-to-end and simply never receive an oversell entry — and the POS
   client drops `warnings` entirely, so even the batch-expiry warnings that DO
   get produced were never shown to anyone.

## Hypothesis

Emit the warning where the negative balance is decided — inside `adjustStock`,
the single place that resolves the policy and computes `newStock` — and return
it. Every caller that already collects warnings then just appends it, and there
is one phrasing of "you sold what you do not have" rather than one per feature.
Then make the POS checkout show `sale.warnings` to the cashier, which is the
only reason to produce them: a warning nobody reads is the same silence.

## Failing test

e2e/gold/pos.spec.ts — TC-POS-08 (WARN_ONLY leg: the sale succeeds, stock goes
to -4, and `warnings` is currently `[]`).
