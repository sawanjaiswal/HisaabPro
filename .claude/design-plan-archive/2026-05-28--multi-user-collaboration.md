---
status: approved
feature: multi-user-collaboration
created: 2026-05-28T10:01:14Z
approved_at: 2026-05-28T10:46:48Z
approver: Sawan
session: bare-152458
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
files_planned:
  # --- schema + migration (high-risk): add monotonic `version Int` (M2) ---
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  # --- backend: optimistic-lock as a CONDITIONAL WRITE in each update service (M1) ---
  - server/src/services/document/update.ts
  - server/src/services/document/update-recompute.ts
  - server/src/services/payment/update-delete.ts
  - server/src/services/party/update-delete.ts
  - server/src/services/product/crud.ts
  - server/src/lib/optimistic-lock.ts
  # --- backend: presence + per-row realtime ---
  - server/src/services/presence/presence.types.ts
  - server/src/services/presence/presence.store.ts
  - server/src/services/presence/presence.service.ts
  - server/src/routes/presence.routes.ts
  - server/src/lib/sse-notifications.ts
  - server/src/services/sse.service.ts
  - server/src/middleware/conflict-detection.ts
  - server/src/app.routes.ts
  - server/src/schemas/presence.schemas.ts
  # --- frontend: 409 reconcile UX + presence indicators ---
  - src/lib/api.ts
  - src/features/collaboration/collaboration.types.ts
  - src/features/collaboration/collaboration.constants.ts
  - src/features/collaboration/presence.service.ts
  - src/features/collaboration/hooks/usePresence.ts
  - src/features/collaboration/hooks/useConflictReconcile.ts
  - src/features/collaboration/components/PresenceAvatars.tsx
  - src/features/collaboration/components/ConflictDialog.tsx
  - src/features/collaboration/collaboration.css
  - src/hooks/useSSE.ts
  - src/lib/translations.en.ext51.ts
  - src/lib/translations.hi.ext51.ts
  - src/lib/translations.ts
  # --- decision record ---
  - docs/EPIC_multi-user-collaboration/DECISION_crdt_vs_lww.md
agents_invoked:
  - architecture-auditor (output: docs/EPIC_multi-user-collaboration/architecture-critique.md, verdict: PASS)
  - security (output: docs/EPIC_multi-user-collaboration/security-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-28T09:59:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: "3 MUST_FIX — M1 TOCTOU lost-update (middleware pre-check ≠ lock); M2 use version Int not updatedAt; M3 strict-gt moot after M1/M2"
  - ts: 2026-05-28T09:59:00Z
    critic: security
    verdict: REVISE
    revision: 1
    findings: "3 MUST_FIX collapse to oracle-free response contract (M1 cross-tenant existence oracle 404-vs-200; M2 SSE emit businessId from token + .strict Zod); 3 SHOULD_FIX (overwrite authz+audit, heartbeat DoS cap)"
  - ts: 2026-05-28T10:05:18Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    findings: "all 3 MUST_FIX closed; 1 non-blocking SHOULD_FIX (S4: DELETE /leave on visibilitychange/pagehide to avoid ≤45s ghost editors)"
  - ts: 2026-05-28T10:05:18Z
    critic: security
    verdict: PASS
    revision: 2
    findings: "all MUST_FIX + SHOULD_FIX closed; 1 non-blocking NIT (acceptance test asserting 409-on-foreign-id has oracle-free shape, no updatedBy/serverVersion; read updatedBy off the matched row)"
acceptance:
  backend:
    - tsc clean
    - "curl 200 presence heartbeat (authed)"
    - "curl 401 presence without cookie"
    - "curl 409 stale X-Entity-Version on PUT (conditional-write lock fires)"
    - "curl 200/empty-shape parity: presence GET for foreign entityId == own empty record (no oracle)"
  frontend:
    - "screenshots: presence-avatars · conflict-dialog · empty (solo) · success"
    - 320px tested
    - console clean
---

# Multi-User Real-Time Collaboration (#150) — Plan

## 0. The decision this spike exists to make: CRDT vs LWW

**Recommendation: Last-Write-Wins with optimistic locking (reject-and-reconcile).
NOT CRDT.** This is the load-bearing decision; everything else follows.

### Why NOT CRDT
CRDTs (or OT) shine for **concurrent free-form editing of a shared mutable
document** — Google-Docs text, Figma canvases, collaborative whiteboards —
where automatically *merging* two edits produces a sensible result and the
worst case is a slightly-wrong character order.

HisaabPro's entities are **discrete financial records**: an invoice's
`grandTotal`, a payment's `amount` (paise Int), a party's `openingBalance`.
Auto-merging these is not merely overkill — it is **actively dangerous**:

- Two users edit the same invoice's quantity. A CRDT LWW-register merge picks
  one silently; a CRDT counter/set merge could *sum* them. Either way the
  books are now wrong and **nobody was told**. For an accounting app this is a
  correctness incident, not a UX nit.
- Money demands an **audit trail and explicit human resolution**, not silent
  convergence. "Someone else changed this invoice — reload and re-check" is the
  *correct* behaviour, not a degraded one.
- CRDT carries permanent cost: per-field metadata (vector clocks / Lamport
  timestamps), tombstones that never garbage-collect cleanly, a merge function
  per entity type, and a client library (Yjs/Automerge ~50-100KB) — on Rs
  8-15K Android phones over 2G/3G (see CLAUDE.md persona constraints). The
  offline queue already serialises a single device's mutations FIFO; the only
  true concurrency is *across devices*, which LWW+lock handles.

### Why LWW + optimistic lock fits the domain AND the existing code
The infra is **already 80% built** (Explore confirmed):
- Every mutable entity (`Invoice`/`Document`, `Payment`, `Party`, `Product`)
  already has `@updatedAt`.
- `server/src/middleware/conflict-detection.ts` already compares a client
  `X-Updated-At` header against the DB row and returns **409** if the DB is
  newer — but **the client never sends the header**, so it is dormant.
- SSE (`sse.service.ts` + `useSSE.ts`) already broadcasts per-business
  mutations and invalidates TanStack Query caches. Multi-user is already real
  via the `BusinessUser` table (#138).

So #150 is **incremental, not greenfield**. The work is: (1) *activate* the
dormant optimistic lock end-to-end with a real reconcile UX, (2) add
**presence** (who else is viewing/editing this record), (3) tighten SSE to a
**per-row** signal so an open editor learns "this record just changed".

### What we explicitly are NOT building (FUTURE_EPIC)
- Character-level co-editing of a notes field. (If ever wanted, scope as its
  own CRDT-on-one-text-field epic — not the whole entity.)
- Operational-transform server. WebSocket upgrade (SSE is sufficient for
  presence + invalidation; bidirectional not needed — presence writes go over
  plain POST heartbeats).

---

## 1. Scope (MUST_SHIP)

1. **Optimistic-lock activation — as a CONDITIONAL WRITE, not a middleware
   pre-check (arch M1).** The dormant `conflict-detection.ts` reads `updatedAt`
   in middleware, but the real `.update()` runs ~tens-of-ms later in a separate,
   non-transactional statement (`document/update.ts`, `payment/update-delete.ts`,
   `party/update-delete.ts`, `product/crud.ts`). Two requests can both clear the
   gate then the second clobbers the first — a lost update **by construction**.
   The fix: a shared `optimistic-lock.ts` helper does the lock in the write
   itself — `updateMany({ where: { id, businessId, version: expected }, data:
   { ...patch, version: { increment: 1 } } })`; `count === 0` → **409**. The
   middleware downgrades to a fast pre-check only (cheap early-reject; never the
   source of truth). Client sends the integer `version` (header `X-Entity-Version`).
   On **409** the client opens a `ConflictDialog`: **Reload** (discard local,
   refetch) or **Overwrite** (re-send with the server's fresh `version` —
   explicit). No silent merge, ever.
   - **Overwrite is permission-gated + audited (sec S1):** server requires the
     entity's edit permission AND persists the clobbered prior value (audit row /
     existing audit-emit path) so an overwrite is recoverable, not a silent
     destruction of another user's financial edit.
2. **Presence.** A lightweight `presence.store` (in-memory, per-business,
   `Map<businessId, Map<userId, {entityType, entityId, mode, lastSeen}>>`).
   Heartbeat POST every 20s while a record is open; TTL-expire at 45s. Broadcast
   presence deltas over the **existing SSE channel** as a new event type
   `presence`. `PresenceAvatars` renders the other viewers/editors on detail &
   edit screens.
   - **Oracle-free + bounded (sec M1/M2/S2):** every presence read AND the
     heartbeat write first validate that `entityId` belongs to
     `req.user.businessId` (token, never body) BEFORE touching the store. A
     foreign or non-existent `entityId` returns an **identical** response to
     "no peers" — same status, same body shape — so there is no 404-vs-200
     existence oracle across tenants. SSE emit `businessId` is the token value,
     never the heartbeat body; the heartbeat Zod schema is `.strict()`.
     Heartbeat is auth-gated, server-side rate-limited, and the store caps
     entries per user (reject beyond cap) so it can't be inflated into a memory
     DoS.
3. **Per-row realtime.** Extend the SSE mutation event to carry `entityId` (it
   already carries `entityType`). `useSSE` invalidates the specific query key;
   an open editor for that exact row shows a non-blocking "updated — reload"
   banner instead of silently diverging.

## 2. File Plan

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/schema.prisma | modify | +4 | schema — **add `version Int @default(0)` to Document, Payment, Party, Product** (arch M2) |
| server/prisma/migrations/** | create | ~12 | migration: add column NULL→default 0 backfill→NOT NULL (already has default, single step) |
| server/src/lib/optimistic-lock.ts | create | ~70 | shared conditional-write helper: `updateWithLock(model, {id, businessId, version}, patch)` → throws 409 on count===0 (arch M1) |
| server/src/services/document/update.ts | modify | +12 | route mutation through `updateWithLock` |
| server/src/services/document/update-recompute.ts | modify | +8 | same |
| server/src/services/payment/update-delete.ts | modify | +10 | same |
| server/src/services/party/update-delete.ts | modify | +10 | same |
| server/src/services/product/crud.ts | modify | +10 | same |
| server/src/services/presence/presence.types.ts | create | ~40 | types |
| server/src/services/presence/presence.store.ts | create | ~90 | in-memory store + TTL sweep |
| server/src/services/presence/presence.service.ts | create | ~110 | orchestration + SSE emit |
| server/src/schemas/presence.schemas.ts | create | ~40 | Zod (entityType enum, entityId cuid, mode) |
| server/src/routes/presence.routes.ts | create | ~70 | POST /heartbeat, DELETE /leave, GET /:entityType/:entityId |
| server/src/lib/sse-notifications.ts | modify | +20 | add `presence` event + `entityId` on mutation event |
| server/src/services/sse.service.ts | modify | +15 | typed broadcast helper |
| server/src/middleware/conflict-detection.ts | modify | +10 | extend to Document/Invoice route group; keep header-absent = pass |
| server/src/app.routes.ts | modify | +2 | mount /api/presence |
| src/lib/api.ts | modify | +18 | send `X-Updated-At` on PUT/PATCH when caller passes `expectedUpdatedAt`; surface 409 as typed `ConflictError` |
| src/features/collaboration/collaboration.types.ts | create | ~50 | types |
| src/features/collaboration/collaboration.constants.ts | create | ~30 | heartbeat interval, TTL, mode enum |
| src/features/collaboration/presence.service.ts | create | ~70 | api() heartbeat/leave/list |
| src/features/collaboration/hooks/usePresence.ts | create | ~110 | heartbeat lifecycle + SSE subscribe |
| src/features/collaboration/hooks/useConflictReconcile.ts | create | ~90 | catch ConflictError → dialog state |
| src/features/collaboration/components/PresenceAvatars.tsx | create | ~90 | stacked avatars + tooltip |
| src/features/collaboration/components/ConflictDialog.tsx | create | ~120 | Reload / Overwrite, 4-state |
| src/features/collaboration/collaboration.css | create | ~80 | tokens only |
| src/hooks/useSSE.ts | modify | +25 | route `presence` events + per-row invalidation |
| src/lib/translations.en.ext51.ts / .hi.ext51.ts | create | ~50 ea | i18n |
| src/lib/translations.ts | modify | +4 | spread ext51 |
| docs/EPIC_multi-user-collaboration/DECISION_crdt_vs_lww.md | create | ~120 | the decision record (this §0 expanded) |

Every row ≤250 lines. Presence store/service split keeps each <150.

## 3. Data / schema

**Add `version Int @default(0)` to Document, Payment, Party, Product (arch M2).**
Both critics rejected reusing `updatedAt` as the lock token, and they were
right: `@updatedAt` is set by Prisma (client/app clock, skew-prone), may be
skipped on no-op writes, and has only ms granularity. A monotonic integer
incremented **inside the same conditional UPDATE** is exact, cheap, and
collision-free. Migration is single-step (column has a default, so no
add-NULL→backfill→NOT-NULL dance): `ALTER TABLE ... ADD COLUMN version INTEGER
NOT NULL DEFAULT 0`. Existing rows get 0; the first locked write moves them to 1.

The lock lives in the **write**, not the middleware (arch M1): `updateMany({
where: { id, businessId, version: expected }, data: { ...patch, version: {
increment: 1 } } })`. `count === 0` means either the row moved on (real
conflict) or it isn't the caller's (scoping) — both → 409, no distinction
leaked. `conflict-detection.ts` stays only as a cheap pre-check.

Presence is **ephemeral, in-memory** (server process state, TTL-swept) —
deliberately NOT persisted: worthless after 45s, and a DB table would add write
load + a cleanup job for zero benefit. Presence correctly evaporates on deploy.

> **Single-instance guard (arch S, sec FUTURE_EPIC):** Render runs 1 web
> instance today. `presence.store` is an interface with a loud startup log
> asserting single-instance; the Redis pub/sub adapter is a documented
> FUTURE_EPIC seam (swap is local to the store). The high-risk gate fires
> because `files_planned` lists schema.prisma — and now it genuinely changes.

## 4. API contracts

- `POST /api/presence/heartbeat` `{entityType, entityId, mode:'viewing'|'editing'}`
  (Zod `.strict()`) → `200 {peers: PresencePeer[]}`. Auth + business-scoped.
  `businessId` from token. Ownership of `entityId` validated **before** any
  store write; foreign/unknown `entityId` → the SAME response as "no peers"
  (no oracle). Server-side rate-limited; per-user entry cap enforced.
- `DELETE /api/presence/leave` `{entityType, entityId}` → `204` (idempotent;
  identical for foreign/unknown — no oracle).
- `GET /api/presence/:entityType/:entityId` → `200 {peers}` for owned rows and
  the **identical** `200 {peers: []}` for foreign/unknown ids (sec M1).
- Mutation PUT/PATCH unchanged in shape; client sends header `X-Entity-Version`
  (integer). **409** body `{code:'CONFLICT', serverVersion, updatedBy}` when the
  conditional write matches 0 rows. Overwrite re-sends with `serverVersion`,
  requires the entity edit permission, and the clobbered value is persisted.

## 5. Security cuts (resolves security-critique MUST_FIX 1-2, SHOULD_FIX 1-2)
Presence broadcasts **who is looking at which record** — a cross-tenant leak
if scoping slips. Hard rules:
- `businessId` for every presence read/write comes from `req.user.businessId`
  (token), **never** from the body; heartbeat schema is Zod `.strict()` (sec M2).
- **Oracle-free contract (sec M1):** `entityId` ownership is validated against
  the caller's `businessId` BEFORE any store read OR write. A foreign or
  non-existent id returns the **identical** status + body shape as a legitimately
  empty record (`200 {peers: []}`) — no 404-vs-200 distinction, so an attacker
  cannot enumerate cuids across tenants. The validation precedes the store write,
  so the write path is not a pollution/oracle vector either.
- SSE `presence` events are emitted only into the originating business's client
  set, keyed by the **token** `businessId` (reuse the per-business channel,
  don't widen).
- `ConflictDialog` "Overwrite" requires the entity edit permission (server-side)
  and **persists the clobbered prior value** (existing audit-emit path), so a
  deliberate overwrite of another user's financial edit is recoverable, not a
  silent loss (sec S1).
- Heartbeat is rate-limited and the in-memory store caps entries per user;
  excess is rejected so the `Map` can't be inflated into a memory DoS (sec S2).
- Presence peer payload carries `displayName` + `userId` only — no phone, no
  role internals (`userId` cuid already rides the existing SSE event).

## 6. Rollout
1. **Schema `version` column + `optimistic-lock.ts` conditional write FIRST**,
   wired through all four update services. Only THEN the client `X-Entity-Version`
   header + 409 `ConflictDialog`. Per arch M1: step 1 must NOT ship until the
   conditional write lands — otherwise we ship a safety feature that only *looks*
   like it works (the middleware pre-check alone still loses updates).
2. Presence service + avatars second.
3. Per-row SSE last (`sse.service.ts` already declares `entityId?`, so this is a
   refinement of working invalidation, not new transport).
Behind no flag — additive, degrades to today's behaviour if SSE drops (polling
fallback already exists).
FUTURE_EPIC seam: `presence.store` interface → Redis adapter when >1 instance.

## 7. Critic questions — RESOLVED
- **arch M1 (TOCTOU lost update):** lock moved into the conditional write
  (`updateMany WHERE version=expected`, count===0 → 409); middleware demoted to
  pre-check. ✔
- **arch M2 (token choice):** `updatedAt` rejected; added monotonic
  `version Int @default(0)`. ✔
- **arch M3 (strict-gt):** moot — comparison replaced by the conditional write. ✔
- **arch single-instance:** in-memory accepted for 1 instance with a loud
  single-instance startup guard + documented Redis seam. ✔
- **sec M1 (existence oracle):** uniform oracle-free response shape, ownership
  validated before any store touch. ✔
- **sec M2 (SSE scoping):** emit `businessId` from token + `.strict()` Zod. ✔
- **sec S1 (overwrite):** permission-gated + clobbered value persisted. ✔
- **sec S2 (heartbeat DoS):** rate-limit + per-user entry cap. ✔

### Non-blocking, fold into build (both critics PASS, these are SHOULD_FIX/NIT)
- **arch S4:** `usePresence` fires `DELETE /leave` on `visibilitychange`/
  `pagehide`, not TTL-only — avoids ≤45s ghost editors on mobile backgrounding.
- **sec NIT:** add an acceptance test asserting the 409-on-foreign-id path
  returns the oracle-free shape (no `updatedBy`/`serverVersion`), and read
  `updatedBy` off the matched row, never a separate unscoped lookup.
