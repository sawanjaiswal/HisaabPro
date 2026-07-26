---
symptom: Every parties-list render logs `404 GET /api/marketing/opt-outs`, and the marketing opt-out page can never list anyone.
root_cause_file: server/src/routes/marketing/segments.ts:1
root_cause_reason: The client shipped a reader for an endpoint that was never implemented — only the POST that sets `marketingOptOut` exists, so there is no route that lists the parties who opted out.
---

## 5-whys

1. Why does the opt-out page show nothing? — Its query rejects with a 404.
2. Why a 404? — `GET /api/marketing/opt-outs` matches no route in `server/src/routes/marketing/segments.ts`.
3. Why is there no route? — Marketing opt-out was built write-side only: `POST /opt-out` flips `Party.marketingOptOut`, and nothing ever read the flag back as a list.
4. Why did the client call it anyway? — `useOptOutSet` was written against an assumed contract (`{ data, nextCursor }`); `api<T>()` asserts the response type rather than checking it, so a missing endpoint is a runtime 404, not a compile error.
5. Why did nothing catch it? — The parties list calls the hook on every render, so the 404 was constant, but no test asserted "no API failures" on that page until TC-PTY-01 started tracking failed requests.

## Hypothesis

The fix is server-side and additive: implement `listOptOutParties(businessId, {limit, cursor})` in the
existing marketing-optout service (the SSOT for that flag) and expose it as `GET /api/marketing/opt-outs`
in the marketing segments router, cursor-paginated like every other list. Because
`marketingOptOutAt` is null for rows opted out before it was recorded, the cursor orders by
`[marketingOptOutAt desc, id desc]` so it stays stable. The response field is named `optOuts`, not
`data`, so the client reads `data.optOuts` instead of the `data.data` shape the assumed contract implied.

## Failing test

e2e/gold/parties.spec.ts — TC-PTY-01 asserts `failures.get()` is empty while on the parties list,
which fails with `404 GET /api/marketing/opt-outs` before the route exists.
