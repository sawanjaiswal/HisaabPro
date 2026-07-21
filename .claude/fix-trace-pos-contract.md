---
symptom: /pos renders the error boundary — "Cannot read properties of undefined (reading 'length')"
root_cause_file: src/features/pos/components/QuickProductGrid.tsx:33
root_cause_reason: POS asserts its own `{ items: QuickProduct[] }` shape for GET /api/products instead of importing the canonical getProducts()/ProductListResponse, so TypeScript validates a fiction that the server never returned.
---

## 5-whys

1. **Why does `/pos` show the error boundary?**
   `products.length` throws — `products` is `undefined` at
   `QuickProductGrid.tsx:64`.

2. **Why is `products` undefined when state is initialised to `[]`?**
   The fetch resolves and calls `setProducts(res.items)`. `res.items` is
   `undefined`, which overwrites the `[]` seed.

3. **Why is `res.items` undefined?**
   `api()` unwraps the `{ success, data }` envelope and returns `data`.
   `GET /api/products` builds that payload in
   `server/src/services/product/search.ts:177` as
   `{ products, pagination, summary }`. There has never been an `items` key.

4. **Why did the client read a key the server never sent?**
   `QuickProductGrid.tsx:33` calls `api<{ items: QuickProduct[] }>(…)`. The
   type argument on `api()` is an *assertion*, not a check — it is the
   developer telling TypeScript what came back. Assert the wrong shape and the
   compiler will defend it.

5. **Why was the shape asserted by hand instead of typed from the real contract?**
   Because POS declared a private `QuickProduct` interface
   (`pos.types.ts:50`) rather than deriving from `ProductSummary`. Once the
   feature owned a parallel type, it also needed a parallel response type and a
   parallel fetch — none of which any test or compiler step ever compared
   against the server.

6. **Why was a parallel fetch written when a canonical one exists?**
   `src/features/products/product-crud.service.ts:86` already exports
   `getProducts()` returning `ProductListResponse` — `{ products, pagination,
   summary }`, matching the server exactly. It was not reused. This is an SSOT
   violation: one capability (fetch the product list), two implementations, and
   only one of them correct.

## Hypothesis

The bug is not a typo in a key name — it is a **duplicated contract**. POS
maintains its own product type, its own list fetch, and its own response shape,
none of which are derived from or checked against the canonical products
service. That duplication produced three distinct defects from one cause:

1. **The crash.** `res.items` → `undefined` → `.length` throws (this trace).
2. **`Stock: undefined`.** `QuickProduct.stock` does not exist on the wire; the
   server sends `currentStock` (`selects.ts:13`). Every consumer of `.stock`
   reads `undefined`.
3. **A silent stock-cap bypass.** `usePosCart.ts:44` guards with
   `existing.quantity >= product.stock`. With `product.stock === undefined`
   that comparison is always `false`, so the cart lets a cashier add unlimited
   quantity of an out-of-stock product — no error, no toast. This is the
   dangerous one: it does not crash, it oversells.

Corroborating evidence that `{ items }` was wrong from the first commit rather
than drift from a later server change: `useBarcodeLookup.ts:23` — the *offline*
branch of the same feature already reads `cached.products`. Two code paths in
one feature disagree about the response shape, which only happens when the
shape was guessed rather than imported.

## The same cause on the second POS screen — and a trap inside it

`/pos/billing` calls `GET /api/pos/products` and has its **own** copy of the
mistake: the client `PosProductDTO` (`types/pos.types.ts:20`) declared
`salePrice` / `stock` / `unit` / `taxRate`; the server DTO
(`pos-products.service.ts:123`) sends `salePricePaise` / `currentStock` /
`unitSymbol` / `gstRate`. Not one field name matched — hence the reported
`₹NaN` and `Stock: undefined` on every tile.

The trap: **renaming `taxRate` → `gstRate` would have been worse than the
crash.** `TaxCategory.rate` is stored in basis points (`schema.prisma:1978`,
1800 = 18.00%) and travels that way; `pos.utils.ts:13` computes
`taxable * taxRate / 100`, expecting a percent. Wire the field through raw and
every line is taxed 100x — 1800% GST — with no error, on real invoices. The
undefined field was failing loudly; the "obvious" fix fails silently. Converted
at the store boundary via `basisPointsToPercent()`, with a test asserting a
₹100 line is taxed ₹18 and not ₹1800.

## Fix

Delete the parallel contract. `QuickProduct` becomes a `Pick<>` of the
canonical `ProductSummary`, and the grid calls `getProducts()`. Renaming the
key to `products` would fix the symptom and leave defects 2 and 3 live.

## Failing test

`src/features/pos/__tests__/QuickProductGrid.test.tsx`

Feeds the component the exact payload the server sends
(`{ products, pagination, summary }` with `currentStock`) and asserts the grid
renders the product. Fails today with the reported TypeError.

`src/features/pos/__tests__/usePosCart.test.ts` covers defect 3 — adding the
same product past its stock level must stop at `currentStock`.
