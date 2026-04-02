# Operations Runbook — HisaabPro

> **Status:** Draft
> **Date:** 2026-04-02
> **Audience:** On-call developer (currently just Sawan)

---

## 1. Service Map

| Service | Provider | URL | Health Check |
|---------|----------|-----|-------------|
| Frontend | Vercel | hisaabpro.in | `curl -s https://hisaabpro.in` → 200 |
| Backend API | Render | api.hisaabpro.in | `curl -s https://api.hisaabpro.in/health` → `{"status":"ok"}` |
| Database | Neon (PostgreSQL) | Neon dashboard | `SELECT 1` via Prisma |
| Redis | Upstash | Upstash console | `PING` → `PONG` |
| Error Tracking | Sentry | sentry.io/hisaabpro | Dashboard |
| Push Notifications | FCM | Firebase console | — |
| WhatsApp | Aisensy | Aisensy dashboard | — |
| Email | Resend | Resend dashboard | — |
| Payments | Razorpay | Razorpay dashboard | Webhook health |
| DNS/CDN | Cloudflare | Cloudflare dashboard | — |
| CAPTCHA | Cloudflare Turnstile | Cloudflare dashboard | — |

---

## 2. Health Check Endpoint

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "database": "ok",
    "redis": "ok",
    "memory_mb": 128,
    "active_sse_connections": 42
  }
}
```

Implementation:
```typescript
// server/src/routes/health.ts
router.get('/health', async (req, res) => {
  const checks = {
    database: 'unknown',
    redis: 'unknown',
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    active_sse_connections: getSSEClientCount(),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'unavailable'; // degraded, not dead
  }

  const allOk = checks.database === 'ok';
  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks,
  });
});
```

---

## 3. Incident Response Playbook

### 3.1 Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|--------------|---------|
| **P0 — Outage** | App completely down, data loss risk | 15 min | DB unreachable, API 500 on all routes |
| **P1 — Critical** | Major feature broken, money affected | 1 hour | Payments failing, invoices not saving |
| **P2 — Major** | Feature degraded, workaround exists | 4 hours | Reports slow, SSE disconnected |
| **P3 — Minor** | Cosmetic, non-blocking | 24 hours | UI glitch, wrong translation |

### 3.2 Response Steps

**For any incident:**

1. **Acknowledge** — Note the time, symptoms, affected users
2. **Triage** — Assign severity level
3. **Diagnose** — Check in this order:
   ```
   Sentry (errors) → Render logs → Neon dashboard → Upstash dashboard
   ```
4. **Mitigate** — Quick fix to stop bleeding (rollback, feature flag, redirect)
5. **Fix** — Root cause fix
6. **Verify** — Confirm fix works in production
7. **Post-mortem** — Write what happened, why, and what changes prevent recurrence

### 3.3 Common Scenarios

#### API returns 500

```bash
# 1. Check Render logs
render logs --service hisaabpro-api --since 10m

# 2. Check if DB is reachable
curl https://api.hisaabpro.in/health

# 3. If DB error: check Neon status page
open https://neonstatus.com

# 4. If code error: check Sentry for stack trace
open https://sentry.io/organizations/hisaabpro/issues/

# 5. Rollback if needed
render rollback --service hisaabpro-api --to-deploy <previous-deploy-id>
```

#### Database connection exhausted

```bash
# Symptoms: "too many connections" in logs
# 1. Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'hisaabpro';

# 2. Kill idle connections
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'hisaabpro'
  AND state = 'idle'
  AND state_change < now() - interval '5 minutes';

# 3. Verify connection_limit in DATABASE_URL
# Should be: ?connection_limit=10&pool_timeout=30

# 4. If persistent: restart Render service
render restart --service hisaabpro-api
```

#### SSE connections accumulating

```bash
# Symptoms: Memory growing, /health shows high active_sse_connections
# 1. Check count
curl https://api.hisaabpro.in/health | jq .checks.active_sse_connections

# 2. If > 200 on single instance: connections may be leaking
# Check if heartbeat is working (should be every 30s)
# Check client disconnect handler

# 3. Nuclear option: restart service (all SSE clients auto-reconnect)
render restart --service hisaabpro-api
```

#### Razorpay webhook failing

```bash
# Symptoms: Subscription status not updating after payment
# 1. Check Razorpay dashboard → Webhooks → Recent deliveries
# 2. Verify webhook secret matches RAZORPAY_WEBHOOK_SECRET env var
# 3. Check Render logs for webhook route errors
# 4. Manual sync: hit /api/subscriptions/sync for the affected business
```

#### Neon database outage

```
# Neon has automatic failover. Recovery is usually < 30 seconds.
# 1. Check https://neonstatus.com
# 2. If extended outage (> 5 min):
#    - App continues working offline (IndexedDB + sync queue)
#    - Users see "Offline mode" banner
#    - Queue processes automatically when DB returns
# 3. After recovery: verify data integrity
#    - Run /api/admin/data-verification
#    - Check audit log for gaps
```

---

## 4. Rollback Procedures

### 4.1 Frontend Rollback (Vercel)

```bash
# List recent deployments
vercel ls hisaabpro

# Rollback to previous
vercel rollback <deployment-url>
# OR: promote previous deployment in Vercel dashboard
```

Vercel keeps all deployments. Rollback is instant (DNS switch).

### 4.2 Backend Rollback (Render)

```bash
# Render auto-deploys from git. To rollback:
# Option A: Revert commit and push
git revert HEAD
git push origin main

# Option B: Manual deploy of previous commit in Render dashboard
# Dashboard → Service → Manual Deploy → Select commit
```

### 4.3 Database Rollback

```
# Neon supports Point-in-Time Recovery (PITR)
# 1. Go to Neon dashboard → Project → Branches
# 2. Create branch from point-in-time (before the bad migration)
# 3. Verify data on the branch
# 4. If good: promote branch to main (Neon feature)

# For Prisma migration rollback:
npx prisma migrate resolve --rolled-back <migration-name>
# Then apply fix migration
```

### 4.4 Redis Rollback

```
# Upstash is append-only. No rollback needed.
# If data is corrupt: FLUSHDB and let app rebuild caches.
# Rate limit counters auto-expire. Token blacklist rebuilds from DB.
```

---

## 5. Monitoring Setup

### 5.1 What to Monitor

| Metric | Tool | Alert Threshold |
|--------|------|----------------|
| API error rate | Sentry | > 10 errors/min |
| API latency P95 | Render metrics | > 1000ms |
| DB connection count | Neon dashboard | > 80% of limit |
| Memory usage | Render metrics | > 80% of instance |
| SSE connection count | /health endpoint | > 200 per instance |
| Disk usage (Neon) | Neon dashboard | > 80% of plan |
| Redis commands/sec | Upstash dashboard | > 8000/day (near free limit) |
| Failed login attempts | Audit log | > 50/hour from same IP |
| Webhook failures | Razorpay dashboard | > 3 consecutive failures |
| SSL certificate expiry | Cloudflare | < 14 days |

### 5.2 Uptime Monitoring

Use a free uptime monitor (UptimeRobot, Better Uptime, or Render's built-in):

```
Check: GET https://api.hisaabpro.in/health
Interval: 60 seconds
Alert: Email + WhatsApp to Sawan
Expected: HTTP 200 + body contains "ok"
```

### 5.3 Sentry Setup

```typescript
// server/src/lib/sentry.ts
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,  // 10% of requests traced (cost control)
  beforeSend(event) {
    // Strip PII from error reports
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
    }
    return event;
  },
});

// Add to Express error handler
app.use(Sentry.Handlers.errorHandler());
```

```typescript
// src/lib/sentry-frontend.ts (React)
import * as Sentry from '@sentry/react';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  tracesSampleRate: 0.05, // 5% on frontend (more traffic)
  replaysSessionSampleRate: 0,    // no session replay (PII risk)
  replaysOnErrorSampleRate: 0.1,  // 10% replay on error
});
```

---

## 6. Deployment Checklist

### Before deploying to production:

```
Pre-Deploy:
[ ] All tests pass: npm test (1114 tests)
[ ] TypeScript clean: npx tsc --noEmit
[ ] Build succeeds: npm run build
[ ] No console.log in production code
[ ] Environment variables set in Render dashboard
[ ] Database migration applied: npx prisma migrate deploy
[ ] Prisma client generated: npx prisma generate

Post-Deploy:
[ ] Health check returns 200: curl https://api.hisaabpro.in/health
[ ] Frontend loads: open https://hisaabpro.in
[ ] Login works (OTP or dev mode)
[ ] Create test invoice → verify in DB
[ ] Check Sentry for new errors (wait 5 min)
[ ] Check Render logs for warnings
```

---

## 7. Environment Variables Reference

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | Backend | Yes | Neon connection string (with pgbouncer) |
| `DIRECT_URL` | Backend | Yes | Neon direct connection (for migrations) |
| `REDIS_URL` | Backend | Prod | Upstash Redis connection string |
| `JWT_SECRET` | Backend | Yes | JWT signing secret (min 32 chars) |
| `JWT_ADMIN_SECRET` | Backend | Yes | Admin JWT secret (different from user) |
| `RAZORPAY_KEY_ID` | Backend | Prod | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Backend | Prod | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Backend | Prod | Razorpay webhook validation |
| `RESEND_API_KEY` | Backend | Prod | Email sending |
| `AISENSY_API_KEY` | Backend | Prod | WhatsApp messaging |
| `FCM_SERVER_KEY` | Backend | Prod | Push notifications |
| `MSG91_AUTH_KEY` | Backend | Prod | OTP SMS |
| `SENTRY_DSN` | Both | Prod | Error tracking |
| `TURNSTILE_SECRET_KEY` | Backend | Prod | Cloudflare CAPTCHA |
| `VITE_API_URL` | Frontend | Yes | Backend API URL |
| `VITE_SENTRY_DSN` | Frontend | Prod | Frontend error tracking |
| `VITE_TURNSTILE_SITE_KEY` | Frontend | Prod | CAPTCHA widget key |
| `VITE_AUTH_MODE` | Frontend | Yes | `dev` or `otp` |
| `NODE_ENV` | Backend | Yes | `development` or `production` |

---

## 8. Backup & Recovery

### 8.1 Automated Backups

| What | How | Frequency | Retention |
|------|-----|-----------|-----------|
| Database | Neon PITR (point-in-time recovery) | Continuous | 7 days (free), 30 days (pro) |
| Database snapshot | Neon branch | Daily (cron) | 7 most recent |
| User-initiated backup | `/api/backup/create` | On demand | 5 per business |
| Redis | Upstash persistence | Continuous | Auto (managed) |
| Code | Git (GitHub) | Every push | Permanent |
| Environment config | Render dashboard export | Monthly (manual) | In password manager |

### 8.2 Recovery Procedures

**Full database recovery:**
1. Go to Neon dashboard → Project → Branches
2. "Restore" → select point-in-time
3. Verify data on branch
4. Promote to main
5. Restart backend service
6. Verify /health

**Single business data recovery:**
1. Create Neon branch at point-in-time
2. Export specific business data from branch
3. Import into production main branch
4. Verify with business owner

---

## 9. Scaling Triggers

| Metric | Current Limit | Action When Exceeded |
|--------|-------------|---------------------|
| API response time P95 > 1s | Render starter | Upgrade to standard ($25/mo) |
| DB storage > 4GB | Neon free tier | Upgrade to Pro ($19/mo) |
| SSE connections > 200 | Single instance | Add second Render instance + Redis pub/sub |
| Redis commands > 8K/day | Upstash free | Upgrade to Pay-as-you-go ($0.2/100K commands) |
| Frontend bandwidth > 100GB/mo | Vercel free | Upgrade to Pro ($20/mo) |
| Error rate > 1% of requests | — | Investigate, don't scale |
| Concurrent users > 500 | — | Add horizontal scaling + load balancer |
