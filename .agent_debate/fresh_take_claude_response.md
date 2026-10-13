**[11:18 AM]**

I checked the code. Your diagnosis is mostly right, but the proposed fix, "retire System A", would break the app as written. Verdict: **REVISE**.

## 1. Is the dual-engine diagnosis accurate?

**Confirmed:**
- `startOfflineAutoSync()` runs in `src/main.tsx:29`, and `api.ts:89` enqueues failed mutations via `enqueue` from `./offline`. System A is live.
- `createParty` in `party-crud.service.ts:94-103` calls `repo.create()` and then `void api('/parties', …)`. `invoice-crud.service.ts:159` does the same for documents, and `product-crud.service.ts` has the same pattern.

**Worse than you described.** The two writes don't just duplicate, they produce two different records.
- `repo.create` generates a client UUID and pushes it as `entityId`. `sync.routes.ts` creates the party with `id: entityId`.
- `POST /parties` creates a second party with a server-generated id.
- So an online create can produce **two parties on the server**, and the "duplicate outbox" is the smaller problem. I did not run this against a live server, so the duplicate-party outcome is from reading the code only. Reproduce it before building on it.

**Scope correction.** The dual-write is limited to three CRUD services (parties, products, invoices). Every other feature (HR, expenses, appointments, CRM, GST, imports, collections, and more) only uses System A, and I count about 40 files importing `@/lib/offline`.

## 2. Should System A be retired and everything moved to System B?

**Not wholesale.** System B can't carry it yet:
- `sync.routes.ts:22` only accepts `PARTY | PRODUCT | DOCUMENT | PAYMENT`. Anything else is rejected by Zod.
- The server PARTY create handler writes only name, phone, type, companyName, gstin, pan and the opening balance. Address, credit limit, tags, groups and CRM fields are silently dropped. Retiring the REST call would lose that data on every party.
- I only saw the PARTY and PRODUCT handlers in the push route. I found no DOCUMENT or PAYMENT branch, and `idempotencyKey` is validated but I found no code that uses it. That needs checking before invoices move to the outbox.
- Pull covers the same four entities.

**Right target:** one mechanism for the entities System B fully covers, and System A stays as the generic fallback for the rest. A single engine across everything is a larger epic that has to be scoped as one.

**Decision for you:**
- **(a) Keep A as the fallback for everything not in B.** I recommend this. It is smaller and keeps all 40 feature files working.
- **(b) Migrate every feature to repositories.** This is a multi-week epic. Under your scope-integrity rule, don't reduce it silently.

## 3. Ordering

1. **Stop the duplicate writes first.**
   - Delete the `void api(...)` calls in the three CRUD services, but only after step 2.
   - Until then, as a stopgap, make the REST call the fallback only when the repo throws, which is already the `catch` branch.
2. **Make sync/push lossless for parties, products and documents.**
   - Map every `PartyFormData` field.
   - Honor `idempotencyKey`.
   - Add DOCUMENT and PAYMENT handlers if they are missing.
   - Return the accepted ids, and keep `temp_*` to server-id remapping crash-safe.
   - This touches `server/src/routes/sync.routes.ts`. It has no listed high-risk pattern, but it is a tenant-scoped write path, so treat it as one.
3. **Add a failing integration test first.** For example, online create then count parties on the server, expecting 1. Use the real-DB suite (`npm run test:integration`).
4. **Fix reads.**
   - Hooks should return Dexie data immediately and revalidate in the background.
   - They should merge with pending `temp_*` rows and never block on the network when local data is empty.
   - Invoice party search should query Dexie, with a debounce only if it falls back to the network.
5. **Throttle `useLiveQuery`.**
   - The scope is a time-based throttle on refetch-on-focus, plus entity-scoped bus subscriptions.
   - Add a minimum interval of a few seconds, not a full rewrite.
6. **Then widen B to more entities, one at a time.** Each one needs server push/pull support and a repository. Only then is its System A usage removed.
7. **Delete System A last,** once nothing imports it.

## Risks to settle before building

- **Data migration:** devices may already hold queued items in `SyncDB`. Drain them before removing any reader.
- **Two sync UIs:** `SyncQueueDrawer` and `useSyncQueue` read System A only. Until both systems are merged, users see an incomplete pending count.
- **Plan gates:** the file plan must stay at 250 lines per file or less. The session-wide `enforce-offline.mjs` ratchet will flag changes to `api.ts`.

This was read-only. I changed no files.

**[11:19 AM]**