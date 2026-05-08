# SECURITY_AUDIT_phase5_marketing_comms

**Status:** APPROVED WITH CONDITIONS
**Auditor:** security agent
**Date:** 2026-05-08
**Sources reviewed:**
- docs/SCOPE_phase5_marketing_comms.md
- docs/ARCHITECTURE_phase5_marketing_comms.md

## 1. Architect-flagged items — verdicts

### 1.1 Auth on campaign endpoints — APPROVED WITH CONDITIONS
- All `/api/marketing/*` MUST mount `requireAuth` at the router level.
- Cross-business IDOR: `businessId` always from `req.user.businessId`. Verify ownership of `templateId`, `partyId`, `campaignId` in service layer.
- Role gating: OWNER/ADMIN required for `/launch`, `/cancel`, `DELETE /templates/:id`, `/opt-out/:partyId`. STAFF can create DRAFT only. Architect's "any authenticated" REJECTED for launch.

### 1.2 Segment query injection — APPROVED WITH CONDITIONS
- `campaign-segment.service.ts` MUST translate `SegmentFilter` via explicit allowlist switch — no dynamic key iteration.
- Banned: `$queryRawUnsafe`, `$executeRawUnsafe`, interpolated `Prisma.sql`. Add to `enforce.js` + ESLint `no-restricted-syntax`.
- Zod `.strict()`: `tags` ≤ 20 strings ≤ 40 chars; `cityContains` ≤ 60 chars; `inactiveDays` int 0-3650; `outstandingGtePaise` int ≥0; `partyType` enum.
- Result cap: `LIMIT 10001` in Prisma `take`, not JS slice.
- `tags` translation via Prisma `hasEvery`.

### 1.3 Webhook signature verification — APPROVED WITH CONDITIONS
- Raw body: `express.raw({ type: 'application/json', limit: '256kb' })` mounted BEFORE global `express.json`.
- `crypto.timingSafeEqual` with try/catch on length mismatch.
- Aisensy: HMAC-SHA256(rawBody, AISENSY_WEBHOOK_SECRET).
- MSG91: static bearer, still `timingSafeEqual`. Token ≥ 32 bytes.
- **Replay window: ±5 minutes** on `occurredAt` (architect's 24h REJECTED).
- Idempotency: unique index on `NotificationJob.providerMessageId` or `WebhookEvent` ledger.
- Failures → 401 `WEBHOOK_BAD_SIGNATURE` with no detail leakage.
- Logging: provider, providerMessageId, verified, latencyMs. Never log secret/header/raw body.

### 1.5 PII handling — APPROVED WITH CONDITIONS
- Phone purge on `MarketingCampaignRecipient.phone` at 90 days post-dispatch (set NULL, row stays).
- Daily cron `marketing-retention-cron` 03:00 IST.
- Job payload: `entityType: 'campaign_recipient'`, `entityId: recipientId`, `recipientPartyId: partyId` — phone resolved at dispatch time.
- Unit test: `JSON.stringify(jobPayload).includes(phone) === false`.
- Winston redactor: mask `phone`, `bodyEn`, `bodyHi`, `defaultVars`.
- Opt-out: PRIMARY at segment-resolve; SECONDARY belt-and-braces re-check at per-recipient dispatch. Notification engine's `requiresOptIn` is for transactional, NOT marketing.

### 1.6 Rate limiting — APPROVED WITH CONDITIONS
| Endpoint | Limit | Key |
|---|---|---|
| `POST /campaigns/:id/launch` | 5/min, 30/hour | businessId |
| `POST /campaigns` | 30/min | businessId |
| `POST /segments/preview` | 60/min | businessId |
| `POST /opt-out/:partyId` | 30/min | userId |
| webhooks | 600/min/IP + 5000/min global | source IP |

Webhook reject path returns 429 (providers retry) not 401 (providers abandon).

### 1.7 Role matrix
| Action | OWNER | ADMIN | STAFF |
|---|---|---|---|
| Read templates/campaigns/rules | ✅ | ✅ | ✅ |
| Create/update DRAFT | ✅ | ✅ | ✅ |
| Delete template | ✅ | ✅ | ❌ |
| **Launch / Cancel campaign** | ✅ | ✅ | ❌ |
| Toggle/delete reminder rule | ✅ | ✅ | ❌ |
| Opt-out party | ✅ | ✅ | ✅ |

Audit log on every launch/cancel: `{ actorUserId, actorRole, campaignId, recipientCount, channel }`.

### 1.8 Cron worker auth — APPROVED
Mechanical grep: zero `req.*` in `reminder-cron.service.ts`.

## 2. OWASP Top 10
- A01 Broken Access Control: CONDITIONAL (IDOR — service-layer ownership checks)
- A02 Crypto: CONDITIONAL (env Zod schema for secrets)
- A03 Injection: CONDITIONAL (allowlist Zod, no rawUnsafe)
- A04 Insecure Design: APPROVED
- A05 Misconfig: CONDITIONAL (parser order, CORS off on webhooks)
- A06 Vulnerable Components: APPROVED
- A07 Authn Failures: CONDITIONAL (role matrix)
- A08 Integrity: CONDITIONAL (HMAC + 5-min replay + dedupe)
- A09 Logging: CONDITIONAL (Winston redactor; audit logs on launch/cancel)
- A10 SSRF: APPROVED

## 3. Pre-merge gates per PR

**PR2 (templates):** strict Zod, ownership check, enforce.js pass.

**PR3 (segments + opt-out):** allowlist Zod, single switch, ESLint ban on rawUnsafe, rate limit on preview, audit log on opt-out.

**PR4 (campaigns + launch):** role mw OWNER/ADMIN on launch/cancel; rate limit; pre-launch cost cap + per-job re-check; `take: 10001`; Idempotency-Key on POST /campaigns; audit log on launch; unit test job payload has no phone; belt-and-braces opt-out re-check.

**PR5 (reminder cron):** zero req.* refs; feature flag `REMINDER_CRON_DISABLED=1`; concurrent-tick claim test.

**PR6 (webhooks) — STRICTEST:** raw parser before global json; `timingSafeEqual` with try/catch; **5-min replay window**; unique index on `providerMessageId`; `{success:true}` only response; 401 on any failure; CORS off; rate limit 600/min/IP; env Zod for `AISENSY_WEBHOOK_SECRET ≥32`, `MSG91_WEBHOOK_TOKEN ≥32`, `AISENSY_API_KEY`. Curl proofs: valid 200, bad sig 401, stale occurredAt 401, replay valid 200 idempotent.

**Cross-cutting:** no console.log; no localStorage of marketing data; all mutations carry entityType+entityLabel; Winston redactor extended; lib/env.ts updated before reads.

## Final verdict: APPROVED WITH CONDITIONS

Architecture is sound. No re-architecture required. Strictest blockers are PR6 (webhooks) and PR4 (launch role gating).
