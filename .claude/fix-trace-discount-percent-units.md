---
symptom: A 10% line discount saves as 0.1% — the stored invoice total is higher than the total the seller saw.
root_cause_file: src/features/invoices/invoice-form.utils.ts:112
root_cause_reason: The form holds percentage discounts as percent (10 = 10%) but the wire/DB holds basis points (1000 = 10%); nothing converted at the crossing, so the raw percent was posted.
---
## 5-whys
1. Why is the saved discount 100× too small? The server divided the posted value by 10,000.
2. Why does it divide by 10,000? `calculateLineDiscount` / `calculateChargeAmount` treat PERCENTAGE values as basis points (`PAISE_BASIS_POINTS`), the same units POS checkout and coupons write.
3. Why did the client post percent? The form field renders and computes on-screen totals from what the seller typed — percent is correct *in the form*.
4. Why was there no conversion? `normalizeFormPayload` passed line items and charges through untouched; the unit crossing was never modelled anywhere.
5. Why did it survive review? Both sides are plain numbers named `discountValue`, so the mismatch is invisible in types — a name match hiding a unit mismatch.

## Hypothesis
Give the crossing one owner. `invoice-discount-units.ts` exports `discountToWire` / `discountFromWire` derived from `PAISE_BASIS_POINTS` (never a literal 100), applied in `normalizeFormPayload` on the way out and in `EditInvoicePage` hydration on the way back — so a saved invoice re-opens showing the percent it was created with.

## Failing test
src/features/invoices/__tests__/invoice-discount-wire.test.ts (10% → 1000; AMOUNT paise untouched; 2% charge → 200, FIXED untouched)
