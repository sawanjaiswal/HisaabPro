---
symptom: An inter-state sale's IGST never appears in GSTR-3B — 3.1(a) and section 4 stay at zero
root_cause_file: server/src/services/gst-returns/gstr3b.service.ts:96
root_cause_reason: "is this document taxed?" is expressed as `totalCgst > 0`, which is only true for intra-state documents; IGST-only documents match no 3.1 section at all
---

## 5-whys

1. Why does 3B show no tax for an inter-state sale? — The 3.1(a) aggregate returns 0 for it.
2. Why 0? — Its `where` requires `totalCgst: { gt: 0 }`, and an inter-state document stores 0 CGST.
3. Why is CGST the filter? — It was written as a shorthand for "the document carries GST".
4. Why is that shorthand wrong? — The GST split is state-dependent: intra-state bills CGST+SGST,
   inter-state bills IGST. Only one pair is ever non-zero, so CGST is not a proxy for "taxed".
5. Why did nothing catch it? — 3.1(c) (nil-rated) requires ALL heads to be zero, so an IGST-only
   sale falls through every 3.1 row instead of landing in the wrong one. A missing row reads as
   "no such supplies this month", not as an error.

Same shorthand on section 4 (ITC) drops the input credit on every inter-state purchase — the
business pays output tax it already paid on the way in.

## Hypothesis

`fetchAggregates` should express "taxed" as any non-zero tax head (CGST, SGST, IGST or cess),
not as CGST alone. That is the same predicate 3.1(c)/5 already use in negated form, so stating it
once and reusing it keeps the taxed and nil-rated buckets exhaustive and disjoint.

## Failing test

e2e/gold/gst-returns.spec.ts — TC-GSTR-11 (outward IGST in 3.1), TC-GSTR-12 (inter-state purchase ITC)
