---
feature: phase-5-epic-d-crm-loyalty
status: DRAFT — awaiting Sawan answers to open questions §11
created: 2026-05-17T15:50:00+05:30
scope: backlog items #125 Loyalty + #127 CRM Basics + #128 Staff Performance & Commission
gates: scope-auditor required before architect; architect required before any build PR
sibling_docs:
  - docs/SCOPE_EPIC_B_sales_workflow.md
  - docs/SCOPE_EPIC_C_customer_facing.md
---

# SCOPE — Phase 5 Epic D: CRM + Loyalty

## Summary

Epic D closes Phase 5 with three retention-and-team features that all hook
into existing entities: (1) #125 loyalty points that accrue on every POS
sale via a new ledger model, redeemed as cash-equivalent paise on a future
sale; (2) #127 CRM upgrades on the existing `Party` model — add
`lastContactedAt` + `followUpAt`, ship a tag-filterable list and a
follow-up queue page; (3) #128 staff commission rules per-product or
per-category, accrued to a new ledger on every `PosSale` and `Document` of
type `SALE_INVOICE`, with a per-staff "what you earned this month" widget.
Payout (Phase 6 #136 Payroll) is explicitly deferred — Epic D only
accrues, it does not pay out. After Epic D, Phase 5 is 14/14 and we are at
**133/150 shipped**.

---

## 1. Schema Audit — What Already Exists

### #125 Loyalty

**Schema:** Nothing. New tables `LoyaltyProgram` + `LoyaltyLedger` required.

**Hook surface:** `server/src/services/pos/pos-checkout.service.ts:228-235`
already writes a `PosSaleEvent.CREATED` row inside the same `$transaction`
that creates the `PosSale`. Loyalty accrual hooks here — same `tx` ensures
points + sale commit atomically.

### #127 CRM Basics

**Schema gap analysis** (Party model at `server/prisma/schema.prisma:349`):
- `tags String[] @default([])` — **EXISTS** (line 358). Today free-text;
  used by Marketing campaign audience picker. Reuse as-is.
- `notes String?` — **EXISTS** (line 370). Already part of party form.
- `lastTransactionAt DateTime?` — **EXISTS** (line 369). NOT the same as
  `lastContactedAt`. Transaction = invoice/payment created. Contact =
  reminder sent, call logged, WhatsApp shared. Need both.
- `lastContactedAt DateTime?` — **MISSING**. New nullable column.
- `followUpAt DateTime?` — **MISSING**. New nullable column.

**Hook surfaces** (auto-update `lastContactedAt`):
- `DocumentShareLog` create (invoice shared via WA/email)
- `ReminderLog` create (Phase 5 Epic A reminder fired for this party)
- `PaymentReminder` create (manual reminder logged)
- Future Phase 6 #135 will add call logs — schema already covered

### #128 Staff Performance & Commission

**Schema:** New tables `CommissionRule` + `CommissionLedger`. No changes
to `User` / `Role` / `BusinessUser`.

**Reuse**:
- Staff identity = `BusinessUser` (already has `userId` + `businessId` +
  `roleId`). No new "Staff" model.
- Per-product/category targeting reuses `Product.id` and `Category.id`.
- `PosSale.cashierId` → already records who rang the sale. That's the
  commission earner for POS.
- `Document.createdBy` (User) → that's the commission earner for invoice.
- Custom-role permission `staff.commission.read.self` and
  `staff.commission.read.all` to gate the dashboard widget.

---

## 2. Goals

- **#125** [MUST_SHIP] — Raju enables a flat-rate loyalty program on POS;
  every sale accrues points to the party ledger; on a future sale the
  cashier sees an "Available: 240 pts (Rs 24)" chip and can redeem up to
  the cart subtotal.
- **#125** [MUST_SHIP] — Ledger is the single source of truth; balance =
  `SUM(delta) WHERE partyId AND businessId`. No denormalized balance
  column on `Party` in MVP.
- **#125** [SHOULD_SHIP] — Expiry policy: points expire N months after
  accrual; daily cron emits `EXPIRED` ledger row + push notification
  (when notification creds land).
- **#127** [MUST_SHIP] — Party list gains a tag filter chip-bar; tapping a
  tag filters to parties with that tag.
- **#127** [MUST_SHIP] — "Follow-ups" page (`/parties/follow-ups`) lists
  parties with `followUpAt <= today + N days`, ordered ASC, with overdue
  badge.
- **#127** [MUST_SHIP] — `lastContactedAt` auto-updates on the 3 hook
  surfaces listed in §1. No manual "I called this person" action in MVP
  (call logging defers to Phase 6).
- **#128** [MUST_SHIP] — Owner can define a commission rule
  (`scope: product | category | all`, `rate: bps`, `mode: PERCENT_GROSS |
  PERCENT_NET | FLAT_PER_UNIT`).
- **#128** [MUST_SHIP] — On every `PosSale.CREATED` and
  `Document.status=SAVED` (SALE_INVOICE), accrual is computed
  server-side and written to `CommissionLedger` in the same transaction.
- **#128** [MUST_SHIP] — Staff dashboard widget: "This month: Rs 3,420
  commission · Rs 18,400 sales".
- **#128** [SHOULD_SHIP] — Owner "All staff" leaderboard view (sortable by
  commission or by sales).
- **#128** [FUTURE_EPIC] — Payout (Phase 6 #136 Payroll).
- **#128** [FUTURE_EPIC] — Split commission across multiple staff per
  sale (deferred per vertical V4 backlog).

---

## 3. Non-Goals

- Tiered loyalty (Silver/Gold/Platinum membership). Flat-rate per
  business only in MVP. **[FUTURE_EPIC]**
- Per-party loyalty programs (each party gets a different rate). One
  program per business. **[FUTURE_EPIC]**
- Loyalty on `Document` SALE_INVOICE (counter sale). MVP accrues on
  `PosSale` only. **[FUTURE_EPIC]** — extending later is a one-line
  service-call addition, schema is type-agnostic.
- Manual ledger adjustments by owner ("give 500 bonus points"). Owner
  edits via admin script for MVP. **[NICE_TO_HAVE]**
- Commission payout via Razorpay → bank transfer. **[FUTURE_EPIC]** —
  Phase 6 #136.
- Commission on `Payment` collection. Phase 6 candidate. **[FUTURE_EPIC]**
- Split commission across multiple staff per sale. **[FUTURE_EPIC]** —
  vertical V4.
- Tag taxonomy / pre-defined tag list per business. Free-text only in
  MVP (matches Party.tags today). **[NICE_TO_HAVE]**
- Manual "log a call" button on party detail. **[FUTURE_EPIC]** —
  paired with Phase 6 attendance flow.
- Per-tag analytics ("how much revenue from `vip` tag this month").
  **[NICE_TO_HAVE]**

---

## 4. User Stories

**Raju (micro retailer)**
- As Raju, I want to set "1 point per Rs 10 spent" so my regulars keep
  coming back.
- As Raju, on the next sale, I want to see "Sunita has 240 pts available"
  on the cart and tap "Redeem 240" to cut Rs 24 off the bill.
- As Raju, I want a follow-up date on the party for Kishan who promised to
  pay next week, so I see it on a single page.

**Priya (wholesaler)**
- As Priya, I want to filter parties by tag `priority` to see who needs
  reaching out this morning.
- As Priya, I want my sales staff Anita to earn 2% commission on every
  POS sale she rings up, accrued daily, so I can pay her monthly.
- As Priya, I want a leaderboard showing each staff member's monthly
  sales + commission.

**Amit (distributor)**
- As Amit, I want different commission rates per product category
  (Spices 1.5%, FMCG 0.5%) because margins differ.
- As Amit, I want loyalty points to expire after 12 months so the ledger
  liability stays bounded.
- As Amit, I want my regional manager to see all staff commissions while
  staff only see their own.

---

## 5. API Surface (per feature)

### #125 Loyalty

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/api/loyalty/program` | session | — | `{ success: true, data: LoyaltyProgramDTO | null }` |
| `PUT` | `/api/loyalty/program` | session + `loyalty.config` | `{ enabled, accrualRateBps, accrualMinSpendPaise, redemptionUnit, redemptionPaisePerUnit, expiryMonths }` | `{ success: true, data: LoyaltyProgramDTO }` |
| `GET` | `/api/loyalty/balance/:partyId` | session + `parties.read` | — | `{ success: true, data: { partyId, points, equivalentPaise, lastEntryAt } }` |
| `GET` | `/api/loyalty/ledger/:partyId?cursor=&limit=` | session + `parties.read` | — | `{ success: true, data: { entries: [...], nextCursor } }` |
| `POST` | `/api/loyalty/redeem/preview` | session + `pos.write` | `{ partyId, points, cartSubtotalPaise }` | `{ success: true, data: { eligiblePoints, equivalentPaise, errorCode? } }` |

**No `POST /accrue` endpoint** — accrual is server-internal, fired from
inside `pos-checkout.service.ts` transaction. Redemption is also
internal: `payments[]` on `PosSale` create gains a `LOYALTY_REDEMPTION`
mode that, when present, deducts from ledger + decrements paise from
cart. This keeps loyalty mutations atomic with the sale.

**Error codes**: `400 PROGRAM_DISABLED`, `400 INSUFFICIENT_POINTS`,
`400 REDEMPTION_EXCEEDS_CART`, `400 PARTY_OPTED_OUT_OF_PROGRAM`,
`401`, `403`.

### #127 CRM Basics

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/api/parties?tag=vip&followUpBefore=2026-05-25&cursor=` | session + `parties.read` | — | `{ success: true, data: { parties: [...], nextCursor } }` |
| `PATCH` | `/api/parties/:id` | session + `parties.write` | `{ tags?, notes?, followUpAt? }` (existing endpoint — extended) | `{ success: true, data: PartyDTO }` |
| `GET` | `/api/parties/follow-ups?withinDays=7` | session + `parties.read` | — | `{ success: true, data: { items: [{partyId, partyName, followUpAt, daysUntilDue, isOverdue, lastContactedAt}], total, overdueCount } }` |
| `GET` | `/api/parties/tags` | session + `parties.read` | — | `{ success: true, data: { tags: [{name, count}] } }` (distinct tags from `Party.tags[]` across the business, with usage count, used to populate filter chip bar) |

**No new mutation routes** — `lastContactedAt` auto-updates server-side
inside `DocumentShareLog`, `ReminderLog`, `PaymentReminder` creates.

**Error codes**: `400 INVALID_FOLLOWUP_PAST`, `401`, `403`, `404`.

### #128 Commission

| Method | Path | Auth | Request | Response |
|--------|------|------|---------|----------|
| `GET` | `/api/commission/rules` | session + `commission.config` | — | `{ success: true, data: { rules: CommissionRuleDTO[] } }` |
| `POST` | `/api/commission/rules` | session + `commission.config` | `{ name, scope, scopeId?, mode, rateBps?, flatPerUnitPaise?, appliesTo: 'POS' | 'INVOICE' | 'BOTH', staffUserIds?: [], isActive }` | `{ success: true, data: CommissionRuleDTO }` |
| `PUT` | `/api/commission/rules/:id` | session + `commission.config` | same as POST | `{ success: true, data: CommissionRuleDTO }` |
| `DELETE` | `/api/commission/rules/:id` | session + `commission.config` | — | `{ success: true }` (soft delete — `isActive=false`) |
| `GET` | `/api/commission/ledger?staffUserId=&from=&to=&cursor=` | session — gated by `commission.read.self` (own) vs `commission.read.all` (any) | — | `{ success: true, data: { entries: [...], totalCommissionPaise, totalSalesPaise, nextCursor } }` |
| `GET` | `/api/commission/leaderboard?from=&to=` | session + `commission.read.all` | — | `{ success: true, data: { rows: [{staffUserId, name, salesPaise, commissionPaise, txCount}] } }` |

**No `POST /accrue`** — accrual is server-internal, fired from inside
the `pos-checkout.service.ts` transaction AND from the document
SAVED transition in `document.service.ts`.

**Error codes**: `400 RULE_CONFLICT` (overlapping rule for same
product/category/staff combo), `403 FORBIDDEN_READ_OTHER_STAFF`,
`401`, `404`.

---

## 6. Schema Delta (additive only)

### New models — #125 Loyalty

```prisma
model LoyaltyProgram {
  id                     String   @id @default(cuid())
  businessId             String   @unique
  enabled                Boolean  @default(false)
  // Accrual
  accrualRateBps         Int      @default(100)        // 100 bps = 1 point per Rs 1; configurable
  accrualMinSpendPaise   Int      @default(0)          // ignore lines smaller than this
  // Redemption
  redemptionUnit         Int      @default(1)          // points required to redeem 1 unit
  redemptionPaisePerUnit Int      @default(100)        // each unit = Rs 1
  // Expiry
  expiryMonths           Int?                          // null = never; default 12 if enabled
  // Audit
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  createdBy              String

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId])
}

model LoyaltyLedger {
  id            String   @id @default(cuid())
  businessId    String
  partyId       String
  // Source of the delta
  type          String   @db.VarChar(20)             // ACCRUED | REDEEMED | EXPIRED | ADJUSTED
  delta         Int                                  // signed; ACCRUED > 0, REDEEMED/EXPIRED < 0
  // Provenance — exactly one of these is set
  posSaleId     String?
  documentId    String?
  expiryRunId   String?                              // groups all EXPIRED rows from one cron pass
  adjustedBy    String?                              // userId if type=ADJUSTED
  note          String?  @db.VarChar(200)
  // Expiry tracking — when an ACCRUED row was earned, this fires expiry calc
  earnedAt      DateTime @default(now())
  expiresAt     DateTime?                             // computed at accrual time from program.expiryMonths
  createdAt     DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  party    Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)
  posSale  PosSale? @relation(fields: [posSaleId], references: [id], onDelete: SetNull)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([businessId, partyId, createdAt])
  @@index([businessId, expiresAt])                   // expiry cron scan
  @@index([posSaleId])
  @@index([documentId])
}
```

### Party additions — #127 CRM

```prisma
// Additions only, all nullable — single zero-downtime migration step
model Party {
  // ... existing 30+ fields untouched ...
  lastContactedAt DateTime?
  followUpAt      DateTime?

  @@index([businessId, followUpAt])               // follow-up queue
  @@index([businessId, lastContactedAt])          // dormant-party scans (future epic)
}
```

**No backfill needed** — both columns nullable; null = "never" / "no
date set". Existing rows continue working.

### New models — #128 Commission

```prisma
model CommissionRule {
  id               String   @id @default(cuid())
  businessId       String
  name             String   @db.VarChar(80)
  scope            String   @db.VarChar(20)        // ALL | PRODUCT | CATEGORY
  scopeId          String?                          // productId or categoryId; null when scope=ALL
  mode             String   @db.VarChar(30)        // PERCENT_GROSS | PERCENT_NET | FLAT_PER_UNIT
  rateBps          Int?                             // basis points for PERCENT modes
  flatPerUnitPaise Int?                             // paise per unit for FLAT_PER_UNIT
  appliesTo        String   @db.VarChar(10)        // POS | INVOICE | BOTH
  staffUserIds     String[] @default([])            // empty array = applies to ALL staff
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        String

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  // Cross-tenant guard via businessId scoping in service layer
  @@index([businessId, isActive])
  @@index([businessId, scope, scopeId])
}

model CommissionLedger {
  id              String   @id @default(cuid())
  businessId      String
  staffUserId     String                            // BusinessUser.userId
  ruleId          String?                           // null if rule deleted (history preserved)
  // Provenance — exactly one of these set
  posSaleId       String?
  documentId      String?
  // Money
  basisPaise      Int                               // the sale or line amount the commission was computed against
  commissionPaise Int                               // the earned amount
  // Period markers for fast leaderboard queries
  periodYearMonth String   @db.VarChar(7)           // "2026-05"
  // Audit
  createdAt       DateTime @default(now())
  meta            Json?                              // ruleSnapshot for forensics

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  staff    User     @relation("StaffCommissionLedger", fields: [staffUserId], references: [id], onDelete: Restrict)
  posSale  PosSale? @relation(fields: [posSaleId], references: [id], onDelete: SetNull)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([businessId, staffUserId, periodYearMonth])     // dashboard widget
  @@index([businessId, periodYearMonth])                  // leaderboard
  @@index([posSaleId])
  @@index([documentId])
}
```

### Migration ordering

Single step — additive only. Run order:
1. `npx prisma migrate dev --name epic_d_crm_loyalty_commission` (creates
   3 new tables + 2 nullable columns + 4 new indexes on Party).
2. No backfill required.
3. Deploy backend → deploy frontend (services need to be live before the
   client sends new request shapes).

### Ephemeral-table cleanup spec (per blindspot #5)

`LoyaltyLedger` and `CommissionLedger` are **NOT ephemeral** — they are
the financial truth and must be retained for the lifetime of the
business. No cleanup cron.

What IS ephemeral and needs a cleanup script:

| Concern | Mechanism | File | Frequency | Retention |
|---------|-----------|------|-----------|-----------|
| Loyalty expiry sweep | `scripts/loyalty-expiry.cron.ts` registered via `server/src/lib/cron-scheduler.ts` | new file | Daily 02:30 IST | `LoyaltyLedger` rows of type `EXPIRED` retained forever (audit); `LoyaltyProgram.expiryMonths` controls how far back ACCRUED rows are still spendable |
| Commission rule history | None — `isActive=false` soft delete preserves the rule for ledger.ruleId FK | n/a | n/a | n/a |

---

## 7. Offline Behavior (per `.claude/rules/OFFLINE_RULES.md`)

### POS already blocks checkout when offline

The existing `usePosCheckout.openCheckout()` (file
`src/features/pos/hooks/usePosCheckout.ts:53-56`) refuses to open the
checkout sheet when `!navigator.onLine`. Loyalty accrual and commission
write happen inside the existing online-only POS checkout transaction —
**they inherit the same online-only constraint**, no extra plumbing
needed.

### Loyalty redemption preview — must work offline

The cashier needs to see "Sunita has 240 pts" while the cart is being
built (which can happen offline). We solve this with:

- **Read cache for balance**: `GET /api/loyalty/balance/:partyId` is
  called with `cacheReads: true` when the customer is added to the
  cart. Last-known balance + `__fromCache` flag is shown when offline,
  with a "Last synced at HH:MM" caption.
- **No offline redemption write**: redemption is only committed at POS
  checkout, which already requires `navigator.onLine`. So even though
  the UI shows the balance offline, the actual redemption is rejected
  by `openCheckout()` exactly like any other POS sale.
- **Stale-data tolerance**: if the cached balance is wrong (party
  redeemed elsewhere in last 5 min), the server-side preview call at
  checkout time re-validates and returns `INSUFFICIENT_POINTS` — the
  sheet shows an inline error and resets the redemption input.

### CRM mutations — full offline support

| Mutation | `entityType` | `entityLabel` |
|----------|--------------|---------------|
| Update party tags / notes | `party` | party.name |
| Set / change followUpAt | `party` | party.name |

Reads:
- `GET /api/parties?tag=...&followUpBefore=...` — **`cacheReads: true`**
  (low PII — only party names + dates).
- `GET /api/parties/follow-ups` — **`cacheReads: true`** (party names +
  dates only).
- `GET /api/parties/tags` — **`cacheReads: true`** (only tag names +
  counts).
- `GET /api/loyalty/program` — **`cacheReads: true`** (just the config).
- `GET /api/loyalty/ledger/:partyId` — **NO CACHE** (financial detail
  per-party; leak surface).

### Commission writes — server-internal only

Commission accrual fires inside the POS / Document creation transaction
on the server. There is no client-side accrual write — the client only
reads the dashboard / leaderboard. All reads are `cacheReads: true`
(staff dashboard widget); leaderboard is **NO CACHE** (multi-staff
data; leak surface).

### Conflict resolution

- **Tags edit**: server takes last-write-wins. No diff merge.
- **followUpAt edit**: server takes last-write-wins.
- **Loyalty redemption**: server is authoritative; client preview can
  go stale and the checkout call will surface the error.
- **Commission**: no client writes — no conflict possible.

---

## 8. Translation Keys Delta

Three new namespaces, one per feature, following Epic A/B/C convention.
Total estimate **~150 keys** (50 per feature), all in EN + HI parity.

| Namespace | Feature | Est. key count | Files |
|-----------|---------|----------------|-------|
| `ext38.loyalty.*` | #125 Loyalty | ~55 | `src/lib/translations.en.ext38.ts` + `src/lib/translations.hi.ext38.ts` |
| `ext39.crm.*` | #127 CRM | ~45 | `src/lib/translations.en.ext39.ts` + `src/lib/translations.hi.ext39.ts` |
| `ext40.commission.*` | #128 Commission | ~50 | `src/lib/translations.en.ext40.ts` + `src/lib/translations.hi.ext40.ts` |

**Gate:** `scripts/check-translations.mjs` (or equivalent enforce check)
must show EN↔HI 1:1 parity per namespace before each PR merges.

---

## 9. Reuse from DudhHisaab (`/Users/sawanjaiswal/DudhHisaab`)

> Per HisaabPro `CLAUDE.md` project rule: search DudhHisaab first, adapt,
> don't reinvent. Strip dairy-specific fields.

### What we steal (verbatim or near-verbatim)

| HisaabPro target | DudhHisaab source | What we use |
|------------------|-------------------|-------------|
| `parties.service.getFollowUpsDue()` | `src/services/cattle-health-issue.service.ts:295-340` | Whole-function template: filter `followUpAt: { not: null, lte: cutoff }`, order ASC, compute `daysUntilDue` + `isOverdue`. Replace `cattle` includes with `party` selects. Same response shape. **High-confidence steal.** |
| `LoyaltyLedger` indexing strategy | `prisma/schema.prisma` `DoodhCoinTransaction` model (line 1578) | Index pattern `(businessId, partyId, createdAt)` for balance scans + `(businessId, expiresAt)` for expiry sweep is identical pattern. |
| Cron pattern (loyalty expiry) | `src/services/subscription/cron-grace-expiry.ts` (in HisaabPro server already, but pattern derived from DH) | Daily IST scheduled job; `for...of business chunks`; advisory-lock per business; write ledger rows in batches of 500. |
| `cacheReads: true` on balance lookups | `src/lib/api-cache.ts` pattern | Already in HisaabPro. |

### What we adapt (heavy edits)

| HisaabPro target | DudhHisaab source | What changes |
|------------------|-------------------|--------------|
| `LoyaltyProgram` settings shape | `prisma/schema.prisma` `subscription_addons` settings JSON | DH uses Json blob; we use typed columns because the field set is bounded. |
| Tag filter UI | None — DH doesn't have free-text tags per entity | Build new chip-bar component; DH party tags are not parallel. |
| Commission ledger | None — DH has no commission concept | Build from scratch. Closest analogue is `DoodhCoinTransaction` for ledger-style accrual + immutable history. |

### What we do NOT take

- DudhHisaab `DoodhCoinTransaction` is dairy-loyalty plus ad-watch
  rewards — out of scope and dairy-specific.
- DH `referral_rewards` — referral system is already ported in
  HisaabPro (#3); no overlap with loyalty.
- DH outreach / campaign tables — Marketing Comms Epic A already
  shipped HisaabPro's parallel models (`MarketingTemplate`,
  `MarketingCampaign`).

---

## 10. File Plan (mandatory per `CLAUDE.md`)

**Hard rule:** every row ≤ 250 lines. Backend layer order: types →
constants → schema → utils → service → route. Frontend layer order:
types → constants → utils → hook → components → page.

### Backend (server/) — 32 files

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|-----------|-------|-------|
| 1 | `server/prisma/schema.prisma` | edit | +95 | schema | Add `LoyaltyProgram`, `LoyaltyLedger`, `CommissionRule`, `CommissionLedger` + Party 2 nullable cols + 4 indexes |
| 2 | `server/prisma/migrations/{ts}_epic_d_crm_loyalty/migration.sql` | create | ~80 | schema | Generated by `prisma migrate dev` |
| **Loyalty (#125)** |  |  |  |  |  |
| 3 | `server/src/types/loyalty.types.ts` | create | ~80 | types | DTOs: `LoyaltyProgramDTO`, `LoyaltyLedgerEntryDTO`, `LoyaltyBalanceDTO` |
| 4 | `server/src/services/loyalty/loyalty.constants.ts` | create | ~40 | constants | Ledger types, default rates, error codes |
| 5 | `server/src/schemas/loyalty.schema.ts` | create | ~80 | schema | Zod `.strict()`: program upsert, redeem preview |
| 6 | `server/src/services/loyalty/loyalty-balance.service.ts` | create | ~100 | utils/service | `getBalance(businessId, partyId)`: aggregate `SUM(delta)` partitioned by `(expired? no)` |
| 7 | `server/src/services/loyalty/loyalty-accrual.service.ts` | create | ~140 | service | `accrueForPosSale(tx, posSale)` — called inside POS checkout transaction; reads program, validates min-spend, writes `ACCRUED` row with `expiresAt` |
| 8 | `server/src/services/loyalty/loyalty-redeem.service.ts` | create | ~160 | service | `previewRedemption(...)`, `applyRedemption(tx, posSale, points)` — FIFO oldest-first against ACCRUED rows |
| 9 | `server/src/services/loyalty/loyalty-program.service.ts` | create | ~120 | service | Program upsert + read |
| 10 | `server/src/services/loyalty/loyalty-expiry.cron.ts` | create | ~140 | service | Daily 02:30 IST scan; writes `EXPIRED` rows; per-business advisory lock |
| 11 | `server/src/routes/loyalty.routes.ts` | create | ~140 | route | 5 endpoints (§5), thin handlers |
| 12 | `server/src/lib/cron-scheduler.ts` | edit | +12 | bootstrap | Register `loyalty-expiry.cron` |
| 13 | `server/src/services/pos/pos-checkout.service.ts` | edit | +30 | service | Insert `accrueForPosSale` + `applyRedemption` calls inside existing `$transaction` (between step 12 and 13) |
| 14 | `server/src/services/pos/pos.validators.ts` | edit | +20 | schema | Allow `LOYALTY_REDEMPTION` mode in `payments[]`; require `loyaltyPoints` if mode set |
| **CRM (#127)** |  |  |  |  |  |
| 15 | `server/src/types/party-crm.types.ts` | create | ~60 | types | `FollowUpItemDTO`, `TagSummaryDTO` |
| 16 | `server/src/services/parties/party-followups.service.ts` | create | ~120 | service | Port of DH `getFollowUpsDue` (see §9); compute overdue + daysUntilDue |
| 17 | `server/src/services/parties/party-tags.service.ts` | create | ~90 | service | Distinct tags + counts via `Party.tags[]` aggregate using raw SQL `unnest(tags)` |
| 18 | `server/src/services/parties/party-last-contacted.service.ts` | create | ~80 | utils | `touchLastContacted(tx, businessId, partyId)` — single helper for the 3 hooks below |
| 19 | `server/src/services/document/share-log.service.ts` | edit | +6 | service | Call `touchLastContacted` when `DocumentShareLog` row created |
| 20 | `server/src/services/marketing/reminder-log.service.ts` | edit | +6 | service | Call `touchLastContacted` when reminder fires |
| 21 | `server/src/services/payment/payment-reminder.service.ts` | edit | +6 | service | Call `touchLastContacted` when manual reminder logged |
| 22 | `server/src/schemas/party.schema.ts` | edit | +10 | schema | Add `followUpAt` to `partyPatchSchema`; reject past dates with `INVALID_FOLLOWUP_PAST` |
| 23 | `server/src/routes/parties.routes.ts` | edit | +50 | route | Add `GET /follow-ups`, `GET /tags`; existing `GET /` accepts `?tag=&followUpBefore=` |
| **Commission (#128)** |  |  |  |  |  |
| 24 | `server/src/types/commission.types.ts` | create | ~70 | types | `CommissionRuleDTO`, `CommissionLedgerEntryDTO`, `LeaderboardRowDTO` |
| 25 | `server/src/services/commission/commission.constants.ts` | create | ~30 | constants | Scope/mode/applies-to enums + error codes |
| 26 | `server/src/schemas/commission.schema.ts` | create | ~110 | schema | Rule upsert (with conflict check) + leaderboard query |
| 27 | `server/src/services/commission/commission-rule.service.ts` | create | ~160 | service | CRUD + `findApplicableRules(productId, categoryId, staffUserId, appliesTo)` |
| 28 | `server/src/services/commission/commission-accrual.service.ts` | create | ~180 | service | `accrueForPosSale(tx, posSale)` and `accrueForDocument(tx, doc)` — pure function on line items + rules; writes ledger |
| 29 | `server/src/services/commission/commission-ledger.service.ts` | create | ~120 | service | Paginated read + leaderboard aggregate |
| 30 | `server/src/routes/commission.routes.ts` | create | ~180 | route | 6 endpoints (§5), thin handlers |
| 31 | `server/src/services/pos/pos-checkout.service.ts` | edit | +15 | service | Add `commission-accrual.accrueForPosSale(tx, posSale)` inside existing `$transaction` |
| 32 | `server/src/services/document/document.service.ts` | edit | +15 | service | Add `accrueForDocument(tx, doc)` on status `DRAFT→SAVED` for `SALE_INVOICE` |

### Frontend (src/) — 38 files

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|-----------|-------|-------|
| **Translations** |  |  |  |  |  |
| 33 | `src/lib/translations.en.ext38.ts` | create | ~140 | i18n | ~55 loyalty keys |
| 34 | `src/lib/translations.hi.ext38.ts` | create | ~140 | i18n | Parity Hindi |
| 35 | `src/lib/translations.en.ext39.ts` | create | ~110 | i18n | ~45 CRM keys |
| 36 | `src/lib/translations.hi.ext39.ts` | create | ~110 | i18n | Parity Hindi |
| 37 | `src/lib/translations.en.ext40.ts` | create | ~120 | i18n | ~50 commission keys |
| 38 | `src/lib/translations.hi.ext40.ts` | create | ~120 | i18n | Parity Hindi |
| 39 | `src/lib/translations.ts` | edit | +24 | i18n | Add 6 imports + merges |
| **Loyalty FE (#125)** |  |  |  |  |  |
| 40 | `src/features/loyalty/loyalty.types.ts` | create | ~70 | types | Mirror server DTOs |
| 41 | `src/features/loyalty/loyalty.constants.ts` | create | ~30 | constants | Default rates display, ledger-type colors |
| 42 | `src/features/loyalty/api/loyalty.service.ts` | create | ~120 | service | `api()` wrappers with `cacheReads: true` on balance/program |
| 43 | `src/features/loyalty/hooks/useLoyaltyProgram.ts` | create | ~80 | hook | TanStack query + mutation |
| 44 | `src/features/loyalty/hooks/useLoyaltyBalance.ts` | create | ~70 | hook | Per-party balance with stale-while-revalidate |
| 45 | `src/features/loyalty/hooks/useLoyaltyLedger.ts` | create | ~90 | hook | Cursor-paginated infinite query |
| 46 | `src/features/loyalty/components/LoyaltyProgramForm.tsx` | create | ~200 | sub-component | Settings form (rate, expiry, min-spend) |
| 47 | `src/features/loyalty/components/LoyaltyBalanceChip.tsx` | create | ~80 | sub-component | "240 pts (Rs 24)" chip with offline indicator |
| 48 | `src/features/loyalty/components/LoyaltyRedeemSheet.tsx` | create | ~190 | sub-component | POS checkout sheet section: input + preview + apply |
| 49 | `src/features/loyalty/components/LoyaltyLedgerList.tsx` | create | ~150 | sub-component | Party-detail tab: list ACCRUED/REDEEMED/EXPIRED rows |
| 50 | `src/features/loyalty/pages/LoyaltyProgramPage.tsx` | create | ~140 | page | `/settings/loyalty` — wires LoyaltyProgramForm + 4 UI states |
| 51 | `src/features/pos/components/payment/PaymentSheet.tsx` | edit | +30 | sub-component | Render `<LoyaltyRedeemSheet>` between split-tender row and total |
| 52 | `src/features/pos/components/customer/CustomerSelector.tsx` | edit | +20 | sub-component | Show `<LoyaltyBalanceChip>` when party selected |
| 53 | `src/features/parties/components/PartyDetailTabs.tsx` | edit | +14 | sub-component | Add "Loyalty" tab → `<LoyaltyLedgerList>` |
| **CRM FE (#127)** |  |  |  |  |  |
| 54 | `src/features/crm/crm.types.ts` | create | ~50 | types | Mirror server DTOs |
| 55 | `src/features/crm/api/crm.service.ts` | create | ~90 | service | tags + follow-ups + party patch |
| 56 | `src/features/crm/hooks/useTagSummary.ts` | create | ~60 | hook | Tag chip-bar source |
| 57 | `src/features/crm/hooks/useFollowUps.ts` | create | ~80 | hook | Follow-up queue + overdue count |
| 58 | `src/features/crm/components/TagFilterBar.tsx` | create | ~140 | sub-component | Horizontal scroll chip bar + clear-all + 4 UI states |
| 59 | `src/features/crm/components/FollowUpDatePicker.tsx` | create | ~120 | sub-component | Native + custom calendar; future-date only |
| 60 | `src/features/crm/components/FollowUpRow.tsx` | create | ~110 | sub-component | Party row with overdue badge + last-contacted snippet |
| 61 | `src/features/crm/pages/FollowUpsPage.tsx` | create | ~150 | page | `/parties/follow-ups` — header + tabs (overdue / next-7d) + 4 UI states |
| 62 | `src/features/parties/components/PartyListPage.tsx` | edit | +25 | page | Render `<TagFilterBar>` above existing list; pass `tag` to query |
| 63 | `src/features/parties/components/PartyDetailPage.tsx` | edit | +20 | page | Add follow-up date row + last-contacted display |
| 64 | `src/features/parties/PartyForm.tsx` | edit | +18 | sub-component | Add `<FollowUpDatePicker>` to form |
| **Commission FE (#128)** |  |  |  |  |  |
| 65 | `src/features/commission/commission.types.ts` | create | ~70 | types | Mirror server DTOs |
| 66 | `src/features/commission/commission.constants.ts` | create | ~30 | constants | Scope/mode display labels |
| 67 | `src/features/commission/api/commission.service.ts` | create | ~120 | service | 6 endpoint wrappers |
| 68 | `src/features/commission/hooks/useCommissionRules.ts` | create | ~100 | hook | CRUD |
| 69 | `src/features/commission/hooks/useCommissionLedger.ts` | create | ~100 | hook | Self / staffUserId paginated |
| 70 | `src/features/commission/hooks/useLeaderboard.ts` | create | ~70 | hook | Owner-only |
| 71 | `src/features/commission/components/CommissionRuleForm.tsx` | create | ~220 | sub-component | Rule editor: scope picker + mode picker + staff multi-select |
| 72 | `src/features/commission/components/CommissionRuleList.tsx` | create | ~130 | sub-component | List with edit/delete + active toggle |
| 73 | `src/features/commission/components/CommissionWidget.tsx` | create | ~120 | sub-component | Staff dashboard tile: this month total + tx count |
| 74 | `src/features/commission/components/LeaderboardTable.tsx` | create | ~180 | sub-component | Sortable owner-only table |
| 75 | `src/features/commission/pages/CommissionSettingsPage.tsx` | create | ~150 | page | `/settings/commission` — rules CRUD + 4 UI states |
| 76 | `src/features/commission/pages/CommissionLedgerPage.tsx` | create | ~140 | page | `/commission/ledger` — self for staff, all for owner |
| 77 | `src/features/commission/pages/LeaderboardPage.tsx` | create | ~120 | page | `/commission/leaderboard` — owner only |
| 78 | `src/features/dashboard/components/StaffDashboardSection.tsx` | edit | +20 | sub-component | Render `<CommissionWidget>` for users with `commission.read.self` |
| 79 | `src/styles/components.crm.css` | create | ~120 | css | Tag chip styles + overdue badge |
| 80 | `src/styles/components.loyalty.css` | create | ~100 | css | Balance chip + ledger row styles |
| 81 | `src/styles/components.commission.css` | create | ~110 | css | Leaderboard table + widget styles |

**Total file count:** 81 (49 create + 32 edit). All rows ≤ 250 lines.
The biggest are `CommissionRuleForm.tsx` (~220L), two service files
(~180L), and `LeaderboardTable.tsx` (~180L) — all safely under cap.

### Routes added (frontend nav)

| Path | Page | Permission gate |
|------|------|-----------------|
| `/settings/loyalty` | LoyaltyProgramPage | `loyalty.config` |
| `/parties/follow-ups` | FollowUpsPage | `parties.read` |
| `/settings/commission` | CommissionSettingsPage | `commission.config` |
| `/commission/ledger` | CommissionLedgerPage | `commission.read.self` |
| `/commission/leaderboard` | LeaderboardPage | `commission.read.all` |

### New custom-role permissions

- `loyalty.config` (configure program — owner by default)
- `loyalty.redeem` (apply redemption at POS — cashier by default)
- `commission.config` (manage rules — owner by default)
- `commission.read.self` (see own ledger — every staff by default)
- `commission.read.all` (see all staff + leaderboard — owner + manager)
- `crm.followup.write` (set followUpAt — same as `parties.write`; alias)

---

## 11. Open Clarifying Questions for Sawan

The following decisions are too important to silently default. **Please
answer each — defaults shown so we ship if you only address half.**

### Loyalty (#125)

1. **Per-business or per-party rates?** Default: **per-business flat
   rate only** (one `LoyaltyProgram` per businessId). Tiered/per-party
   = FUTURE_EPIC. **OK?**

2. **Cash-equivalent or % discount on redemption?** Default: **cash
   equivalent** (1 point = configurable paise, applied as
   `LOYALTY_REDEMPTION` payment mode that reduces amount-due). %
   discount adds tax-recalc complexity. **OK?**

3. **Expiry default?** Default: **12 months from accrual**, configurable
   per business; null = never expires. Daily cron at 02:30 IST. **OK?**

4. **Loyalty on SALE_INVOICE too, or POS-only for MVP?** Default:
   **POS-only**. SALE_INVOICE accrual is a one-line addition later
   (schema is type-agnostic). **OK?**

5. **Redemption gate when party has unpaid invoices?** Default: **no
   block** — points can be redeemed even if party has outstanding
   balance. **OK?**

6. **Min-spend threshold on accrual?** Default: **0 (any sale earns
   points)**; configurable in program settings. **OK?**

7. **Walk-in parties earn points?** Default: **NO** — walk-ins are
   ephemeral sentinel parties; accrual would orphan the points.
   `partyId === walkInPartyId` → skip accrual silently. **OK?**

### CRM (#127)

8. **Tags free-text or pre-defined per business?** Default: **free-text
   continues** (matches current Party.tags[] behavior). Pre-defined
   taxonomy = FUTURE_EPIC. **OK?**

9. **`lastContactedAt` auto-update triggers — final list?** Default
   set: **(a)** `DocumentShareLog` create (any invoice/estimate
   shared), **(b)** `ReminderLog` create (Phase 5 reminder fires),
   **(c)** `PaymentReminder` create (manual reminder logged). Do you
   want to ADD: payment received? new invoice created? Or REMOVE any
   of these?

10. **Follow-up reminders push?** Default: **NO push notification
    today** (requires FCM creds anyway). FollowUpsPage is pull-only.
    When FCM lands, add a daily 9 AM IST push for today's follow-ups.
    **OK?**

11. **Follow-up date — past dates allowed?** Default: **future-only**
    (server rejects past dates with `INVALID_FOLLOWUP_PAST`). **OK?**

### Commission (#128)

12. **Commission on sale-creator OR staff-assigned-to-job?** Default:
    **sale-creator** for MVP — `PosSale.cashierId` (POS) or
    `Document.createdBy` (invoice). Staff-on-the-job =
    Phase 6 vertical V4 (split commission). **OK?**

13. **`%` vs flat vs both?** Default: **all three modes**
    (`PERCENT_GROSS`, `PERCENT_NET`, `FLAT_PER_UNIT`). Owner picks per
    rule. **OK?**

14. **PERCENT_GROSS vs PERCENT_NET basis** — clarify: GROSS = line
    `lineTotal` (after item discount, before tax); NET = `taxableValue`
    (also after item discount, before tax — they're the same in
    non-GST mode; only diverge when GST lands). For MVP, GROSS and NET
    will compute to the same number. **Confirm we still ship both
    modes for forward-compat?**

15. **Conflict resolution when multiple rules apply** — example: rule
    A says "2% on all" + rule B says "3% on Spices category". Default:
    **most specific wins** — PRODUCT > CATEGORY > ALL. Within same
    specificity → newest createdAt wins. **OK?**

16. **Negative commission on void/refund?** Default: **YES** — on
    `PosSale.VOIDED` event we write a NEGATIVE `CommissionLedger` row
    that reverses the accrual. So `SUM(commissionPaise)` always
    reflects net earned. **OK?**

17. **Payout via payroll (Phase 6 #136)?** Default: **explicitly
    deferred to Phase 6**. Epic D only accrues. Owner manually pays
    out (UPI / cash) and ticks "paid" in an admin script for now.
    **OK?**

18. **Should we fold Epic D #128 with Phase 6 vertical V4 (split
    commission)?** Default: **NO** — ship MVP single-staff commission
    in Phase 5 Epic D as planned; V4 (split + staff-on-the-job) is its
    own epic in Phase 6. Folding doubles Epic D scope. **OK?**

19. **Default for the "applies to" cap on rules** — should there be a
    rate ceiling (e.g. no rule can exceed 25%)? Protects against typo
    that gives away the store. Default: **soft cap of 50%** with a
    warning, hard cap of 100%. **OK?**

---

## 12. Acceptance Gates (apply to every PR)

- [ ] `npx tsc -b --noEmit` clean (server and client)
- [ ] `node scripts/enforce.js` 0 errors
- [ ] `node scripts/enforce-offline.mjs` 0 new violations
- [ ] `node scripts/manifest-score.js --brief` exits 0 (gold standard)
- [ ] Translation parity: `ext38/39/40` EN and HI files have identical
      key sets
- [ ] `curl -X GET http://localhost:3001/api/loyalty/program -b
      cookies.txt` → 200 with `{ success: true, data: ... }`
- [ ] Without auth (`curl` no cookie) → 401
- [ ] Bad input (`curl -X PUT ... -d '{"accrualRateBps": "abc"}'`) → 400
- [ ] Same trio for each new endpoint listed in §5 (15 endpoints × 3
      gates = 45 curl checks; record in `docs/SECURITY_AUDIT_EPIC_D.md`
      when security agent runs)
- [ ] Screenshots per page (loading / error / empty / success): 5
      new pages × 4 states = 20 screenshots
- [ ] 320px: no horizontal overflow on any new page
- [ ] 375px: layout works as designed on every page
- [ ] All copy uses `t.<key>` from `useLanguage()` (no hardcoded strings)
- [ ] All API calls go through `api()` from `@/lib/api`
- [ ] Every mutation passes `entityType` + `entityLabel`
- [ ] Cache-safe reads pass `cacheReads: true`; PII reads do not
- [ ] No `localStorage` writes for entity data
- [ ] Each file ≤ 250 lines (enforce via line-count check pre-commit)
- [ ] Atomic guarantees: `pos-checkout.service.ts` integration tests
      prove loyalty accrual + commission accrual + sale all roll back
      together when ANY step throws

---

## 13. Failure Mode Walkthrough (per scope-writer v2)

Six-month-out scenarios with concrete mitigations:

1. **Provider/dependency outage** — N/A. No external provider on
   Epic D; all internal. Cron failure logged and retried next day;
   `LoyaltyLedger` expiry slips by 24h max with no user-visible
   damage.

2. **Abuse spike** — Loyalty: malicious cashier creates 100 fake
   walk-in sales to accrue points to a colluding party. **Mitigation**:
   (a) Walk-ins explicitly excluded from accrual (Q7); (b) every
   `LoyaltyLedger.ACCRUED` row carries `posSaleId` — owner can audit
   any party's ledger and trace back to the sale; (c) commission
   accrual is similarly audit-traceable via `ruleSnapshot` JSON.

3. **Database bloat** — `CommissionLedger` and `LoyaltyLedger` grow
   monotonically. **Mitigation**: indexes on
   `(businessId, periodYearMonth)` mean monthly leaderboard query
   stays O(rows-in-month) not O(all-time). Sizing estimate: 5k POS
   sales/day × 365 = 1.8M ledger rows/year per business — well
   within Postgres comfort zone at our scale (Render Starter handles
   tens of millions per table comfortably).

4. **Client-version lag** — Older clients send POS sale without
   `payments[].mode === 'LOYALTY_REDEMPTION'` support. Server accepts
   either shape; missing redemption → no accrual conflict (sale just
   doesn't redeem). Older clients still SEE accrued points on next
   release. **Mitigation**: server-side accrual is additive; old
   clients earn points silently.

5. **Regulatory change** — RBI / GST clarification: are loyalty
   redemptions treated as discount (no GST) or supply of goods/services
   (GST applies)? **Mitigation**: redemption is modeled as a
   `payment mode` (not a discount line), so it does not affect
   `totalTaxableValue`. If regulator says it MUST reduce taxable
   value, we add a server-side flag on `LoyaltyProgram`
   (`reduceTaxableValueOnRedemption`) and recompute — single-table
   change, no migration. Document this as known-future-risk in
   `docs/ARCHITECTURE_EPIC_D.md`.

6. **Cost runaway** — No external paid service in Epic D.
   `loyalty-expiry.cron` worst-case scans all unexpired ledger rows
   nightly; bounded by Postgres CPU on Render Starter. **Mitigation**:
   batched 500-row updates; per-business iteration; advisory lock
   prevents double-run. If CPU exceeds 60% for the cron window, add a
   `expiry_processed_at` column on `LoyaltyProgram` to skip
   already-swept rows on retry — cheap fix.

7. **Insider abuse** — Engineer with DB access grants their own
   business 1M loyalty points or sets commission rate to 100%.
   **Mitigation**: (a) `AuditLog` row written on every program /
   commission-rule update via existing audit middleware; (b)
   `LoyaltyLedger.adjustedBy` records the `userId`; (c) admin actions
   route through `AdminAction` audit trail. Owner sees a "last edited
   by" trail on the program page. Add quarterly admin-DB-access review
   to ops runbook.

---

## 14. Resolved Decisions (from blindspots checklist)

| Decision | Resolution |
|----------|------------|
| **Tier every recommendation** (blindspot #9) | Every goal in §2 ends with `[MUST_SHIP]` / `[SHOULD_SHIP]` / `[NICE_TO_HAVE]` / `[FUTURE_EPIC]` tag |
| **Ephemeral-table cleanup cron** (#5) | `LoyaltyLedger` / `CommissionLedger` are NOT ephemeral — financial truth. Loyalty expiry sweep cron specified at §6 + cron-scheduler edit in file plan |
| **Provider abstraction for future channels** (#8) | N/A — no external provider in Epic D |
| **Auto-fill / autocomplete** (#10) | All number inputs (rate, points, paise) get `inputmode="numeric"` + block `e/E/+/-` per project rule. No phone/email inputs in Epic D |
| **Failure-mode walkthrough** (v2 hard gate) | Section §13 covers all 7 mandatory scenarios |
| **Auth/billing lockout policy** | N/A — Epic D is not an auth/billing feature |
| **Adapter pattern over deprecation** (#4) | No deprecation in Epic D; all routes are additive |
| **Analytics events ≤ 7 per flow** (#14) | Loyalty redemption: 3 events (`loyalty_program_enabled`, `loyalty_accrued`, `loyalty_redeemed`). Commission: 2 events (`commission_rule_created`, `commission_accrued`). CRM: 2 events (`crm_tag_filtered`, `crm_followup_set`). Total: 7. |

---

## 15. Out of Scope (explicit, tier-tagged)

- Tiered loyalty (Silver / Gold / Platinum) **[FUTURE_EPIC]**
- Per-party loyalty programs **[FUTURE_EPIC]**
- Loyalty on SALE_INVOICE (counter sale) **[FUTURE_EPIC]** — one-line
  service call to add later
- Manual ledger adjustment UI (owner gives bonus points) **[NICE_TO_HAVE]**
- Loyalty referral bonus ("get 100 pts for referring a friend")
  **[FUTURE_EPIC]** — separate from existing #3 referral system
- Push notification on loyalty expiry **[FUTURE_EPIC]** — needs FCM
  creds anyway
- Tag taxonomy / pre-defined tag list per business **[NICE_TO_HAVE]**
- Manual "log a call / WA message" button on party detail
  **[FUTURE_EPIC]** — Phase 6 with attendance
- Per-tag analytics dashboard **[NICE_TO_HAVE]**
- Commission payout via Razorpay → bank transfer
  **[FUTURE_EPIC]** — Phase 6 #136 Payroll
- Commission on `Payment` collection **[FUTURE_EPIC]**
- Split commission across multiple staff per sale **[FUTURE_EPIC]** —
  vertical V4
- Commission on stock-adjustment / refund-out **[NICE_TO_HAVE]**
- Per-product commission caps / floors **[NICE_TO_HAVE]**
- Approval workflow for commission rule changes
  **[FUTURE_EPIC]** — depends on Phase 1 #57 approval infra
- Multi-language Loyalty SMS templates **[FUTURE_EPIC]** — depends on
  Aisensy creds

---

## 16. QA Checklist (verifier runs before merge)

- [ ] Enable loyalty program at 100 bps (1 pt per Rs 1) → ring a Rs 500
      POS sale → ledger shows +500 ACCRUED for the party
- [ ] Ring next sale to same party → balance chip shows "500 pts (Rs 5)"
- [ ] Apply 200-pt redemption → cart total drops by Rs 2 → ledger shows
      -200 REDEEMED row
- [ ] Try to redeem 1000 pts (more than balance) → form error
      `INSUFFICIENT_POINTS`
- [ ] Set party `followUpAt` to tomorrow → appears on
      `/parties/follow-ups` with "1 day" badge
- [ ] Set party `followUpAt` to yesterday → server rejects with
      `INVALID_FOLLOWUP_PAST` (per Q11 default)
- [ ] Filter party list by tag `vip` → only `vip`-tagged parties shown
- [ ] Share an invoice → party `lastContactedAt` updates
- [ ] Define a 2% PERCENT_GROSS commission rule on category "Spices" →
      ring a Rs 1000 POS sale (Spices) → ledger shows +Rs 20 commission
      for the cashier
- [ ] Void the sale → ledger shows -Rs 20 reversal row
- [ ] Staff dashboard widget for the cashier shows current month total
- [ ] Owner leaderboard shows the cashier row
- [ ] Staff WITHOUT `commission.read.all` cannot open leaderboard (403)
- [ ] Offline POS: cart shows last-known loyalty balance from cache,
      "Last synced HH:MM" caption visible; checkout sheet blocked with
      existing "Internet required" message
- [ ] tsc clean, enforce clean, enforce-offline clean

---

## 17. Acceptance Criteria — Per Feature (testable, binary)

### #125 Loyalty

- [ ] `GET /api/loyalty/program` returns `null` for businesses with no
      program configured
- [ ] `PUT /api/loyalty/program` rejects negative rates
- [ ] `LoyaltyLedger` row written inside the SAME `$transaction` as
      `PosSale` — proof: integration test forces a throw mid-checkout,
      asserts ledger row absent
- [ ] Redemption uses FIFO oldest-ACCRUED-first (test: accrue 100, then
      accrue 200, redeem 150 → first ACCRUED row consumed, second row
      partially consumed)
- [ ] Expiry cron writes EXPIRED rows for entries where `expiresAt <
      now` AND the entry is not already offset by a REDEEMED
- [ ] Walk-in party (`isWalkIn=true`) does NOT accrue points
- [ ] `GET /api/loyalty/balance/:partyId` honors `cacheReads: true`
- [ ] Loyalty UI page passes 4 UI states (loading / error / empty /
      success) at 320px

### #127 CRM Basics

- [ ] `GET /api/parties?tag=vip` returns only parties whose `tags[]`
      contains "vip" (verified via SQL `tags @> ARRAY['vip']`)
- [ ] `GET /api/parties/tags` returns aggregated tags with counts,
      filtered to businessId
- [ ] `GET /api/parties/follow-ups?withinDays=7` returns parties where
      `followUpAt <= now + 7d AND followUpAt IS NOT NULL`
- [ ] Sharing an invoice triggers `lastContactedAt = now()` on the
      party (verified via integration test)
- [ ] `PATCH /api/parties/:id` with past `followUpAt` returns 400
      `INVALID_FOLLOWUP_PAST`
- [ ] FollowUpsPage 4 UI states pass at 320px
- [ ] TagFilterBar handles 0-tag / 1-tag / 50-tag states

### #128 Commission

- [ ] `POST /api/commission/rules` creates rule; rate cap of 50%
      warns, 100% hard-blocks (per Q19)
- [ ] CommissionLedger row written inside SAME `$transaction` as the
      POS sale or invoice
- [ ] PRODUCT-scoped rule overrides CATEGORY rule which overrides ALL
      rule (test: 3 overlapping rules → only the most specific writes
      ledger row)
- [ ] Voiding a POS sale writes a NEGATIVE commission row (sum nets
      to 0)
- [ ] `GET /api/commission/ledger?staffUserId=X` returns 403 when
      caller has `commission.read.self` but is not staffUserId X
- [ ] `GET /api/commission/leaderboard` returns 403 without
      `commission.read.all`
- [ ] Staff widget on dashboard hidden when user has no
      `commission.read.self` permission
- [ ] All 4 UI states pass on each of: CommissionSettingsPage,
      CommissionLedgerPage, LeaderboardPage

---

## 18. Rollout Plan (PR sequence)

> Architect to finalize. Suggested sequencing matches Epic B/C pattern:

- **PR1 — Schema + Migration + Shared Types** (files #1, #2, #3-4,
  #15, #24-25, #33-39 translations skeleton). Single migration; no
  user-visible features. Green = `npx prisma migrate dev` succeeds +
  tsc clean + translation parity.
- **PR2 — CRM Basics #127** (files #16-23 backend, #54-64 frontend +
  ext39 translations). Smallest scope, lowest risk, ships first.
- **PR3 — Loyalty #125 backend** (files #5-14). Integration test on
  POS checkout transaction is the gate.
- **PR4 — Loyalty #125 frontend** (files #40-53 + ext38 translations).
- **PR5 — Commission #128 backend** (files #26-32 backend). Hooks into
  POS checkout AND document.service — both transactions must include
  the accrual.
- **PR6 — Commission #128 frontend** (files #65-78 + ext40
  translations + #79-81 CSS).
- **PR7 — Security audit fixes** (output: `SECURITY_AUDIT_EPIC_D.md`).

Each PR independently green per §12 gates. Architect may merge / split.

---

## 19. Locked Decisions (Sawan, 2026-05-17 12:48 PM)

All 19 clarifying questions from §11 are resolved. The 4 critical
schema-impacting questions were confirmed via prompt; the remaining 15
accept the scope-writer's default for each.

### Loyalty (#125)

| Q | Decision | Source |
|---|----------|--------|
| Q1 | **Per-business flat** — one `LoyaltyProgram` per businessId, no tiers or per-party rules. Tiered = FUTURE_EPIC. | Confirmed prompt |
| Q2 | **Cash-equivalent redemption** — 1 point = configurable paise, applied as `LOYALTY_REDEMPTION` payment-mode that reduces amount-due. No tax recalc. | Confirmed prompt |
| Q3 | **12-month expiry default**, configurable per business; null = never. Daily cron 02:30 IST. | Default accepted |
| Q4 | **POS-only accrual for MVP**. SALE_INVOICE = FUTURE_EPIC (one-line later). | Default accepted |
| Q5 | **No block** on redemption when party has unpaid invoices. | Default accepted |
| Q6 | **Min-spend = 0** (any sale earns); configurable in program settings. | Default accepted |
| Q7 | **Walk-in parties do NOT accrue**. `partyId === walkInPartyId` → skip silently. | Default accepted |

### CRM (#127)

| Q | Decision | Source |
|---|----------|--------|
| Q8 | **Free-text tags** (matches current `Party.tags[]`). Pre-defined taxonomy = FUTURE_EPIC. | Default accepted |
| Q9 | **`lastContactedAt` auto-update on**: DocumentShareLog create, ReminderLog create, PaymentReminder create. No additions/removals. | Default accepted |
| Q10 | **No push** for follow-ups today (no FCM creds). Pull-only FollowUpsPage. Push deferred until FCM lands. | Default accepted |
| Q11 | **Future-only follow-up dates**; server rejects past with `INVALID_FOLLOWUP_PAST`. | Default accepted |

### Commission (#128)

| Q | Decision | Source |
|---|----------|--------|
| Q12 | **Sale-creator only** — `PosSale.cashierId` (POS) or `Document.createdBy` (invoice). Staff-on-job = Phase 6 V4. | Confirmed prompt |
| Q13 | **All three modes**: `PERCENT_GROSS`, `PERCENT_NET`, `FLAT_PER_UNIT`. Owner picks per rule. | Default accepted |
| Q14 | **Ship GROSS + NET both for forward-compat** (identical in non-GST mode; diverge in Phase 2 GST). | Default accepted |
| Q15 | **Most-specific-wins** conflict resolution: PRODUCT > CATEGORY > ALL. Within same specificity → newest `createdAt`. | Default accepted |
| Q16 | **Negative rows on void/refund** — `PosSale.VOIDED` → NEGATIVE `CommissionLedger` row reversing accrual. `SUM(commissionPaise)` always net-earned. | Default accepted |
| Q17 | **Payout deferred to Phase 6 #136 Payroll**. Epic D accrues only. Manual UPI/cash payout + admin-script tick "paid". | Default accepted |
| Q18 | **Keep Epic D separate from Phase 6 V4**. Single-staff MVP now; split commission = own V4 epic later. | Confirmed prompt |
| Q19 | **Rate ceiling**: soft cap 50% with warning, hard cap 100%. | Default accepted |

### Implication for architect

Architect can proceed with the §6 schema delta as-drafted (4 new tables,
2 new nullable Party columns) and the §10 file plan (81 files). No
schema or scope changes required from these answers — all defaults were
designed to be the canonical path.

---

**End of SCOPE.**
