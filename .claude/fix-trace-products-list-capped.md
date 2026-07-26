---
symptom: A business with more than 20 products can only ever see the first 20 — the products list has no way to reach page 2.
root_cause_file: src/features/products/useProducts.ts:47
root_cause_reason: The list is a single-page useQuery keyed on filters.page, and nothing in the UI ever calls setPage — so pagination exists in the hook's API and nowhere in the product.
---

## Symptom

TC-PRD-10: create 21 products sharing a marker, search for the marker. Twenty
rows render, `pagination.totalPages` is 2, and there is no pager, no "load
more", no infinite scroll. Product 21 is unreachable from the UI.

## 5-whys

1. **Why can't the user see product 21?** — the list renders exactly the rows in
   `data.products`, which is one page of 20.
2. **Why only one page?** — `useProducts` runs `useQuery` with
   `filters.page = 1` (`DEFAULT_PRODUCT_FILTERS`). One page in, one page out.
3. **Why doesn't the page advance?** — the hook exposes `setPage`, but no
   caller invokes it. `ProductsPage` renders rows, tiles and a footer card; it
   never renders a pager.
4. **Why would advancing the page not be enough anyway?** — `useQuery` keyed on
   `filters` *replaces* the data on page change, so a "next" control would swap
   rows 1-20 for 21-40 rather than growing the list. On a phone that reads as
   the list losing the rows the user just scrolled past.
5. **Why did this ship?** — the same reason the parties list shipped capped
   (F13): the list was built against Raju (a few dozen SKUs) and the pagination
   contract the server already returns was never consumed. The hook's `setPage`
   made it look handled.

Root cause: the products list never consumed the server's pagination — it is a
single-shot query with a vestigial `setPage`.

## Hypothesis

Same shape as the parties fix, and the same component: switch `useProducts` to
`useInfiniteQuery` (accumulating pages, flattened back into the single-response
shape every consumer already reads) and render the pager. The pager itself is
now one shared `<ListLoadMore>` primitive rather than a second copy of
`PartyListLoadMore` — the third list to need it should import, not rewrite.

## Failing test

`e2e/gold/products-stock.spec.ts` TC-PRD-10 — red before the change ("a list
with a 21st product must offer a way to reach it": the load-more button does
not exist), green after, with 21 rows accumulated rather than swapped.

## Did I fix the symptom or the cause?

The cause. The symptom fix would have been raising `limit` to 100, which moves
the cliff instead of removing it and makes the first paint of a distributor's
catalogue 5x heavier over 2G.
