---
symptom: A GST-registered business sees no GST at all on the Create Invoice screen — no place-of-supply, no tax column, no GST summary — and the invoice saves untaxed.
root_cause_file: src/features/gst/useGstGate.ts:22
root_cause_reason: The hook every GST-aware screen asks "is GST on?" only reads the TanStack cache; nothing on the invoice route ever fetches it, so a fresh session always answers "off".
---
## 5-whys
1. Why is there no GST on the invoice screen? `useGstGate()` returns `gstEnabled: false`.
2. Why false? It reads `queryClient.getQueryData(['gst-settings'])` and gets `undefined`.
3. Why undefined? The only thing that populates that key is `useGstSettings()`, and the only screen that calls it is Settings → GST.
4. Why does that break the invoice screen? A user who opens the app and taps New Invoice never visits that screen, so the cache is cold — the gate reads absence of data as "GST is off".
5. Why did nobody notice? Visiting Settings → GST once warms the cache for the session, which is exactly what a developer testing GST does. The bug only shows on the path a real seller takes.

The same shape breaks tax categories: `TaxPickerColumn` and `useInvoiceGstSummary`
read `['tax','categories']` off the cache, and nothing on the invoice route
fetches it either — so even with the gate open, the per-line auto-fill from
`product.taxCategoryId` finds an empty list and every line goes to the server
untagged.

Two more layers sat under it, found by following the same case down:

6. Even once the gate fetched, `gstEnabled` was still false: `getGstSettings()`
   declared its return as `GstSettings` while the route answers
   `{ settings: {...} }` — `api<T>()` asserts, never checks, so every field read
   `undefined` app-wide.
7. Even with the gate open and categories loaded, no line carried a tax
   category: `handleProductSelect` hardcoded `taxCategoryId: null`, and the
   product's own category was dropped at the picker boundary (positional
   `(id, rate, name)` args). `TaxPickerColumn` had a `productTaxCategoryId`
   auto-fill prop that no call site ever passed.
8. And even with tax computed, the totals bar showed the pre-tax figure:
   `calculateInvoiceTotals` had no tax input and `calculateGrandTotal` never
   added one — the seller quoted ₹2,000 on an invoice the server stored at
   ₹2,360.

## Hypothesis
A cache read is not a data dependency. `useGstGate` is already the SSOT every
feature asks — it has to OWN the fetch, not hope someone else ran it, so it
subscribes with the same key/queryFn/staleTime as `useGstSettings` (one cache
entry, both hooks in sync, no consumer changes). The two invoice-side readers of
`['tax','categories']` likewise call the existing `useTaxCategories(businessId)`
hook instead of peeking at its cache.

The service is where the wire shape becomes the app's type, so `getGstSettings`
unwraps `body.settings` there. Product pickers emit one `ProductPick` object
(id + name + salePrice + taxCategoryId) instead of positional scalars, so a
line is pre-tagged from the product it came from and the dropped field can't
recur silently. And tax joins the totals at the same place the server puts it —
`calculateInvoiceTotals(..., totalTax)`, with the tax computed inside
`useInvoiceForm` next to the totals it feeds, so the GST card and the grand
total cannot disagree.

## Failing test
e2e/gold/gst-invoicing.spec.ts — TC-GST-08
