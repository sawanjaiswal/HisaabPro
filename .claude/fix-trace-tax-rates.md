---
symptom: /settings/tax-rates renders a blank pane (no empty-state, no list, no error)
root_cause_file: server/src/routes/tax-categories.ts:22
root_cause_reason: GET / wraps the array in { categories } while the FE service types the api() result as a flat TaxCategory[], so `categories.length` is undefined and neither the empty nor success branch matches
---
## 5-whys
1. Why is the pane blank? — `TaxCategoriesPage.tsx`'s render branches (loading/error/empty/success) never match once data resolves.
2. Why does no branch match? — the empty/success checks read `categories.length`, and `categories` is `undefined`.
3. Why is `categories` undefined? — `listTaxCategories()` in `src/lib/services/tax.service.ts:7` types `api<TaxCategory[]>(...)` and returns the result directly as an array, but the actual value received is `{ categories: [] }`.
4. Why does `api()` return `{ categories: [] }` instead of the array? — `api()` unwraps exactly one `.data` level off the server envelope `{ success, data }`; whatever shape the route passes as `data` becomes the FE payload verbatim.
5. Why is `data` `{ categories: [...] }` instead of the array? — `server/src/routes/tax-categories.ts:22` calls `sendSuccess(res, { categories })`, wrapping the array, while the route's own FE service was written assuming a flat-array wire shape (matching sibling master-data endpoints `categories.ts` / `units.ts`, which do send flat arrays).

## Hypothesis
The backend route wraps the categories array in an object; the FE service (and its consumer page) were written against the flat-array convention used by every other "settings master data" list endpoint in this codebase. Fixing the backend to send a flat array (matching `categories.ts`/`units.ts`) is the smaller, contract-consistent fix — no FE type change needed. A second live instance of the identical bug exists at `server/src/routes/party-groups.ts:45` (`sendSuccess(res, { groups })` vs. a FE service that already assumes a flat array) and is fixed in the same commit for consistency, since both are the same root cause.

## Failing test
server/src/__tests__/integration/tax-categories-party-groups.contract.test.ts — asserts GET /api/tax-categories and GET /api/party-groups both return `data` as a flat array. Confirmed failing pre-fix, passing post-fix (both routes changed from `sendSuccess(res, { key })` to `sendSuccess(res, arrayVar)`).
