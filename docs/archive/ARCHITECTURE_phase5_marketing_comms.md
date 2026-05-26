# ARCHITECTURE — Phase 5 Epic A: Marketing Communications

**Status:** DRAFT — 2026-05-08
**Author:** architect agent (per Sawan)
**Source scope:** `docs/SCOPE_phase5_marketing_comms.md`
**Reuses:** Phase 1 notification engine (commit `bea1093`)
**Next step:** security review (public webhooks + bulk PII dispatch)

---

## 0. Guiding constraints (re-stated from project rules)

- Mobile-first 320 px+, 4 UI states (loading / error / empty / success) for every screen.
- Files ≤ 250 LOC. No `any`. All client API calls go through `api()`.
- Mutations carry `entityType` + `entityLabel`.
- Schema migrations: additive only — never `NOT NULL` an existing column without backfill PR.
- All money in paise (Int).
- No new provider infrastructure: reuse `providerRegistry`, `notificationManager`, `notification-queue.service.ts`, `notification-dispatch-processor.service.ts`, `notification-quiet-hours.service.ts`, `notification-cost.service.ts`, `notification-rate-limit.service.ts`.

---

## 1. File structure

All files ≤ 250 LOC. If a service approaches the limit, split by responsibility (read / write / dispatch).

### 1.1 Server (`server/src/`)

```
prisma/
  schema.prisma                                 # MODIFY: 5 new models, 3 cols on Party, 3 relations
  migrations/
    20260509_marketing_party_cols/
      migration.sql                             # additive: birthday, marketingOptOut, marketingOptOutAt
    20260510_marketing_template/
      migration.sql                             # MarketingTemplate
    20260511_marketing_campaign/
      migration.sql                             # MarketingCampaign + Recipient + enums
    20260512_reminder_rule/
      migration.sql                             # ReminderRule + enum
    20260513_reminder_instance/
      migration.sql                             # ReminderInstance + enum + unique idx

routes/
  marketing.ts                                  # NEW · ≤120 LOC · thin router only — delegates to services
                                                #   mounted in app.routes.ts behind requireAuth
  webhooks/
    aisensy-webhook.ts                          # NEW · ≤180 LOC · POST /api/webhooks/aisensy (NO requireAuth, signature-checked)
    msg91-webhook.ts                            # NEW · ≤150 LOC · POST /api/webhooks/msg91 (NO requireAuth, signature-checked)

services/marketing/
  marketing-template.service.ts                 # NEW · ≤220 LOC · CRUD; DLT/WA validation
  marketing-template.validators.ts              # NEW · ≤120 LOC · Zod schemas
  campaign.service.ts                           # NEW · ≤230 LOC · CRUD + status transitions (DRAFT→SCHEDULED→…)
  campaign-segment.service.ts                   # NEW · ≤210 LOC · pure SegmentFilter → Prisma where()
  campaign-segment.types.ts                     # NEW · ≤80 LOC · `SegmentFilter` interface
  campaign-dispatch.service.ts                  # NEW · ≤240 LOC · launch orchestration (chunked)
  campaign-recipient.service.ts                 # NEW · ≤200 LOC · materialise recipients, paginated reads
  campaign-counter.service.ts                   # NEW · ≤160 LOC · atomic counter increments from webhooks
  reminder-rule.service.ts                      # NEW · ≤220 LOC · CRUD for ReminderRule
  reminder-cron.service.ts                      # NEW · ≤240 LOC · 30-min tick, materialise+dispatch
  reminder-trigger.service.ts                   # NEW · ≤230 LOC · trigger-specific candidate queries (BIRTHDAY/PAYMENT_DUE/…)
  marketing-optout.service.ts                   # NEW · ≤120 LOC · set/unset opt-out, audit trail
  marketing-compliance.service.ts               # NEW · ≤180 LOC · DLT guard, opt-out filter, quiet-hours wrapper
  marketing-cost-cap.service.ts                 # NEW · ≤140 LOC · pre-launch cost estimate vs business cap

services/notifications/
  notification-events.ts                        # MODIFY: +7 EVENT_KEYS, +7 EVENT_META rows
  providers/whatsapp.provider.ts                # MODIFY: real Aisensy POST + webhook secret
  notification-cron.ts                          # MODIFY: register reminder-cron tick
  notification-dispatch.service.ts              # NO CHANGE — used as-is
  notification-manager.ts                       # NO CHANGE — used as-is
```

### 1.2 Client (`src/features/marketing/`)

```
marketing.types.ts                              # NEW · ≤120 LOC · DTOs mirroring server contracts
marketing.service.ts                            # NEW · ≤200 LOC · read-side api() wrappers (cacheReads where safe)
marketing-crud.service.ts                       # NEW · ≤220 LOC · mutations w/ entityType+entityLabel
marketing.errors.ts                             # NEW · ≤80 LOC · error-code → user-string map

pages/
  CampaignListPage.tsx                          # ≤220 LOC · 4 states
  CampaignCreateWizard.tsx                      # ≤240 LOC · stepper shell only; steps imported
  CampaignDetailPage.tsx                        # ≤220 LOC · 4 states + cancel CTA
  TemplateListPage.tsx                          # ≤200 LOC
  TemplateFormPage.tsx                          # ≤230 LOC
  ReminderRuleListPage.tsx                      # ≤200 LOC
  ReminderRuleFormPage.tsx                      # ≤230 LOC

components/
  AudiencePicker.tsx                            # ≤220 LOC · debounced segment preview
  CampaignStatusBadge.tsx                       # ≤80  LOC
  ChannelToggle.tsx                             # ≤100 LOC
  TemplatePreview.tsx                           # ≤140 LOC · variable substitution preview
  RecipientTable.tsx                            # ≤200 LOC · cursor pagination
  CampaignWizardStep1Channel.tsx                # ≤140 LOC
  CampaignWizardStep2Template.tsx               # ≤160 LOC
  CampaignWizardStep3Audience.tsx               # ≤180 LOC
  CampaignWizardStep4Schedule.tsx               # ≤140 LOC
  CampaignWizardStep5Preview.tsx                # ≤180 LOC
  DltWarningBanner.tsx                          # ≤80  LOC
  ReminderTriggerPicker.tsx                     # ≤160 LOC · bottom-sheet on mobile

hooks/
  useCampaigns.ts                               # ≤120 LOC · useQuery (cacheReads:true)
  useCampaignDetail.ts                          # ≤140 LOC
  useCampaignLaunch.ts                          # ≤120 LOC · useMutation, online-only guard
  useReminderRules.ts                           # ≤140 LOC
  useMarketingTemplates.ts                      # ≤140 LOC
  useSegmentPreview.ts                          # ≤140 LOC · debounced
```

### 1.3 Shared / config

```
src/lib/marketing-segment.types.ts              # SegmentFilter type — shared with server import via build alias if desired; otherwise duplicate
server/src/lib/aisensy-signature.ts             # ≤100 LOC · HMAC verify
server/src/lib/msg91-signature.ts               # ≤100 LOC · HMAC verify
```

---

## 2. Schema migration sequence

Five migrations, each shipped as its own PR (or its own commit within PR1) so we can pause/rollback between them. **All additive**. No `NOT NULL` on existing tables. Order matters because of FKs.

### 2.1 Migration 1 — `20260509_marketing_party_cols`

```sql
ALTER TABLE "Party"
  ADD COLUMN "birthday" DATE,
  ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "marketingOptOutAt" TIMESTAMPTZ;
CREATE INDEX "Party_marketingOptOut_idx" ON "Party"("businessId","marketingOptOut") WHERE "marketingOptOut" = false;
```

`marketingOptOut` is `NOT NULL DEFAULT false` — safe because the default applies retroactively in PG; existing rows get `false` instantly. No backfill PR required.

### 2.2 Migration 2 — `20260510_marketing_template`

Creates `MarketingTemplate` only. Self-contained. No FKs from existing tables yet.

### 2.3 Migration 3 — `20260511_marketing_campaign`

Creates enums `CampaignStatus`, `RecipientDispatchStatus`, then `MarketingCampaign` and `MarketingCampaignRecipient` with FK → `MarketingTemplate` (must be after Migration 2) and FK → `Party` (`onDelete: Restrict`).

Index: `@@index([businessId, status, scheduledAt])` — drives the cron / dashboard queries.

### 2.4 Migration 4 — `20260512_reminder_rule`

Creates enum `ReminderRuleTrigger`, then `ReminderRule` with FK → `MarketingTemplate`. Independent of Migration 3.

### 2.5 Migration 5 — `20260513_reminder_instance`

Creates enum `ReminderInstanceStatus`, then `ReminderInstance` with the **idempotency unique** `(ruleId, partyId, fireDate)`. Must come after Migration 4.

```sql
CREATE UNIQUE INDEX "ReminderInstance_ruleId_partyId_fireDate_key"
  ON "ReminderInstance"("ruleId","partyId","fireDate");
CREATE INDEX "ReminderInstance_status_scheduledAt_idx"
  ON "ReminderInstance"("status","scheduledAt");
```

### 2.6 Rollback discipline

Already-shipped migrations are **immutable history** (per `PRISMA_MIGRATION_RULES.md`). To rollback a feature: ship a new migration that drops the new tables; never edit shipped migrations. New tables have no inbound FKs from older tables, so dropping them is safe.

---

## 3. API contracts

All routes mounted at `/api/marketing/*` and pass through `requireAuth`. Webhooks are mounted at `/api/webhooks/*` and are **public** (signature-checked, see §6).

Common envelope:

```ts
type ApiOk<T>  = { success: true;  data: T }
type ApiErr    = { success: false; error: { code: string; message: string; details?: unknown } }
```

### 3.1 Templates

| Method | Path | Auth | Idempotency |
|---|---|---|---|
| GET    | `/api/marketing/templates?channel=&cursor=&limit=` | requireAuth | n/a |
| POST   | `/api/marketing/templates` | requireAuth | `Idempotency-Key` header → existing `idempotency` middleware |
| GET    | `/api/marketing/templates/:id` | requireAuth | n/a |
| PUT    | `/api/marketing/templates/:id` | requireAuth | optimistic `updatedAt` check |
| DELETE | `/api/marketing/templates/:id` | requireAuth | soft delete |

Request — `POST /api/marketing/templates`:

```ts
interface CreateMarketingTemplateReq {
  name: string                    // 1..100
  channel: 'WHATSAPP' | 'SMS'
  bodyEn: string                  // 1..1000
  bodyHi?: string                 // 0..1000
  dltTemplateId?: string          // SMS only
  waTemplateName?: string         // WHATSAPP only
  variables?: string[]            // ["customerName","amount"]
}
```

Response — `MarketingTemplateRes` (see scope §API Contract).

### 3.2 Campaigns

| Method | Path | Auth | Idempotency |
|---|---|---|---|
| GET    | `/api/marketing/campaigns?status=&cursor=&limit=` | requireAuth | n/a |
| POST   | `/api/marketing/campaigns` | requireAuth | `Idempotency-Key` |
| GET    | `/api/marketing/campaigns/:id` | requireAuth | n/a |
| PUT    | `/api/marketing/campaigns/:id` | requireAuth (DRAFT only) | `If-Match: updatedAt` |
| POST   | `/api/marketing/campaigns/:id/launch` | requireAuth | naturally idempotent on `status` |
| POST   | `/api/marketing/campaigns/:id/cancel` | requireAuth + role≥ADMIN if RUNNING | naturally idempotent |
| GET    | `/api/marketing/campaigns/:id/recipients?cursor=&status=` | requireAuth | n/a |

Launch idempotency: re-POST returns 200 with current state. We rely on the campaign row's `status` as the lock — only a `DRAFT` row transitions; subsequent POSTs short-circuit.

### 3.3 Segment preview

```
POST /api/marketing/segments/preview
```

```ts
interface SegmentPreviewReq  { filter: SegmentFilter }
interface SegmentPreviewRes  {
  count: number                                  // capped at 10_001 (sentinel)
  sample: Array<{ id: string; name: string; phone: string | null; hasBirthday: boolean }>
}
```

Returns `count: 10001` if the segment exceeds the cap — UI shows "10,000+" and blocks launch.

### 3.4 Reminder rules

| Method | Path | Auth |
|---|---|---|
| GET    | `/api/marketing/reminder-rules?enabled=&cursor=` | requireAuth |
| POST   | `/api/marketing/reminder-rules` | requireAuth + Idempotency-Key |
| GET    | `/api/marketing/reminder-rules/:id` | requireAuth |
| PUT    | `/api/marketing/reminder-rules/:id` | requireAuth |
| DELETE | `/api/marketing/reminder-rules/:id` | requireAuth |
| POST   | `/api/marketing/reminder-rules/:id/toggle` | requireAuth |

### 3.5 Opt-out

| Method | Path | Auth |
|---|---|---|
| POST   | `/api/marketing/opt-out/:partyId` | requireAuth (business owner) |
| DELETE | `/api/marketing/opt-out/:partyId` | requireAuth |

A future "unsubscribe link" endpoint will live at `/api/public/unsubscribe/:token` (out of scope for this epic; flagged for security review).

### 3.6 Webhooks (public, signature-checked)

| Method | Path | Auth | Idempotency |
|---|---|---|---|
| POST | `/api/webhooks/aisensy` | HMAC sig verify | provider event id stored on `MarketingCampaignRecipient.externalId` — duplicates ignored |
| POST | `/api/webhooks/msg91` | HMAC sig verify | same — keyed by provider request id |

Webhook payload normalised to:

```ts
interface InboundDeliveryEvent {
  providerMessageId: string                      // Aisensy messageId / MSG91 requestId
  status: 'DELIVERED' | 'READ' | 'FAILED' | 'SENT'
  failureReason?: string
  occurredAt: string                             // ISO
  rawProviderPayload: unknown                    // stored for audit (truncated to 4 KB)
}
```

### 3.7 Error codes

```
TEMPLATE_DLT_MISSING        400  SMS launch w/o dltTemplateId
TEMPLATE_WA_NAME_MISSING    400  WA launch w/o waTemplateName
TEMPLATE_WA_NOT_APPROVED    400  WA launch with status != APPROVED
SEGMENT_EMPTY               400
SEGMENT_TOO_LARGE           400  > 10_000
INVALID_TRANSITION          409  campaign not in valid prior state
COST_CAP_EXCEEDED           402  estimated spend > business monthly cap
PROVIDER_NOT_CONFIGURED     503  (informational; campaigns degrade to SKIPPED, not 503)
WEBHOOK_BAD_SIGNATURE       401  signature verify failed (don't leak detail)
```

---

## 4. Cron architecture

### 4.1 Tick frequency & invariants

- Tick every **30 minutes** via existing `notification-cron.ts` (one place for all schedulers).
- A tick ALWAYS materialises the next 24 h window — so even if a tick is missed, the next tick catches up.
- **Invariants:**
  1. `(ruleId, partyId, fireDate)` is unique → DB rejects duplicates. The tick uses `prisma.reminderInstance.createMany({ skipDuplicates: true })`.
  2. A `ReminderInstance` is dispatched **at most once**: dispatch path is guarded by atomic update `WHERE status = 'PENDING' RETURNING *`.
  3. `fireDate` is normalised to `00:00:00Z` (UTC date) so two ticks on the same calendar day can't write distinct rows for the "same day".
  4. If the rule is deleted/disabled mid-cycle, PENDING instances flip to SKIPPED (`skipReason: 'rule_disabled'`).

### 4.2 Tick pseudocode (`reminder-cron.service.ts`)

```ts
export async function runReminderTick(now = new Date()): Promise<TickReport> {
  const report: TickReport = { rules: 0, materialised: 0, dispatched: 0, skipped: 0 }

  const rules = await prisma.reminderRule.findMany({
    where: { enabled: true, isDeleted: false },
    include: { template: true, business: { select: { id: true, reminderConfig: true } } },
  })

  for (const rule of rules) {
    report.rules++
    // 1. Compute candidate (partyId, fireDate) tuples for next 24h
    const candidates = await reminderTriggerService.candidatesFor(rule, now)

    // 2. Apply segmentFilter (reuses campaign-segment.service)
    const filtered = await campaignSegmentService.filterPartyIds(
      rule.businessId, rule.segmentFilter, candidates.map(c => c.partyId),
    )

    // 3. Drop opted-out parties (compliance gate #1)
    const eligible = await marketingComplianceService.dropOptedOut(filtered)

    const rows = candidates
      .filter(c => eligible.has(c.partyId))
      .map(c => ({
        ruleId: rule.id,
        partyId: c.partyId,
        fireDate: normaliseToUtcMidnight(c.fireDate),
        scheduledAt: marketingComplianceService.applyQuietHours(
          c.fireDate, rule.quietHoursStart, rule.quietHoursEnd, rule.business.reminderConfig,
        ),
        status: 'PENDING' as const,
      }))

    // 4. Bulk insert — unique constraint silently drops duplicates
    const inserted = await prisma.reminderInstance.createMany({
      data: rows, skipDuplicates: true,
    })
    report.materialised += inserted.count

    // 5. Dispatch any whose scheduledAt is now-due (atomic claim)
    const due = await prisma.reminderInstance.findMany({
      where: { ruleId: rule.id, status: 'PENDING', scheduledAt: { lte: now } },
      take: 200,
    })
    for (const inst of due) {
      const claimed = await prisma.reminderInstance.updateMany({
        where: { id: inst.id, status: 'PENDING' },
        data: { status: 'DISPATCHED', dispatchedAt: new Date() },
      })
      if (claimed.count !== 1) continue                  // lost the race; another worker took it

      const job = await notificationManager.notify(rule.eventKey, {
        businessId: rule.businessId,
        entityType: 'reminder_instance',
        entityId: inst.id,
        recipientPartyId: inst.partyId,
        channel: rule.channel,
        templateOverride: { marketingTemplateId: rule.templateId },
      })
      await prisma.reminderInstance.update({
        where: { id: inst.id }, data: { jobId: job.jobId },
      })
      report.dispatched++
    }
  }
  return report
}
```

The atomic `updateMany WHERE status='PENDING'` is the dispatch lock — guarantees at-most-once even if two workers run the tick concurrently.

### 4.3 Trigger candidate queries (`reminder-trigger.service.ts`)

| Trigger | Query |
|---|---|
| BIRTHDAY        | `Party WHERE birthday IS NOT NULL AND to_char(birthday,'MM-DD') = to_char(today + offsetDays,'MM-DD')` |
| PAYMENT_DUE     | `Invoice WHERE dueDate = today + offsetDays AND status != PAID` → return `partyId` |
| PAYMENT_OVERDUE | `Invoice WHERE dueDate = today - offsetDays AND outstandingPaise > 0` |
| FOLLOWUP        | `Party WHERE date(lastTransactionAt) = today - offsetDays` |
| INACTIVE        | `Party WHERE lastTransactionAt < today - offsetDays` (and no instance materialised in last `offsetDays`) |

INACTIVE is the riskiest — must dedupe so a party isn't reminded daily. Mitigated by `(ruleId,partyId,fireDate)` unique + cooldown logic that sets `fireDate = floor(today / offsetDays) * offsetDays`.

---

## 5. Campaign launch flow

### 5.1 Sequence

```
client → POST /:id/launch
  ↓
campaign.service.transitionToLaunching(campaignId)        // DRAFT → SCHEDULED (atomic)
  ↓
marketing-compliance.service:
  - assertTemplateReady(template, channel)                 // DLT/WA gates
  - assertProviderConfigured-or-skip                       // logs but proceeds
  ↓
marketing-cost-cap.service.assertWithinCap(business, est) // hard 402 if over
  ↓
campaign-segment.service.resolvePartyIds(filter, businessId)
  - applies segmentFilter
  - filters: marketingOptOut=false, isActive=true, phone IS NOT NULL, partyType match
  - LIMIT 10_001 (sentinel for too-large)
  ↓
chunked materialisation (CHUNK_SIZE = 500):
  for chunk of partyIds:
    prisma.marketingCampaignRecipient.createMany({
      data: chunk.map(pid => ({campaignId, partyId: pid, phone: snapshot, status:'QUEUED'})),
      skipDuplicates: true,
    })
  ↓
update campaign.recipientCount, status = RUNNING (or SCHEDULED if scheduledAt > now)
  ↓
respond 200 to client (don't block on enqueue completion)
  ↓
fire-and-forget (process.nextTick / queue): campaign-dispatch.service.enqueueAll(campaignId)
  - paginates recipients in QUEUED, chunks of 200
  - per recipient → notificationManager.notify() with marketingTemplateId override
  - on enqueue success: recipient.status=SENT, recipient.jobId, recipient.costPaise=estimate
  - on enqueue fail (rate limit / cap): recipient.status=SKIPPED + skipReason
  - increment campaign.sentCount / failedCount in batches via campaign-counter.service
```

### 5.2 Why chunk size 500 for materialisation, 200 for dispatch

- **Materialisation:** 500 keeps a single `INSERT … VALUES (…), (…)` under the PG parameter ceiling and avoids long-running statements that could conflict with the row lock taken when status flips.
- **Dispatch:** 200 matches the existing notification queue worker pull size. Producing more than the worker can drain in one tick wastes memory.
- Both numbers live in `marketing-config.ts` as named constants — tunable.

### 5.3 Counter aggregation

To avoid hot-row contention on `MarketingCampaign.sentCount` during a 10 K blast we accumulate locally and flush every 200 rows:

```ts
class CampaignCounterBuffer {
  private buf = new Map<string, { sent: number; failed: number; cost: number }>()
  inc(campaignId, kind, costPaise) { /* … */ }
  async flush() {
    for (const [cid, v] of this.buf) {
      await prisma.marketingCampaign.update({
        where: { id: cid },
        data: { sentCount: { increment: v.sent }, failedCount: { increment: v.failed }, totalCostPaise: { increment: v.cost } },
      })
    }
    this.buf.clear()
  }
}
```

Webhook updates (delivered / failed-after-send) also funnel through `campaign-counter.service` using `{ increment }` so they never clobber the launch-time counts.

---

## 6. Provider integration

### 6.1 Aisensy (WhatsApp)

- `whatsapp.provider.ts` — `isConfigured()` returns `!!process.env.AISENSY_API_KEY`. `send()` POSTs to `https://backend.aisensy.com/campaign/t1/api/v2`.
- Returns `externalId = aisensy.messageId`. We store this on `MarketingCampaignRecipient.jobId`'s linked `NotificationJob.providerMessageId` (already a column from Phase 1).
- **Webhook receipt** — Aisensy POSTs to `/api/webhooks/aisensy` with header `X-Aisensy-Signature: hex(hmac_sha256(rawBody, AISENSY_WEBHOOK_SECRET))`.

### 6.2 MSG91 (SMS)

- Existing `msg91.provider.ts`. `MarketingTemplate.dltTemplateId` flows in as `rendered.payload.smsDltTemplateId`.
- **Webhook receipt** — MSG91 POSTs to `/api/webhooks/msg91` with header `Authorization: <MSG91_WEBHOOK_TOKEN>` (MSG91 uses a static token, not HMAC — we wrap it with timing-safe compare).

### 6.3 Webhook handler pseudocode

```ts
// routes/webhooks/aisensy-webhook.ts
router.post('/api/webhooks/aisensy', express.raw({ type: 'application/json' }), async (req, res) => {
  const raw = req.body as Buffer                                   // raw bytes for HMAC
  const sig = req.header('x-aisensy-signature') ?? ''
  if (!verifyAisensySignature(raw, sig, env.AISENSY_WEBHOOK_SECRET)) {
    return res.status(401).json({ success: false, error: { code: 'WEBHOOK_BAD_SIGNATURE', message: 'invalid' } })
  }
  const payload = JSON.parse(raw.toString('utf8')) as AisensyWebhookBody
  const event = normaliseAisensy(payload)                          // → InboundDeliveryEvent

  // idempotent: keyed by providerMessageId
  const job = await prisma.notificationJob.findFirst({ where: { providerMessageId: event.providerMessageId } })
  if (!job) return res.status(200).json({ success: true })          // unknown id → ack to stop retries

  await prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      providerStatus: event.status,
      providerLastEventAt: event.occurredAt,
      providerEvents: { push: { ts: event.occurredAt, status: event.status } },
    },
  })

  // If this job was a campaign recipient → bump campaign counters
  if (job.entityType === 'campaign_recipient') {
    await campaignCounterService.applyWebhookEvent(job.entityId, event.status)
  } else if (job.entityType === 'reminder_instance') {
    await prisma.reminderInstance.update({
      where: { id: job.entityId },
      data: { /* status transitions on FAILED */ },
    })
  }
  return res.status(200).json({ success: true })
})
```

Same pattern for MSG91 with token compare instead of HMAC.

### 6.4 Counter update from webhooks

- `DELIVERED` → `MarketingCampaign.deliveredCount += 1`, `recipient.status = SENT` (already set), `recipient.dispatchedAt` confirmed.
- `FAILED` after we previously marked SENT → `failedCount += 1`, `sentCount -= 1`, recipient flips to FAILED. Done in a single `prisma.$transaction` to avoid drift.
- `READ` is recorded on the underlying `NotificationJob` only (no campaign counter for v1).

All counter math uses `{ increment: … }` — never reads-then-writes — so concurrent webhooks are safe.

---

## 7. Compliance gates

Three gates, in fixed order, on **every** outbound send (campaign or reminder):

```
gate 1: DLT-required guard           [marketing-compliance.service.assertTemplateReady]
gate 2: opt-out filter               [marketing-compliance.service.dropOptedOut]
gate 3: quiet-hours respect          [marketing-compliance.service.applyQuietHours]
            (delegates to existing notification-quiet-hours.service.computeScheduledAt)
```

| Gate | When | Where |
|---|---|---|
| DLT-required | At `POST /launch` (before any DB write) and at cron-tick rule-load time | `marketing-compliance.service.ts` |
| Opt-out filter | At segment resolution (campaign) and after candidate query (cron). Also re-checked at recipient-dispatch time as a belt-and-braces — we treat opt-out as a hard blocker with `skipReason: 'opted_out'` | `marketing-compliance.service.ts` |
| Quiet-hours | Always — every `NotificationJob` already runs through `notification-quiet-hours.service.computeScheduledAt`. Reminders additionally use rule-level overrides (`quietHoursStart/End`) before falling back to `ReminderConfig` | wraps existing service |

Gate failures produce DB-visible audit:
- Campaign: `MarketingCampaignRecipient.skipReason` ∈ `{opted_out, no_phone, dlt_missing, provider_not_configured}`.
- Reminder: `ReminderInstance.skipReason` similar.

---

## 8. Cost cap

The notification engine already has `notification-cost.service.ts` with `checkCap(businessId, costPaise)`. It is called per-job from the dispatch processor. For campaigns that's correct but reactive — we'd already have written 10 K recipient rows when the cap trips on row 1.

**Pre-launch interception** (`marketing-cost-cap.service.ts`):

```ts
async function assertWithinCap(businessId, channel, recipientCount) {
  const perMsg = costEstimatePaiseFor(channel)                     // 50 (WA) / 25 (SMS)
  const estimate = perMsg * recipientCount
  const { spentThisMonthPaise, capPaise } = await notificationCostService.getMonthlyUsage(businessId)
  if (capPaise != null && spentThisMonthPaise + estimate > capPaise) {
    throw new ApiError(402, 'COST_CAP_EXCEEDED', {
      estimatePaise: estimate, remainingPaise: capPaise - spentThisMonthPaise,
    })
  }
}
```

Called in `campaign-dispatch.service.launch()` immediately after segment resolution and **before** any recipient row is written. Per-job `checkCap` continues to run as the second line of defence (covers concurrent campaigns or reminder bursts).

---

## 9. Reuse map (no duplication)

| Concern | Existing module | Used from |
|---|---|---|
| Provider registry | `services/notifications/providers/index.ts` (`providerRegistry`) | `whatsapp.provider.ts` registers itself when `AISENSY_API_KEY` set; `msg91.provider.ts` already registered |
| Per-job dispatch | `notification-dispatch.service.ts` (`dispatchJob`) | called transitively via `notificationManager.notify` from `campaign-dispatch.service` and `reminder-cron.service` |
| Queue worker | `notification-dispatch-processor.service.ts` | unchanged — drains all jobs including campaign jobs |
| Quiet hours | `notification-quiet-hours.service.computeScheduledAt` | wrapped by `marketing-compliance.applyQuietHours` |
| Rate limits | `notification-rate-limit.service.ts` | called from existing dispatch — no marketing-side change |
| Cost caps | `notification-cost.service.ts` (`checkCap`, `getMonthlyUsage`) | reused by `marketing-cost-cap.service` for pre-launch + per-job |
| Templates (system events) | `notification-template.service.ts`, `notification-templates.data.ts` | NOT reused for marketing — `MarketingTemplate` is its own table; `notification-template-resolver` is taught to accept `templateOverride.marketingTemplateId` |
| Cron scheduler | `notification-cron.ts` | `reminder-cron.service.runReminderTick` registered as a new tick handler in this file (one-line change) |
| Event keys / meta | `notification-events.ts` | extended with 7 new keys + meta — single source of truth |
| Idempotency middleware | existing `idempotency` middleware | applied to POST routes that take `Idempotency-Key` |

The marketing layer is **strictly additive**: every new send still flows through `notificationManager.notify` so all existing observability, retries, provider failover, and DB schemas continue to apply.

---

## 10. PR sequence (6 PRs)

| # | Title | Touches | Gate / proof |
|---|---|---|---|
| PR1 | `feat(marketing): schema — Party cols + 5 new models` | `prisma/schema.prisma`, 5 migrations | `prisma migrate diff` clean, `tsc` clean, no app code changes |
| PR2 | `feat(marketing): templates CRUD + DLT/WA validation` | `routes/marketing.ts` (templates), `services/marketing/marketing-template.service.ts`, validators, client `TemplateListPage` + `TemplateFormPage` | curl POST/PUT/DELETE/list, screenshots 4 states, 320 px |
| PR3 | `feat(marketing): segment service + preview endpoint + opt-out` | `campaign-segment.service.ts`, `marketing-optout.service.ts`, `/segments/preview` route, `AudiencePicker` client | curl preview success/empty/too-large, 401 unauth, opt-out toggle screenshot |
| PR4 | `feat(marketing): campaigns CRUD + launch + dispatch` | campaign + dispatch + counter + cost-cap services, route, wizard pages | curl create→launch→detail; screenshots wizard 5 steps, list+detail 4 states |
| PR5 | `feat(marketing): reminder rules + cron tick + instance materialisation` | reminder-rule + reminder-cron + reminder-trigger services, registration in `notification-cron.ts`, ReminderRule pages | unit test of tick (idempotency proof), curl rule CRUD, screenshots |
| PR6 | `feat(marketing): provider webhooks (Aisensy + MSG91) + delivery counters` | `routes/webhooks/*`, signature libs, `whatsapp.provider.ts` real send, counter webhook handler | curl with valid+invalid signature, manual provider test in staging |

PR1 must merge first (schema). PR2/PR3 can ship in parallel after PR1. PR4 needs PR2 + PR3. PR5 needs PR4 (uses templates + segment service). PR6 ships last and is feature-flagged off until DLT + Aisensy approvals are in place.

---

## 11. Risk + rollback notes

| Risk | Likelihood | Blast radius | Rollback |
|---|---|---|---|
| Aisensy contract drifts from sandbox | M | All WA campaigns fail | Provider stays unregistered (`AISENSY_API_KEY` unset) → recipients SKIPPED, campaign COMPLETED (graceful). Toggle via env flag, no deploy needed. |
| Cron tick exceeds 30 min (slow growth) | L | Reminders late by one tick | Tick runtime metered; if > 10 min consistently, split per-business worker. Idempotency keeps re-runs safe. |
| 10 K-recipient launch overwhelms queue | M | Other transactional notifications delayed | Per-recipient rate-limit already exists; chunk-200 dispatch + queue priority (campaign jobs already MEDIUM, transactional HIGH per EVENT_META). |
| Webhook replay attack | M | False delivery counts | HMAC verify + dedupe by `providerMessageId`. Replay of valid event is idempotent (counters use `{increment}` only on first transition). |
| DLT registration delayed → SMS launches blocked | H | SMS campaigns unusable | Expected. UI banner is explicit. WA campaigns continue to work. |
| Bad segment query → wrong recipients | M | Spam to wrong audience | Mandatory preview step, 10 K cap, opt-out always honoured, recipient list visible post-launch with `skipReason`. Cancel endpoint stops further enqueue. |
| Migration order skew (FK before parent) | L | Deploy fails | Migrations are numbered (`20260509…20260513`) and self-test in CI via `prisma migrate diff`. |

**Rollback playbook:**
- Schema: ship a follow-up migration that drops the new tables (zero inbound FKs to existing tables — safe).
- Feature: env flag `MARKETING_ENABLED=false` short-circuits all `/api/marketing/*` routes (return 503) and prevents cron registration. Set via Render dashboard, no redeploy.
- Cron: comment out `notificationCron.register('reminder-tick', runReminderTick, '*/30 * * * *')` line or set `REMINDER_CRON_DISABLED=1`.

---

## 12. Open security review items

The following items must be cleared by the **security agent** before PR4 / PR6 merge. This list is not exhaustive — it is the architect's flag list. Security will produce `SECURITY_AUDIT_phase5_marketing_comms.md` covering at minimum:

1. **Auth on campaign endpoints**
   - All `/api/marketing/*` mounted under `requireAuth`. Confirm: route-level (not just app-level).
   - Role gating on `cancel` (RUNNING campaigns) — should it be OWNER only? Architect proposes ADMIN+; needs ratification.
   - Cross-business reads forbidden — every query filters by `req.user.businessId`. Audit each service for missed scope filter.
   - Templates and rules referenced by ID must be validated to belong to the caller's business — direct-object-reference attack surface.

2. **Segment query injection**
   - `SegmentFilter` is a JSON blob. `campaign-segment.service.ts` MUST translate it into Prisma query objects only — never string-concatenate into raw SQL.
   - `cityContains` is a free-text user input that lands in `ilike '%X%'`. With Prisma parameterised queries this is safe, but Prisma `Unsafe` calls must be banned in this service. ESLint rule (`no-restricted-syntax`) recommended.
   - `tags` array — bound to a max length (proposed 20) to avoid pathological `array_agg` queries.
   - `outstandingGtePaise` — must be coerced to integer; reject NaN/negative/Number.MAX.
   - All filter inputs run through Zod with strict shapes.

3. **Webhook signature verification**
   - Aisensy: HMAC-SHA256 over raw body using `AISENSY_WEBHOOK_SECRET`. Use `crypto.timingSafeEqual`. Reject if header missing.
   - MSG91: static bearer token compare with `timingSafeEqual`. Token rotated quarterly.
   - Body parser must be `express.raw({ type: 'application/json' })` for the webhook routes — otherwise the verified signature won't match the actual bytes.
   - Replay protection: dedupe by `providerMessageId` (already implied by idempotent `{increment}` updates), and reject events older than 24 h (`occurredAt` skew guard).
   - 401 responses for failed verification should not leak which check failed (just `WEBHOOK_BAD_SIGNATURE`).

4. **Bulk PII dispatch**
   - Recipient `phone` is snapshot at launch time → stored in `MarketingCampaignRecipient.phone`. Confirm: this column should be eligible for retention purge (e.g. drop after 90 days) per existing `notification-retention.service` policy.
   - Job payloads must NOT carry the phone; they carry `partyId` and the worker resolves at send time. This matches Phase 1 pattern; review the new `campaign-dispatch` to ensure it doesn't accidentally log full payloads.
   - Log redaction: phone numbers must be masked in any structured log emitted from the marketing services.

5. **Public unsubscribe link** (out of scope for this epic but flagged)
   - When implemented, must use a signed token (HMAC over `partyId + businessId + nonce`), single-use, 30-day TTL. Architect recommends raising it as its own SCOPE doc when scheduled.

6. **Rate limiting of the launch endpoint itself**
   - One business launching 100 campaigns/min = abuse vector. Recommend adding express-rate-limit at 5 launches per minute per businessId.

7. **Idempotency-Key handling**
   - Existing middleware reuses last response if same key; ensure `POST /launch` is also keyed correctly so a retried network request never re-launches.

8. **Cron worker auth**
   - `runReminderTick` runs in-process and uses Prisma directly — no auth context. Confirm no service inside the tick performs an action that assumes `req.user` (architect: none should).

---

*End of ARCHITECTURE — Phase 5 Epic A: Marketing Communications*
