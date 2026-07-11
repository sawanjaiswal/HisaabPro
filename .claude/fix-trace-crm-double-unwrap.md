---
symptom: Parties page shows a permanent "Retry" chip in the tag filter bar; underlying React Query entry for ['crm','tags'] is stuck at status:'error' / dataUpdateCount:0 forever, even after confirmed-successful network responses.
root_cause_file: src/features/crm/api/crm.service.ts:37-40
root_cause_reason: getTagSummary (and getFollowUps, patchPartyCrm) typed the api() response as ApiEnvelope<T> and re-accessed .data, but api() (src/lib/api.ts:239) already unwraps { success, data } and returns json.data directly — a second unwrap on an already-unwrapped object reads a nonexistent field, yielding undefined.
---
## 5-whys
1. Why does the Parties page show a stray "Retry" chip? — TagFilterBar's isError branch is rendering.
2. Why does useTagSummary() report isError? — the underlying React Query cache entry for ['crm','tags'] has status:'error'.
3. Why is the query in an error state when the network request genuinely returns 200 with a valid body (confirmed via a fetch monkeypatch that logged the real response)? — React Query's dev guard marks any query whose queryFn *resolves* (not throws) to `undefined` as an error ("[...] data is undefined"), and getTagSummary was resolving to undefined.
4. Why does getTagSummary resolve to undefined despite api() returning real data? — getTagSummary does `const res = await api<ApiEnvelope<TagSummaryPage>>(...); return res.data`, i.e. it accesses `.data` on the value api() returns.
5. But why does that access undefined? — api() (src/lib/api.ts) already unwraps the server's `{ success, data }` envelope internally and returns `json.data` (the real TagSummaryPage) to its caller. So `res` in getTagSummary IS already `{ tags: [...], ... }` — it has no `.data` field of its own. `res.data` is therefore always undefined. The file's own comment ("api() doesn't unwrap so each service does it locally") was simply wrong / stale — likely written against an earlier version of api() before the unwrap was centralized.

## Hypothesis
crm.service.ts is the only file in the codebase using the local `ApiEnvelope<T>` re-wrap pattern (grep confirmed zero other usages). Every other feature's service file calls `api<T>()` with T as the bare payload shape and uses the result directly. Removing the redundant envelope type and the second `.data`/`.party` access restores the same single-unwrap contract as every other service, fixing getTagSummary (visible bug) and silently fixing patchPartyCrm, which was returning `{}` on every party CRM PATCH (masked by `res.data?.party ?? {}` optional chaining, so it never crashed — it just silently discarded every follow-up-date/tag save's server response).

## Failing test
No test suite covers this hook end-to-end; verified via live browser reproduction instead:
- Before fix: `queryClient.getQueryCache().getAll()` for key ['crm','tags'] showed `{status:'error', dataUpdateCount:0, error:'[...] data is undefined'}` despite a monkey-patched fetch confirming the real HTTP response was 200 with valid JSON.
- After fix: same inspection shows `{status:'success', dataUpdateCount:1, data:{tags:[],totalPartiesWithTags:0,totalPartiesWithoutTags:0}}`.
