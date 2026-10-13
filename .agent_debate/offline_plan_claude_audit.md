**[11:11 AM]**

# Verdict: REVISE

The diagnosis is partly right and partly stale. The mechanism sections (Phases 1, 3 and 4) either duplicate code that already exists or add a second source of truth. This was read-only: I checked the plan's claims against the code and changed nothing.

## Claims checked against the code

| Plan claim | Reality |
|---|---|
| Auth blocks up to 30s on `getMe` | Only partly true. `AuthContext.tsx:50-58` already renders the cached user and businesses instantly when the cache holds a business. It deliberately waits for the server only when the cache has no business. |
| Add a 2s race timeout to `init()` | This reintroduces fixed bugs. The comments cite `fix-trace-empty-business-cache`, `fix-trace-aborted-auth-verify` and `fix-trace-dead-session-stranded`. A timeout that unblocks on an empty business cache strands the owner on `/onboarding`. |
| Empty local list blocks on network (`useParties.ts:60-66`) | True, and `useInvoices` has the same pattern. |
| Build `POST /api/sync/batch` | `/api/sync/push` already exists. It takes an array of mutations, sorts them topologically and has a per-mutation `idempotencyKey`. `SyncManager` already uses `.limit(50)`. Adding `/batch` creates two sync contracts. |
| Temp-ID cascade remap is needed (4.3) | `OutboxEngine` already generates IDs, and the server inserts `id: entityId`. If IDs are client-generated, remapping is unnecessary. The plan doesn't pick one model. |
| "Frame-0 synchronous Dexie seed into React Query" | Dexie reads are async, so this is impossible. This codebase uses a custom `useLiveQuery` (`src/hooks/useLiveQuery.ts`), not React Query. The wording is copied from DudhHisaab. |
| `src/utils/paiseMath.ts` | `src/utils` doesn't exist. Money helpers live in `src/lib`. Check `.claude/ssot-index.json` before creating a new module. |

## Architecture problems

1. **Phase 3 (local ledger) is a second source of truth, which is the opposite of SSOT.**
   - The server ledger covers GL double-entry, opening balances, returns and credit notes, cancelled documents, discounts and round-off.
   - Re-deriving that from `documents` and `payments` will drift silently.
   - Counter-proposal: extract one pure ledger function that server and client both import, with a golden-fixture parity test against `/parties/:id/ledger`. Until the server confirms, label the local result "provisional".
   - Success criterion 4 ("never visited that party online") also requires a full local mirror of that party's history. The plan doesn't say whether one exists.

2. **There is no stated source of truth for "local is complete".**
   - Search (Phase 2) and the ledger both assume Dexie holds the full set. The lists are paginated, so it may not.
   - Counter-proposal: show local results instantly, and when online append server results de-duplicated by id.

3. **Phase 1.3 can flash a false empty state.**
   - On first install, or an unsynced filter, "return `[]` in 0ms" shows `EmptyState` for a customer who has data.
   - It needs a separate "never synced / hydrating" state, which fits the 4-UI-state rule.

4. **There is a likely refetch loop and a request storm in the current hook.** This is my reading of `useParties.ts:56-62` and `useLiveQuery.ts`, and I have not confirmed it at runtime.
   - `queryFn` fires `void getParties()` on every execution: mount, focus, and every bus invalidation.
   - If `getParties` writes Dexie and then invalidates the bus, it loops.
   - `useLiveQuery` also has no stale-result guard, so a slow response for an old key can overwrite a newer one.
   - Fix this in the one shared hook, with a revalidation throttle and a sequence guard. Do not add a third `useLocalFirstQuery`; 1.2's "or" must become a decision.

5. **Search uses the wrong index strategy.** Dexie indexes support prefix matching, not substring. Substring search is a full-table scan, and this app targets Rs 8-15K Android phones.
   - Counter-proposal: a normalized `searchKey` plus a word-prefix `multiEntry` index, a result cap of about 20, and barcode/SKU looked up by exact index.
   - The plan never mentions the barcode scanner path in `ProductSearchInput`.
   - It should state that the dropdown keeps ≥44px rows, arrow/Enter keyboard navigation and the clear button. Swapping the data source must not change the UI contract.

6. **Server-side payload fidelity is unaddressed.**
   - `/push` PARTY CREATE persists only a few fields (name, phone, type, company, gstin, pan, opening balance). UPDATE ignores `baseVersion`.
   - An offline-created customer with an address or credit limit silently loses it on sync.
   - There is no conflict policy. This is a data-loss risk and belongs ahead of any speed work.

7. **Level 6 items are missing.**
   - No audit-log writes on the sync path, no RBAC check, no idempotency or replay behaviour spelled out, and no transient-vs-permanent error classification (401/403/network must not burn attempts toward DLQ).
   - No offline token grace is mentioned.

8. **Process.**
   - There is no file plan. `SyncManager.ts` is already 232 lines against the 250 cap.
   - "Status: Approved Blueprint" is self-declared. It should say draft.
   - There are no failing-first tests.
   - The success criteria ("<50ms cold launch in airplane mode") are not measurable as written. WebView boot and bundle parse alone exceed that. Measure time from mount to data-ready, on a low-end device, with instrumentation.

## Counter-proposal order

1. **Fix the hook.** Fix `useLiveQuery` (throttle, sequence guard, a `hydrating` state) and `useParties` / `useInvoices`. Leave the auth gate alone, or make the timeout apply only when the cache already has a business.
2. **Make local search cheap.** Add the indexed `searchKey`. Point `PartySearchInput` and `ProductSearchInput` at the repositories, with a server merge when online.
3. **Fix `/push` fidelity and decide the ID model.** Fidelity means all party fields persist and conflict handling exists. The ID decision is client-generated UUIDs, which makes 4.3 unnecessary. Extend `/push`; do not add `/batch`.
4. **Build the ledger last.** Use the shared pure function with a parity test, and add it only once the local mirror is confirmed complete.

Not applicable here: the 375/320px, touch-target and focus-state checks. The plan adds no UI, so those only matter if Phase 2 changes the dropdown markup.

**[11:11 AM]**