# Load Stability & Resilience — HisaabPro

> **Status:** Draft
> **Date:** 2026-04-02
> **Goal:** App stays responsive under 10x normal load. Degrades gracefully, never crashes.

---

## 1. Stability Principles

> **The app should get slower, never crash.**
> **Shed load early, protect the database.**
> **Fail fast, recover fast.**

---

## 2. Request Pipeline (Defense Layers)

Every request passes through these protection layers in order:

```
Internet Request
  │
  ▼
┌──────────────────────────────┐
│  1. Cloudflare               │  DDoS protection, bot filtering
│     (blocks attack traffic)  │  Rate: 100K+ req/sec capacity
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│  2. Rate Limiter (Redis)     │  Per-IP and per-user limits
│     API: 100/min             │  Auth: 5/15min
│     Sensitive: 10/hour       │  OTP: 3/10min
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│  3. Request Timeout          │  30s max (Render default)
│     (prevents hanging)       │  Custom: 10s for reads, 30s for writes
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│  4. Connection Pool          │  Max 10 DB connections per instance
│     (protects database)      │  pool_timeout: 30s (queue, don't fail)
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│  5. Query Timeout            │  statement_timeout: 10s
│     (kills slow queries)     │  Prevents DB lock-up
└──────────┬───────────────────┘
           ▼
┌──────────────────────────────┐
│  6. Response Cache           │  Dashboard: 30s, Reports: 60s
│     (reduces DB load)        │  HSN search: 1hr (static data)
└──────────────────────────────┘
```

**Under normal load:** All layers are transparent. Request flows through in < 200ms.
**Under heavy load:** Each layer absorbs pressure. Load is shed before hitting the database.

---

## 3. Rate Limiting (First Line of Defense)

### 3.1 Configuration

```typescript
// server/src/middleware/rate-limit.ts

// Already exists — 4 tiers with pluggable store (Memory/Redis)
const rateLimiters = {
  api:       { max: 100, windowMs: 60_000 },      // 100 req/min per user
  auth:      { max: 5,   windowMs: 900_000 },      // 5 attempts per 15 min per IP
  otp:       { max: 3,   windowMs: 600_000 },      // 3 OTPs per 10 min per phone
  sensitive: { max: 10,  windowMs: 3_600_000 },    // 10 deletes/exports per hour per user
};
```

### 3.2 Burst Protection

```typescript
// Sliding window rate limiter (not fixed window)
// Prevents burst at window boundary

// Example: 100 req/min sliding window
// At T=30s, user has made 80 requests
// At T=31s, user makes 21st request in last 60 seconds → DENIED
// (Fixed window would allow 100 at T=59s + 100 at T=61s = 200 in 2 seconds)
```

### 3.3 Adaptive Rate Limiting (Stage 2+)

```typescript
// Reduce limits when server is under pressure
function getAdaptiveLimit(baseLimit: number): number {
  const cpuUsage = process.cpuUsage();
  const memUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;

  if (memUsage > 0.9) return Math.floor(baseLimit * 0.5);  // 50% limit
  if (memUsage > 0.8) return Math.floor(baseLimit * 0.75); // 75% limit
  return baseLimit;
}
```

---

## 4. Database Protection

### 4.1 Connection Pool Limits

```
DATABASE_URL="postgresql://...?connection_limit=10&pool_timeout=30"
```

- **10 connections per instance** — Neon free tier allows 100 total
- **pool_timeout=30s** — Queue requests for 30s before failing
- **No connection leak:** Prisma's pool auto-releases connections after query

### 4.2 Query Timeouts

```typescript
// server/src/lib/prisma.ts
const prisma = new PrismaClient({
  // Log slow queries
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
  ],
});

// Set statement timeout globally
prisma.$queryRaw`SET statement_timeout = '10s'`;

// For reports (can be slower):
prisma.$queryRaw`SET LOCAL statement_timeout = '30s'`;
```

**Why 10 seconds:** No user-facing query should take > 10s. If it does, the query needs optimization, not more time.

### 4.3 N+1 Query Prevention

```typescript
// BAD — N+1 (fetches party for each invoice separately)
const invoices = await prisma.document.findMany({ where: { businessId } });
for (const inv of invoices) {
  const party = await prisma.party.findUnique({ where: { id: inv.partyId } });
}

// GOOD — Single query with include
const invoices = await prisma.document.findMany({
  where: { businessId },
  include: { party: { select: { id: true, name: true } } },
  take: 20,
});
```

**Enforcement:** ESLint rule or code review to flag `findUnique` inside loops.

### 4.4 Pagination Enforcement

```typescript
// EVERY findMany MUST have a take limit
// Already enforced by codebase audit (FEATURE_MAP.md: "All findMany have take limits")

// server/src/lib/prisma-safety.ts
prisma.$use(async (params, next) => {
  if (params.action === 'findMany' && !params.args?.take) {
    params.args = { ...params.args, take: 100 }; // Safety net
    console.warn(`[PRISMA] findMany without take limit on ${params.model}`);
  }
  return next(params);
});
```

---

## 5. Graceful Degradation

When the system is under pressure, degrade non-critical features before critical ones fail.

### 5.1 Degradation Priority

| Priority | Feature | Under Pressure | Recovery |
|----------|---------|---------------|----------|
| 1 (KEEP) | Invoice creation | Always works | — |
| 1 (KEEP) | Payment recording | Always works | — |
| 1 (KEEP) | Authentication | Always works | — |
| 2 (SLOW) | Reports | Cache for 5min instead of 1min | Auto-recover |
| 2 (SLOW) | Dashboard | Cache for 2min instead of 30s | Auto-recover |
| 3 (SHED) | SSE real-time | Disable, fall to polling | Manual re-enable |
| 3 (SHED) | Data export | Queue, delay notification | Process when load drops |
| 3 (SHED) | Bulk import | Reject with retry-later | Process when load drops |
| 4 (BLOCK) | Admin analytics | Return cached or 503 | Manual re-enable |

### 5.2 Circuit Breaker Pattern

For external services (Razorpay, MSG91, Aisensy, Resend):

```typescript
// server/src/lib/circuit-breaker.ts

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const breakers = new Map<string, CircuitBreakerState>();

export function withCircuitBreaker(serviceName: string, fn: () => Promise<any>) {
  const breaker = breakers.get(serviceName) || { failures: 0, lastFailure: 0, state: 'CLOSED' };

  // OPEN — fail immediately (don't even try)
  if (breaker.state === 'OPEN') {
    const cooldown = 30_000; // 30 seconds
    if (Date.now() - breaker.lastFailure > cooldown) {
      breaker.state = 'HALF_OPEN'; // Try one request
    } else {
      throw new Error(`Circuit breaker OPEN for ${serviceName}. Retry after cooldown.`);
    }
  }

  return fn()
    .then((result) => {
      breaker.failures = 0;
      breaker.state = 'CLOSED';
      breakers.set(serviceName, breaker);
      return result;
    })
    .catch((error) => {
      breaker.failures++;
      breaker.lastFailure = Date.now();
      if (breaker.failures >= 3) {
        breaker.state = 'OPEN'; // Trip the breaker after 3 failures
      }
      breakers.set(serviceName, breaker);
      throw error;
    });
}

// Usage
async function sendOTP(phone: string) {
  return withCircuitBreaker('msg91', () => msg91.sendOTP(phone));
}

async function processPayment(orderId: string) {
  return withCircuitBreaker('razorpay', () => razorpay.capture(orderId));
}
```

**Why circuit breakers:**
- MSG91 down? Don't spam it with retries. Wait 30s, try once.
- Razorpay down? Return "Payment service temporarily unavailable" immediately.
- Without breakers: cascading failure — slow external service → all requests queue → server OOM.

### 5.3 Timeout Cascade Prevention

```typescript
// Every external call has an explicit timeout
const TIMEOUTS = {
  msg91: 5_000,       // 5s — OTP must be fast
  razorpay: 10_000,   // 10s — payments can be slower
  aisensy: 5_000,     // 5s — WhatsApp
  resend: 5_000,      // 5s — email
  neonDb: 10_000,     // 10s — database
  redis: 2_000,       // 2s — cache
};

// AbortController for every fetch
async function callExternal(url: string, options: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
```

---

## 6. Memory Management

### 6.1 Memory Leak Prevention

```typescript
// 1. SSE cleanup on disconnect (already in TRD)
req.on('close', () => removeClient(businessId, client));

// 2. Interval cleanup
setInterval(() => {
  // Remove stale SSE clients (no heartbeat response in 60s)
  for (const [businessId, clientSet] of clients) {
    for (const client of clientSet) {
      try { client.res.write(':ping\n\n'); }
      catch { removeClient(businessId, client); }
    }
  }
}, 60_000);

// 3. Prisma connection cleanup
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// 4. AbortController cleanup in all useEffect hooks (already enforced)
```

### 6.2 Memory Monitoring

```typescript
// Log memory usage every 5 minutes
setInterval(() => {
  const used = process.memoryUsage();
  const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);
  logger.info('memory', {
    rss: mb(used.rss),
    heap_total: mb(used.heapTotal),
    heap_used: mb(used.heapUsed),
    external: mb(used.external),
  });

  // Alert if heap > 80% of total
  if (used.heapUsed / used.heapTotal > 0.8) {
    logger.warn('memory_pressure', { heap_percent: (used.heapUsed / used.heapTotal * 100).toFixed(1) });
  }
}, 300_000); // 5 minutes
```

### 6.3 Large Request Protection

```typescript
// Limit request body size
app.use(express.json({ limit: '1mb' }));  // Default JSON body limit
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Bulk endpoints have explicit limits
// Bulk import: max 500 items (already enforced)
// Bulk adjust: max 200 items (already enforced)
// Label data: max 200 items (already enforced)
```

---

## 7. Graceful Shutdown

```typescript
// server/src/lib/shutdown.ts

let isShuttingDown = false;

export function setupGracefulShutdown(server: http.Server) {
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Stop accepting new connections
    server.close();

    // 2. Close all SSE connections (clients will auto-reconnect to another instance)
    closeAllSSEClients();

    // 3. Wait for in-flight requests (max 10s)
    await new Promise(resolve => setTimeout(resolve, 10_000));

    // 4. Close database connection
    await prisma.$disconnect();

    // 5. Close Redis connection
    const redis = getRedis();
    if (redis) await redis.quit();

    logger.info('Graceful shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Health check returns 503 during shutdown
export function healthCheck(req: Request, res: Response) {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  // ... normal health check
}
```

**Why graceful shutdown matters:**
- Render sends SIGTERM before killing the instance
- Without graceful shutdown: in-flight requests fail, SSE clients get no notification
- With graceful shutdown: current requests complete, SSE clients reconnect to healthy instance

---

## 8. Load Testing Strategy

### 8.1 Tools

```bash
# k6 — best for HTTP load testing (Go-based, free)
npm install -g k6

# OR autocannon — Node.js based, simpler
npm install -g autocannon
```

### 8.2 Test Scenarios

```javascript
// load-tests/invoice-creation.js (k6)
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Ramp up to 50 users
    { duration: '1m', target: 100 },  // Spike to 100 users
    { duration: '2m', target: 50 },   // Scale back
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

export default function () {
  // Login
  const loginRes = http.post(`${BASE_URL}/auth/verify-otp`, JSON.stringify({
    phone: `+9198765${__VU}${__ITER}`.slice(0, 13), // unique phone per VU
    otp: '123456', // dev mode OTP
  }));

  // Create invoice
  const invoiceRes = http.post(`${BASE_URL}/documents`, JSON.stringify({
    type: 'SALE_INVOICE',
    partyId: 'test-party',
    items: [{ productId: 'test-product', quantity: 1, rate: 10000 }],
  }), { headers: { Cookie: loginRes.headers['set-cookie'] } });

  check(invoiceRes, { 'invoice created': (r) => r.status === 201 });

  sleep(1); // Think time between actions
}
```

### 8.3 Test Plan

| Test | Target | Pass Criteria |
|------|--------|---------------|
| **Baseline** | 10 concurrent users, 5 min | P95 < 200ms, 0% errors |
| **Normal load** | 50 concurrent users, 10 min | P95 < 500ms, < 0.1% errors |
| **Peak load** | 100 concurrent users, 5 min | P95 < 1000ms, < 1% errors |
| **Spike test** | 0 → 200 users in 30s | No crashes, < 5% errors, recovery in 60s |
| **Endurance** | 50 users, 1 hour | No memory leak, stable P95, 0% errors |
| **Report spike** | 50 users all hitting /reports at once | P95 < 3000ms (cache miss), P95 < 500ms (cache hit) |

### 8.4 When to Run

- Before every major deployment
- After TanStack Query migration
- After SSE implementation
- After database schema changes
- Monthly (automated via CI)

---

## 9. Monitoring for Stability

### 9.1 Key Stability Metrics

| Metric | Normal | Warning | Critical | Action |
|--------|--------|---------|----------|--------|
| P95 latency | < 200ms | 200-500ms | > 500ms | Optimize queries, add caching |
| Error rate | < 0.1% | 0.1-1% | > 1% | Check Sentry, investigate |
| Memory usage | < 60% | 60-80% | > 80% | Check for leaks, restart |
| CPU usage | < 50% | 50-80% | > 80% | Add instance, optimize |
| DB connections | < 70% | 70-90% | > 90% | Check pool config, optimize |
| SSE connections | < 150 | 150-200 | > 200 | Scale instances |
| Queue depth | < 10 | 10-50 | > 50 | Add worker, investigate |
| Redis memory | < 50% | 50-80% | > 80% | Check TTLs, increase plan |

### 9.2 Alerting Rules

```yaml
# Sentry alert rules
rules:
  - name: "High error rate"
    condition: "events > 10 in 1 minute"
    action: "notify-telegram"

  - name: "Slow API"
    condition: "transaction.duration.p95 > 1000ms for 5 minutes"
    action: "notify-telegram"

  - name: "Memory pressure"
    condition: "custom metric 'memory_percent' > 80"
    action: "notify-telegram"
```

---

## 10. Chaos Testing (Stage 2+)

Once core stability is proven, intentionally break things to verify resilience:

| Test | How | Expected Behavior |
|------|-----|-------------------|
| Kill one instance | `render scale 0 && render scale 1` | Other instance handles load, SSE clients reconnect |
| Redis unavailable | Block Redis port | Falls back to in-memory, logs warning |
| Slow database | Add 5s sleep to random queries | Timeouts trigger, circuit breaker opens for affected queries |
| Network partition | Disconnect DB for 30s | App works offline (IndexedDB), sync queue grows |
| Memory pressure | Allocate 80% of heap | Adaptive rate limiting kicks in, non-critical features shed |
| External service down | Mock MSG91 returning 500 | Circuit breaker opens, returns "service unavailable" |

---

## 11. Recovery Patterns

### 11.1 Auto-Recovery

| Failure | Auto-Recovery | Time |
|---------|---------------|------|
| Instance crash | Render auto-restart | < 30s |
| SSE disconnect | Browser EventSource auto-reconnect | < 5s |
| Redis disconnect | ioredis auto-reconnect | < 10s |
| DB connection drop | Prisma pool auto-reconnect | < 5s |
| Network offline | Offline banner + IndexedDB | Immediate |
| Network restore | Sync queue processes | < 30s |

### 11.2 Manual Recovery

| Failure | Recovery | Time |
|---------|----------|------|
| Bad deploy | `git revert && push` or Render rollback | < 5 min |
| Data corruption | Neon PITR restore | < 30 min |
| Secret compromise | Rotate all secrets, revoke all sessions | < 1 hour |
| DDoS attack | Cloudflare Under Attack mode | < 2 min |
