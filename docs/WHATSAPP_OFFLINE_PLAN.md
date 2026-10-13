# Architecture & Execution Plan: Truly Offline-First (WhatsApp-Grade) HisaabPro

> **Status**: DRAFT (Audited & Debate-Verified with Claude Code)  
> **Target**: HisaabPro Mobile App & Express/Prisma Backend  
> **Protocol**: Level 6 Axiomatic Elimination & SSOT (Zero Band-Aids)

---

## 1. Executive Summary & Honest Diagnostic

Following an adversarial cross-examination between Antigravity (AGV) and Claude Code against the HisaabPro codebase, the root causes of mobile sluggishness, ghost duplicates, and slow forms were isolated:

1. **Catastrophic Dual-Writes in Existing Code**:
   In `party-crud.service.ts`, `product-crud.service.ts`, and `invoice-crud.service.ts`:
   ```ts
   const repo = new PartyRepository();
   const local = await repo.create(data); // 1. Writes to local Dexie + queues Outbox + triggers SyncManager
   void api('/parties', { method: 'POST', body: JSON.stringify(data) }); // 2. Simultaneously fires direct REST call!
   ```
   - **Online**: Generates client UUID `A` for sync outbox, while the REST call generates server UUID `B`, creating **two duplicate entities** on the backend.
   - **Offline**: The repo queues to `HisaabDatabase.syncQueue`, and the failed `api()` call catches and queues to `SyncDB.syncQueue`, creating **two outbox entries** in two separate databases.
2. **The Empty-Cache Network Block on Reads**:
   In `useParties.ts` and `useInvoices.ts`:
   ```ts
   if (local && local.parties.length > 0) return local;
   return getParties(filters); // <-- BLOCKS on network when local is empty or filtered!
   ```
   If a list is empty or an un-cached filter is selected, the UI waits for a synchronous HTTP roundtrip instead of rendering immediately.
3. **Background Request Storms & Lack of Sequence Guards**:
   `useLiveQuery.ts` triggers `queryFn` on mount, focus, and every bus event. Inside `useParties`, `void getParties(filters)` fires without revalidation throttling. A slow network response for an earlier keystroke can resolve late and overwrite newer query data.
4. **Full-Table JS Scans During Invoicing Search**:
   `PartySearchInput` and `ProductSearchInput` fire remote HTTP queries on keystrokes or perform linear array scans (`.includes(search)`) in JS, causing input lag on ₹8K-₹15K Android devices.

---

## 2. Hard Architectural Invariants (SSOT Mandates)

1. **Single Mutation Path (No Dual Writes)**:
   For core entities (`PARTY`, `PRODUCT`, `DOCUMENT`, `PAYMENT`), the repository is the **Single Source of Truth**. Mutations write to local Dexie in `<1ms` and enqueue in the outbox in a single atomic transaction. The redundant `void api(...)` side-effect calls are deleted.
2. **Single Sync Contract**:
   `POST /api/sync/push` is the sole mutation ingestion endpoint for core entities. Client generates UUIDs (`crypto.randomUUID()`); the server persists them directly without remapping cascades.
3. **No Second Source of Truth for Ledgers**:
   Ledger calculation covers GST, round-off, credit notes, discounts, and cancellations. Local calculation must be a pure deterministic function shared between client and server, verified against golden test fixtures. Local balances prior to server sync are explicitly flagged as `provisional`.
4. **4-State UI Completeness**:
   Every view must handle `Loading/Hydrating`, `Empty`, `Error`, and `Content`. An empty local cache during initial sync must render `Hydrating` (via `lastHydratedAt` meta), never flashing an erroneous `EmptyState`.
5. **Budget-Device Indexing**:
   Search must use indexed prefix matching on Dexie (`searchKey` / `multiEntry` tokens), never unindexed full-table `.filter()` loops.

---

## 3. Implementation Phases & Milestones

### Phase 1: Eliminate Dual Writes & Lock SSOT Gate
- [ ] **1.1 Remove Dual Writes in CRUD Services**:
  - In `party-crud.service.ts`: Remove `void api('/parties', ...)` in `createParty`, `updateParty`, and `deleteParty`. The repository write is the sole mutation.
  - In `product-crud.service.ts`: Remove `void api('/products', ...)` in `createProduct` and `updateProduct`.
  - In `invoice-crud.service.ts`: Remove `void api('/documents', ...)` in `createDocument`.
- [ ] **1.2 Register SSOT Guard in `ssot.config.mjs`**:
  - Add `"src/repositories"` to `SHARED_DIRS`.
  - Add canonical repository row with exported classes (`PartyRepository`, `ProductRepository`, `InvoiceRepository`, `PaymentRepository`).
  - Add forbidden regex shape preventing mutating `void api('/parties' | '/products' | '/documents' | '/payments')` side-effects in CRUD services.

### Phase 2: Fix `useLiveQuery` & Eliminate List Latency
- [ ] **2.1 Sequence Guard & Throttle in `useLiveQuery.ts`**:
  - Add query execution sequence counter to prevent stale out-of-order network overwrites.
  - Add a 5-second revalidation cooldown to prevent duplicate background network storms on window focus / bus invalidation.
- [ ] **2.2 Non-Blocking Return in `useParties.ts` & `useInvoices.ts`**:
  - Return local Dexie state immediately, even if `items.length === 0`.
  - Introduce `isHydrating` state (tracking `lastHydratedAt` in Dexie) so UI shows a skeleton during first sync instead of a false `EmptyState`.
- [ ] **2.3 Preserve Auth Gate Safety**:
  - Maintain the existing `AuthContext.tsx` safety logic (`fix-trace-empty-business-cache`). Never prematurely unlock with an empty business cache.

### Phase 3: High-Performance Local Search for Invoicing & Payments
- [ ] **3.1 Add Indexed Search Keys in Dexie (`db.ts` / `schema.ts`)**:
  - Add prefix token indexing for `parties` (`name`, `phone`) and `products` (`name`, `sku`, `barcode`).
- [ ] **3.2 Instant Search in `PartySearchInput.tsx`**:
  - Query local `PartyRepository` first (resolves in <5ms).
  - When online, fire background search and merge results deduplicated by `id`.
  - Maintain full UI contract: $\ge 44$px touch targets, keyboard navigation (Arrow/Enter), and clear button.
- [ ] **3.3 Instant Search in `ProductSearchInput.tsx`**:
  - Point to local `ProductRepository` with exact SKU/barcode match acceleration.

### Phase 4: Push Sync Fidelity & Conflict Hardening
- [ ] **4.1 Full-Field Fidelity in `POST /api/sync/push`**:
  - Ensure party addresses, credit limits, tags, notes, and custom fields are persisted by the backend outbox processor (prevent silent field dropping).
- [ ] **4.2 Concurrency & Error Classification**:
  - Respect `baseVersion` on `UPDATE` mutations.
  - Distinguish transient network errors (retryable) from permanent 4xx validation errors (route to DLQ without burning retry budget).

### Phase 5: Shared Pure Ledger Engine & Parity Verification
- [ ] **5.1 Pure Ledger Calculation Engine in `src/lib/ledger`**:
  - Compute balances and ledger rows with integer paise arithmetic (`paiseMath`).
- [ ] **5.2 Golden Parity Tests**:
  - Unit tests verifying 100% parity between local calculation and `/parties/:id/ledger` responses across partial payments, discounts, and credit notes.
- [ ] **5.3 UI Provisional Badge**:
  - Mark running balance as `(Provisional)` until the outbox queue drains and server confirms ledger state.

---

## 4. Verification & DoD (Definition of Done)

1. **Zero Dual Writes**: Creating a party or invoice executes 1 repository transaction and 1 outbox record; zero direct `api()` calls fired in parallel.
2. **Mount to Data-Ready**: Customer list and invoice list render local data in $<15$ms on low-end device simulation.
3. **No False Empty State**: Opening an empty un-hydrated account shows a hydrating skeleton, not "No customers found".
4. **No Request Storms**: Switching tabs or focusing window does not fire duplicate `/parties` or `/documents` requests within 5 seconds.
5. **Instant Invoicing Search**: Autocomplete for customers and products responds within 1 frame ($<16$ms) from Dexie keystroke event.
6. **Zero Data Loss on Sync**: Customers created offline with addresses and credit limits retain 100% of fields when synced via `/push`.
7. **SSOT Pre-Commit Gate**: `npm run ssot` passes with 0 violations.
