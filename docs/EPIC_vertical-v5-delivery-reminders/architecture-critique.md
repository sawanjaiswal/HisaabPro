verdict: PASS

# Architecture Critique — V5 Customer Delivery Reminders (revision 2)

- audit_of: `.claude/design-plan-active--vertical-v5-delivery-reminders--bare-044707.md`
- auditor: architecture-auditor
- audited_at: 2026-05-29T04:53:00Z
- revision: 2 (re-audit after round-1 REVISE)
- must_fix: 0 · should_fix: 1 · future_epic: 1

## Verdict: PASS

Round-1 MUST_FIX is resolved. The `orderDeliveryCandidates` block now includes
`isDeleted: false` (plan line 118), the prose (lines 127-131) correctly states
`CustomOrder` HAS a soft-delete column, and Open Question #1 (lines 147-149) is
struck through and marked RESOLVED. No remaining MUST_FIX. The change is
end-to-end complete and `files_planned` covers backend + migration + FE + i18n.

## Code-validation (verified against repo, not plan claims)

| Claim | Evidence | Status |
|-------|----------|--------|
| `enum ReminderRuleTrigger` has 5 values, no ORDER_DELIVERY | schema.prisma:3719-3725 | OK — additive `ADD VALUE` correct |
| `CustomOrder.deliveryAt DateTime?` | schema.prisma:3107 | OK |
| `CustomOrder.partyId String` (required, non-null) | schema.prisma:3094 | OK — no `not: undefined` guard needed |
| `CustomOrder.status CustomOrderStatus` | schema.prisma:3104 | OK |
| `isDeleted Boolean @default(false)` | schema.prisma:3136 | OK — guard now present |
| `@@index([businessId, deliveryAt])` + `@@index([businessId, isDeleted])` | schema.prisma:3155-3156 | OK — query is index-covered |
| status active-set RECEIVED/IN_PRODUCTION/READY (excl DELIVERED/INVOICED/CANCELLED) | enum schema.prisma:3083-3089 | OK — valid pre-delivery set |
| `orderDeliveryCandidates` mirrors `paymentDueCandidates` | reminder-trigger.service.ts:82-112 | OK — same targetDate math, UTC-midnight window, dedupe-by-partyId, `fireDate=normaliseToUtcMidnight(targetDate)` |
| Zod enum to widen | reminder-rule.service.ts:19 | OK — single `z.enum([...])` literal, plan widens it |
| FE union `ReminderRuleTrigger` | marketing.types.ts:15-20 | OK — plan adds ORDER_DELIVERY |
| FE `TRIGGER_LABEL`/`TRIGGER_BADGE` exhaustive Records | marketing.constants.ts:55,63 | OK — `Record<ReminderRuleTrigger,string>`, tsc forces the new key |
| `ReminderTriggerPicker` LABEL_KEY/DESC_KEY Records + TRIGGERS array | ReminderTriggerPicker.tsx:12,14,22 | OK — note: the two Records use explicit literal-union value types; plan must widen BOTH the key AND the value-union literal, else tsc fails. File Plan `+6` lines accommodates this |

`files_planned` is complete for a working change: schema + standalone migration
(`ALTER TYPE ... ADD VALUE`, non-transactional, append-only — correctly noted),
Zod widen, candidate case, test, FE union + 2 constant Records + picker + en/hi
i18n + translations.ts wiring. No missing layer.

## MUST_FIX
_None._

## SHOULD_FIX
1. **Picker literal-union value types must widen, not just the key.**
   `LABEL_KEY`/`DESC_KEY` (ReminderTriggerPicker.tsx:14-28) type their VALUES as
   a closed string-literal union of the 5 existing key names. Adding
   `ORDER_DELIVERY: 'marketingTriggerOrderDeliveryLabel'` requires adding
   `| 'marketingTriggerOrderDeliveryLabel'` to the value-union too. tsc will
   catch it, but the File Plan's `+6` lines must budget for both edits per
   Record. Non-blocking — caught at compile.

## FUTURE_EPIC
1. **Hour-precision delivery reminders** — current model is day-granular
   (`offsetDays` + UTC-midnight idempotency key). "Remind N hours before" needs
   an `offsetHours` column, a redesigned idempotency key, and per-trigger cron
   branching. Correctly deferred and BACKLOG-noted in the plan (lines 62-76).

## What the plan got right
- Reuses the entire cron/materialise/dispatch/quiet-hours/opt-out pipeline —
  one new `case` + one candidate fn, zero new routes/tables/authz surface.
- Candidate query is business-scoped (from `rule.businessId`, token-derived),
  soft-delete-filtered, status-filtered, and index-covered.
- Migration correctly flagged irreversible/non-transactional with a sane
  `migrate resolve --applied` fallback.
- Idempotency-key assertion is explicitly in the acceptance test.
