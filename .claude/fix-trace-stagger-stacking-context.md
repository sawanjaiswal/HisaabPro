---
symptom: Tapping a result in the invoice item/party search dropdown lands on the section below instead of the result.
root_cause_file: src/features/invoices/invoice-product-search.css:1
root_cause_reason: Each direct child of `.stagger-enter` runs a transform entrance animation, which makes it its own stacking context — so the dropdown's z-index only orders it against its own siblings, never against the sections it overhangs.
---
## 5-whys
1. Why did the tap miss the result? Playwright reported the accordion below "intercepts pointer events" — that element is on top at those coordinates.
2. Why is it on top when the dropdown has a higher z-index? Because the two z-indexes are not compared: they live in different stacking contexts.
3. Why different contexts? The dropdown's ancestor section is a direct child of `.stagger-enter` and runs a transform animation; an element with an active transform animation forms a stacking context in Chromium for the animation's life (and the class is never removed).
4. Why does that break ordering? Inside a stacking context, a descendant's z-index is clamped to the context's own order among its siblings — the later section paints after the earlier one regardless.
5. Why was it not caught earlier? The dropdown only overhangs the next section when the list is long enough; short lists paint inside the section and read as correct.

## Hypothesis
The fix cannot live on the dropdown — no z-index inside a stacking context can escape it. It has to raise the *hosting section* among its siblings, and only while a dropdown is open, so the raise does not disturb normal paint order. `.stagger-enter > *:has(.product-search-dropdown) { position: relative; z-index: 5 }` does exactly that; the party search needs the mirror rule.

## Failing test
e2e/gold/invoices.spec.ts (TC-INV-02 — add a product from the search dropdown; failed with "intercepts pointer events" before the rule, passes after)
