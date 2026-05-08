# SCOPE — Phase 5 Epic A: Marketing Communications
## Features #123 WhatsApp Campaigns · #124 SMS Campaigns · #126 Service/Payment Reminders

**Status:** DRAFT — 2026-05-08
**Author:** Sawan Jaiswal
**Personas:** Raju (basic), Priya (primary), Amit (power user)

---

## Summary

Phase 5 Epic A delivers outbound marketing communications to HisaabPro businesses: bulk WhatsApp and SMS campaigns to segmented customer lists, plus recurring reminder rules (birthday wishes, due-date nudges, follow-up sequences). All three features share the same provider abstraction and dispatch queue already in place from Phase 1 notifications (commit bea1093). No new provider infrastructure is introduced — the existing `providerRegistry`, `notificationManager`, and job queue are reused wholesale.

---

## Goals

- Priya can send a Diwali offer to all customers who bought in the last 30 days, via WhatsApp, from her phone, in under 2 minutes.
- Amit can set up a recurring "payment due in 3 days" reminder rule that fires automatically, zero manual effort per invoice.
- Raju can opt out customers who complained about spam without losing their other data.
- All sends respect Indian quiet hours (21:00–09:00 IST), party opt-out, and DLT compliance for SMS.

---

## Non-Goals (explicitly deferred)

- Rich media / image / document attachments in campaigns (Phase 7)
- A/B testing of campaign templates (Phase 7)
- Two-way reply parsing / inbox (Phase 7, WhatsApp Bot epic)
- In-app chat with customers (Phase 7)
- Email marketing campaigns (no Resend cost model yet)
- PUSH campaigns (platform policies prohibit mass promotional push)
- Autoresponders / drip sequences with branching logic (Phase 7)
- Built-in URL shortener / click tracking (Phase 7)
- Landing pages for campaigns (Phase 7)
- Delivery receipts / read receipts webhooks from Aisensy (Phase 7 — requires webhook endpoint)

---

## Personas

| Persona | Usage pattern |
|---------|--------------|
| Raju (micro retailer) | Sends one-off festival promos via WhatsApp, uses birthday reminder rule set-and-forget |
| Priya (growing wholesaler) | Segments by outstanding > Rs 5K, sends payment follow-up campaigns, reviews delivered/failed counts |
| Amit (distributor) | Manages 3-4 reminder rules per customer segment, tracks campaign cost budget |

---

## Defaults (decided, not questioned)

| Decision | Default | Rationale |
|----------|---------|-----------|
| Segment definition | JSON filter blob v1 (no saved segment builder) | Fastest to ship; builder in Phase 5C |
| Campaign status lifecycle | DRAFT → SCHEDULED → RUNNING → COMPLETED / FAILED | Mirrors existing notification job statuses |
| Reminder rule cron tick | Every 30 minutes | Balances timeliness vs DB load |
| Reminder idempotency window | 24 hours (ruleId + partyId + scheduledDate) | Prevents double-send on cron restart |
| Max recipients per campaign | 10,000 (soft cap, enforced at API layer) | Prevents accidental spam blast; Priya tier |
| Quiet hours enforcement | Business's own `ReminderConfig.quietHoursStart/End` (existing); fallback 21:00–09:00 IST | Reuse what's there |
| WhatsApp campaign cost estimate | 50 paise per message (template message pricing) | Aisensy template category pricing |
| SMS campaign cost estimate | 25 paise per message | Reuses msg91Provider.estimateCostPaise() |
| New event keys for campaigns | `MARKETING_CAMPAIGN_WHATSAPP`, `MARKETING_CAMPAIGN_SMS` | Added to EVENT_KEYS + EVENT_META |
| Reminder rule event keys | `REMINDER_BIRTHDAY`, `REMINDER_PAYMENT_DUE`, `REMINDER_FOLLOWUP` | Added to EVENT_KEYS + EVENT_META |
| Template ownership | Business creates their own templates (not system templates); stored in new `MarketingTemplate` table | Keeps system NotificationTemplate clean |
| Party birthday field | Added as `birthday Date?` on Party | Not present today |
| Party marketing opt-out | Added as `marketingOptOut Boolean @default(false)` on Party | Not present today |

---

## Data Model Deltas

All new models added via `prisma migrate dev`. No existing model columns removed or made non-nullable without backfill.

### New column on existing model: Party

```prisma
model Party {
  // ... existing fields ...
  birthday         DateTime? // date only; time portion ignored
  marketingOptOut  Boolean   @default(false)
  marketingOptOutAt DateTime?
}
```

Migration: `ALTER TABLE "Party" ADD COLUMN "birthday" DATE, ADD COLUMN "marketingOptOut" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "marketingOptOutAt" TIMESTAMPTZ;`

---

### New model: MarketingTemplate

Stores business-owned WhatsApp/SMS templates. Not to be confused with `NotificationTemplate` (system events). Marketing templates require DLT registration for SMS.

```prisma
model MarketingTemplate {
  id          String   @id @default(cuid())
  businessId  String
  name        String   @db.VarChar(100)
  channel     String   // WHATSAPP | SMS
  bodyEn      String   @db.Text
  bodyHi      String?  @db.Text
  // SMS only
  dltTemplateId    String?  @db.VarChar(60)
  dltRegistered    Boolean  @default(false)
  // WhatsApp only — Aisensy template name (pre-approved by Meta)
  waTemplateName   String?  @db.VarChar(80)
  waTemplateStatus String?  @default("PENDING") // PENDING | APPROVED | REJECTED
  // Substitution variable names in order e.g. ["customerName","amount"]
  variables        String[] @default([])
  isActive         Boolean  @default(true)
  isDeleted        Boolean  @default(false)
  deletedAt        DateTime?
  createdBy        String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  business  Business            @relation(fields: [businessId], references: [id], onDelete: Cascade)
  campaigns MarketingCampaign[]

  @@unique([businessId, name, channel])
  @@index([businessId, channel, isActive])
  @@index([businessId, isDeleted])
}
```

---

### New model: MarketingCampaign

One campaign = one blast to one segment via one channel.

```prisma
enum CampaignStatus {
  DRAFT
  SCHEDULED
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

model MarketingCampaign {
  id          String         @id @default(cuid())
  businessId  String
  name        String         @db.VarChar(100)
  channel     String         // WHATSAPP | SMS
  templateId  String
  // Segment as JSON filter blob: { tags, cityContains, inactiveDays, outstandingGtePaise, birthdayThisWeek }
  segmentFilter Json         @default("{}")
  // Resolved at dispatch time — snapshot count
  recipientCount Int         @default(0)
  scheduledAt   DateTime?   // null = send immediately on launch
  startedAt     DateTime?
  completedAt   DateTime?
  status        CampaignStatus @default(DRAFT)
  // Aggregated counters updated by dispatch processor
  sentCount      Int         @default(0)
  deliveredCount Int         @default(0) // updated via webhook later; 0 until webhook wired
  failedCount    Int         @default(0)
  // Total cost in paise
  totalCostPaise Int         @default(0)
  // Vars substitution defaults (override per-recipient in processor)
  defaultVars   Json         @default("{}")
  isDeleted     Boolean      @default(false)
  deletedAt     DateTime?
  createdBy     String
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  business   Business                    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  template   MarketingTemplate           @relation(fields: [templateId], references: [id], onDelete: Restrict)
  recipients MarketingCampaignRecipient[]

  @@index([businessId, status, scheduledAt])
  @@index([businessId, isDeleted])
  @@index([businessId, createdAt])
}
```

---

### New model: MarketingCampaignRecipient

One row per party in a campaign. Written during launch; updated by dispatch processor.

```prisma
enum RecipientDispatchStatus {
  QUEUED
  SENT
  FAILED
  SKIPPED // opted-out, no phone, quiet hours blocked permanently
}

model MarketingCampaignRecipient {
  id          String                  @id @default(cuid())
  campaignId  String
  partyId     String
  phone       String?                 @db.VarChar(20) // snapshot at dispatch time
  status      RecipientDispatchStatus @default(QUEUED)
  // jobId from NotificationJob — links to existing queue
  jobId       String?
  skipReason  String?                 @db.VarChar(80)
  dispatchedAt DateTime?
  failedAt    DateTime?
  costPaise   Int                     @default(0)
  createdAt   DateTime                @default(now())

  campaign  MarketingCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  party     Party             @relation(fields: [partyId], references: [id], onDelete: Restrict)

  @@unique([campaignId, partyId])
  @@index([campaignId, status])
  @@index([campaignId, createdAt])
}
```

---

### New model: ReminderRule

Recurring rule definition. Replaces and extends the ad-hoc `PaymentReminder` rows for the scheduled-reminder use case. `PaymentReminder` stays for Phase 1 ad-hoc reminders; `ReminderRule` is for recurring automation.

```prisma
enum ReminderRuleTrigger {
  BIRTHDAY          // fires on party.birthday each year
  PAYMENT_DUE       // fires X days before invoice dueDate
  PAYMENT_OVERDUE   // fires X days after invoice dueDate passes unpaid
  FOLLOWUP          // fires X days after last transaction
  INACTIVE          // fires when party has no txn for X days
}

model ReminderRule {
  id          String               @id @default(cuid())
  businessId  String
  name        String               @db.VarChar(100)
  trigger     ReminderRuleTrigger
  // Number of days before/after the trigger event
  offsetDays  Int                  @default(0)
  channel     String               // WHATSAPP | SMS
  templateId  String
  // JSON segment filter (same shape as MarketingCampaign.segmentFilter)
  segmentFilter Json               @default("{}")
  enabled     Boolean              @default(true)
  // Quiet hours override — null means use business ReminderConfig
  quietHoursStart String?          @db.VarChar(5) // HH:MM
  quietHoursEnd   String?          @db.VarChar(5)
  isDeleted   Boolean              @default(false)
  deletedAt   DateTime?
  createdBy   String
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  business   Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  template   MarketingTemplate @relation(fields: [templateId], references: [id], onDelete: Restrict)
  instances  ReminderInstance[]

  @@index([businessId, enabled])
  @@index([businessId, trigger, enabled])
  @@index([businessId, isDeleted])
}
```

---

### New model: ReminderInstance

One materialised future send for a specific party+rule combination. Written by the cron tick service for sends due in the next 24 hours. Idempotency prevents double-write.

```prisma
enum ReminderInstanceStatus {
  PENDING   // written by cron, not yet dispatched
  DISPATCHED
  FAILED
  SKIPPED
}

model ReminderInstance {
  id          String                  @id @default(cuid())
  ruleId      String
  partyId     String
  // Logical date this instance fires for (for idempotency: ruleId+partyId+fireDate)
  fireDate    DateTime                // date only, normalised to midnight UTC
  scheduledAt DateTime                // exact send time after quiet-hours adjustment
  status      ReminderInstanceStatus  @default(PENDING)
  jobId       String?                 // set when dispatched via notification queue
  skipReason  String?                 @db.VarChar(80)
  dispatchedAt DateTime?
  costPaise   Int                     @default(0)
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  rule   ReminderRule @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  party  Party        @relation(fields: [partyId], references: [id], onDelete: Restrict)

  @@unique([ruleId, partyId, fireDate]) // idempotency key
  @@index([status, scheduledAt])
  @@index([ruleId, status])
  @@index([partyId])
}
```

---

## Relation additions on existing models

```prisma
// Party — add to existing model
marketingCampaignRecipients MarketingCampaignRecipient[]
reminderInstances           ReminderInstance[]

// Business — add to existing model
marketingTemplates   MarketingTemplate[]
marketingCampaigns   MarketingCampaign[]
reminderRules        ReminderRule[]
```

---

## Segment Filter Schema

Used by both `MarketingCampaign.segmentFilter` and `ReminderRule.segmentFilter`.

```ts
interface SegmentFilter {
  tags?: string[]              // party.tags contains ALL listed tags
  cityContains?: string        // party addresses: city ilike %cityContains%
  inactiveDays?: number        // party.lastTransactionAt < now() - inactiveDays
  outstandingGtePaise?: number // party.outstandingBalance > outstandingGtePaise
  birthdayThisWeek?: boolean   // party.birthday within next 7 calendar days
  partyType?: 'CUSTOMER' | 'SUPPLIER' | 'BOTH' // default CUSTOMER
}
```

Segment resolution is a synchronous DB query at campaign launch time (not pre-computed). Max 10,000 results enforced at query layer.

---

## Notification Engine Extensions

### New EVENT_KEYS added to `notification-events.ts`

```ts
MARKETING_CAMPAIGN_WHATSAPP: 'MARKETING_CAMPAIGN_WHATSAPP',
MARKETING_CAMPAIGN_SMS:      'MARKETING_CAMPAIGN_SMS',
REMINDER_BIRTHDAY:           'REMINDER_BIRTHDAY',
REMINDER_PAYMENT_DUE:        'REMINDER_PAYMENT_DUE',
REMINDER_PAYMENT_OVERDUE_AUTO: 'REMINDER_PAYMENT_OVERDUE_AUTO',
REMINDER_FOLLOWUP:           'REMINDER_FOLLOWUP',
REMINDER_INACTIVE:           'REMINDER_INACTIVE',
```

### EVENT_META entries (new)

| EventKey | defaultChannels | priority | requiresOptIn | costEstimatePaise |
|----------|----------------|----------|---------------|-------------------|
| MARKETING_CAMPAIGN_WHATSAPP | WHATSAPP | MEDIUM | true | 50 |
| MARKETING_CAMPAIGN_SMS | SMS | MEDIUM | true | 25 |
| REMINDER_BIRTHDAY | WHATSAPP, SMS | LOW | true | 50 |
| REMINDER_PAYMENT_DUE | WHATSAPP, SMS | HIGH | false | 50 |
| REMINDER_PAYMENT_OVERDUE_AUTO | SMS | HIGH | false | 25 |
| REMINDER_FOLLOWUP | WHATSAPP, SMS | LOW | true | 50 |
| REMINDER_INACTIVE | SMS | LOW | true | 25 |

Marketing events use `requiresOptIn: true`. The dispatch service skips parties where `party.marketingOptOut = true` BEFORE calling the existing preference check.

---

## Provider Abstraction

### WhatsApp (Aisensy)

```
ENV VAR: AISENSY_API_KEY
```

`whatsapp.provider.ts` already exists as a stub. The real implementation will:
1. Check `process.env.AISENSY_API_KEY` in `isConfigured()`.
2. `send()` POSTs to `https://backend.aisensy.com/campaign/t1/api/v2` with `campaignName`, `userName`, `templateParams` array.
3. Requires `waTemplateName` on `MarketingTemplate` — passed as `campaignName` field.
4. Returns Aisensy `messageId` as `externalId`.
5. Cost estimate: 50 paise (`estimateCostPaise()`).
6. Register with `providerRegistry.register('WHATSAPP', whatsappProvider)` when `isConfigured()` is true.

When `AISENSY_API_KEY` is absent, `isConfigured()` returns false, campaigns targeting WHATSAPP get all recipients marked `SKIPPED` with `skipReason: 'provider_not_configured'`, campaign status transitions to `COMPLETED` (not `FAILED`).

### SMS (MSG91)

Already implemented in `msg91.provider.ts`. No changes needed except ensuring `MarketingTemplate.dltTemplateId` is passed as `rendered.payload.smsDltTemplateId` by the campaign dispatch service.

### Stub local behaviour

Both providers degrade gracefully: `isConfigured()` returns false → dispatch processor marks all recipients SKIPPED → campaign completes. No crash, no partial state. Local dev works without any credentials.

---

## API Surface

All routes under `/api/marketing`. Auth: `requireAuth` middleware. Business-scoped — every query filters by `req.user.businessId`.

### Marketing Templates

```
GET    /api/marketing/templates              list (channel filter, cursor pagination)
POST   /api/marketing/templates             create
GET    /api/marketing/templates/:id         get one
PUT    /api/marketing/templates/:id         update (only DRAFT/PENDING templates)
DELETE /api/marketing/templates/:id         soft delete
```

### Campaigns

```
GET    /api/marketing/campaigns             list (status filter, cursor pagination)
POST   /api/marketing/campaigns             create campaign (DRAFT)
GET    /api/marketing/campaigns/:id         get detail (includes sent/delivered/failed counts)
PUT    /api/marketing/campaigns/:id         update (DRAFT only — name, template, segment, scheduledAt)
POST   /api/marketing/campaigns/:id/launch  transition DRAFT → SCHEDULED or RUNNING
POST   /api/marketing/campaigns/:id/cancel  cancel SCHEDULED or RUNNING
GET    /api/marketing/campaigns/:id/recipients  list recipients with dispatch status (cursor paginated)
```

### Segment preview (not a campaign save)

```
POST   /api/marketing/segments/preview      return { count, sample: Party[5] } for a segment filter
```

### Reminder Rules

```
GET    /api/marketing/reminder-rules        list rules (enabled filter)
POST   /api/marketing/reminder-rules        create rule
GET    /api/marketing/reminder-rules/:id    get one
PUT    /api/marketing/reminder-rules/:id    update rule
DELETE /api/marketing/reminder-rules/:id    soft delete (+ cancels future instances)
POST   /api/marketing/reminder-rules/:id/toggle  enable/disable
```

### Opt-out

```
POST   /api/marketing/opt-out/:partyId      set party.marketingOptOut = true
DELETE /api/marketing/opt-out/:partyId      clear opt-out (opt back in)
```

---

## API Contract

### POST /api/marketing/templates

```ts
interface CreateMarketingTemplateReq {
  name: string                    // max 100 chars
  channel: 'WHATSAPP' | 'SMS'
  bodyEn: string                  // max 1000 chars
  bodyHi?: string
  dltTemplateId?: string          // required for SMS before campaign launch
  waTemplateName?: string         // required for WHATSAPP before campaign launch
  variables?: string[]            // e.g. ["customerName","amount"]
}

interface MarketingTemplateRes {
  id: string
  name: string
  channel: string
  bodyEn: string
  bodyHi: string | null
  dltTemplateId: string | null
  waTemplateName: string | null
  waTemplateStatus: string
  dltRegistered: boolean
  variables: string[]
  isActive: boolean
  createdAt: string
}
```

### POST /api/marketing/campaigns

```ts
interface CreateCampaignReq {
  name: string                    // max 100 chars
  channel: 'WHATSAPP' | 'SMS'
  templateId: string
  segmentFilter: SegmentFilter
  scheduledAt?: string            // ISO 8601; null = send now on launch
  defaultVars?: Record<string, string>
}

interface CampaignRes {
  id: string
  name: string
  channel: string
  templateId: string
  segmentFilter: object
  recipientCount: number
  scheduledAt: string | null
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  sentCount: number
  deliveredCount: number
  failedCount: number
  totalCostPaise: number
  createdAt: string
  updatedAt: string
}
```

### POST /api/marketing/campaigns/:id/launch

Request: empty body.

Response:
```ts
{ success: true, data: { campaignId: string, recipientCount: number, status: string } }
```

Validation errors:
- Template has no `dltTemplateId` (SMS) → 400 `TEMPLATE_DLT_MISSING`
- Template has no `waTemplateName` (WHATSAPP) → 400 `TEMPLATE_WA_NAME_MISSING`
- Segment resolves 0 recipients → 400 `SEGMENT_EMPTY`
- Segment resolves > 10,000 recipients → 400 `SEGMENT_TOO_LARGE`
- Campaign not in DRAFT status → 409 `INVALID_TRANSITION`

### POST /api/marketing/segments/preview

```ts
interface SegmentPreviewReq { filter: SegmentFilter }
interface SegmentPreviewRes {
  count: number
  sample: Array<{ id: string; name: string; phone: string | null }>
}
```

### POST /api/marketing/reminder-rules

```ts
interface CreateReminderRuleReq {
  name: string
  trigger: 'BIRTHDAY' | 'PAYMENT_DUE' | 'PAYMENT_OVERDUE' | 'FOLLOWUP' | 'INACTIVE'
  offsetDays: number              // 0-90
  channel: 'WHATSAPP' | 'SMS'
  templateId: string
  segmentFilter?: SegmentFilter
  quietHoursStart?: string        // HH:MM, e.g. "21:00"
  quietHoursEnd?: string          // HH:MM, e.g. "09:00"
}
```

### Error shapes (all endpoints)

```ts
// 400
{ success: false, error: { code: string, message: string } }
// 401
{ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }
// 404
{ success: false, error: { code: 'NOT_FOUND', message: '...' } }
// 409
{ success: false, error: { code: 'INVALID_TRANSITION', message: '...' } }
```

### Idempotency

Campaign launch: `POST /launch` is idempotent — if campaign is already SCHEDULED/RUNNING/COMPLETED, returns current status with 200 (no re-launch).

Reminder instance writes: unique constraint on `(ruleId, partyId, fireDate)` — `upsert` with `skipDuplicates: true` in cron service.

---

## Backend Services

### `campaign-dispatch.service.ts`

Called by `POST /launch`. Responsibilities:
1. Resolve segment → Party list (filtered by `marketingOptOut = false`, `isActive = true`, `phone IS NOT NULL`).
2. Write `MarketingCampaignRecipient` rows in batch (skipDuplicates).
3. Update `campaign.recipientCount`.
4. For each recipient: call `notificationManager.notify(eventKey, ctx)` where `ctx.entityType = 'campaign'`, `ctx.entityId = campaignId`. The existing dispatch pipeline handles quiet hours, rate limits, cost cap, and enqueue.
5. Mark campaign `RUNNING` (or `SCHEDULED` if `scheduledAt` is future).
6. After all jobs enqueued, transition to `COMPLETED` synchronously for small batches (< 500). For large batches, a background worker polls `NotificationJob` statuses and updates counters every 60 seconds.

Template variable substitution: replace `{{customerName}}` with `party.name`, `{{amount}}` with `party.outstandingBalance` formatted as rupees, etc. Variable map is resolved per-recipient in the dispatch loop.

### `reminder-cron.service.ts`

Extends existing `notification-cron.ts`. New tick function runs every 30 minutes:

```
FOR EACH enabled ReminderRule:
  compute fireDate candidates based on trigger:
    BIRTHDAY         → parties where birthday falls today+offsetDays, within next 24h
    PAYMENT_DUE      → invoices where dueDate = today + offsetDays
    PAYMENT_OVERDUE  → invoices where dueDate = today - offsetDays AND outstanding > 0
    FOLLOWUP         → parties where lastTransactionAt = today - offsetDays
    INACTIVE         → parties where lastTransactionAt < today - offsetDays AND no txn since
  
  apply segmentFilter
  filter out marketingOptOut = true
  
  FOR EACH matching party:
    upsert ReminderInstance { ruleId, partyId, fireDate }
    if new instance AND scheduledAt <= now():
      call notificationManager.notify(eventKey, ctx)
      update instance.status = DISPATCHED, instance.jobId
```

Idempotency: the `@@unique([ruleId, partyId, fireDate])` constraint on `ReminderInstance` means re-running the cron on the same day never double-writes. `upsert` with `skipDuplicates` handles the race.

---

## Frontend Pages & Routes

```
/marketing                              → redirect to /marketing/campaigns
/marketing/campaigns                    CampaignListPage
/marketing/campaigns/new                CampaignCreateWizard (5 steps)
/marketing/campaigns/:id                CampaignDetailPage
/marketing/templates                    TemplateListPage
/marketing/templates/new                TemplateFormPage (create)
/marketing/templates/:id/edit           TemplateFormPage (edit)
/marketing/reminders                    ReminderRuleListPage
/marketing/reminders/new                ReminderRuleFormPage (create)
/marketing/reminders/:id/edit           ReminderRuleFormPage (edit)
```

### Campaign Create Wizard (5 steps, single-page stepper on mobile)

```
Step 1: Name + Channel (WhatsApp / SMS toggle)
Step 2: Template picker (list of business templates for chosen channel)
Step 3: Audience / Segment builder (tag multiselect, city input, outstanding slider, inactive days, birthday toggle) + live preview count
Step 4: Schedule (Send Now / Schedule toggle → datetime picker, IST)
Step 5: Preview (rendered template with sample vars + recipient count) → Launch button
```

Progress: saved to local state only (not persisted to server until final Launch). Campaign created as DRAFT on Step 5 submit; LAUNCH called immediately after.

---

## UI States (all screens)

### CampaignListPage

- **Loading:** Skeleton rows (3), full-width, 12px radius cards
- **Empty:** "No campaigns yet" + "Create your first campaign" CTA button
- **Error:** "Could not load campaigns. Tap to retry." + retry button
- **Populated:** Cursor-paginated list; each row shows name, channel icon, status badge (color-coded), sent/failed counts, date

### CampaignDetailPage

- **Loading:** Skeleton header + 3 stat cards
- **Error:** "Could not load campaign details." + retry
- **Empty (no recipients yet):** "Campaign has no recipients yet." (shown while DRAFT)
- **Populated:** Name, status badge, sent/delivered/failed counts, cost in rupees, recipient list (paginated), Cancel button if SCHEDULED/RUNNING

### CampaignCreateWizard

- **Loading (segment preview):** Spinner inside audience step card "Counting recipients..."
- **Error (preview failed):** "Could not estimate audience. Check your filters." inline below filter
- **Empty segment:** "No customers match these filters. Adjust filters to continue." — blocks advance to step 4
- **Launch success:** Toast "Campaign launched! Sending to {{count}} customers." → navigate to CampaignDetailPage

### ReminderRuleListPage

- **Loading:** Skeleton rows
- **Empty:** "No reminder rules. Set up automatic follow-ups." + "Create rule" CTA
- **Error:** "Could not load rules." + retry
- **Populated:** Rule name, trigger type badge, channel icon, enabled toggle, edit/delete actions

### ReminderRuleFormPage

- **Saving:** Button shows "Saving..." disabled state
- **Save success:** Toast "Reminder rule saved." → navigate back to list
- **Save error:** Toast "Could not save rule. Please try again."
- **Delete confirm:** Bottom sheet "Delete this rule? Future reminders will be cancelled." — Confirm / Cancel

### TemplateFormPage

- **Saving:** "Saving..." button state
- **Success:** Toast "Template saved."
- **DLT warning (SMS, no dltTemplateId):** Yellow inline banner "DLT Template ID required before this template can be used in a campaign. Add it in settings."
- **Character count:** Live SMS char counter (160 limit highlighted in orange > 140)

---

## UX Copy

### Buttons
- Create campaign: "New Campaign"
- Launch campaign (wizard step 5): "Launch Campaign"
- Cancel campaign: "Cancel Campaign"
- Create template: "New Template"
- Create rule: "New Reminder Rule"
- Toggle rule: "Pause Rule" / "Enable Rule"
- Opt-out action (on party detail): "Stop Marketing Messages"
- Opt-in action: "Allow Marketing Messages"

### Success toasts
- Campaign launched: "Campaign launched! Sending to {{count}} customers."
- Campaign cancelled: "Campaign cancelled."
- Template saved: "Template saved."
- Reminder rule saved: "Reminder rule saved."
- Party opted out: "{{partyName}} will no longer receive marketing messages."
- Party opted in: "Marketing messages re-enabled for {{partyName}}."

### Error toasts
- Launch fail — empty segment: "No customers match these filters."
- Launch fail — too large: "Audience too large (max 10,000). Add more filters."
- Launch fail — DLT missing: "Add DLT Template ID to this template before launching an SMS campaign."
- Launch fail — WA name missing: "Add WhatsApp template name before launching."
- Network fail: "Could not send request. Check your connection."

### Confirmation dialogs
- Cancel campaign: "Cancel this campaign? Messages already sent will not be recalled." — "Yes, Cancel" / "Keep Running"
- Delete template: "Delete this template? Campaigns using it cannot be re-launched." — "Delete" / "Cancel"
- Delete rule: "Delete this reminder rule? Scheduled reminders will be cancelled." — "Delete" / "Cancel"

---

## Compliance

### Opt-out

- `party.marketingOptOut = true` blocks ALL marketing sends (campaigns + reminder rules) for that party.
- Checked BEFORE the notification engine preference check in `campaign-dispatch.service.ts` and `reminder-cron.service.ts`.
- Recipients skipped due to opt-out get `skipReason: 'opted_out'` in `MarketingCampaignRecipient`.
- Opt-out accessible from Party detail page → "..." menu → "Stop Marketing Messages".
- Opt-out API is public (no auth) only if accessed via a future unsubscribe link; the management API requires auth.
- Opt-out is not deleted when party is deleted — soft delete preserves it.

### DLT (Indian SMS Telecom Compliance)

- `MarketingTemplate.dltTemplateId` is required for any SMS campaign launch (enforced at `POST /launch`).
- `MarketingTemplate.dltRegistered` is a manual flag set by the business owner to confirm they have registered the template with TRAI via MSG91 portal.
- The system does NOT auto-register DLT — that is a manual regulatory process. The UI shows a persistent banner on the template form until `dltRegistered = true`.
- DLT template ID is passed through as `rendered.payload.smsDltTemplateId` into the existing MSG91 provider, which already requires and validates it.
- Sender ID (`MSG91_SENDER_ID`) must be DLT-registered — env var responsibility.

### Quiet Hours

- Default: 21:00–09:00 IST.
- Per-rule override: `ReminderRule.quietHoursStart/End` — if null, falls back to `ReminderConfig` for that business.
- Campaigns: always use business `ReminderConfig` quiet hours (no per-campaign override in v1).
- Enforcement: existing `computeScheduledAt()` from `notification-quiet-hours.service.ts` is called for every job — no new logic needed.
- If a campaign is launched at 20:30, all jobs get `scheduledAt = 09:00 next day`.

### Rate Limits

- Existing `checkRateLimit()` in notification engine applies per-user (business owner) per channel.
- Campaign sends go through the same rate limiter — per-recipient, not per-campaign. Large campaigns spread naturally over the queue processor tick interval.
- No additional campaign-level rate limiting in v1.

---

## Mobile Layout

- 375px primary layout. All campaign/template/rule list pages use full-width cards with 12px radius.
- 320px minimum: wizard steps use single-column layout; segment filter controls stack vertically; no horizontal overflow.
- Campaign Create Wizard: uses a horizontal step indicator (numbered dots) that fits 5 steps at 320px.
- Template body textarea: 4 rows minimum, scrollable, full width.
- Launch button: full-width, 52px height, blue, bottom of screen (safe area aware via Capacitor).
- Audience count preview: shown as a chip "~{{n}} customers" below filter controls, updates on blur.
- Channel selector: icon toggle (WhatsApp green / SMS blue), not text dropdown.
- Reminder rule trigger: bottom sheet picker on mobile (not dropdown).

---

## Internationalisation (en + hi)

All UI copy must have English and Hindi translation keys. New keys to add to the translation file:

```
marketing.campaign.title
marketing.campaign.empty
marketing.campaign.create
marketing.campaign.launch
marketing.campaign.cancel
marketing.campaign.detail.sent
marketing.campaign.detail.failed
marketing.template.title
marketing.template.dlt_warning
marketing.reminder.title
marketing.reminder.empty
marketing.reminder.create
marketing.optout.action
marketing.optout.success
marketing.error.segment_empty
marketing.error.too_large
```

Hindi translations follow project convention (160+ key i18n file pattern from Phase 1).

---

## Offline Behaviour

- Campaign list, template list, reminder rule list: `cacheReads: true` (PII-safe counts, no phone numbers in list view).
- Campaign create wizard: state is local until Step 5 submit. If offline on submit → mutation queued with `entityType: 'campaign'`, `entityLabel: campaignName`. Optimistic `{}` return handled — no navigate to detail page until online.
- Campaign launch: online-only. If offline when tapping Launch → toast "Campaign launch requires an internet connection."
- Reminder rule save: queued when offline with `entityType: 'reminder_rule'`, `entityLabel: ruleName`.
- All API calls go through `api()` from `@/lib/api`. No raw `fetch()`.

---

## Security

| Concern | Implementation |
|---------|---------------|
| Auth required | All `/api/marketing/*` routes behind `auth` middleware |
| Business isolation | Every DB query filters by `req.user.businessId` |
| Role | Default: any authenticated business user can create campaigns; OWNER/ADMIN role required to cancel a running campaign (enforced via permission check on cancel endpoint) |
| Max recipients cap | 10,000 enforced at segment resolution before any DB write |
| Cost cap | Existing `checkCap()` in notification engine — campaigns are subject to same plan-tier monthly cost cap |
| Rate limiting | Existing per-user channel rate limits apply to each recipient job |
| DLT enforcement | SMS campaign cannot launch without `dltTemplateId` on template |
| Opt-out respected | Checked in dispatch service before enqueue, not in notification engine (notification engine is for transactional events; marketing dispatch is a parallel path) |
| No raw PII in job payload | Campaign jobs pass `partyId` in `entityId`; `recipientHash` is sha256 of partyId, matching existing notification pattern |
| Quiet hours | `computeScheduledAt()` enforced for every job |

---

## Risks & Open Questions

| # | Risk | Likelihood | Mitigation |
|---|------|-----------|------------|
| 1 | Aisensy API response shape differs from assumed contract | Medium | Integration done against live sandbox before enabling provider; stub works locally |
| 2 | MSG91 DLT approval takes weeks for new templates | High | Show persistent DLT warning in UI; SMS campaigns simply won't launch until dltRegistered = true |
| 3 | Large campaigns (5K+) block the cron tick loop | Medium | Campaign dispatch is async — enqueue all jobs in batch, cron continues |
| 4 | Party.birthday field not collected historically | High | Birthday reminder rule only fires for parties with `birthday IS NOT NULL`; UI shows count "X of Y customers have birthdays set" in segment preview |
| 5 | WhatsApp template approval (Meta) can take 1-3 days | Medium | `waTemplateStatus` field shown in UI; campaign cannot launch until `APPROVED` (enforced at launch) |
| 6 | Users accidentally blast 10K customers with test message | Low | Mandatory preview step shows count prominently; confirmation dialog before launch |
| 7 | Duplicate sends if cron restarts mid-tick | Low | `@@unique([ruleId, partyId, fireDate])` + idempotency on `NotificationJob` within 60s window |

**Open question (not blocking):** WhatsApp template approval — should `waTemplateStatus` be manually set by the business owner (they check Meta portal themselves) or should there be a polling mechanism? Decision: manual flag in v1, same as `dltRegistered`. A future PR can add polling via Aisensy webhook.

---

## Out of Scope (this epic)

- Rich media / image / PDF / video in WhatsApp campaigns
- A/B testing of message variants
- Two-way WhatsApp reply parsing or inbox
- Autoresponders / drip sequences
- Email marketing campaigns
- PUSH notification campaigns
- Click/open tracking webhooks from Aisensy
- Built-in URL shortener
- Campaign analytics beyond sent/delivered/failed counts
- Saved audience segments (reusable segment objects)
- Campaign cloning / duplication
- Multi-language (EN+HI) per-recipient routing (all recipients get same language variant)
- Import contacts from phone for campaign (Capacitor contact import is Phase 1 feature only)
- Regulatory TRAI DLT auto-registration (manual process only)
- WhatsApp Business Account setup guide within app

---

## Acceptance Criteria

### Backend

- [ ] `curl -X POST /api/marketing/templates -H "Cookie: ..." -d '{"name":"Diwali Offer","channel":"SMS","bodyEn":"Dear {{customerName}}...","dltTemplateId":"1234"}' → { success: true, data: { id, name, channel } }`
- [ ] `curl /api/marketing/templates` without auth cookie → `{ success: false, error: { code: "UNAUTHORIZED" } }` 401
- [ ] `curl -X POST /api/marketing/templates -d '{"name":"","channel":"SMS","bodyEn":"x"}' → 400 validation error`
- [ ] `curl -X POST /api/marketing/campaigns/:id/launch` when template has no `dltTemplateId` (SMS campaign) → `{ success: false, error: { code: "TEMPLATE_DLT_MISSING" } }` 400
- [ ] `curl -X POST /api/marketing/campaigns/:id/launch` with segment resolving 0 parties → 400 `SEGMENT_EMPTY`
- [ ] `curl -X POST /api/marketing/campaigns/:id/launch` (DRAFT, valid template, > 0 segment) → 200, status transitions to RUNNING
- [ ] `curl -X POST /api/marketing/campaigns/:id/launch` on already-COMPLETED campaign → 200 (idempotent, no re-launch)
- [ ] `curl -X POST /api/marketing/segments/preview -d '{"filter":{"birthdayThisWeek":true}}'` → 200 `{ count: N, sample: [...] }`
- [ ] `curl -X POST /api/marketing/reminder-rules -d '{"name":"Birthday","trigger":"BIRTHDAY","offsetDays":0,"channel":"WHATSAPP","templateId":"..."}' → 201`
- [ ] `curl -X POST /api/marketing/reminder-rules` without auth → 401
- [ ] `curl -X POST /api/marketing/opt-out/:partyId` → 200; subsequent campaign launch skips that party (verified via recipient list `skipReason: opted_out`)
- [ ] Cron tick with a BIRTHDAY rule and a party whose birthday is today → `ReminderInstance` created, `NotificationJob` enqueued (verified by DB row check)
- [ ] Cron re-run same day for same rule+party → no duplicate `ReminderInstance` (unique constraint holds)
- [ ] Party with `marketingOptOut = true` → campaign dispatch skips with `skipReason: opted_out`, not dispatched via notification engine
- [ ] `tsc --noEmit` clean on server after all new files added

### Frontend

- [ ] Screenshot: CampaignListPage — loading state (skeleton rows visible)
- [ ] Screenshot: CampaignListPage — empty state ("No campaigns yet" + CTA)
- [ ] Screenshot: CampaignListPage — populated (3+ campaign rows, status badges visible)
- [ ] Screenshot: CampaignCreateWizard — Step 3 Audience (segment filters + live count chip)
- [ ] Screenshot: CampaignCreateWizard — Step 5 Preview (template preview + "Launch Campaign" button)
- [ ] Screenshot: CampaignDetailPage — sent/failed stat cards visible
- [ ] Screenshot: ReminderRuleListPage — populated (trigger badge + enabled toggle)
- [ ] Screenshot: TemplateFormPage — DLT warning banner visible (SMS channel, no dltTemplateId)
- [ ] 375px: wizard step indicator fits without overflow
- [ ] 320px: all filter controls stack vertically, no horizontal scroll
- [ ] 320px: "Launch Campaign" button full-width, no clipping
- [ ] Hindi (`?lang=hi`): all marketing UI strings rendered in Hindi (no missing key fallbacks)
- [ ] Opt-out confirmation dialog appears before opting out a party
- [ ] Offline submit of campaign draft → toast "Saved — will sync when online" (no crash)
- [ ] Offline launch attempt → toast "Campaign launch requires an internet connection." (no crash)

### QA Checklist

- [ ] Create SMS template without DLT ID → cannot launch campaign (blocked at UI + API)
- [ ] Create SMS template with DLT ID + `dltRegistered: false` → DLT warning banner visible; launch allowed (warning only, not blocking, since DLT ID is present)
- [ ] Create WA template with `waTemplateStatus: PENDING` → cannot launch WA campaign (API returns 400)
- [ ] Create campaign with `birthdayThisWeek: true` filter; parties without `birthday` field → excluded from count
- [ ] Party with `marketingOptOut: true` in segment → excluded from `recipientCount` in preview; excluded from dispatch
- [ ] Campaign `scheduledAt` in quiet hours (e.g. 22:00) → all jobs enqueued with `scheduledAt` set to 09:00 next day
- [ ] Cancel running campaign → status = CANCELLED; no further jobs dispatched
- [ ] Delete reminder rule → associated PENDING instances skipped (status = SKIPPED or soft-deleted)
- [ ] Reminder cron: BIRTHDAY trigger with `offsetDays: 3` fires 3 days before party's birthday (not on birthday)
- [ ] 10,001-recipient segment → API returns 400 `SEGMENT_TOO_LARGE`; no DB writes
- [ ] Two simultaneous launch requests for same campaign → second returns 200 idempotent (no duplicate recipient rows)
- [ ] `tsc --noEmit` clean on frontend after all new files

---

## File Structure

```
server/src/
  routes/
    marketing.ts                      # all /api/marketing/* routes
  services/
    marketing/
      campaign-dispatch.service.ts    # segment resolve + bulk enqueue
      campaign-segment.service.ts     # segment filter → Party[] query
      reminder-cron.service.ts        # 30-min tick, ReminderInstance materialise
      marketing-template.service.ts   # CRUD for MarketingTemplate
  services/notifications/
    providers/
      whatsapp.provider.ts            # MODIFY: wire Aisensy, flip isConfigured()
    notification-events.ts            # MODIFY: add 7 new event keys + meta

src/features/
  marketing/
    marketing.service.ts
    marketing-crud.service.ts
    pages/
      CampaignListPage.tsx
      CampaignCreateWizard.tsx
      CampaignDetailPage.tsx
      TemplateListPage.tsx
      TemplateFormPage.tsx
      ReminderRuleListPage.tsx
      ReminderRuleFormPage.tsx
    components/
      AudiencePicker.tsx              # reusable segment filter + count preview
      CampaignStatusBadge.tsx
      ChannelToggle.tsx
      TemplatePreview.tsx
      RecipientTable.tsx
    hooks/
      useCampaigns.ts
      useCampaignDetail.ts
      useReminderRules.ts
      useMarketingTemplates.ts
      useSegmentPreview.ts
```

---

*End of SCOPE — Phase 5 Epic A: Marketing Communications*
