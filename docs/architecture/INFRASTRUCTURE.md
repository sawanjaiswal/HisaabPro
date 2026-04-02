# Infrastructure & Cost Model — HisaabPro

> **Status:** Draft
> **Date:** 2026-04-02

---

## 1. Infrastructure Map

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUDFLARE                             │
│  DNS + CDN + DDoS protection + Turnstile CAPTCHA         │
│  hisaabpro.in → Vercel | api.hisaabpro.in → Render      │
└──────────┬──────────────────────────┬────────────────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼──────────────────┐
│    VERCEL            │   │    RENDER                    │
│    Frontend          │   │    Backend API               │
│    React 19 + Vite   │   │    Express + TypeScript      │
│    Static + SSR      │   │    Node.js 20                │
│    Edge CDN          │   │    512MB - 2GB RAM           │
│    Auto SSL          │   │    Auto SSL                  │
└──────────────────────┘   └──────┬─────────┬─────────────┘
                                  │         │
                    ┌─────────────▼──┐  ┌───▼──────────────┐
                    │  NEON           │  │  UPSTASH         │
                    │  PostgreSQL     │  │  Redis           │
                    │  Serverless     │  │  Serverless      │
                    │  Auto-scale     │  │  Global          │
                    │  PITR backup    │  │  REST + native   │
                    │  ap-south-1     │  │  ap-south-1      │
                    └────────────────┘  └──────────────────┘

External Services:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Razorpay │ │ Sentry   │ │ FCM      │ │ Aisensy  │ │ Resend   │
│ Payments │ │ Errors   │ │ Push     │ │ WhatsApp │ │ Email    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

---

## 2. Cost Model

### 2.1 At Launch (0-100 users)

| Service | Plan | Cost/month | Notes |
|---------|------|-----------|-------|
| Vercel | Free | $0 | 100GB bandwidth, unlimited deployments |
| Render | Free → Starter | $0-7 | Free has cold starts, Starter ($7) for always-on |
| Neon | Free | $0 | 0.5GB storage, 190 compute hours |
| Upstash Redis | Free | $0 | 10K commands/day, 256MB |
| Cloudflare | Free | $0 | DNS + CDN + DDoS |
| Sentry | Free | $0 | 5K errors/month |
| MSG91 | Pay-as-go | ~$5 | OTP SMS at ~₹0.15/SMS × ~1000/month |
| Razorpay | 2% per txn | $0 base | No monthly fee |
| Aisensy | Basic | ~$10 | WhatsApp BSP |
| Resend | Free | $0 | 3K emails/month |
| **TOTAL** | | **$7-22/month** | |

### 2.2 At 1,000 Users

| Service | Plan | Cost/month | Notes |
|---------|------|-----------|-------|
| Vercel | Free | $0 | Still within limits |
| Render | Starter | $7 | 512MB RAM sufficient |
| Neon | Pro | $19 | ~2GB storage, autoscale compute |
| Upstash Redis | Pay-as-go | $1 | ~50K commands/day |
| Cloudflare | Free | $0 | |
| Sentry | Free → Team | $0-26 | May need Team for volume |
| MSG91 | Pay-as-go | ~$15 | Higher OTP volume |
| Aisensy | Growth | ~$25 | Higher WhatsApp volume |
| Resend | Pro | $20 | 50K emails/month |
| **TOTAL** | | **~$87-112/month** | |

**Revenue at 1K users (10% conversion to Pro):**
100 × ₹299/month = ₹29,900 (~$360/month)
**Net margin: ~$250/month** ✓

### 2.3 At 10,000 Users

| Service | Plan | Cost/month | Notes |
|---------|------|-----------|-------|
| Vercel | Pro | $20 | Higher bandwidth |
| Render | Standard | $25 | 2GB RAM, 2 instances |
| Neon | Pro | $69 | ~20GB storage, higher compute |
| Upstash Redis | Pro | $10 | 500K commands/day |
| Cloudflare | Free | $0 | |
| Sentry | Team | $26 | 100K errors/month |
| MSG91 | Volume | ~$50 | |
| Aisensy | Business | ~$75 | |
| Resend | Business | $75 | 500K emails/month |
| Load Balancer | Render | $20 | If 2+ instances needed |
| **TOTAL** | | **~$370/month** | |

**Revenue at 10K users (10% Pro, 3% Business):**
1000 × ₹299 + 300 × ₹599 = ₹4,78,700 (~$5,750/month)
**Net margin: ~$5,380/month** ✓

### 2.4 Break-Even Analysis

| Scenario | Users Needed | Monthly Revenue | Monthly Cost |
|----------|-------------|----------------|-------------|
| Break even (Starter) | 8 paid Pro | ₹2,392 ($29) | ~$22 |
| Cover Pro infra | 50 paid Pro | ₹14,950 ($180) | ~$112 |
| Cover Business infra | 150 paid Pro + 30 Business | ₹62,820 ($755) | ~$370 |
| First hire ($1500) | 500 paid Pro + 100 Business | ₹2,09,400 ($2,513) | ~$1,870 |

---

## 3. Region Strategy

### 3.1 Current: Single Region

All services in **India / Asia-Pacific South**:
- Neon: `ap-south-1` (Mumbai)
- Upstash: `ap-south-1`
- Render: Singapore (closest available)
- Vercel: Edge CDN (automatic, global)
- Cloudflare: Edge CDN (automatic, global)

### 3.2 Latency Budget

```
User (India) → Cloudflare Edge (~5ms)
  → Vercel Edge / CDN (~10ms for static)
  → Render Singapore (~30ms)
    → Neon Mumbai (~10ms)
    → Upstash Mumbai (~5ms)

Total P95: ~60ms for cached, ~150ms for DB query
Target: < 500ms P95
```

### 3.3 Data Residency (DPDP Compliance)

- **Primary data** (PostgreSQL): India (ap-south-1, Mumbai) ✓
- **Cache** (Redis): India (ap-south-1) ✓
- **CDN cache**: Global edge (static assets only, no PII) ✓
- **Error reports** (Sentry): US-based servers ⚠️
  - Mitigation: Strip PII in `beforeSend` hook
  - No user data in Sentry — only stack traces and error metadata
- **Backups**: Neon-managed, same region ✓

---

## 4. Scaling Strategy

### 4.1 Vertical Scaling (First)

| When | Action | Cost Delta |
|------|--------|-----------|
| P95 > 500ms consistently | Render: Starter → Standard (2GB RAM) | +$18/mo |
| DB storage > 4GB | Neon: Free → Pro | +$19/mo |
| Redis > 10K cmd/day | Upstash: Free → Pay-as-go | +$1/mo |

### 4.2 Horizontal Scaling (Later)

| When | Action | Prereq |
|------|--------|--------|
| Single instance can't handle load | Add 2nd Render instance | Redis pub/sub for SSE |
| 500+ concurrent users | Render load balancer | Stateless backend (sessions in Redis) |
| Read-heavy reports | Neon read replica | Read/write splitting in Prisma |
| Global expansion (unlikely MVP) | Multi-region | CDN + regional backends |

### 4.3 Scaling Bottlenecks (in order of likely failure)

1. **DB connections** — Neon free = 100 connections. Solution: PgBouncer (built-in).
2. **SSE connections** — Each holds an HTTP connection open. ~200 per instance safe. Solution: Redis pub/sub + multiple instances.
3. **Memory** — PDF generation (React-PDF) is memory-heavy. Solution: Offload to worker or increase RAM.
4. **Compute** — GST calculation on large invoices. Solution: Caching, precomputation.
5. **Storage** — Invoice images, backup files. Solution: Object storage (S3/R2) when needed.

---

## 5. Security Infrastructure

### 5.1 Network Security

```
Internet → Cloudflare (DDoS, WAF, bot protection)
  → Vercel (auto-SSL, headers)
  → Render (auto-SSL, private network)
    → Neon (SSL required, IP allowlist available)
    → Upstash (TLS required, token auth)
```

### 5.2 Secret Management

| Secret | Storage | Rotation |
|--------|---------|----------|
| JWT_SECRET | Render env var | Manual, on compromise |
| JWT_ADMIN_SECRET | Render env var | Manual, on compromise |
| DATABASE_URL | Render env var | On Neon password reset |
| REDIS_URL | Render env var | On Upstash token reset |
| RAZORPAY_KEY_SECRET | Render env var | Annually |
| API keys (MSG91, Aisensy, etc.) | Render env var | On compromise |

**Not using:** Vault, AWS Secrets Manager, etc. Overkill for current scale. Render env vars are encrypted at rest.

### 5.3 Audit & Compliance

| Requirement | Implementation |
|-------------|---------------|
| Access logging | AuditLog model (every mutation) |
| Admin action logging | AdminAction model (separate) |
| Failed login tracking | auth.service.ts + rate limiter |
| Data access audit | Prisma middleware can log queries (disabled by default) |
| PII handling | Anonymization on account deletion |
| Data retention | Soft delete + 6yr GST retention |

---

## 6. Disaster Recovery

### 6.1 Targets

| Metric | Target | How |
|--------|--------|-----|
| **RTO** (Recovery Time Objective) | < 1 hour | Render auto-restart + Neon PITR |
| **RPO** (Recovery Point Objective) | < 5 minutes | Neon continuous WAL archiving |
| **Uptime SLA** | 99.5% | ~3.6 hours downtime/month allowed |

### 6.2 Failure Scenarios

| Scenario | Impact | Recovery |
|----------|--------|----------|
| Render instance crash | API down | Auto-restart (< 30s) |
| Neon compute down | API errors on DB ops | Auto-failover (< 30s), app works offline |
| Neon storage issue | Data at risk | PITR to pre-incident point |
| Upstash down | Rate limiting + SSE degraded | Fallback to in-memory (automatic) |
| Vercel down | Frontend unreachable | PWA cached version works offline |
| Cloudflare down | DNS resolution fails | Direct IP access (documented) |
| Code bug in production | Feature broken | Git revert + redeploy (< 10 min) |
| Compromised credentials | Data breach risk | Rotate all secrets, revoke all sessions, audit |

### 6.3 Backup Verification

Monthly: Restore from Neon PITR to a test branch, run data integrity checks:
```bash
# Create test branch from 24h ago
neon branches create --project-id xxx --parent-timestamp "24h ago" --name "backup-test"

# Run integrity check
DATABASE_URL=<test-branch-url> node scripts/verify-data-integrity.js

# Drop test branch
neon branches delete --project-id xxx --branch-id <test-branch>
```

---

## 7. CI/CD Pipeline

### 7.1 Current Flow

```
Developer pushes to main
  → GitHub Actions:
      1. npm ci
      2. npx tsc --noEmit
      3. npm test (1114 tests)
      4. npm run build
  → If all pass:
      → Vercel auto-deploys frontend
      → Render auto-deploys backend
  → If any fail:
      → Deploy blocked, developer notified
```

### 7.2 Target Flow (Gold Standard)

```
Developer pushes to feature branch
  → GitHub Actions:
      1. Lint + type check + tests
      2. Build frontend + backend
      3. Vercel preview deploy (per-PR)
      4. Neon branch (per-PR database)
      5. Run E2E tests against preview
  → PR merged to main:
      1. All checks pass (required)
      2. Vercel production deploy
      3. Render production deploy
      4. Prisma migration (if schema changed)
      5. Post-deploy health check
      6. Sentry release tracking
```

### 7.3 Database Migration Pipeline

```
Schema change detected (prisma/schema.prisma modified):
  1. PR creates Neon branch (isolated DB for testing)
  2. npx prisma migrate dev --name <name> (generates migration)
  3. Tests run against branch DB
  4. On merge: npx prisma migrate deploy (production)
  5. Verify: npx prisma migrate status
```
