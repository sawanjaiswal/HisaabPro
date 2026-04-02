# Scalability Architecture — HisaabPro

> **Status:** Draft
> **Date:** 2026-04-02
> **Scope:** From 1 user to 100,000 users — every scaling decision documented

---

## 1. Scaling Philosophy

> **Scale vertically first. Horizontally only when vertical fails.**
> **Optimize queries before adding infrastructure.**
> **Free tiers first. Paid only when revenue justifies it.**

HisaabPro targets Indian MSMEs. The scaling profile is:
- **Write-heavy** during business hours (9 AM - 9 PM IST)
- **Read-heavy** on reports (month-end, quarter-end, year-end)
- **Bursty** on invoice creation (billing time = spike)
- **Offline-first** so server load is lower than typical SaaS

---

## 2. Scaling Stages

### Stage 0: Launch (1-100 users)

```
Infrastructure:
  Frontend  → Vercel Free (Edge CDN, auto-SSL)
  Backend   → Render Free/Starter ($0-7/mo, 512MB RAM)
  Database  → Neon Free (0.5GB, 100 connections, auto-suspend)
  Redis     → Upstash Free (10K commands/day)
  CDN       → Cloudflare Free

Cost: $0-22/month
Bottleneck: None. Free tiers handle this easily.
```

**Architecture:** Single Express instance. In-memory rate limiting. In-memory SSE. Direct Prisma connections.

**When to move to Stage 1:** P95 latency > 500ms OR Neon compute hours exhausted OR first paying customer.

---

### Stage 1: Traction (100-1,000 users)

```
Infrastructure:
  Frontend  → Vercel Free (still sufficient)
  Backend   → Render Starter ($7/mo, 512MB RAM, always-on)
  Database  → Neon Pro ($19/mo, 10GB, auto-scaling compute)
  Redis     → Upstash Pay-as-go (~$1/mo)
  Monitoring→ Sentry Free + UptimeRobot Free

Cost: ~$50/month
Revenue (10% conversion): ~$360/month
```

**Changes from Stage 0:**
- Enable connection pooling (`?pgbouncer=true` in Neon URL)
- Move rate limiting to Redis (shared state)
- Move token blacklist to Redis (survives restart)
- Add Sentry error tracking
- Add health check monitoring

**When to move to Stage 2:** Single instance CPU > 80% OR SSE connections > 200 OR DB query time > 100ms P95.

---

### Stage 2: Growth (1,000-10,000 users)

```
Infrastructure:
  Frontend  → Vercel Pro ($20/mo)
  Backend   → Render Standard ($25/mo × 2 instances)
  Database  → Neon Pro ($69/mo, 50GB, read replica)
  Redis     → Upstash Pro ($10/mo, 500K cmd/day)
  Queue     → BullMQ (on Redis, no extra cost)
  Storage   → Cloudflare R2 ($0, 10GB free)
  Monitoring→ Sentry Team ($26/mo)

Cost: ~$200/month
Revenue (10% Pro, 3% Business): ~$5,750/month
```

**Changes from Stage 1:**
- **Horizontal scaling:** 2 Express instances behind Render load balancer
- **SSE via Redis pub/sub:** Cross-instance real-time (already built in TRD Section 4.6)
- **Read replica:** Reports and dashboards hit read replica, writes hit primary
- **Background jobs:** BullMQ on Redis for exports, email sends, cleanup jobs
- **Object storage:** Invoice PDFs, backups, images → Cloudflare R2 (not local disk)
- **Query optimization:** Add database indexes for slow queries (identified via Sentry APM)

**When to move to Stage 3:** 2 instances at 80% CPU OR DB storage > 50GB OR need multi-region.

---

### Stage 3: Scale (10,000-100,000 users)

```
Infrastructure:
  Frontend  → Vercel Pro (or self-hosted on Cloudflare Pages)
  Backend   → Railway/Fly.io (auto-scaling, multi-region)
  Database  → Neon Business ($300/mo) OR Supabase
  Redis     → Upstash Enterprise OR Redis Cloud
  Queue     → BullMQ + dedicated worker instances
  Storage   → Cloudflare R2 Pro
  Search    → Typesense/Meilisearch (product/party search)
  Monitoring→ Grafana Cloud + Sentry Business

Cost: ~$800-1,500/month
Revenue: ~$30,000-50,000/month
```

**Changes from Stage 2:**
- **Auto-scaling:** Backend scales with load (Railway/Fly.io)
- **Full-text search:** Dedicated search engine for products, parties, invoices
- **Worker separation:** API servers separate from background job workers
- **Database sharding evaluation** (probably not needed — see Section 6)
- **CDN for API responses:** Cache GET endpoints at edge (Cloudflare Workers)
- **Multi-region consideration** (if expanding beyond India)

---

## 3. Database Scaling Strategy

### 3.1 Query Optimization (First, Always)

Before adding infrastructure, optimize:

```sql
-- EXPLAIN ANALYZE every slow query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT * FROM "Document" WHERE "businessId" = $1 AND "isDeleted" = false ORDER BY "date" DESC LIMIT 20;
```

**Index strategy:**
```
Every table:
  @@index([businessId, isDeleted])               -- base filter (already exists)

Hot tables (Document, Payment):
  @@index([businessId, isDeleted, date])          -- list sorting
  @@index([businessId, isDeleted, type, date])    -- filtered lists
  @@index([businessId, partyId, isDeleted])       -- party statements

Search:
  CREATE INDEX CONCURRENTLY idx_party_name_trgm ON "Party" USING gin (name gin_trgm_ops);
  CREATE INDEX CONCURRENTLY idx_product_name_trgm ON "Product" USING gin (name gin_trgm_ops);
```

### 3.2 Connection Pooling

```
Stage 0-1: Neon built-in PgBouncer (?pgbouncer=true)
  - connection_limit=10 per instance
  - pool_timeout=30s

Stage 2+: Neon connection pooler + read replica
  - Primary: writes (connection_limit=10)
  - Read replica: reads (connection_limit=20)
  - Prisma: separate datasource for reads

Stage 3: Evaluate PgBouncer proxy if needed
```

### 3.3 Read Replica Strategy (Stage 2+)

```prisma
// prisma/schema.prisma — read replica
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // primary (writes)
  directUrl = env("DIRECT_URL")          // migrations
}
```

```typescript
// server/src/lib/prisma.ts
const writePrisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL });
const readPrisma  = new PrismaClient({ datasourceUrl: process.env.DATABASE_READ_URL });

// Read-heavy operations use read replica
export async function getReportData(businessId: string) {
  return readPrisma.document.findMany({ where: { businessId } });
}

// Writes always use primary
export async function createDocument(data: any) {
  return writePrisma.document.create({ data });
}
```

**Which queries go to read replica:**
- All report endpoints (`/reports/*`)
- Dashboard aggregations (`/dashboard/home`)
- List endpoints with complex filters
- Search queries
- Admin analytics

**Which stay on primary:**
- All mutations (POST, PUT, DELETE)
- Auth checks (token verification)
- Single-entity GET after mutation (consistency guarantee)

### 3.4 Partitioning (Stage 3, Only If Needed)

If the `Document` table exceeds 50M rows:

```sql
-- Partition by financial year
CREATE TABLE "Document" (
  ...
) PARTITION BY RANGE ("date");

CREATE TABLE "Document_FY2025" PARTITION OF "Document"
  FOR VALUES FROM ('2025-04-01') TO ('2026-03-31');
CREATE TABLE "Document_FY2026" PARTITION OF "Document"
  FOR VALUES FROM ('2026-04-01') TO ('2027-03-31');
```

**Why partition by date, not businessId:**
- Most queries filter by date range (this month, this FY)
- Partition pruning eliminates scanning old financial years
- Business isolation is already handled by `businessId` index

### 3.5 Why NOT Shard (Probably Never)

| Users | Rows (estimated) | Sharding needed? |
|-------|-----------------|-----------------|
| 1,000 | ~5M | No — single PostgreSQL handles 100M+ |
| 10,000 | ~50M | No — add indexes, read replica, partitioning |
| 100,000 | ~500M | Maybe — evaluate Citus or per-tenant DB |
| 1,000,000 | ~5B | Yes — but this is a different product at this point |

PostgreSQL comfortably handles 100M+ rows with proper indexing. Sharding adds massive complexity. Don't do it until forced.

---

## 4. Backend Scaling Strategy

### 4.1 Stateless Design (Required for Horizontal Scaling)

The Express backend MUST be stateless. All state lives in external stores:

| State | Store | Why |
|-------|-------|-----|
| Session data | Redis | Survives restart, shared across instances |
| Rate limit counters | Redis | Must be consistent across instances |
| SSE clients | In-memory + Redis pub/sub | Local clients + cross-instance broadcast |
| Token blacklist | Redis | Must be consistent |
| File uploads | Cloudflare R2 (S3) | Not local disk |
| Temp files (exports) | Cloudflare R2 | Not local disk |

**Rule:** If `server restarts` → zero data loss. Everything recoverable from PostgreSQL + Redis + R2.

### 4.2 Worker Separation (Stage 2+)

```
                    Load Balancer
                    ┌─────┴─────┐
               API Server 1   API Server 2
                    │               │
                    └───────┬───────┘
                            │
                      ┌─────┴─────┐
                   Redis Queue   PostgreSQL
                      │
                Worker Instance
                (background jobs)
```

**What runs on workers (not API servers):**
- Data export (ZIP generation)
- Email sending (batch)
- WhatsApp notifications
- Recurring invoice generation
- Report pre-computation
- Backup generation
- Audit log cleanup
- Subscription status sync (Razorpay webhook retries)

**Why separate:** Long-running jobs block the event loop. A 30-second export on an API server increases latency for all other requests.

### 4.3 BullMQ Job Queue (Stage 2+)

```typescript
// server/src/lib/queue.ts
import { Queue, Worker } from 'bullmq';
import { getRedis } from './redis';

const connection = getRedis();

// Queues
export const exportQueue = new Queue('export', { connection });
export const emailQueue = new Queue('email', { connection });
export const recurringQueue = new Queue('recurring', { connection });

// Workers (run on separate instance)
new Worker('export', async (job) => {
  const { businessId, userId } = job.data;
  const filePath = await generateFullExport(businessId);
  await notifyUser(userId, { type: 'EXPORT_READY', downloadUrl: signUrl(filePath) });
}, { connection });

new Worker('email', async (job) => {
  const { to, subject, html } = job.data;
  await resend.emails.send({ from: 'HisaabPro <noreply@hisaabpro.in>', to, subject, html });
}, { connection, limiter: { max: 10, duration: 1000 } }); // 10 emails/sec
```

### 4.4 API Response Caching (Stage 2+)

```typescript
// Cache GET responses at application level
import { getRedis } from './redis';

export function cacheResponse(key: string, ttlSeconds: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedis();
    if (!redis) return next();

    const cacheKey = `hp:cache:${key}:${req.user.businessId}:${req.url}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200) {
        redis.setex(cacheKey, ttlSeconds, JSON.stringify(body));
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };
    next();
  };
}

// Usage — cache dashboard for 30 seconds
router.get('/dashboard/home', authenticate, cacheResponse('dashboard', 30), getDashboard);

// Invalidation — on any mutation
function invalidateCache(pattern: string) {
  const redis = getRedis();
  if (!redis) return;
  // Scan and delete matching keys
  const stream = redis.scanStream({ match: `hp:cache:${pattern}:*` });
  stream.on('data', (keys: string[]) => { if (keys.length) redis.del(...keys); });
}
```

**What to cache:**
| Endpoint | TTL | Invalidated By |
|----------|-----|---------------|
| `/dashboard/home` | 30s | Any document/payment mutation |
| `/reports/*` | 60s | Any document/payment mutation |
| `/products` (list) | 30s | Product CRUD |
| `/parties` (list) | 30s | Party CRUD |
| `/categories` | 300s | Category CRUD (rare) |
| `/units` | 300s | Unit CRUD (rare) |
| `/hsn/search` | 3600s | Never (static data) |

---

## 5. Frontend Scaling Strategy

### 5.1 Bundle Optimization

Current: 440KB gzipped. Target: < 300KB initial load.

```
Strategies:
1. Code splitting by route (React.lazy + Suspense) — already possible with Vite
2. Dynamic imports for heavy features:
   - React-PDF → import only on invoice preview
   - Tesseract.js → import only on bill scan
   - Chart libraries → import only on reports
3. Tree-shaking: verify no barrel exports bloating bundle
4. Image optimization: WebP + lazy loading + srcset
```

### 5.2 Offline-First as Scaling Strategy

Offline-first architecture is also a **server scaling strategy**:
- IndexedDB serves reads without hitting the server
- Sync queue batches writes (fewer requests)
- Service Worker caches static assets (no CDN hit)
- Stale-while-revalidate shows cached data instantly

**Result:** Server handles 10x fewer requests than a typical SaaS.

### 5.3 TanStack Query as Scaling Strategy

```
staleTime: 30s    → Don't refetch within 30 seconds (reduces API calls by ~60%)
gcTime: 5min      → Keep data in memory for 5 minutes (instant back navigation)
refetchOnWindowFocus: true → Only refetch when tab becomes active
```

Combined with SSE: only refetch when server says data changed. Zero wasted requests.

### 5.4 Virtual Lists (Stage 2+)

When lists exceed 100+ items visible at once:

```typescript
// Use @tanstack/react-virtual for large lists
import { useVirtualizer } from '@tanstack/react-virtual';

function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: invoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // row height in px
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <InvoiceRow key={virtualRow.key} invoice={invoices[virtualRow.index]} />
        ))}
      </div>
    </div>
  );
}
```

---

## 6. Real-Time Scaling Strategy

### 6.1 SSE Connection Limits

| Stage | Max SSE Connections | Strategy |
|-------|-------------------|----------|
| 0-1 | ~200 | Single instance, in-memory |
| 2 | ~1,000 | 2 instances + Redis pub/sub |
| 3 | ~10,000 | Dedicated SSE service OR switch to Ably/Pusher |

### 6.2 When to Switch from Self-Hosted SSE

At ~5,000 concurrent SSE connections:
- Each connection holds ~2KB memory
- 5,000 × 2KB = 10MB (acceptable)
- BUT: 5,000 open HTTP connections per instance = OS limit concerns

**Options at scale:**
1. **Dedicated SSE microservice** — separate from API, scales independently
2. **Managed service (Ably/Pusher)** — $50-200/month for 10K connections, zero ops
3. **WebSocket upgrade** — Socket.io with Redis adapter, same scaling pattern

**Recommendation:** Stay self-hosted until 5K concurrent connections. Then evaluate Ably ($49/mo for 500 peak connections, scales to millions).

### 6.3 Event Filtering

As business count grows, Redis pub/sub channels multiply:

```
100 businesses = 100 channels (fine)
10,000 businesses = 10,000 channels (fine — Redis handles millions)
100,000 businesses = 100,000 channels (evaluate Redis Streams instead)
```

Redis pub/sub is O(subscribers) per message. Since each business has ~5 employees max, this scales linearly.

---

## 7. Storage Scaling Strategy

### 7.1 Database Storage

| Users | Estimated DB Size | Neon Plan | Cost |
|-------|------------------|-----------|------|
| 100 | ~200MB | Free (0.5GB) | $0 |
| 1,000 | ~2GB | Pro (10GB) | $19/mo |
| 10,000 | ~20GB | Pro (50GB) | $69/mo |
| 100,000 | ~200GB | Business | $300/mo |

**Estimation basis:**
- Average business: 500 invoices/year × 2KB = 1MB/year for documents
- + parties, products, payments, audit logs ≈ 2MB/year per business
- + indexes ≈ 50% overhead

### 7.2 Object Storage (Cloudflare R2)

| Content | Storage Strategy | Cost |
|---------|-----------------|------|
| Invoice PDFs | Generate on-demand (React-PDF), cache in R2 | Near $0 |
| Backup files | R2, auto-delete after 30 days | Near $0 |
| Product images | R2, serve via CDN | $0.015/GB/month |
| Export ZIPs | R2, auto-delete after 24 hours | Near $0 |
| Digital signatures | R2, permanent | Near $0 |

**Why R2 over S3:**
- Zero egress fees (S3 charges for downloads)
- S3-compatible API (drop-in replacement)
- 10GB free tier
- Cloudflare CDN built-in

### 7.3 Cleanup Jobs

```typescript
// Run daily via cron
async function cleanup() {
  // Delete expired export files (> 24h)
  await r2.deleteExpiredObjects('exports/', 24 * 60 * 60);

  // Delete expired backup files (> 30 days)
  await r2.deleteExpiredObjects('backups/', 30 * 24 * 60 * 60);

  // Archive old audit logs (> 24 months → cold storage)
  await archiveOldAuditLogs(24);

  // Clean up expired sessions
  await prisma.session.deleteMany({
    where: { isRevoked: true, createdAt: { lt: thirtyDaysAgo } },
  });

  // Clean up expired Redis keys (handled by TTL, but verify)
  // No action needed — Redis TTL is automatic
}
```

---

## 8. Search Scaling Strategy

### 8.1 Current: PostgreSQL LIKE/ILIKE

```sql
SELECT * FROM "Product" WHERE name ILIKE '%chai%' AND "businessId" = $1;
```

Works fine up to ~100K products. Beyond that, ILIKE full-scan is slow.

### 8.2 Stage 1: PostgreSQL Trigram Index

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY idx_product_name_trgm
  ON "Product" USING gin (name gin_trgm_ops);
CREATE INDEX CONCURRENTLY idx_party_name_trgm
  ON "Party" USING gin (name gin_trgm_ops);
```

Trigram indexes support `ILIKE`, `%pattern%`, and fuzzy matching. 10-100x faster than sequential scan.

### 8.3 Stage 3: Dedicated Search Engine

When search response time > 200ms or need advanced features:

```
Options:
  Meilisearch (Rust, self-hosted, free) — best for Indian languages
  Typesense (C++, cloud or self-hosted) — typo-tolerant, fast
  Algolia (managed, expensive) — best DX, overkill for this market

Recommendation: Meilisearch
  - Supports Hindi + English
  - Typo-tolerant (user types "cha" finds "chai")
  - 50ms search latency on 1M documents
  - Self-hosted on Render ($7/mo instance)
  - OR Meilisearch Cloud (free tier: 100K documents)
```

**Sync pattern:**
```typescript
// On product/party create/update → sync to search engine
async function syncToSearch(entity: string, id: string, data: object) {
  await meili.index(entity).addDocuments([{ id, ...data }]);
}

// On soft-delete → remove from search
async function removeFromSearch(entity: string, id: string) {
  await meili.index(entity).deleteDocument(id);
}
```

---

## 9. Multi-Tenancy Scaling

### 9.1 Current: Shared Database, businessId Filter

All tenants share one PostgreSQL database. Every query filters by `businessId`. This is the correct approach for 99% of SaaS products.

### 9.2 Row-Level Security (Stage 2+, Optional)

Add PostgreSQL RLS as defense-in-depth:

```sql
-- Enable RLS on all business-scoped tables
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "business_isolation" ON "Document"
  USING ("businessId" = current_setting('app.business_id')::text);

-- Set per-request
SET LOCAL app.business_id = 'clx123';
```

**Why optional:** Prisma doesn't natively support RLS. Requires raw SQL or Prisma middleware to set the session variable. Add only if a security audit demands it.

### 9.3 Per-Tenant Database (Stage 3, Only If Forced)

If a large enterprise customer requires data isolation:

```
Option A: Neon Branching per tenant
  - Each business gets a Neon branch
  - Pro: True isolation, easy backup/restore per tenant
  - Con: Connection management complexity

Option B: Schema-per-tenant
  - Shared DB, different PostgreSQL schema per tenant
  - Pro: True isolation without separate DBs
  - Con: Migration complexity (apply to all schemas)
```

**Recommendation:** Don't do this unless a customer paying > Rs 50K/month demands it. Shared DB with businessId works for 99.9% of use cases.

---

## 10. Geographic Scaling (Future)

### Current: India-Only

All infrastructure in `ap-south-1` (Mumbai). Optimal for Indian users.

### If Expanding to Other Countries

```
Phase 1: Single region + CDN
  - Keep DB in Mumbai
  - Frontend on Vercel Edge CDN (global, automatic)
  - API latency: 200-500ms for non-India users (acceptable)

Phase 2: Multi-region API
  - Deploy API instances in us-east-1 and eu-west-1
  - Read replicas in each region
  - Writes route to Mumbai primary
  - Latency: < 100ms for reads, 200ms for writes

Phase 3: True multi-region (probably never needed)
  - CockroachDB or Neon multi-region
  - Each region has read-write capability
  - Conflict resolution at DB level
```

**Realistically:** India-only for years. Global expansion = different product phase.

---

## 11. Scaling Decision Matrix

| Problem | DON'T Do | DO This |
|---------|---------|---------|
| Slow queries | Add more servers | Add indexes, EXPLAIN ANALYZE, optimize query |
| High memory | Add more RAM | Find memory leak, optimize data structures |
| Too many DB connections | Increase connection limit | Enable connection pooling |
| Slow list pages | Paginate harder | Virtual scrolling + useInfiniteQuery |
| Too many API requests | Rate limit harder | Cache responses, stale-while-revalidate |
| SSE connection limit | Switch to WebSocket | Add Redis pub/sub, scale instances |
| Large exports | Increase timeout | Background job + download link |
| Slow search | Add Elasticsearch | Add PostgreSQL trigram index first |
| "Need microservices" | Split into 10 services | Keep monolith, extract workers only |
| "Need Kubernetes" | Set up K8s cluster | Use Render/Railway auto-scaling |

---

## 12. Anti-Patterns (Don't Do These)

1. **Don't shard before 100M rows** — PostgreSQL handles it. Sharding adds 10x complexity.
2. **Don't microservice before 10 developers** — Monolith + workers is correct for 1-3 devs.
3. **Don't Kubernetes before $10K/mo infra** — Managed platforms (Render/Railway) are cheaper and simpler.
4. **Don't multi-region before international revenue** — Latency from Mumbai to anywhere in India is < 50ms.
5. **Don't build a custom queue before BullMQ** — BullMQ on Redis is free and battle-tested.
6. **Don't GraphQL for this product** — REST with cursor pagination is simpler and sufficient.
7. **Don't pre-optimize** — Measure first. If it's not slow, don't optimize it.
8. **Don't over-cache** — Cache invalidation is the hardest problem. Only cache what's expensive.

---

## 13. Scaling Checklist Per Stage

### Before Stage 1 (100+ users)
- [ ] Connection pooling enabled
- [ ] Redis for rate limiting + token blacklist
- [ ] Sentry error tracking live
- [ ] Health check endpoint monitored
- [ ] Database indexes on hot queries

### Before Stage 2 (1,000+ users)
- [ ] 2+ server instances + load balancer
- [ ] SSE via Redis pub/sub
- [ ] Read replica for reports
- [ ] BullMQ for background jobs
- [ ] Object storage for files (R2)
- [ ] Response caching for dashboards
- [ ] Trigram indexes for search

### Before Stage 3 (10,000+ users)
- [ ] Auto-scaling backend
- [ ] Dedicated worker instances
- [ ] Full-text search engine
- [ ] Table partitioning evaluation
- [ ] CDN for API responses
- [ ] Virtual scrolling on all lists
- [ ] Bundle < 300KB gzipped
