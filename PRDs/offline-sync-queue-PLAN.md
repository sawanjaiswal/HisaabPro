# Mission Plan: Offline Sync Queue | Status: Awaiting Approval

> **PRD #:** 9
> **Date:** 2026-03-17
> **Owner:** Sawan Jaiswal
> **Scope:** Frontend-only — offline mutation queue + sync processor + UI indicator
> **Depends On:** `useOnlineStatus` (exists), Dexie (installed), `api.ts` wrapper (exists)
> **Blocks:** Nothing (enhancement layer)

---

## 1. What

When the user performs a mutation (create/update/delete) while offline, the operation is queued in IndexedDB and automatically replayed in FIFO order when connectivity returns. A small UI indicator shows pending/failed sync items so the user always knows their data status.

---

## 2. Domain Model

### Entity: SyncQueueItem (IndexedDB via Dexie)

| Field | Type | Description |
|-------|------|-------------|
| id | string (auto-increment) | Unique queue item ID |
| method | 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE' | HTTP method |
| path | string | API path (e.g. `/parties/abc123`) |
| body | string \| null | JSON-serialised request body |
| createdAt | number | Unix timestamp ms |
| status | 'pending' \| 'syncing' \| 'failed' \| 'dead' | Current state |
| retryCount | number | Times this item has been retried |
| errorMessage | string \| null | Last error message (for UI display) |
| entityType | string | Human-readable label (e.g. "party", "invoice") |
| entityLabel | string | Display name (e.g. "Raju Traders", "INV-0042") |

### State Machine

```
pending ──(processor picks up)──> syncing
syncing ──(2xx response)──> [DELETED from queue]
syncing ──(4xx/5xx/timeout)──> failed
failed ──(retryCount < 3)──> pending (auto-retry with backoff)
failed ──(retryCount >= 3)──> dead
dead ──(user clicks Retry)──> pending (retryCount reset)
dead ──(user clicks Discard)──> [DELETED from queue]
```

---

## 3. User Flows

### Happy Path (offline mutation)
1. User is offline (OfflineBanner visible)
2. User taps "Delete Party" → ConfirmDialog → confirms
3. `api()` call fails with network error
4. Operation queued in IndexedDB → toast: "Saved offline — will sync when back online"
5. SyncQueueIndicator shows "1 pending"
6. Network returns → processor replays DELETE → success
7. Item removed from queue → toast: "All changes synced"
8. Indicator disappears

### Error Path (sync fails)
1. Queue replays POST → server returns 409 Conflict
2. Item marked `failed`, retryCount incremented
3. After 3 retries → marked `dead`
4. SyncQueueIndicator shows "1 failed" in red
5. User taps indicator → sees failed item with error message
6. User taps "Retry" → item reset to `pending`
7. OR user taps "Discard" → item deleted from queue

### Edge: Queue while syncing
1. User is back online, queue processing item #1
2. User goes offline again before item #2 processes
3. Processor stops after current item
4. Resumes when online again

---

## 4. API Contract

No new API endpoints. The sync queue replays existing API calls using `api()` wrapper.

### Modified: `src/lib/api.ts`
- On network error during mutation (POST/PUT/PATCH/DELETE):
  - If `options.offlineQueue !== false` (opt-out flag):
    - Queue the operation
    - Return a synthetic success response (optimistic)
    - Show toast
  - If `options.offlineQueue === false`:
    - Throw normally (for auth endpoints, etc.)

---

## 5. Data Model

No Prisma changes. IndexedDB only.

```typescript
// Dexie schema
db.version(1).stores({
  syncQueue: '++id, status, createdAt'
})
```

---

## 6. UI States

### SyncQueueIndicator (shows in OfflineBanner area)
- **Empty (0 items)**: Hidden — nothing to show
- **Pending (N items)**: Amber dot + "N pending" — shows during offline
- **Syncing**: Spinning icon + "Syncing N..." — shows during replay
- **All synced**: Brief "All synced" toast → indicator hidden
- **Failed (N dead items)**: Red dot + "N failed" — tappable to see details
- **Mixed (pending + failed)**: Shows both counts

### SyncQueueDrawer (opened by tapping indicator)
- List of queued items with: icon, entityLabel, method badge, status badge, timestamp
- Failed items show error message + Retry/Discard buttons
- "Clear All" button (with confirmation) for dead items

---

## 7. Mobile

- 375px: Indicator as small chip in OfflineBanner row
- 320px: Abbreviated — just dot + count, no text
- Drawer: Full-width bottom sheet on mobile
- Touch targets: All buttons 44px+

---

## 8. Edge Cases

| Scenario | Handling |
|----------|---------|
| App killed while syncing | Item stays `syncing` — on app restart, reset `syncing` → `pending` |
| Same entity queued twice | Both replay in order — server handles idempotency |
| Queue > 100 items | Reject new items, toast: "Too many offline changes. Please connect to sync." |
| Auth expired during sync | Stop processing, don't mark items as failed (auth issue, not data issue) |
| Server 400 (validation) | Mark `dead` immediately (no retry — data is invalid) |
| Server 5xx | Retry with backoff |
| DELETE followed by UPDATE on same entity | Both replay — DELETE succeeds, UPDATE 404s → marked dead (acceptable) |

---

## 9. Constraints

- Max queue size: 100 items
- Max retries: 3 per item
- Retry backoff: 1s, 3s, 9s (exponential)
- Sequential replay (FIFO) — never parallel
- No temp ID remapping (MVP limitation)
- Auth endpoints excluded from queueing (`/auth/*`)

---

## 10. Out of Scope

- Read-side offline caching (GET → IndexedDB)
- Service worker integration
- Conflict resolution UI
- Temporary ID remapping for create → reference chains
- Offline-created entities referenced by other offline operations
- Server-side optimistic locking / version fields

---

## 11. Build Plan

### Batch A — Core Library (no UI)

| # | File | Action | Lines |
|---|------|--------|-------|
| 1 | `src/lib/offline.types.ts` | CREATE | ~30 |
| 2 | `src/lib/offline.constants.ts` | CREATE | ~15 |
| 3 | `src/lib/offline.ts` | CREATE — Dexie DB + queue CRUD + sync processor | ~120 |
| 4 | `src/lib/api.ts` | MODIFY — add offline queue interceptor on mutation failures | ~20 added |

### Batch B — React Integration

| # | File | Action | Lines |
|---|------|--------|-------|
| 5 | `src/hooks/useSyncQueue.ts` | CREATE — hook exposing queue state + actions | ~50 |
| 6 | `src/components/feedback/SyncQueueIndicator.tsx` | CREATE — indicator chip | ~60 |
| 7 | `src/components/feedback/SyncQueueDrawer.tsx` | CREATE — expandable queue list | ~80 |
| 8 | `src/components/feedback/sync-queue.css` | CREATE — styles | ~60 |
| 9 | `src/components/feedback/OfflineBanner.tsx` | MODIFY — integrate indicator | ~10 added |

### Batch C — Wire + Verify

| # | File | Action |
|---|------|--------|
| 10 | `tsc --noEmit` | Verify |
| 11 | `npm run build` | Verify |

---

## 12. Acceptance Criteria

- [ ] Mutation while offline → queued in IndexedDB
- [ ] Toast shows "Saved offline" on queue
- [ ] SyncQueueIndicator shows pending count
- [ ] Queue replays FIFO when online
- [ ] Failed items retry 3x with backoff
- [ ] Dead items show in drawer with Retry/Discard
- [ ] Auth endpoints excluded from queueing
- [ ] Queue capped at 100 items
- [ ] App restart recovers stuck `syncing` items
- [ ] "All synced" toast when queue empties
- [ ] tsc clean + build passes
- [ ] Works on 375px and 320px
