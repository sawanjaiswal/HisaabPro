---
symptom: BOM create/update crashes with "Cannot read properties of undefined (reading 'id')"; BOM/Production-Run list pagination is always page 1/total 0; invoice tiered pricing silently never applies for parties on a price list; Role edit page crashes on load; staff invite success screen crashes; staff role-change toast crashes.
root_cause_file: src/features/bom/bom.service.ts:25-47 (and 8 sibling service files — see below)
root_cause_reason: Multiple feature service files re-accessed a `.data`/`.list`/`.entry`/`.invoice` field on the value returned by api(), but api() (src/lib/api.ts:239) already unwraps the server's {success,data} envelope and returns json.data directly — a second unwrap on an already-unwrapped object reads a field that doesn't exist, yielding undefined. A second, related bug: some server route handlers spread a paginated result as {success:true, ...result} instead of nesting it under data, making sibling fields (pagination) structurally unrecoverable by api()'s single-unwrap contract regardless of client code.
---
## 5-whys

1. Why does BOM create crash? — `useBomForm.ts` reads `created.id`, but `createBom()` resolved to `undefined`.
2. Why does `createBom()` resolve to undefined? — it does `const res = await api<BomDetailResponse>(...); return res.data`, and `res` (what `api()` returns) has no `.data` field of its own.
3. Why does `res` have no `.data`? — `api()` (src/lib/api.ts:239) already unwrapped the server's `{success,data}` envelope and returned `json.data` — the real `BomDetailDTO` — to the caller. `BomDetailResponse` (`{data: BomDetailDTO}`) was a stale type describing the *pre-unwrap* server payload, not what `api()` actually resolves to.
4. Why did this pattern spread to 9 functions across bom/production-runs/price-lists/sales/roles/staff? — this was the same mistake independently repeated across feature service files (the crm.service.ts bug fixed earlier in this session was one instance of the same class), evidently written against a mental model of `api()` where the caller does the unwrapping, which was true at some earlier point in the codebase's history but is no longer.
5. Why wasn't this caught by `tsc`? — `api<T>()` is generic and does not runtime-validate `T`; TypeScript trusts the caller's type annotation even when it's a lie about the runtime shape, so `res.data` type-checks fine while being `undefined` at runtime.

A second, distinct bug was found alongside: `server/src/routes/bom.ts` and `server/src/routes/production-runs.ts`'s list handlers built `res.json({success:true, ...result})` where `result = {data, pagination}`, spreading `pagination` as a sibling of `data` at the top level. Since `api()` only returns `json.data`, `pagination` was structurally discarded on every client regardless of client-side code — confirmed via curl showing `{"success":true,"data":[],"pagination":{...}}` (pagination unrecoverable).

## Hypothesis

Fixed by (a) removing the redundant client-side `.data`/`.list`/`.entry`/`.invoice` unwraps to match api()'s real single-unwrap contract, (b) changing the two server list-route handlers to use `sendSuccess(res, result)` so the full result (including its own nested pagination) survives under `data`, and (c) for price-lists/roles/staff, where the server's actual field names (`list`/`lists`/`entry`/`role`/`invoice`/raw Prisma fields) diverge from what the client types claimed, re-wrapping the unwrapped value to match each function's declared return type — following the same explicit re-wrap pattern already used correctly by `getRoles`/`getStaff` in the same files.

## Failing test

No test suite covers these hooks end-to-end; verified via live curl against the running dev server (business `cmr7oznk60005rotsb0oddfgq`):
- Before fix: `GET /api/bom?page=1&limit=20` → `{"success":true,"data":[],"pagination":{...}}` (pagination sibling to data, unrecoverable by api()).
- After fix: `GET /api/bom?page=1&limit=20` → `{"success":true,"data":{"data":[],"pagination":{...}}}` — api() unwrap yields `{data:[],pagination:{...}}` matching `BomListResponse` exactly.
- `GET /api/price-lists` → `{"success":true,"data":{"lists":[]}}` confirms client must read `.lists`, not `.data`.
- `GET /api/businesses/:id/roles/:roleId` → `{"success":true,"data":{...bare Role fields...}}` confirms client must NOT re-access `.data.role` after api()'s unwrap; `getRole()` now re-wraps to `{success:true,data:{role}}` to match consumer's `roleResponse.data.role` access in `useRoleBuilder.ts`.
- `GET /api/businesses/:id/staff` → `{"success":true,"data":{"staff":[...],"pending":[]}}` confirms the existing explicit re-wrap in `getStaff()` was already correct.
- `tsc -b --noEmit` exits 0 across the whole workspace after all fixes.
- `npm run ssot` exits 0, no new drift.
