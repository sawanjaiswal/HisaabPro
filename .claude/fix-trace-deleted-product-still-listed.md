---
symptom: Deleting a product does nothing visible — it stays in the products list forever.
root_cause_file: server/src/services/product/search.ts:147
root_cause_reason: listProducts applies a status filter only when the caller sends one, so the default list returns soft-deleted (INACTIVE) rows — while every summary metric in the same response counts ACTIVE only, so the list and its own header disagree.
---

## Symptom

TC-PRD-04: create a product, open it, press Delete, confirm. The row is still
in `/products` and still in `GET /api/products`:

```
{"name":"Renamed …","status":"INACTIVE", …}
```

## 5-whys

1. **Why is the product still listed after deleting it?** — `GET /api/products`
   still returns it.
2. **Why does the list return it?** — `listProducts` builds
   `where = { businessId }` and adds `status` only `if (status)`; the client
   sends no status by default, so no status filter is applied.
3. **Why does that matter — isn't it deleted?** — `deleteProduct`
   (`server/src/services/product/crud.ts:212`) is a soft delete: it sets
   `status: 'INACTIVE'` and returns `{ deleted: true, mode: 'soft' }`. Nothing
   else marks the row, so "deleted" *is* "INACTIVE".
4. **Why did nobody notice the list contradicts itself?** — the same response's
   `summary` counts only ACTIVE rows (`totalProducts`, `lowStockCount`,
   `totalStockValue`, `outOfStockCount` all filter `status = 'ACTIVE'`). The
   header therefore says 12 products while 13 rows render, and
   `pagination.total` agrees with neither. Two different definitions of "the
   business's products" in one payload.
5. **Why are there two definitions?** — the summary was written against
   "sellable products"; the row query was written against "rows in the table".
   The list route never picked one, so the caller's silence became "show
   everything", including rows the user deleted.

Root cause: the list's default scope was unset, so it silently disagreed with
the definition its own summary uses.

## Hypothesis

Default `status` to `ACTIVE` in `listProductsSchema` and add an explicit `ALL`
filter value for the "show me everything" case the filter drawer offers. Then
one rule holds: the list shows what the summary counts unless the caller asks
for otherwise. Deleted products disappear from the list (the user's
expectation), stay reachable under Status → Inactive, and no product data is
destroyed.

Not chosen: adding `Product.deletedAt` to separate "deleted" from
"discontinued". That is the more precise model and is worth doing, but it is a
schema change (high-risk path, needs the architect design plan) and it is not
what makes today's list contradict its own header.

## Failing test

`server/src/__tests__/integration/products.contract.test.ts` — "a soft-deleted
product leaves the default list and is still reachable with status=INACTIVE".
Red before the change (the row comes back), green after. E2E: TC-PRD-04 in
`e2e/gold/products.spec.ts`.

## Did I fix the symptom or the cause?

The cause. The symptom fix would have been the client passing
`status=ACTIVE` in `DEFAULT_PRODUCT_FILTERS` — which leaves every other caller
of the endpoint (POS picker, invoice line lookup, import dedup) still offering
deleted products, and leaves the summary/rows disagreement in place for anyone
who reads the API directly.
