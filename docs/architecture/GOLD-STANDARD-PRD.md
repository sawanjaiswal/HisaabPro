# Gold Standard Architecture — PRD

> **Status:** Draft — Pending Approval
> **Date:** 2026-04-02
> **Owner:** Sawan Jaiswal
> **Scope:** Architecture upgrades to reach production gold standard
> **Affects:** All 113 existing features + future phases

---

## 1. Why This Document Exists

HisaabPro has 113 features, 345 endpoints, 68 Prisma models, and 1114 tests. The feature set is competitive with Vyapar/MyBillBook. But the **architecture** has gaps that will cause failures at scale:

| Problem | When It Hits | Impact |
|---------|-------------|--------|
| No server-state cache (TanStack Query) | Day 1 with 2+ users | Stale data, duplicate fetches, manual refresh needed |
| No real-time sync | Day 1 with 2+ employees | Employee A doesn't see Employee B's changes |
| Flat permission arrays | Phase 4+ (new features) | Every new feature = update every role manually |
| Inconsistent soft delete | Day 1 in production | Some data hard-deleted, GST audit fails |
| No subscription gating | Monetization day | Free users access paid features |
| No conflict resolution | Offline user comes online | Duplicate/lost data |
| No data export for owners | First CA request | Business owner can't give data to accountant |

This PRD defines what "gold standard" means for each layer and what must change.

---

## 2. Architecture Principles (Non-Negotiable)

### P1: Single Source of Truth
```
PostgreSQL (Neon) → Express API → React Frontend
```
- DB is truth. Frontend is a viewer/editor.
- No local state treated as truth (except offline queue).
- Every mutation: `User Action → API → DB → Cache Invalidation → All Screens Update`.

### P2: Offline-First (India Constraint)
```
IndexedDB (Dexie) = local replica for reads
Sync Queue = ordered mutations waiting for connectivity
Conflict Resolution = deterministic merge on reconnect
```
- App MUST work fully offline on Rs 8K phones with 2G.
- Not "offline-tolerant" — offline-FIRST.

### P3: Multi-Tenant Isolation
```
Every data row has businessId
Every query filters by businessId
No cross-tenant data leakage — EVER
```

### P4: Defense in Depth
```
Rate Limiting → CSRF → Auth → Permission → Validation → Business Logic → Audit
```
- Every layer assumes the previous layer failed.

### P5: Immutable Audit
```
Who changed what, when, old value → new value
```
- Billing data has 6-8 year legal retention (GST).
- Hard delete = compliance violation.

### P6: API-First
```
All validation and logic → backend
Frontend = dumb UI that renders server state
```

---

## 3. Current State Assessment

### What's Already Gold Standard

| Area | Evidence |
|------|----------|
| Multi-tenant isolation | `businessId` on all models, filtered in every query |
| Auth stack | JWT httpOnly cookies, token blacklist, 2FA, WebAuthn, account lockout, CAPTCHA |
| Audit trail | Immutable `AuditLog` + `AdminAction` tables with diff tracking |
| Idempotency | `middleware/idempotency.ts` on documents, payments, stock, expenses, accounting |
| Security headers | Helmet + CSP + HSTS + CORP + COOP + replay protection |
| Rate limiting | 4-tier (api/auth/otp/sensitive), pluggable Redis store |
| Soft delete (partial) | Documents, Payments, StockMovements, Batches, SerialNumbers |
| Permission middleware | `requirePermission()` on all 133 mutation routes |
| Admin separation | Separate `AdminUser` table, JWT audience claim, dedicated routes |

### What's NOT Gold Standard

| Gap | Current State | Gold Standard |
|-----|--------------|---------------|
| **Server state management** | `useState + useEffect + manual refresh()` | TanStack Query (auto-cache, stale-while-revalidate, optimistic updates) |
| **Real-time sync** | None — page reload to see changes | SSE (Server-Sent Events) for multi-user sync |
| **Permission model** | `String[]` on Role | Resource × Action matrix with inheritance |
| **Soft delete coverage** | 6 models have it, ~62 don't | ALL business data models (GST compliance) |
| **Subscription gating** | No enforcement | Middleware that checks plan limits per-request |
| **Offline conflict resolution** | Basic sync queue | Last-Write-Wins with vector timestamps + user merge UI |
| **Data export** | None | CSV/Excel/Tally export for business owners |
| **Multi-device sessions** | No tracking | Active sessions list, force logout, device trust |
| **Connection pooling** | Direct Prisma connection | PgBouncer or Prisma connection pool config |

### 3.5 Observability Strategy

**Why:** Without observability, production issues are discovered by users, not by us. We need to know about failures before the first support call.

**Components:**

| Layer | Tool | What It Covers |
|-------|------|---------------|
| **Error Tracking** | Sentry (free tier: 5K events/mo) | Unhandled exceptions, API 5xx errors, frontend crashes |
| **Structured Logging** | Winston (already implemented) | Request/response logs, business events, audit trail |
| **Uptime Monitoring** | BetterUptime or UptimeRobot (free) | Ping `/api/health` every 60s, alert on 3 consecutive failures |
| **APM / Metrics** | Sentry Performance (bundled) | P95 latency per endpoint, slow queries, throughput |
| **Alerting** | Sentry + webhook to Telegram/Slack | Error spike > 10/min, uptime down, DB connection failures |

**Health Check Endpoints:**
```
GET /api/health          → { status: "ok", uptime, version }
GET /api/health/db       → Prisma $queryRaw SELECT 1 (< 100ms or WARN)
GET /api/health/redis    → Redis PING (if configured)
GET /api/health/deep     → All dependencies checked, returns degraded status per component
```

**What Gets Monitored:**
- All API 5xx responses (auto-captured by Sentry Express middleware)
- Slow queries > 500ms (logged as WARN)
- Auth failures > 10/min from same IP (rate limit evasion attempt)
- SSE connection count per business (memory leak detection)
- Sync queue depth > 100 (offline sync backlog)
- Subscription webhook failures (revenue impact)

**Success criteria:**
- Mean time to detect (MTTD) < 5 minutes for any production error
- Sentry dashboard shows error trends, not just individual errors
- Zero "black box" failures — every 5xx has a stack trace

---

### 3.6 Disaster Recovery

**Why:** Data is the business. If we lose a trader's invoice history, we lose their trust forever. Recovery must be fast and tested.

**Targets:**

| Metric | Target | How |
|--------|--------|-----|
| **RTO** (Recovery Time Objective) | < 1 hour | Render auto-deploys with instant rollback |
| **RPO** (Recovery Point Objective) | < 5 minutes | Neon continuous PITR (point-in-time recovery) |
| **Data Durability** | 99.99% | Neon managed PostgreSQL with replication |

**Backup Strategy:**
- **Continuous:** Neon PITR — recover to any point in the last 7 days (free) / 30 days (Pro)
- **Daily Snapshots:** Automated pg_dump to S3-compatible storage (Cloudflare R2, free 10GB)
- **Weekly:** Full export test — restore snapshot to a test branch (Neon branching)
- **Schema:** All migrations version-controlled in `server/prisma/migrations/`

**Recovery Runbook (reference: `docs/runbooks/disaster-recovery.md`):**
1. **App down (Render):** Check Render dashboard → redeploy last working commit → < 5 min
2. **DB corruption:** Neon PITR → restore to last known good timestamp → < 30 min
3. **Accidental data deletion:** Soft delete means data still exists. If hard-deleted: PITR restore → < 1 hour
4. **Full region outage (ap-south-1):** Neon failover to replica (Pro plan). Manual: restore daily snapshot to new region → < 2 hours

**Testing:**
- Monthly: Restore daily snapshot to Neon branch, verify data integrity
- Quarterly: Full disaster simulation (restore from backup, verify app works end-to-end)

---

## 4. Upgrades Required (Priority Order)

### 4.1 TanStack Query Migration (P0 — Do First)

**Why:** Every other upgrade depends on proper cache invalidation. Without TanStack Query, real-time sync, optimistic updates, and offline sync are impossible to build cleanly.

**What changes:**
- Install `@tanstack/react-query`
- Create `QueryClientProvider` at app root
- Replace every `useState + useEffect + fetch` pattern with `useQuery` / `useMutation`
- Keep Zustand for client-only state (UI preferences, offline queue status, theme)
- Implement mutation → invalidation pattern:
  ```
  mutate(data) → onSuccess: invalidateQueries(['invoices']) → auto-refetch
  ```

**Scope:** ~40 hooks across 29 feature modules need migration.

**Success criteria:**
- Zero manual `refresh()` calls remaining
- All list screens auto-update after create/edit/delete
- Stale data impossible without explicit opt-out
- Network tab shows cache hits (no duplicate requests)

---

### 4.2 Soft Delete Everywhere (P0 — Legal Compliance)

**Why:** Indian GST law requires 6-8 years of billing data retention. Hard-deleting any business data is a compliance violation. Currently only 6 models have soft delete.

**What changes:**
- Add `isDeleted Boolean @default(false)` + `deletedAt DateTime?` to ALL business data models:
  - Party, PartyGroup, PartyAddress, OpeningBalance
  - Product, Category, Unit, UnitConversion
  - DocumentNumberSeries, TermsAndConditionsTemplate
  - TaxCategory, HsnCode (business-scoped ones)
  - Expense, ExpenseCategory, OtherIncome
  - BankAccount, LedgerAccount, JournalEntry
  - Cheque, Loan, LoanTransaction
  - Role, StaffInvite
  - Godown, GodownStock, GodownTransfer
  - StockVerification, StockAlert
  - RecurringInvoice
  - CustomField
- Add `@@index([businessId, isDeleted])` to each
- Update ALL `findMany` / `findFirst` queries to include `where: { isDeleted: false }`
- Create `softDelete()` utility:
  ```typescript
  async function softDelete(model: string, id: string, userId: string) {
    await prisma[model].update({ where: { id }, data: { isDeleted: true, deletedAt: new Date() } });
    await auditLog({ action: 'DELETE', entityType: model, entityId: id, userId });
  }
  ```
- Add "Recycle Bin" capability to Party, Product, Expense (Documents + Payments already have it)

**Success criteria:**
- `grep -r "delete(" server/src/` returns ZERO hard deletes on business data
- Every soft-deleted record has an audit log entry
- Recycle bin accessible for all major entities

---

### 4.3 Real-Time Sync via SSE (P0 — Multi-User)

**Why:** When Employee A creates a bill, Employee B MUST see it without refreshing. This is table-stakes for multi-user apps. WebSockets are overkill — SSE is simpler, works through proxies, and auto-reconnects.

**What changes:**

**Backend:**
- New `server/src/services/sse.service.ts`:
  ```typescript
  // Per-business event bus
  const businessClients = new Map<string, Set<Response>>();

  function subscribe(businessId: string, res: Response) { ... }
  function broadcast(businessId: string, event: SSEEvent) { ... }
  ```
- New endpoint: `GET /api/events/stream` (SSE, auth required)
- Events emitted after every mutation:
  ```json
  { "type": "INVOICE_CREATED", "entityId": "xxx", "timestamp": 1234 }
  { "type": "PAYMENT_UPDATED", "entityId": "xxx", "timestamp": 1234 }
  { "type": "STOCK_ADJUSTED", "productId": "xxx", "timestamp": 1234 }
  ```
- Emit events from service layer (not routes) to capture all mutation paths

**Frontend:**
- New `src/hooks/useSSE.ts`:
  ```typescript
  function useSSE() {
    const queryClient = useQueryClient();
    useEffect(() => {
      const source = new EventSource('/api/events/stream', { withCredentials: true });
      source.onmessage = (e) => {
        const event = JSON.parse(e.data);
        // Invalidate relevant query cache
        queryClient.invalidateQueries({ queryKey: [event.type.split('_')[0].toLowerCase()] });
      };
      return () => source.close();
    }, []);
  }
  ```
- Mount `useSSE()` at app root — done. TanStack Query handles the rest.

**Fallback:** For offline/poor connectivity, polling every 30s as backup.

**Mobile (Capacitor) Note:**
- SSE is **web-only**. On Capacitor/native mobile, SSE connections are unreliable (killed by OS on background, battery drain).
- Mobile uses **push notifications (FCM)** for real-time events instead. Same event types, different transport.
- On foreground resume (`App.addListener('appStateChange')`), mobile triggers a full cache invalidation to catch missed events.
- Priority: Web SSE first, FCM integration in Phase C+1.

**Success criteria:**
- Open 2 browser tabs → create invoice in Tab A → Tab B shows it within 2 seconds
- SSE auto-reconnects after network drop
- No performance impact on server (SSE is lightweight)
- Mobile app shows fresh data within 3 seconds of foreground resume

---

### 4.4 Resource × Action Permission Matrix (P1)

**Why:** Current `String[]` permissions don't scale. Adding a new feature (e.g., "Godown") requires manually updating every role. A matrix scales automatically.

**Current:**
```json
["create_bill", "edit_bill", "delete_bill", "view_reports"]
```

**Gold standard:**
```typescript
// Role definition
{
  name: "Cashier",
  grants: {
    invoice:   ["create", "read"],
    payment:   ["create", "read"],
    product:   ["read"],
    report:    [],            // implicit deny
    party:     ["read"],
    settings:  [],            // implicit deny
  }
}
```

**What changes:**

**Schema:**
```prisma
model RoleGrant {
  id         String   @id @default(cuid())
  roleId     String
  resource   String   // "invoice", "payment", "product", etc.
  actions    String[] // ["create", "read", "update", "delete"]
  role       Role     @relation(fields: [roleId], references: [id])

  @@unique([roleId, resource])
}
```

**Middleware:**
```typescript
// Before: requirePermission("create_bill")
// After:  requirePermission("invoice", "create")
function requirePermission(resource: string, action: string) {
  return async (req, res, next) => {
    const grants = await getGrantsForUser(req.user);
    if (grants[resource]?.includes(action)) return next();
    return res.status(403).json({ success: false, error: 'Forbidden' });
  };
}
```

**Migration:** Map existing `String[]` to new RoleGrant rows. Backward-compatible — old format still works during transition.

**Resources (16):**
`invoice`, `payment`, `party`, `product`, `report`, `settings`, `expense`, `bank_account`, `journal`, `cheque`, `loan`, `godown`, `batch`, `serial_number`, `template`, `staff`

**Actions (5):**
`create`, `read`, `update`, `delete`, `export`

**Field-Level Permissions:**

Beyond resource × action, certain sensitive fields must be restricted per role. Example: a Cashier can view an invoice but should NOT see `purchasePrice` or `profitMargin`.

```typescript
// Field restriction config
const FIELD_RESTRICTIONS: Record<string, Record<string, string[]>> = {
  cashier: {
    invoice: ['purchasePrice', 'profitMargin', 'costPrice'],
    product: ['purchasePrice', 'supplierInfo'],
    report:  ['profitReport', 'marginAnalysis'],
  },
};

// Response filter middleware (applied AFTER route handler)
function filterRestrictedFields(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    const role = req.user.roleName;
    const resource = req.route.resource;
    const restricted = FIELD_RESTRICTIONS[role]?.[resource] || [];
    // Recursively null restricted fields in response
    return originalJson(nullifyFields(data, restricted));
  };
  next();
}
```

- Implemented as **response filter middleware**, NOT at DB level (queries stay simple).
- Config-driven: add field restrictions without code changes.
- Restricted fields return `null` (not omitted — frontend knows field exists but is hidden).

**Success criteria:**
- Adding a new feature = add 1 resource name. Existing roles auto-deny until granted.
- Role builder UI shows resource × action checkbox grid
- Zero changes needed to existing middleware signatures
- Cashier viewing invoice sees `purchasePrice: null` in response

---

### 4.5 Subscription Gating (P1 — Monetization)

**Why:** App is free until gating exists. No revenue without enforcement.

**Tiers (from Product Brief):**

| Feature Gate | Free | Pro (Rs 299/mo) | Business (Rs 599/mo) |
|---|---|---|---|
| Users per business | 1 | 3 | Unlimited |
| Invoices per month | 50 | Unlimited | Unlimited |
| GST features | No | Yes | Yes |
| Custom roles | No | Yes | Yes |
| Multi-godown | No | No | Yes |
| POS mode | No | No | Yes |
| Tally export | No | No | Yes |
| E-invoicing | No | No | Yes |
| Priority support | No | Yes | Yes |

**What changes:**

**Backend middleware:**
```typescript
// server/src/middleware/subscription-gate.ts
function requirePlan(minPlan: 'free' | 'pro' | 'business') {
  return async (req, res, next) => {
    const business = await getBusiness(req.user.businessId);
    const plan = business.subscription?.plan || 'free';
    if (PLAN_HIERARCHY[plan] >= PLAN_HIERARCHY[minPlan]) return next();
    return res.status(402).json({
      success: false,
      error: 'UPGRADE_REQUIRED',
      requiredPlan: minPlan,
      currentPlan: plan,
    });
  };
}

function requireQuota(resource: 'invoices' | 'users') {
  return async (req, res, next) => {
    const usage = await getMonthlyUsage(req.user.businessId, resource);
    const limit = PLAN_LIMITS[plan][resource];
    if (limit === -1 || usage < limit) return next();
    return res.status(402).json({
      success: false,
      error: 'QUOTA_EXCEEDED',
      resource, usage, limit,
    });
  };
}
```

**Frontend:**
- `useSubscription()` hook exposes current plan + limits
- Locked features show upgrade prompt (not hidden — show value)
- Usage meter in Settings (e.g., "23/50 invoices this month")

**Success criteria:**
- Free user hitting invoice #51 gets upgrade prompt, not silent failure
- Downgraded user retains data access (read-only) but can't create
- Razorpay webhook updates plan in real-time

---

### 4.6 Offline Conflict Resolution (P1)

**Why:** Current sync queue is fire-and-forget. If two users edit the same record offline, last write silently wins with no notification. Data loss.

**Strategy: Last-Write-Wins + Notification**

```
1. Every record has `updatedAt` timestamp
2. Offline mutations carry `clientUpdatedAt` (timestamp when user edited)
3. On sync, server compares:
   - If server.updatedAt <= client.clientUpdatedAt → apply (no conflict)
   - If server.updatedAt > client.clientUpdatedAt → CONFLICT
4. On conflict:
   - Server version wins (safety)
   - Client gets notification: "Invoice #45 was modified by Priya while you were offline. Your changes were not applied."
   - Client can view diff and re-apply manually
```

**What changes:**
- Add `clientUpdatedAt` to sync queue entries
- Server conflict detection in mutation handlers
- Frontend conflict notification UI (toast + diff viewer)
- Conflict log table for audit

**Not building (overkill for this market):**
- CRDTs
- Three-way merge
- Automatic field-level merge

**Success criteria:**
- Simulate: User A edits invoice offline, User B edits same invoice online. User A reconnects → gets conflict notification, not silent overwrite.

---

### 4.7 Multi-Device Session Management (P2)

**Why:** Indian users share phones. One device, multiple users. Need to see active sessions and force-logout.

**What changes:**

**Schema:**
```prisma
model Session {
  id           String   @id @default(cuid())
  userId       String
  deviceInfo   String   // "Samsung Galaxy A15, Chrome 120"
  ipAddress    String
  lastActiveAt DateTime @updatedAt
  createdAt    DateTime @default(now())
  isRevoked    Boolean  @default(false)
  user         User     @relation(fields: [userId], references: [id])

  @@index([userId, isRevoked])
}
```

**Endpoints:**
- `GET /api/sessions` — list active sessions
- `DELETE /api/sessions/:id` — revoke specific session
- `DELETE /api/sessions/all` — revoke all except current (panic button)

**Frontend:**
- Settings → Security → Active Sessions (device name, IP, last active, "Logout" button)

**Success criteria:**
- User can see all devices where they're logged in
- "Logout all devices" works within 1 token refresh cycle (max 15 minutes)

---

### 4.8 Data Export for Business Owners (P2)

**Why:** Legal right + trust feature. Business owners need to give data to CAs, switch apps, or just have a backup they control.

**Export formats:**
- **CSV** — parties, products, invoices, payments, expenses (one ZIP file)
- **Excel** — same as CSV but formatted with headers
- **Tally XML** — already built (feature #100)
- **PDF reports** — already built

**Endpoint:**
```
POST /api/export/full
→ Queues export job
→ Returns jobId
→ GET /api/export/:jobId/status
→ GET /api/export/:jobId/download (signed URL, 24h expiry)
```

**Limits:**
- 1 full export per day (prevent abuse)
- Streamed generation (don't load entire DB into memory)
- Owner-only permission

**Success criteria:**
- Business owner downloads ZIP with all their data in < 60 seconds
- Data is complete and accurate (matches what app shows)

---

### 4.9 Connection Pooling (P2)

**Why:** Prisma opens a connection per query by default. Under load (50+ concurrent users), this exhausts Neon's connection limit.

**What changes:**
- Configure Prisma connection pool:
  ```
  datasource db {
    url = env("DATABASE_URL")
    directUrl = env("DIRECT_URL") // for migrations
  }
  ```
- Set `connection_limit` in DATABASE_URL: `?connection_limit=10&pool_timeout=30`
- Add Neon's serverless driver for edge compatibility (future)

**Success criteria:**
- 100 concurrent requests handled without connection errors
- Average query latency < 50ms

---

## 5. Implementation Order

| Phase | Upgrade | Weeks | Dependencies |
|-------|---------|-------|-------------|
| **A** | 4.2 Soft Delete Everywhere | 1 | None — schema migration |
| **A** | 4.9 Connection Pooling | 0.5 | None — config change |
| **B** | 4.1 TanStack Query Migration | 2 | None — frontend only |
| **C** | 4.3 SSE Real-Time Sync | 1 | Depends on 4.1 (TanStack Query) |
| **C** | 4.5 Subscription Gating | 1 | None — but Razorpay keys needed |
| **D** | 4.4 Permission Matrix | 1.5 | None — backward compatible |
| **D** | 4.6 Offline Conflict Resolution | 1 | Depends on 4.1 (TanStack Query) |
| **E** | 4.7 Multi-Device Sessions | 0.5 | None |
| **E** | 4.8 Data Export | 1 | None |

**Total: ~9.5 weeks for gold standard.**

Phase A+B can run in parallel (backend + frontend).
Phase C+D can run in parallel.
Phase E is independent.

---

### 5.5 Zero-Downtime Migration Plan

**Principle:** All schema changes must be additive. Never remove columns, rename tables, or change types in a single deployment.

**Rules:**
1. **Add columns with defaults** — `ALTER TABLE ADD COLUMN x DEFAULT y` is non-blocking in PostgreSQL
2. **Never remove columns** in the same release that stops using them. Remove in release N+2 minimum.
3. **Never rename columns** — add new, migrate data, update code, deprecate old, remove later.
4. **Index creation** — use `CREATE INDEX CONCURRENTLY` (non-blocking). Prisma migrations need raw SQL for this.

**Specific Migration Plans:**

**RoleGrant Migration (Section 4.4):**
```
Week 1: Add RoleGrant table + migration script to populate from existing String[]
Week 1: Deploy new middleware that reads from RoleGrant (falls back to String[] if no grants)
Week 2: Verify all roles have RoleGrant rows. Monitor for permission denials.
Week 3: Remove fallback to String[] in middleware
Week 4: Mark old permissions String[] as @deprecated (keep in schema, stop writing)
Week 6: Remove String[] column from schema
```

**Session Table (Section 4.7):**
- New table, no existing data affected. Safe to add in single migration.
- On deploy: existing users continue working. Sessions created on next login.

**Soft Delete Columns (Section 4.2):**
- `isDeleted Boolean @default(false)` — additive, default false, no existing data changes.
- Add in batches: 10-15 models per migration to keep migration files manageable.
- Update queries AFTER migration is applied (same deploy is fine since default is false).

---

### 5.6 Compliance (DPDP Act 2023)

**Why:** India's Digital Personal Data Protection Act 2023 applies to any app collecting personal data of Indian users. Non-compliance penalties up to Rs 250 crore.

**Data Localization:**
- All data stored in Neon region `ap-south-1` (Mumbai). No cross-border data transfer.
- Backups also in Indian region (Cloudflare R2 Mumbai or Neon's built-in).
- Sentry data: configure to use EU/India region (no US storage for PII).

**Consent Management:**
- OTP verification = implicit consent for service delivery (legitimate purpose under DPDP).
- First login: display Terms of Service + Privacy Policy. Record consent timestamp.
- Business owners collecting customer data (Party records) = Data Processors. HisaabPro = Data Fiduciary.
- Need: Data Processing Agreement (DPA) template for business owners to acknowledge their responsibility for customer data they enter.

**Right to Erasure vs GST Retention:**
- DPDP grants right to erasure. GST law requires 6-8 year retention of financial records.
- Resolution: **Anonymize personal data, keep financial records.**
  ```
  On erasure request:
  1. Null out: name, email, phone, address on User record
  2. Keep: all invoices, payments, transactions (with businessId, no personal identifiers)
  3. Audit log: record erasure request + what was anonymized
  4. Party records: anonymize name/phone, keep financial totals
  ```
- Business owner data: full deletion after GST retention period (6 years from last transaction).

**Data Processing Agreement:**
- Template at `docs/legal/data-processing-agreement.md`
- Shown to business owners during onboarding
- Covers: what data they enter, their responsibility for customer consent, retention periods

**Success criteria:**
- Zero PII stored outside India
- Erasure request completable within 72 hours (DPDP requirement: 30 days)
- Financial records preserved post-erasure for GST compliance
- DPA acknowledged by every business owner at signup

---

### 5.7 Cost Model

**Why:** Know exactly when free tiers run out. No surprise bills.

| Component | 100 Users | 1,000 Users | 10,000 Users |
|-----------|-----------|-------------|--------------|
| **Neon (PostgreSQL)** | Free (0.5GB) | Pro $19/mo (10GB) | Pro $69/mo (50GB) |
| **Render (API)** | Free (spin-down) | Starter $7/mo | Standard $25/mo × 2 |
| **Render (Frontend)** | Static (free) | Static (free) | Static (free) |
| **Sentry** | Free (5K events/mo) | Free (5K events/mo) | Team $26/mo (50K events) |
| **Redis (Upstash)** | Free (10K cmd/day) | Free (10K cmd/day) | Pay-as-you-go ~$10/mo |
| **R2 Storage (backups)** | Free (10GB) | Free (10GB) | ~$5/mo (50GB) |
| **FCM (Push)** | Free | Free | Free |
| **UptimeRobot** | Free (5 monitors) | Free (5 monitors) | Free (5 monitors) |
| **Domain (hisaabpro.in)** | ~$10/year | ~$10/year | ~$10/year |
| **Total** | **~$0/mo** | **~$50/mo** | **~$200/mo** |

**Break-even analysis:**
- At 1,000 users with 10% Pro conversion: 100 × Rs 299 = Rs 29,900/mo (~$360) vs $50 cost = healthy margin
- At 10,000 users with 10% Pro conversion: 1,000 × Rs 299 = Rs 2,99,000/mo (~$3,600) vs $200 cost

**Cost alerts:**
- Set Neon usage alerts at 80% of tier limit
- Set Render auto-scaling limits (max 3 instances)
- Monthly cost review in first 6 months post-launch

---

## 6. What We're NOT Changing

These are already gold standard — do not touch:

- Auth stack (JWT httpOnly, OTP, 2FA, WebAuthn, lockout, CAPTCHA)
- Multi-tenant isolation (`businessId` everywhere)
- Audit trail (AuditLog + AdminAction)
- Rate limiting (4-tier, Redis-ready)
- Security headers (Helmet + CSP + HSTS)
- Idempotency middleware
- Replay protection
- Admin separation (separate JWT audience)
- CSRF double-submit cookies

---

## 7. Success Metrics

| Metric | Current | Gold Standard |
|--------|---------|--------------|
| Stale data incidents | Frequent (manual refresh) | Zero (TanStack Query + SSE) |
| Multi-user sync delay | ∞ (page reload) | < 2 seconds (SSE) |
| Hard-deleted business data | Some models | Zero (soft delete everywhere) |
| Permission update for new feature | Manual per-role | Add 1 resource name |
| Offline conflict handling | Silent overwrite | Notification + diff |
| Active session visibility | None | Full list + force logout |
| Data export | None | Full ZIP in < 60s |
| Free user on paid feature | No enforcement | 402 + upgrade prompt |
| Connection limit under load | Unpooled | Pooled (100 concurrent) |

---

## 8. Risks

| Risk | Mitigation |
|------|-----------|
| TanStack Query migration breaks existing hooks | Migrate one feature at a time, keep old hooks until verified |
| Soft delete migration on 68 models | Batch migration, add `isDeleted` default false (no data change) |
| SSE connection limits on Render | Max 100 concurrent SSE per instance, scale horizontally |
| SSE unreliable on mobile (Capacitor) | Use FCM push notifications for mobile; SSE web-only. Foreground resume triggers cache invalidation. |
| Permission matrix migration | Backward-compatible — old String[] still works during transition |
| Subscription gating blocks beta users | Grace period: 30 days free Pro after launch |
| DPDP Act non-compliance | Data localization (ap-south-1), erasure workflow built in Phase E, DPA template at onboarding. Legal review before launch. |
| Neon region outage (ap-south-1) | Neon PITR + daily snapshots to R2. Manual restore to alternate region within 2 hours. Neon Pro plan adds auto-failover. |
| Sentry free tier exceeded | 5K events/mo is tight at scale. Alert at 80% usage. Upgrade to Team ($26/mo) at 1K+ users. Filter noisy non-critical errors. |

---

### 8.5 SLA Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **API Uptime** | 99.5% (~3.6 hours downtime/month) | UptimeRobot monitoring `/api/health` every 60s |
| **P95 API Latency** | < 500ms | Sentry Performance transaction monitoring |
| **P50 API Latency** | < 200ms | Sentry Performance |
| **Real-Time Sync Delay** | < 3 seconds | SSE event timestamp vs client receive time |
| **Data Durability** | 99.99% | Neon managed replication + PITR |
| **Backup Frequency** | Continuous PITR + daily snapshot | Neon built-in + scheduled pg_dump to R2 |
| **Backup Recovery** | < 1 hour (RTO) | Quarterly disaster recovery test |
| **Data Loss Window** | < 5 minutes (RPO) | Neon PITR granularity |
| **Erasure Request** | < 72 hours | Automated anonymization workflow |

**Note:** 99.5% is realistic for Render's starter/standard tiers. Achieving 99.9%+ requires Render's dedicated instances or migration to Railway/Fly.io with multi-region. Not needed at current scale.

---

## Approval

- [ ] Sawan reviewed architecture principles
- [ ] Sawan approved implementation order
- [ ] Sawan approved subscription tiers/limits
- [ ] Sawan approved ~9.5 week timeline
