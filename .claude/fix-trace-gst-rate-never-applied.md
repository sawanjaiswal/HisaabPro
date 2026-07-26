---
symptom: Every GST invoice saves with zero tax — the screen shows the CGST/SGST summary, the stored and printed invoice has none.
root_cause_file: server/src/services/document/create-tax-prep.ts:129
root_cause_reason: The line's GST rate is read from the request body (`li.gstRate`), not from the tax category the line is tagged with; the invoice form never sends that field, and the tax category is loaded without its `rate` column at all.
---
## 5-whys
1. Why is `totalTax` zero on a line tagged GST 18%? `calculateLineTax` received `gstRate: undefined`.
2. Why undefined? `buildCalcItems` passes `li.gstRate` straight through from the request body.
3. Why is it not in the body? The invoice form posts `taxCategoryId` and computes its on-screen GST summary from the category's own `rate` (`useInvoiceGstSummary.ts:53`) — it never sends a rate, because the rate is not the client's to state.
4. Why did the server not fall back to the category? The create/update paths select only `{ id, cessRate, cessType }` from TaxCategory — `rate`, the column that *is* the rate, is never loaded.
5. Why did nothing catch it? The FE computes the summary from the category and the BE computes the total from the body; both are individually consistent, so no unit test on either side disagrees. Only a real save reveals that the two never met.

## Hypothesis
`TaxCategory.rate` is the SSOT for what a line is taxed at. Load it, and derive the line's rate from the category, falling back to a body-supplied `gstRate` only for a line with no category. Doing it inside `buildCalcItems` puts the derivation at the one crossing both paths share — and the update path, which had its own copy of the mapping (and no INCLUSIVE back-calculation), now calls the same function instead of duplicating it.

## Failing test
e2e/gold/gst-invoicing.spec.ts (TC-GST-02 — an intra-state 18% sale must split into CGST 9% + SGST 9%; failed with 0/0) and server/src/services/document/__tests__/create-tax-prep.test.ts
