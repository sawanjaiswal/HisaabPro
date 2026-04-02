# Architecture Decision Records

> Decisions made for HisaabPro gold-standard architecture. Each ADR explains WHY, not just WHAT.

---

## ADR-001: TanStack Query over Redux/RTK Query

**Decision:** Use TanStack Query for server state, keep Zustand for client state.

**Alternatives considered:**
| Option | Pros | Cons |
|--------|------|------|
| RTK Query | Redux ecosystem, mature | Heavy boilerplate, overkill without Redux |
| SWR | Lightweight, Vercel-backed | No mutation support, no devtools, smaller community |
| TanStack Query | Zero boilerplate, devtools, optimistic updates, SSE-friendly | New dependency |
| Keep useState+useEffect | No migration work | Stale data, manual cache, no optimistic updates |

**Why TanStack Query:**
- Declarative cache invalidation (`invalidateQueries`) integrates naturally with SSE events
- Optimistic updates built-in (critical for offline-first UX)
- `staleTime` + `gcTime` eliminate unnecessary refetches on slow 2G connections
- Devtools make debugging cache state trivial
- 50KB gzipped — acceptable for a 440KB bundle

**Why NOT replace Zustand:**
- Zustand handles client-only state (theme, language, UI toggles, offline queue status)
- TanStack Query handles server-synced state (invoices, parties, products)
- Clear separation: "Where does this data come from?" Server → TQ. Client → Zustand.

---

## ADR-002: SSE over WebSocket

**Decision:** Use Server-Sent Events, not WebSocket or Socket.io.

**Alternatives considered:**
| Option | Pros | Cons |
|--------|------|------|
| WebSocket | Bidirectional, low latency | Complex server setup, proxy issues, Render limits |
| Socket.io | Auto-reconnect, rooms | 60KB bundle, complex, overkill for broadcasts |
| SSE | Simple, auto-reconnect, HTTP/2 multiplexed, proxy-friendly | Unidirectional (server → client only) |
| Polling (30s) | Simplest | 30s delay, unnecessary requests, battery drain on mobile |

**Why SSE:**
- We only need server → client push (client → server goes through REST API)
- SSE auto-reconnects natively (no library needed)
- Works through Cloudflare, Nginx, CDN proxies (WebSocket doesn't always)
- Render supports SSE natively
- ~0 bytes added to frontend bundle (browser EventSource API)
- HTTP/2 multiplexes SSE with regular requests on same connection

**Fallback:** If SSE connection fails (corporate firewalls), fall back to 30s polling automatically.

---

## ADR-003: Soft Delete Middleware over Per-Model Implementation

**Decision:** Use Prisma middleware for global soft delete, not per-model manual filtering.

**Why middleware:**
- One place to enforce, impossible to forget `isDeleted: false` in a query
- `prisma.party.delete()` automatically becomes soft delete — developers can't accidentally hard-delete
- New models automatically get soft delete when added to the whitelist
- Recycle bin is generic — one endpoint serves all entity types

**Risk:** Middleware adds ~1ms per query. Acceptable for our scale (< 1000 concurrent users target).

---

## ADR-004: Resource × Action Matrix over Flat Permission Strings

**Decision:** Replace `String[]` permissions with `RoleGrant` table (resource × action).

**Why:**
- Current: Adding "Godown" feature requires updating every existing role's permission array
- New: Add "godown" resource. Existing roles auto-deny until explicitly granted.
- UI: Checkbox grid (resource rows × action columns) is intuitive for business owners
- Backward-compatible migration — old String[] mapped to new format

**Why NOT RBAC library (like CASL):**
- CASL adds 30KB to bundle and is overkill for 16 resources × 5 actions
- Our permission check is a single DB lookup cached per-request
- Custom implementation is ~50 lines of code

---

## ADR-005: Last-Write-Wins over CRDT for Offline Conflicts

**Decision:** Use Last-Write-Wins with conflict notification, not CRDTs or field-level merge.

**Why:**
- Target users are micro/small businesses with 1-5 employees
- Simultaneous offline edits to the SAME record are extremely rare
- CRDTs add significant complexity (Yjs/Automerge = 100KB+ bundle)
- Field-level merge requires deep schema knowledge and custom merge functions per model
- LWW + notification is simple, debuggable, and covers 99% of cases

**Trade-off accepted:** In rare conflict cases, the offline user's changes are rejected (not silently overwritten). They see a notification and can manually re-apply. This is the same behavior as Google Docs when two users edit the same paragraph offline.

---

## ADR-006: Neon Connection Pooler over Self-Hosted PgBouncer

**Decision:** Use Neon's built-in PgBouncer, not a self-hosted connection pooler.

**Why:**
- Neon includes PgBouncer at no extra cost (`?pgbouncer=true` in connection string)
- Zero ops overhead — no separate service to deploy, monitor, or maintain
- Supports transaction-mode pooling (Prisma-compatible)
- `directUrl` for migrations bypasses the pooler (Prisma requirement)

---

## ADR-007: Feature Gating via Middleware over Feature Flags

**Decision:** Enforce subscription tiers via server middleware, not client-side feature flags.

**Why:**
- Client-side feature flags can be bypassed (inspect element, direct API calls)
- Server middleware returns 402 — impossible to bypass
- Frontend reads plan from auth context, shows/hides UI accordingly (UX only, not security)
- Business logic for limits (50 invoices/month) must be server-enforced

**Pattern:**
```
Server: requireFeature('gst')  → 402 if not Pro+
Client: if (plan !== 'free') show GSTTab  → UX convenience only
```

---

## ADR-008: Export as Background Job over Synchronous Download

**Decision:** Full data export runs as a background job, not a synchronous response.

**Why:**
- A business with 10,000 invoices + 5,000 parties = large dataset
- Synchronous export would time out on Render (30s request limit)
- Background job generates ZIP, uploads to temp storage, returns signed download URL
- User sees "Export started. We'll notify you when it's ready." (good UX for slow 2G)

**Implementation:** Not using a job queue (Bull/BullMQ) — overkill for 1 export/day. Simple async function with in-memory tracking.

---

## ADR-009: Redis as Required Infrastructure (not Optional)

**Decision:** Redis (Upstash) is a required production dependency.

**Current state:** Rate limiting uses in-memory store with optional Redis. Token blacklist is in-memory. SSE is in-memory.

**Why required:**
- In-memory stores don't work across multiple server instances (horizontal scaling)
- Rate limiting must be shared (attacker can hit different instances)
- SSE pub/sub needs cross-instance communication
- Token blacklist must survive server restarts
- Session cache improves auth middleware performance (avoid DB hit per request)

**Provider choice: Upstash over self-hosted**
| Option | Pros | Cons |
|--------|------|------|
| Upstash | Serverless, free tier (10K cmd/day), zero ops, pay-per-use | Slight latency vs co-located |
| Redis Cloud | Managed, generous free tier | More complex setup |
| Self-hosted on Render | Co-located, low latency | Ops burden, no persistence guarantees |

Upstash wins: zero ops, scales automatically, free tier sufficient for early stage.

**Fallback:** In-memory stores remain for local development. Feature parity — same interface, different backend.

---

## ADR-010: Accept Header API Versioning over URL Versioning

**Decision:** Use `Accept: application/json; version=2` header, not `/api/v1/` URL prefix.

**Alternatives:**
| Option | Pros | Cons |
|--------|------|------|
| URL versioning (/v1/, /v2/) | Obvious, cacheable | Duplicates all routes, breaks bookmarks, ugly |
| Accept header | Clean URLs, no route duplication | Less discoverable |
| Query param (?version=2) | Easy to test | Pollutes cache keys, not RESTful |
| No versioning | Simple | Breaking changes break all clients |

**Why Accept header:**
- Routes stay clean (/api/invoices, not /api/v2/invoices)
- Single route handler can branch on version when needed
- Defaults to latest if no header (new clients get latest automatically)
- Old Capacitor app builds in the wild keep working with explicit version header
- Industry standard (GitHub API, Stripe API use similar patterns)

**Sunset policy:** Old versions supported for 6 months. Deprecation header returned for 3 months before removal.

---

## ADR-011: FCM Push for Mobile Real-Time instead of SSE

**Decision:** Use FCM push notifications for real-time on Capacitor/mobile. SSE only for web browsers.

**Why not SSE on mobile:**
- Android/iOS kill background connections to save battery
- Capacitor WebView doesn't reliably maintain SSE connections when app is backgrounded
- FCM is battery-efficient (uses OS-level push infrastructure)
- FCM works even when app is closed

**Pattern:**
```
Web browser → SSE (persistent connection, instant updates)
Mobile app  → FCM push (OS-managed, battery-efficient)
Both        → Full refetch on foreground resume (catch anything missed)
```

**Trade-off:** FCM adds ~2-5 second delay vs SSE's ~0.5s. Acceptable for mobile users who are switching between apps.

---

## ADR-012: Anonymize over Hard-Delete for DPDP Right-to-Erasure

**Decision:** When a user requests data deletion under DPDP Act 2023, anonymize personal data but retain financial records.

**Conflict:** DPDP Act requires right-to-erasure. GST law requires 6-8 year retention of financial records.

**Resolution:**
- Personal data (name, phone, email, address) → anonymized ("Deleted User", "XXXXXXXXXX")
- Financial data (invoices, payments, ledger entries) → retained with anonymized party references
- Audit trail → retained (who/when, but personal identifiers anonymized)
- This satisfies both laws: personal data is erased, financial records are intact

**Legal basis:** Section 8(8) of DPDP Act 2023 allows retention when "necessary for compliance with any law." GST Act Section 35 requires records for 72 months.

**Implementation:** `DELETE /api/me/data` → runs anonymization job → confirms deletion → user account deactivated.

---

## ADR-013: Response Field Filtering over View-Based Permissions

**Decision:** Restrict sensitive fields (purchasePrice, profitMargin) via response middleware, not database views or separate endpoints.

**Alternatives:**
| Option | Pros | Cons |
|--------|------|------|
| DB views per role | Strong isolation | Prisma doesn't support views well, complex |
| Separate endpoints (/invoices/cashier-view) | Explicit | Route explosion, maintenance nightmare |
| Response middleware filtering | One middleware, works on any endpoint | Runs after query (slight overhead) |
| Prisma select per role | DB-level filtering | Every query needs role-aware select |

**Why response middleware:**
- Single implementation point — `filterRestrictedFields('invoice')` on route
- Works on both list and detail endpoints
- Doesn't affect DB query performance
- Easy to add new restricted fields without changing queries
- Restricted field config is centralized in one file

**Trade-off:** Fetches full data from DB then strips fields. For our scale (< 10K users), the ~1ms overhead is irrelevant. At scale, move to Prisma select-based filtering.

---

## ADR-014: Unified Error Code Registry

**Decision:** All API errors return a machine-readable error code from a centralized registry.

**Current state:** Errors return mixed formats — sometimes `{ error: 'string' }`, sometimes `{ message: 'string' }`, sometimes `{ success: false, error: 'string' }`.

**Gold standard format:**
```json
{
  "success": false,
  "error": {
    "code": "HP-409-001",
    "message": "This invoice was modified by another user while you were offline.",
    "details": { "serverUpdatedAt": "2026-04-02T10:00:00Z" }
  }
}
```

**Code format:** `HP-{HTTP_STATUS}-{SEQUENCE}`
- `HP-400-001` — Validation failed
- `HP-401-001` — Token expired
- `HP-401-002` — Token blacklisted
- `HP-402-001` — Upgrade required (feature gate)
- `HP-402-002` — Quota exceeded
- `HP-403-001` — Permission denied
- `HP-403-002` — Business inactive
- `HP-404-001` — Resource not found
- `HP-409-001` — Conflict (offline sync)
- `HP-429-001` — Rate limited

**Why centralized:**
- Frontend can switch on error code for specific handling (show upgrade modal for HP-402-001)
- i18n: error messages can be translated by code
- Debugging: grep logs by error code
- Documentation: single source of all possible errors

**Migration:** Existing `sendError()` utility updated to accept error code. Old format still works (backward compatible).
