---
symptom: A business with more than 20 parties can only ever see the first 20 — party 21 is unreachable except by typing an exact search term.
root_cause_file: src/features/parties/useParties.ts:40
root_cause_reason: The list is fetched with a single-page `useQuery` keyed on `filters` (which contains `page`), and nothing in the app ever calls `setPage`, so the UI renders exactly one page of 20 with no pager, no "load more" and no infinite scroll.
---

## Symptom

`/parties` renders 20 rows. The business has 21. There is no control anywhere on
the page that reaches the 21st.

## 5-whys

1. **Why is party 21 not on the page?** — `data.parties` holds 20 rows;
   `PartiesPage.tsx:181` maps exactly that array and renders nothing else.
2. **Why does `data.parties` hold only 20?** — `useParties` requests
   `DEFAULT_FILTERS` (`party.constants.ts:70`), which is `page: 1, limit: 20`,
   and the server honours it.
3. **Why is page 2 never requested?** — `setPage` is exported by the hook but
   `PartiesPage.tsx:37` destructures only `data, status, filters, setSearch,
   setFilter, refresh`. No call site in the repo calls `setPage`.
4. **Why was no pager ever built?** — the hook uses a plain `useQuery` keyed by
   the whole `filters` object. Changing `page` would *replace* the cached list
   rather than append to it, so a "load more" button on top of this hook would
   swap rows 1-20 for rows 21-40 instead of growing the list. The pagination
   affordance was never buildable without changing the hook's fetch model.
5. **Why did the hook use a single-page `useQuery`?** — it was a straight
   mechanical port of the pre-TanStack `useState(data) + useEffect(fetch)` code
   (see the comment at `useParties.ts:39`). The port preserved the old shape;
   the repo's paged-list idiom (`useInfiniteQuery`, 12 files, reference
   `src/features/custom-orders/hooks/useCustomOrders.ts`) was never applied here.

Root cause: the fetch model, not the page markup. `useParties` fetches one page
and has no way to accumulate a second, so the list is structurally capped at
`limit`.

## Hypothesis

Converting `useParties` to `useInfiniteQuery` — page number as the page param,
`getNextPageParam` derived from `pagination.page < pagination.totalPages`, and
the pages flattened back into the existing `{ parties, pagination, summary }`
shape — makes every party reachable without changing a single consumer's read
of `data`. The page then only needs the affordance: a "Load more" button
identical to the one `PartyTransactionsTab.tsx` already renders (`t.loadMore2`).

Because the cached value's shape changes from `PartyListResponse` to
`InfiniteData<PartyListResponse>`, `party-cache.ts` — the SSOT every party
mutation routes its cache update through — must understand both shapes, or its
`isPartyList` guard silently returns `old` and every optimistic create/update/
delete stops updating the list while still showing a success toast. That is the
same class of bug the file was written to kill, so it is fixed in the same
change rather than left to be discovered later.

## Failing test

- `src/features/parties/__tests__/useParties.test.ts` — "loadMore appends the
  next page instead of replacing the current one" (unit, red before the change).
- `e2e/gold/parties-list.spec.ts` — TC-PTY-07 "every party is reachable once
  there are more than one page" (E2E against the real server; the case that
  found this).

## Did I fix the symptom or the cause?

The cause. The symptom fix would have been raising `limit` to 100 — which just
moves the wall to party 101 and makes the first paint heavier for Raju, who has
eight parties. The list now fetches as many pages as the user asks for, and the
`total` the summary card already displayed is finally reachable.
