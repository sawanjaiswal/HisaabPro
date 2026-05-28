---
status: approved
feature: vertical-v5-delivery-reminders
created: 2026-05-28T23:25:00Z
session: bare-044707
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
files_planned:
  # Backend
  - server/prisma/schema.prisma
  - server/prisma/migrations/20260529001000_reminder_order_delivery_trigger/migration.sql
  - server/src/services/marketing/reminder-rule.service.ts
  - server/src/services/marketing/reminder-trigger.service.ts
  - server/src/services/marketing/__tests__/reminder-trigger.delivery.test.ts
  # Frontend
  - src/features/marketing/marketing.types.ts
  - src/features/marketing/marketing.constants.ts
  - src/features/marketing/components/ReminderTriggerPicker.tsx
  - src/lib/translations.en.ext54.ts
  - src/lib/translations.hi.ext54.ts
  - src/lib/translations.ts
  # Docs
  - docs/BACKLOG.md
  - docs/HISAABPRO.md
agents_invoked:
  - architecture-auditor (output: docs/EPIC_vertical-v5-delivery-reminders/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-28T23:21:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 1 MUST_FIX (missing isDeleted:false guard — plan claimed CustomOrder had no soft-delete; schema.prisma:3136 disproves), 2 SHOULD_FIX
  - ts: 2026-05-28T23:26:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    findings: 0 MUST_FIX (isDeleted:false guard landed, prose corrected), 1 SHOULD_FIX (picker value-union widen, tsc-caught), 1 FUTURE_EPIC (hour-precision)
acceptance:
  backend:
    - tsc clean (server)
    - reminder-trigger.delivery.test.ts — candidate query returns only RECEIVED/IN_PRODUCTION/READY, isDeleted:false orders whose deliveryAt falls on now+offsetDays, deduped by partyId, with fireDate === normaliseToUtcMidnight(now+offsetDays) (idempotency-key assertion)
    - reminder-rule create accepts ORDER_DELIVERY trigger (Zod enum widened)
    - reminder-rule create still 400s on an unknown trigger string
  frontend:
    - tsc clean (web)
    - ReminderTriggerPicker renders the new "Order delivery" option (6 radios); LABEL_KEY + DESC_KEY Records gain the ORDER_DELIVERY entry (exhaustive Record stays type-complete — tsc proves it)
    - enforce.js clean (i18n keys present in both en + hi)
approver: sawanjaiswal
approved_at: 2026-05-28T23:29:40.389Z

---

# V5 — Customer Delivery Reminders — Plan

## Scope (1 sentence)
Add an `ORDER_DELIVERY` value to the `ReminderRuleTrigger` enum so a business
can configure a reminder rule that fires **`offsetDays` before a CustomOrder's
`deliveryAt` date** — reusing the entire existing reminder-cron / dispatch /
compliance pipeline. No new tables, no new routes, no new dispatch path.

## Why this is small (and why it's still high-risk)
- High-risk ONLY because it touches `server/prisma/schema.prisma` (enum value
  add). Everything else is additive application code.
- The cron, ReminderInstance materialisation, atomic claim, quiet-hours,
  opt-out, and channel dispatch are all untouched — `candidatesFor` simply
  gains one more `case`.

## Design decision — granularity (resolves the "N hours before" tension)
The vertical brief framed V5 as "remind N **hours** before delivery." The
existing reminder model is uniformly **day-granular** (`ReminderRule.offsetDays:
Int`, every candidate fn computes `now + offsetDays * 86_400_000` and the
idempotency key is `normaliseToUtcMidnight`). The 30-minute cron tick could
support hour precision, but doing so would require:
  - a new `offsetHours` column (schema change),
  - a redesigned idempotency key (midnight-normalisation breaks),
  - per-trigger granularity branching in the cron.

**Decision: reuse `offsetDays`** — `ORDER_DELIVERY` fires `offsetDays` days
before the delivery date (offsetDays=0 → morning-of, offsetDays=1 →
day-before). This is consistent with all 5 existing triggers and ships V5 as a
pure additive enum. **Hour-precision delivery reminders = FUTURE_EPIC** (needs
the offsetHours schema work above). Noted in BACKLOG.

## File Plan
| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/schema.prisma | modify | +1 | schema (enum value) |
| .../migrations/20260529001000_.../migration.sql | create | ~3 | migration (ALTER TYPE ADD VALUE) |
| server/.../reminder-rule.service.ts | modify | +1 | Zod enum widen |
| server/.../reminder-trigger.service.ts | modify | ~40 | new case + orderDeliveryCandidates() |
| server/.../__tests__/reminder-trigger.delivery.test.ts | create | ~90 | test (mocked prisma) |
| src/.../marketing.types.ts | modify | +1 | FE union add |
| src/.../marketing.constants.ts | modify | +3 | TRIGGER_LABEL/BADGE rows |
| src/.../ReminderTriggerPicker.tsx | modify | +6 | TRIGGERS array + LABEL/DESC keys |
| src/lib/translations.en.ext54.ts | create | ~10 | i18n (label+desc) |
| src/lib/translations.hi.ext54.ts | create | ~10 | i18n |
| src/lib/translations.ts | modify | +4 | import+spread ext54 |

All files ≤250 lines.

## Migration (Postgres enum value add — irreversible, must be standalone)
```sql
ALTER TYPE "ReminderRuleTrigger" ADD VALUE 'ORDER_DELIVERY';
```
Notes:
- `ADD VALUE` cannot run inside a transaction block on older PG and cannot be
  rolled back — it is append-only and safe (no existing rows reference it).
- Apply path mirrors V1: `prisma migrate dev --name reminder_order_delivery_trigger`
  (shadow DB handles ADD VALUE fine since it's not CONCURRENTLY). If the shadow
  DB balks, fall back to `db execute` + `migrate resolve --applied`.
- Down-migration: none meaningful (PG can't drop an enum value without a type
  rebuild); acceptable since value is purely additive.

## orderDeliveryCandidates(businessId, offsetDays, now)
Mirrors `paymentDueCandidates` exactly:
```ts
const targetDate = new Date(now.getTime() + offsetDays * 86_400_000)
const startOfDay = new Date(targetDate); startOfDay.setUTCHours(0,0,0,0)
const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

const orders = await prisma.customOrder.findMany({
  where: {
    businessId,
    isDeleted: false,                                     // schema.prisma:3136 — sibling fns all filter this
    status: { in: ['RECEIVED','IN_PRODUCTION','READY'] },  // not DELIVERED/INVOICED/CANCELLED
    deliveryAt: { gte: startOfDay, lt: endOfDay },
  },
  select: { partyId: true, deliveryAt: true },
})
// dedupe by partyId, fireDate = normaliseToUtcMidnight(targetDate)
```
Uses the existing `@@index([businessId, deliveryAt])` (and
`@@index([businessId, isDeleted])`). `CustomOrder` **does** have a soft-delete
column (`isDeleted` schema.prisma:3136) — the query MUST filter `isDeleted:
false` or it would fire reminders for deleted orders (wrong send + privacy
leak). `partyId` is a required (non-nullable) `String`, so no `partyId: { not:
undefined }` guard is needed.

## Cred-blocked live-send posture (carry-over from Epic A)
`AISENSY_API_KEY` and `MSG91_WEBHOOK_TOKEN` are unset, so the dispatch step
no-ops at the provider boundary exactly as for the 5 existing triggers. V5 is
buildable + testable **up to the enqueue/materialise boundary**; live WhatsApp
send remains gated on credentials (tracked separately, not a V5 deliverable).

## Security cuts
- No new route → no new authz surface. Reuses reminder-rule CRUD (already
  `requirePermission`-gated + business-scoped).
- `businessId` always from `rule.businessId` (token-derived upstream), never
  request body — no cross-tenant candidate leak.
- Candidate query is business-scoped + soft-delete-filtered.

## Open questions for the critic
1. ~~Does `CustomOrder` have `isDeleted`?~~ RESOLVED (rev 2): YES — `isDeleted`
   at schema.prisma:3136 with `@@index([businessId, isDeleted])`. Query filters
   `isDeleted: false` (matches every sibling candidate fn). `partyId` is required.
2. Is `status: { in: [...] }` the right active set, or should `READY` be
   excluded (already-ready orders may not need a "delivery coming up" nudge)?
   Default: include all three pre-delivery states.
