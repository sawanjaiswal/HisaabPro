# Architecture & Execution Plan: Truly Offline-First (WhatsApp-Grade) HisaabPro

> **Status**: DRAFT (Audited & Debate-Verified with Claude Code)  
> **Target**: HisaabPro Mobile App & Express/Prisma Backend  
> **Protocol**: Level 6 Axiomatic Elimination & SSOT (Zero Band-Aids)

---

## 1. Executive Summary & Honest Diagnostic

Following an adversarial cross-examination between Antigravity (AGV) and Claude Code against the HisaabPro codebase, the root causes of mobile sluggishness were isolated:

1. **The Empty-Cache Network Block**:
   In `useParties.ts` and `useInvoices.ts`:
   ```ts
   if (local && local.parties.length > 0) return local;
   return getParties(filters); // <-- BLOCKS on network when local is empty or filtered!
   ```
   If a list is empty or an un-cached filter is selected, the UI waits for a synchronous HTTP roundtrip instead of rendering immediately.
2. **Background Request Storms & Lack of Sequence Guards**:
   `useLiveQuery.ts` triggers `queryFn` on mount, focus, and every bus event. Inside `useParties`, `void getParties(filters)` fires without revalidation throttling. A slow network response for an earlier keystroke can resolve late and overwrite newer query data.
3. **Full-Table JS Scans During Invoicing Search**:
   `PartySearchInput` and `ProductSearchInput` fire remote HTTP queries on keystrokes or perform linear array scans (`.includes(search)`) in JS, causing input lag on ₹8K-₹15K Android devices.
4. **No Double-Sync Contracts**:
   HisaabPro already possesses `POST /api/sync/push` and client-generated UUIDs. We will **NOT** create a duplicate `/api/sync/batch` endpoint or unnecessary ID remapping cascades. We will extend `/push` to ensure 100% field fidelity.

---

## 2. Hard Architectural Invariants (SSOT Mandates)

1. **Single Sync Contract**:
   `POST /api/sync/push` is the sole mutation ingestion endpoint. Client generates UUIDs (`crypto.randomUUID()`); the server persists them directly without remapping cascades.
2. **No Second Source of Truth for Ledgers**:
   Ledger calculation covers GST, round-off, credit notes, discounts, and cancellations. Local calculation must be a pure deterministic function shared between client and server, verified against golden test fixtures. Local balances prior to server sync are explicitly flagged as `provisional`.
3. **4-State UI Completeness**:
   Every view must handle `Loading/Hydrating`, `Empty`, `Error`, and `Content`. An empty local cache during initial sync must render `Hydrating`, never flashing an erroneous `EmptyState`.
4. **Budget-Device Indexing**:
   Search must use indexed prefix matching on Dexie (`searchKey` / `multiEntry` tokens), never unindexed full-table `.filter()` loops.

---

## 3. Implementation Phases & Milestones

### Phase 1: Fix `useLiveQuery` & Eliminate List Latency
- [ ] **1.1 Sequence Guard & Throttle in `useLiveQuery.ts`**:
  - Add query execution sequence counter to prevent stale out-of-order network overwrites.
  - Add a 5-second revalidation cooldown to prevent duplicate background network storms on window focus / bus invalidation.
- [ ] **1.2 Non-Blocking Return in `useParties.ts` & `useInvoices.ts`**:
  - Return local Dexie state immediately, even if `parties.length === 0`.
  - Introduce `isHydrating` state so UI shows a skeleton/progress indicator during first sync instead of a false `EmptyState`.
- [ ] **1.3 Preserve Auth Gate Safety**:
  - Maintain the existing `AuthContext.tsx` safety logic (`fix-trace-empty-business-cache`). Never prematurely unlock with an empty business cache.

### Phase 2: High-Performance Local Search for Invoicing & Payments
- [ ] **2.1 Add Indexed Search Keys in Dexie (`db.ts` / `schema.ts`)**:
  - Add prefix token indexing for `parties` (`name`, `phone`) and `products` (`name`, `sku`, `barcode`).
- [ ] **2.2 Instant Search in `PartySearchInput.tsx`**:
  - Query local `PartyRepository` first (resolves in <5ms).
  - When online, fire background search and merge results deduplicated by `id`.
  - Maintain full UI contract: $\ge 44$px touch targets, keyboard navigation (Arrow/Enter), and clear button.
- [ ] **2.3 Instant Search in `ProductSearchInput.tsx`**:
  - Point to local `ProductRepository` with exact SKU/barcode match acceleration.

### Phase 3: Push Sync Fidelity & Conflict Hardening
- [ ] **3.1 Full-Field Fidelity in `POST /api/sync/push`**:
  - Ensure party addresses, credit limits, tags, notes, and custom fields are persisted by the backend outbox processor (prevent silent field dropping).
- [ ] **3.2 Concurrency & Error Classification**:
  - Respect `baseVersion` on `UPDATE` mutations.
  - Distinguish transient network errors (retryable) from permanent 4xx validation errors (route to DLQ without burning retry budget).

### Phase 4: Shared Pure Ledger Engine & Parity Verification
- [ ] **4.1 Pure Ledger Calculation Engine in `src/lib/ledger`**:
  - Compute balances and ledger rows with integer paise arithmetic (`paiseMath`).
- [ ] **4.2 Golden Parity Tests**:
  - Unit tests verifying 100% parity between local calculation and `/parties/:id/ledger` responses across partial payments, discounts, and credit notes.
- [ ] **4.3 UI Provisional Badge**:
  - Mark running balance as `(Provisional)` until the outbox queue drains and server confirms ledger state.

---

## 4. Verification & DoD (Definition of Done)

1. **Mount to Data-Ready**: Customer list and invoice list render local data in $<15$ms on low-end device simulation.
2. **No False Empty State**: Opening an empty un-hydrated account shows a hydrating skeleton, not "No customers found".
3. **No Request Storms**: Switching tabs or focusing window does not fire duplicate `/parties` or `/documents` requests within 5 seconds.
4. **Instant Invoicing Search**: Autocomplete for customers and products responds within 1 frame ($<16$ms) from Dexie keystroke event.
5. **Zero Data Loss on Sync**: Customers created offline with addresses and credit limits retain 100% of fields when synced via `/push`.
