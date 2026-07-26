---
symptom: A ₹675 line with a ₹75 discount shows a ₹600 grand total on the create screen, but the server stores ₹675 — the bill under-collects by the discount.
root_cause_file: src/features/invoices/invoice-totals.utils.ts:1
root_cause_reason: `calculateSubtotal` already nets per-line discounts off, yet its result was fed to `calculateGrandTotal`, which subtracts the discount again from what it assumes is a gross subtotal.
---
## 5-whys
1. Why is the displayed total short by the discount? The discount is subtracted twice.
2. Why twice? `calculateGrandTotal(subtotal, totalDiscount, ...)` subtracts `totalDiscount` from its first argument.
3. Why is that wrong here? The `subtotal` passed in is already post-discount — `calculateSubtotal` sums line totals *after* each line's discount, matching the server's `subtotal` contract.
4. Why did the two disagree? `calculateGrandTotal` was written against a gross subtotal (the pre-discount sum) and the two helpers were composed without reconciling which figure each one expects.
5. Why did tests not catch it? The unit expectations were written from the same wrong composition, so they encoded the bug (210000 / 85000).

## Hypothesis
Reconstruct the gross figure at the call site (`subtotal + totalDiscount`) and hand that to `calculateGrandTotal`, keeping the server contract (`grandTotal = subtotal + charges + tax + roundOff`) as the invariant. The totals bar then shows the gross on the "Subtotal" row so the breakdown reconciles with the "- discount" line below it.

## Failing test
src/features/invoices/__tests__/invoice-totals.utils.test.ts ("does not subtract the line discounts twice"), plus corrected expectations in the same file and useInvoiceCalculations.test.ts
