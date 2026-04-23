# Offline Patterns — MANDATORY

> Background: DudhHisaab shipped v1 without these patterns and we paid the
> tax later — every feature had to be retrofitted for the offline queue,
> idempotency, and IDB cache. HP must build offline-correct from day one.
> `scripts/enforce-offline.mjs` blocks commits that violate these rules.

---

## Rule 1 — All API calls go through `api()` from `src/lib/api.ts`

**Never** call `fetch()` directly from feature code. The `api()` helper
provides cookie auth, CSRF, replay protection, 401 refresh, the offline
mutation queue, and the optional read cache. Bypassing it means losing
all of those for that one call.

✅ Allowed direct-`fetch` files:
- `src/lib/api.ts` (the wrapper itself)
- `src/lib/api-cache.ts` (no — it doesn't fetch, just IDB)
- `src/hooks/useOnlineStatus.ts` (heartbeat probe)
- `src/lib/auth.ts` (refresh + csrf bootstrap inside `api.ts`)
- `src/serviceWorkerRegistration.ts` and any `*.test.ts` / `__tests__/*`

Anywhere else, use `api<T>('/path', { method, body })`.

---

## Rule 2 — Mutations MUST pass `entityType` and `entityLabel`

When calling `api()` with `POST` / `PUT` / `PATCH` / `DELETE` from a
service file (`src/features/**/*.service.ts`, `src/features/**/*-crud.service.ts`),
include human-readable metadata so the offline queue UI shows
"Saving party — Raju Traders" instead of "Offline change".

```ts
// ✅ correct
await api('/parties', {
  method: 'POST',
  body: JSON.stringify(data),
  entityType: 'party',
  entityLabel: data.name,
})

// ❌ wrong — queued mutation will appear as "Offline change" with no context
await api('/parties', { method: 'POST', body: JSON.stringify(data) })
```

`entityType` is the singular noun (`party`, `invoice`, `payment`,
`product`). `entityLabel` is the user-recognisable name shown in the
sync queue (the party's name, the invoice number, etc.).

---

## Rule 3 — Reads default to network-only; opt in for offline

GET responses are NOT cached by default — most endpoints carry PII
(phone numbers, balances, transaction histories) and a wide cache
surface enlarges the cross-session leak risk. When you are sure a read
is safe to persist for the lifetime of the user's session, opt in:

```ts
// ✅ explicit opt-in for the read cache (cleared on logout)
await api<DashboardSummary>('/dashboard/today', { cacheReads: true })
```

Do NOT cache:
- `/auth/*`, `/me`, `/csrf-token` — credentials & identity
- Anything returning another tenant's data
- Anything that changes per-call (search results, exports, generated PDFs)

Do cache:
- Dashboard summary, business stats
- Static reference data (products, units, tax-categories) — though
  these are also covered by the SW cache in `vite.config.ts`
- Lists the user navigates to constantly (parties, recent invoices)
  *if* the page already shows per-row stale indicators

---

## Rule 4 — No `localStorage` for entity data

`localStorage` is synchronous and capped at ~5 MB. Use:
- `sessionStorage` only for short-lived auth artefacts (`cachedUser`)
- `IndexedDB` (via Dexie) for everything else — see `src/lib/offline.ts`
  and `src/lib/api-cache.ts` for the patterns

The enforce script flags `localStorage.setItem` in feature code.

---

## Rule 5 — Mutation handlers MUST tolerate the optimistic `{}` return

When `api()` queues a mutation offline, it returns `{} as T` so the UI
keeps moving. Service consumers (TanStack Query mutations, form submits)
must handle this — typically by optimistically updating the local cache
and showing a "queued" toast rather than reading the response object's
fields blindly.

```ts
// ✅ correct — optimistic update without depending on response
const created = await createParty(data)        // returns {} when offline
queryClient.invalidateQueries(['parties'])     // refetch happens online
toast.success(navigator.onLine ? 'Saved' : 'Saved — will sync when online')

// ❌ wrong — crashes when offline
const created = await createParty(data)
navigate(`/parties/${created.id}`)             // .id is undefined offline
```

---

## Quick checklist for every new feature

- [ ] Every API call uses `api()` from `@/lib/api`
- [ ] All mutations pass `entityType` and `entityLabel`
- [ ] Any safe-to-cache read passes `cacheReads: true`
- [ ] No `localStorage` writes for entity data
- [ ] Mutation success handlers don't deref response fields without an `if`
- [ ] React Query `mutationFn` calls invalidate on success
- [ ] If new endpoint, server side adds idempotency middleware for POSTs
