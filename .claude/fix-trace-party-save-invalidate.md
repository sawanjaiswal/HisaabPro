---
symptom: New/edited party shows success toast but doesn't appear in the list until a hard reload
root_cause_file: src/features/parties/usePartyForm.ts:186
root_cause_reason: The Create/Edit form hook calls createParty/updateParty then navigates but never invalidates the ['parties'] React Query cache; with global staleTime:30s the list serves stale cached data on navigate-back.
---
## 5-whys
1. Why doesn't the new party show? — The parties list still renders old cached data.
2. Why is old data cached? — On navigate-back, TanStack Query returns the cached `['parties','list',filters]` without refetching.
3. Why no refetch? — The query is still "fresh": global `staleTime: 30_000` (src/lib/query-client.ts:10) keeps it fresh for 30s, and nothing marked it stale.
4. Why wasn't it marked stale? — The create path used by the form page (`usePartyForm.handleSubmit`) never calls `queryClient.invalidateQueries`.
5. Why not? — Two divergent create paths exist: `useParties.createMutation.onSuccess` DOES invalidate `parties.all()`, but the full-form page uses `usePartyForm`, which calls `createParty()` directly and only toasts + navigates.

## Hypothesis
Adding `queryClient.invalidateQueries({ queryKey: queryKeys.parties.all() })` after a successful create (and update) in `usePartyForm.handleSubmit` marks the list stale so the navigate-back remount refetches and shows the new/edited party immediately. This is a missing-cache-invalidation root cause, not a symptom patch. Matches "shows after reload" (hard reload bypasses the in-memory cache) and the 30s intermittency (`staleTime`).

## Failing test
src/features/parties/__tests__/usePartyForm.submit.test.ts — "inserts the created
party into the list cache instantly (regression)": seeds a parties list cache,
submits create, asserts the new party is at parties[0] and total incremented.
Fails on old code (usePartyForm never touched the cache).

## Resolution — gold-standard SSOT (not a local patch)
Root cause was architectural: cache reconciliation was duplicated across FOUR
call sites and diverged — usePartyForm (create+edit) did NOTHING (the reported
bug), PartyDetailPage delete did NOTHING (deleted party lingered), bulk-import
did NOTHING (imported parties invisible), useParties invalidated. Patching only
usePartyForm would leave the divergence for the next path to re-hit.

Created ONE canonical module `src/features/parties/party-cache.ts`:
  - reconcilePartyCreated  — optimistic prepend + invalidate (INSTANT insert)
  - reconcilePartyUpdated  — patch list + detail + invalidate
  - optimisticRemoveParty  — remove only (deferred-delete undo window)
  - reconcilePartyDeleted  — remove + invalidate (immediate/confirmed delete)
  - invalidatePartyLists   — bulk refresh
All five consumers now route through it (usePartyForm, useParties,
PartyDetailPage, useBulkImport, PartyCrmTab). Registered as canon in
ssot.config.mjs with a `forbidden` regex so any future direct
`invalidateQueries({ queryKey: queryKeys.parties* })` in feature code fails the
commit gate — the divergence cannot recur.

Verify: tsc clean · 74/74 parties+bulk tests · npm run ssot exit 0 ·
enforce-offline clean.
