---
symptom: Sales Hub tabs (Estimates, Sale Orders, Delivery Challans) show "Could not load estimates"/"Failed to load X" with console error "Query data cannot be undefined" for queryKey ['sales-documents', {...}] — reproduces on every load, every browser (Chrome + Safari), every account.
root_cause_file: src/features/sales/sales-list.service.ts:33-40
root_cause_reason: getSalesDocuments() double-unwraps the API envelope — it types the api() call as `{success, data}` and returns `response.data`, but api() (src/lib/api.ts:239) already returns `json.data` (the unwrapped DocumentListResponse). Since DocumentListResponse has no `.data` field, response.data is always undefined, which TanStack Query v5 rejects as an invariant violation on every successful fetch.
---
## 5-whys
1. Why does the Sales Hub show "Could not load estimates"? — Because the `sales-documents` useQuery's queryFn resolves to `undefined`, and TanStack Query v5 throws "Query data cannot be undefined" instead of committing the result, which the hook's error boundary then renders as a load failure.
2. But why does the queryFn resolve to undefined? — Because `getSalesDocuments()` in sales-list.service.ts returns `response.data`, and `response.data` is undefined.
3. But why is `response.data` undefined? — Because `response` is NOT the raw server envelope `{success, data}` at runtime — it's already the inner `DocumentListResponse` object (`{documents, pagination, summary}`), which has no `data` property.
4. But why is `response` already unwrapped? — Because `api<T>()` in src/lib/api.ts (line 239) does `return json.data` internally — every caller of `api()` receives the already-unwrapped payload, by design (every other call site in the codebase, e.g. invoice-crud.service.ts:80, calls `api<DocumentListResponse>(...)` and uses the result directly with no further `.data` access).
5. But why did this call site do it differently? — `sales-list.service.ts` was written independently of the invoices list service and mistakenly generic-typed the `api()` call as the wire envelope shape (`{success: boolean, data: DocumentListResponse}`) instead of the unwrapped payload shape (`DocumentListResponse`), then added a redundant `.data` access — a copy-paste/API-contract misunderstanding that was never caught because TypeScript's structural typing didn't flag it (the annotated type was self-consistent, just wrong relative to what api() actually returns at runtime).

## Hypothesis
The bug is 100% client-side and has nothing to do with server caching, ETags, ETag/304 behavior, ACCOUNT role, or browser — all of which were investigated and ruled out via extensive curl reproduction (8+ clean 200 responses with valid `data` payloads, using both a dev-login owner account and the real user's own account/token). The prior fix (commit 34ad2ce, disabling ETag) was based on a plausible-but-incorrect mechanism and did not address the actual defect, which is why the bug persisted identically afterward. The actual defect is the double-unwrap in `getSalesDocuments()`.

## Failing test
No existing unit test covers `sales-list.service.ts`. Manual reproduction: any authenticated call to `getSalesDocuments()` returns `undefined` for `.documents` (in fact the whole return value is `undefined`) regardless of server response content, because `response.data` reads a nonexistent field off the already-unwrapped envelope.
