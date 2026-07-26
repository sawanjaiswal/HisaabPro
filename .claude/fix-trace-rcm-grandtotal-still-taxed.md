---
symptom: Saving a reverse-charge invoice fails with "GL posting: unbalanced entry (debit 118000 ≠ credit 100000)"
root_cause_file: server/src/services/document/create-tax-prep.ts:163
root_cause_reason: RCM zeroes the document's tax heads AFTER the totals are computed, so grandTotal (and roundOff, totalProfit) still carry tax the supplier never collects.
---
## 5-whys
1. Why does the save fail? The GL entry is unbalanced — the debit exceeds the credits by exactly the GST.
2. Why is the debit higher? The receivable is posted at `grandTotal` (Rs 1,180) while the credits are revenue (Rs 1,000) + the tax heads (Rs 0).
3. Why are the tax heads zero but grandTotal not? `computeGstTotals` calls `applyRcmFlag`, which zeroes `totalCgst/Sgst/Igst/Cess/totalTax` on the already-computed result.
4. Why does that leave grandTotal wrong? `grandTotal = subtotal + charges + totalTax + roundOff` was computed inside `calculateDocumentTotals` before the zeroing, and nothing recomputes it.
5. Why was the zeroing done outside the calculator? `DocumentTotalsOpts.isReverseCharge` exists but was never read — the RCM rule lives in `tax-calc.applyRcmFlag`, which only knows about a tax summary and cannot see the money.

## Hypothesis
Under reverse charge the recipient pays the tax to the government, so the supplier's
bill is the taxable value alone. That is a totals rule, not a post-hoc adjustment:
it has to be applied before `preRound`, so grandTotal, roundOff and totalProfit are
all derived from the amount actually billed. `calculateDocumentTotals` already
declares `isReverseCharge` in its opts — reading it there puts the rule at the one
place both the create and update paths compute money, and `computeGstTotals` stops
patching the result afterwards. Line-level tax amounts stay populated (GSTR-1 needs
them; only the collection is zeroed).

## Failing test
server/src/services/__tests__/document-calc.test.ts (RCM cases)
