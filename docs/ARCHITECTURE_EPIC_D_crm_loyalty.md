# ARCHITECTURE — Phase 5 Epic D: CRM + Loyalty + Commission

**Features:** #125 Loyalty · #127 CRM Basics · #128 Staff Performance & Commission
**Status:** DRAFT — 2026-05-17 14:55 IST (pre-security-audit)
**Companion:** `docs/SCOPE_EPIC_D_crm_loyalty.md` (§19 Locked Decisions)
**Cleared for security audit:** YES (open risks compiled in §11)

---

## Revision history

- **2026-05-17** — Initial architecture draft. SCOPE §6 schema delta accepted unchanged.
  Five intentional deviations from SCOPE file plan, all path-only (real worktree
  paths differ from SCOPE assumptions) — listed in §0 and re-baselined in §7
  File Plan.

---

## 0. SCOPE conformance & intentional deviations

The SCOPE was drafted before the architect walked the actual worktree. Five
file paths in SCOPE §10 do not exist in the worktree; they are renamed below to
the real files. **No business logic changes — only path corrections.** Every
SCOPE Locked Decision (§19) and every Goal in §2 lands intact in this document.

| SCOPE row | SCOPE path (assumed) | Real path (worktree) | Why the rename |
|-----------|----------------------|----------------------|----------------|
| #16 | `services/parties/party-followups.service.ts` | `server/src/services/party/followups.service.ts` | Repo uses singular `party/` directory (see `services/party.service.ts` barrel re-export) |
| #17 | `services/parties/party-tags.service.ts` | `server/src/services/party/tags.service.ts` | Same |
| #18 | `services/parties/party-last-contacted.service.ts` | `server/src/services/party/last-contacted.service.ts` | Same |
| #19 | `services/document/share-log.service.ts` | `server/src/routes/documents/share.ts` (edit existing) | Share log is written from the route handler, not a service — Epic C never extracted it |
| #20 | `services/marketing/reminder-log.service.ts` | `server/src/services/collections/bulk-reminder.service.ts` (edit existing) | ReminderLog is written from the collections bulk-reminder service, not marketing |
| #21 | `services/payment/payment-reminder.service.ts` | `server/src/services/payment/reminders.ts` (edit existing) | Real filename is `reminders.ts`, not `payment-reminder.service.ts` |

These corrections add **zero** new files and remove **zero** required hooks.
The end state matches SCOPE §1 "auto-update on 3 hook surfaces" verbatim.

One other subtlety the SCOPE didn't surface: `services/payment/reminders.ts:31`
creates the `PaymentReminder` row **outside** any `$transaction` (the side-effect
WhatsApp delivery is non-DB I/O). For CRM hook #21, the `touchLastContacted`
call is therefore a sibling `prisma.party.update` (post-commit), not an
in-transaction call. The race window is "user creates reminder, app crashes
before `lastContactedAt` update" — acceptable; the worst case is one missed
contact timestamp, which the next reminder will heal. Documented at §3.

---

## 1. Overview & component diagram

Epic D layers three retention/team features onto existing entities without
introducing any new transports, new external providers, or new top-level
domains. Every mutation hangs off an existing `$transaction` (POS checkout,
document save, share-log write, reminder dispatch). The single new background
process is a daily loyalty-expiry cron that mirrors the existing
`runGraceExpiryJob` pattern (`server/src/services/subscription/cron-grace-expiry.ts`)
exactly: cursor-paged business sweep, per-row try/catch, advisory lock, no
in-memory accumulation.

### 1.1 Boundary diagram

```
                    ┌────────────────────────────────────────────────────────┐
                    │                  Existing surfaces                     │
                    │                                                        │
  POST /pos/sales   │  pos-checkout.service.ts  $transaction {              │
  ─────────────────►│    1..12  existing steps                              │
                    │    12.5   loyalty-accrual.service.accrueForPosSale ◄──┼─── NEW (in-tx)
                    │    12.6   loyalty-redeem.service.applyRedemption  ◄──┼─── NEW (in-tx, FIFO)
                    │    12.7   commission-accrual.service.accrueForPos ◄──┼─── NEW (in-tx)
                    │    13     PosSaleEvent CREATED                        │
                    │  }                                                    │
                    │                                                        │
  POST /pos/:id/   │  pos-void.service.ts      $transaction {              │
  void              │    existing reverseStock / voidCashEntry              │
  ─────────────────►│    NEW   commission-accrual.service.reverseForPos ◄──┼─── NEW (in-tx, ‑ve row)
                    │    NEW   loyalty-accrual.service.reverseForPosSale ◄─┼─── NEW (in-tx, ‑ve row)
                    │    PosSaleEvent VOIDED                                │
                    │  }                                                    │
                    │                                                        │
  POST /documents  │  document/create.ts       $transaction {              │
  (SALE_INVOICE)   │    1..N  existing                                     │
  ─────────────────►│    N+1   if isSaving && type=SALE_INVOICE             │
                    │          commission-accrual.service.accrueForDoc ◄──┼─── NEW (in-tx)
                    │  }                                                    │
                    │                                                        │
  PUT  /documents  │  document/update.ts       $transaction {              │
  (DRAFT→SAVED)    │    if !wasSaved && willBeSaved && SALE_INVOICE        │
  ─────────────────►│         commission-accrual.service.accrueForDoc ◄──┼─── NEW (in-tx)
                    │  }                                                    │
                    │                                                        │
  POST /documents  │  routes/documents/share.ts $transaction {              │
  /:id/share/*     │    existing documentShareLog.create                   │
  ─────────────────►│    NEW   last-contacted.service.touchLastContacted ◄┼─── NEW (in-tx, free)
                    │  }                                                    │
                    │                                                        │
  POST /payments  │  bulk-reminder.service.ts $transaction {               │
  /reminders/bulk  │    existing reminderLog.createMany                    │
  ─────────────────►│    NEW   last-contacted.service.touchLastContactedMany◄┼── NEW (in-tx)
                    │  }                                                    │
                    │                                                        │
  POST /payments  │  payment/reminders.ts (no tx)                          │
  /:id/reminders   │    existing paymentReminder.create                    │
  ─────────────────►│    NEW   sibling party.update(lastContactedAt)  ──── │── NEW (post-write)
                    │                                                        │
                    └────────────────────────────────────────────────────────┘

                    ┌────────────────────────────────────────────────────────┐
                    │                     New surfaces                       │
                    │                                                        │
  Cron 02:30 IST   │  loyalty-expiry.cron.ts   per-business loop {         │
                   │    pg_try_advisory_xact_lock(loyalty:{businessId})    │
                   │    write EXPIRED ledger rows in batches of 500        │
                   │  }                                                    │
                    │                                                        │
  GET  /loyalty/   │  loyalty-program.service.ts  read program JSON         │
  program           │                                                        │
  PUT  /loyalty/   │  loyalty-program.service.ts  upsert (audit + RBAC)     │
  program           │                                                        │
                    │                                                        │
  GET  /loyalty/   │  loyalty-balance.service.ts  SUM(delta) — see §4.1     │
  balance/:partyId │                                                        │
                    │                                                        │
  POST /loyalty/   │  loyalty-redeem.service.previewRedemption              │
  redeem/preview    │  (read-only — same lock-free FIFO simulation)         │
                    │                                                        │
  GET  /parties/   │  party/followups.service.ts  ported from DH pattern    │
  follow-ups        │                                                        │
  GET  /parties/   │  party/tags.service.ts        UNNEST aggregate         │
  tags              │                                                        │
  GET  /parties?   │  party/list-get.ts (edit)     already-supported tag    │
  tag=…             │  via hasSome; add followUpBefore                      │
                    │                                                        │
  /commission/*    │  commission-rule.service.ts   CRUD + applicability     │
                   │  commission-ledger.service.ts cursor list + leaderbd   │
                   │                                                        │
                    └────────────────────────────────────────────────────────┘
```

The **only** code paths that share a transaction with money-equivalent rows
(loyalty + commission) are `pos-checkout.service.ts`, `pos-void.service.ts`,
`document/create.ts`, and `document/update.ts`. Everything else is read-only or
non-money-equivalent.

---

## 2. Schema delta (final, additive only)

All four new tables and two nullable Party columns are exactly as SCOPE §6
specified, with two minor refinements made by walking the existing schema:

1. **Reverse-relation additions** on `Business`, `Party`, `PosSale`,
   `Document`, `User` — Prisma requires explicit reverse fields when a
   model declares a `@relation`. These cost zero migration time.
2. **Naming consistency** — `LoyaltyLedger.type` (a `String` per SCOPE)
   gets a named constant set in `loyalty.constants.ts`; no enum at the DB
   layer to keep migrations cheap (matches existing pattern e.g.
   `Document.type`, `PosSale.status`).

### 2.1 New: `LoyaltyProgram`

```prisma
model LoyaltyProgram {
  id                     String   @id @default(cuid())
  businessId             String   @unique
  enabled                Boolean  @default(false)
  // Accrual
  accrualRateBps         Int      @default(100)        // 100 bps ⇒ 1 pt / Rs 1 spent (gross-line)
  accrualMinSpendPaise   Int      @default(0)          // skip lines below this
  // Redemption
  redemptionUnit         Int      @default(1)          // points required for 1 unit
  redemptionPaisePerUnit Int      @default(100)        // 1 unit = Rs 1
  // Expiry
  expiryMonths           Int?                          // null = never; default 12
  // Audit
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
  createdBy              String

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId])
}
```

Reverse on `Business`: `loyaltyProgram LoyaltyProgram?` (1:0..1).

### 2.2 New: `LoyaltyLedger`

```prisma
model LoyaltyLedger {
  id            String   @id @default(cuid())
  businessId    String
  partyId       String
  type          String   @db.VarChar(20)              // ACCRUED | REDEEMED | EXPIRED | ADJUSTED
  delta         Int                                   // signed paise-equivalent points
  // Provenance — exactly one of these is set (enforced in service)
  posSaleId     String?
  documentId    String?
  expiryRunId   String?                                // groups EXPIRED rows from one cron pass
  adjustedBy    String?                                // userId if type=ADJUSTED
  note          String?  @db.VarChar(200)
  earnedAt      DateTime @default(now())               // when the ACCRUED row was earned
  expiresAt     DateTime?                              // computed at accrual from program.expiryMonths
  createdAt     DateTime @default(now())

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  party    Party    @relation(fields: [partyId], references: [id], onDelete: Restrict)
  posSale  PosSale? @relation(fields: [posSaleId], references: [id], onDelete: SetNull)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([businessId, partyId, createdAt])      // ledger list per party
  @@index([businessId, partyId, expiresAt])      // FIFO redemption scan (UNEXPIRED ACCRUED rows)
  @@index([businessId, expiresAt])                // expiry cron sweep
  @@index([posSaleId])
  @@index([documentId])
}
```

Reverse adds:
- `Business.loyaltyLedger LoyaltyLedger[]`
- `Party.loyaltyLedger LoyaltyLedger[]`
- `PosSale.loyaltyLedger LoyaltyLedger[]`
- `Document.loyaltyLedger LoyaltyLedger[]`

> **Refinement vs SCOPE:** I added `@@index([businessId, partyId, expiresAt])`
> beyond what SCOPE drew. The redemption FIFO scan is
> `WHERE businessId=? AND partyId=? AND type='ACCRUED' AND expiresAt > now()
>  ORDER BY earnedAt ASC`. The two-column `(partyId, createdAt)` index isn't
> selective enough — adding `expiresAt` lets the planner do an index-only scan
> for the unexpired bucket. Cost: one extra B-tree per ledger row (negligible).

### 2.3 New: `CommissionRule`

```prisma
model CommissionRule {
  id               String   @id @default(cuid())
  businessId       String
  name             String   @db.VarChar(80)
  scope            String   @db.VarChar(20)         // ALL | PRODUCT | CATEGORY
  scopeId          String?                           // productId or categoryId; null when scope=ALL
  mode             String   @db.VarChar(30)         // PERCENT_GROSS | PERCENT_NET | FLAT_PER_UNIT
  rateBps          Int?                              // basis points for PERCENT modes
  flatPerUnitPaise Int?                              // paise per unit for FLAT_PER_UNIT
  appliesTo        String   @db.VarChar(10)         // POS | INVOICE | BOTH
  staffUserIds     String[] @default([])             // empty array = applies to ALL staff
  isActive         Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  createdBy        String

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId, isActive])
  @@index([businessId, scope, scopeId])             // applicability query
}
```

Reverse on `Business`: `commissionRules CommissionRule[]`.

### 2.4 New: `CommissionLedger`

```prisma
model CommissionLedger {
  id              String   @id @default(cuid())
  businessId      String
  staffUserId     String                            // BusinessUser.userId (FK → User.id)
  ruleId          String?                           // null if rule deleted (history preserved)
  posSaleId       String?
  documentId      String?
  basisPaise      Int                               // the sale or line amount commission was computed against
  commissionPaise Int                               // earned (signed; void produces negative row)
  periodYearMonth String   @db.VarChar(7)           // "2026-05" — denormalized for leaderboard speed
  createdAt       DateTime @default(now())
  meta            Json?                              // { ruleSnapshot: {...}, source: 'POS'|'INVOICE'|'VOID' }

  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  staff    User     @relation("StaffCommissionLedger", fields: [staffUserId], references: [id], onDelete: Restrict)
  posSale  PosSale? @relation(fields: [posSaleId], references: [id], onDelete: SetNull)
  document Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)

  @@index([businessId, staffUserId, periodYearMonth])  // dashboard widget
  @@index([businessId, periodYearMonth])               // leaderboard
  @@index([posSaleId])
  @@index([documentId])
}
```

Reverse adds:
- `Business.commissionLedger CommissionLedger[]`
- `User.staffCommissionLedger CommissionLedger[] @relation("StaffCommissionLedger")`
- `PosSale.commissionLedger CommissionLedger[]`
- `Document.commissionLedger CommissionLedger[]`

### 2.5 `Party` additions

```prisma
// In existing Party model — add ONLY these two nullable columns + 2 indexes.
lastContactedAt DateTime?    // touched on share + reminder events
followUpAt      DateTime?    // owner-set future date; powers /parties/follow-ups

@@index([businessId, followUpAt])         // follow-up queue
@@index([businessId, lastContactedAt])    // dormant-party scans (Phase 6)
```

Both columns are nullable (no backfill needed). SCOPE §1 confirmed neither
exists today; the worktree schema check at `server/prisma/schema.prisma:349-424`
confirms — only `lastTransactionAt` (different concept) exists.

### 2.6 Migration plan — single additive step

```
prisma/migrations/20260518000000_phase5_epic_d_crm_loyalty_commission/
  migration.sql
```

Contents (single transaction at the DB level):

1. `CREATE TABLE "LoyaltyProgram" (...) ;` + indexes
2. `CREATE TABLE "LoyaltyLedger" (...) ;` + 5 indexes + FK constraints
3. `CREATE TABLE "CommissionRule" (...) ;` + 2 indexes
4. `CREATE TABLE "CommissionLedger" (...) ;` + 4 indexes + FK constraints
5. `ALTER TABLE "Party" ADD COLUMN "lastContactedAt" TIMESTAMP(3) ;`
6. `ALTER TABLE "Party" ADD COLUMN "followUpAt" TIMESTAMP(3) ;`
7. `CREATE INDEX "Party_businessId_followUpAt_idx" ON "Party"("businessId","followUpAt") ;`
8. `CREATE INDEX "Party_businessId_lastContactedAt_idx" ON "Party"("businessId","lastContactedAt") ;`

Zero destructive DDL. Zero backfill (all new columns nullable, all new tables
empty). Zero `make-NOT-NULL` step. Conforms to
`.claude/rules/PRISMA_MIGRATION_RULES.md` — no `db push`, no raw GIN.

**Render Starter sizing check:** 8 DDL statements + 11 index builds on
production-sized tables takes < 5 s on Render Starter Postgres. No downtime
window required.

---

## 3. Transaction boundaries (where exactly the new code splices in)

Every money-equivalent write hooks into an existing `$transaction`. The
authoritative reference is `pos-checkout.service.ts:67-243` — step numbers
below match the existing comments.

### 3.1 POS checkout — `pos-checkout.service.ts` (extend existing tx)

Current shape (`pos-checkout.service.ts:67-243`):
```
$transaction(async tx => {
  step 1b   idempotency
  step 1c   clientId guard
  step 2    load PosSetting
  step 3    reprice lines
  step 3b   MOQ guard
  step 4    resolve party
  step 5    tax engine
  step 6    drift + payment-sum guards
  step 7    allocate receipt number
  step 8    claim inventory
  step 9    create Document
  step 10   persistPosSale (PosSale + PosSaleItem)
  step 11   createCashEntry
  step 12   PosSaleEvent CREATED                          ← existing last in-tx step
  step 13   storeIdempotency (post-DTO)
})
```

Extended shape — three new in-tx steps inserted **between step 10 and 11**
(after PosSale row exists, before cash entry / event):

```
  step 10   persistPosSale
  step 10.5 loyalty-redeem.service.applyRedemption(tx, ...)   ← NEW
  step 10.6 loyalty-accrual.service.accrueForPosSale(tx, ...) ← NEW
  step 10.7 commission-accrual.service.accrueForPosSale(tx, ...)  ← NEW
  step 11   createCashEntry  (unchanged)
  step 12   PosSaleEvent CREATED  (unchanged)
```

**Why redeem before accrue?** Two reasons. (1) Redemption MUST run before
the post-sale ledger snapshot so that the cashier's "after this sale: X pts"
balance is correctly computed; if accrual ran first the customer could
double-spend (redeem the points they just earned on the same sale).
(2) The validator (`pos.validators.ts`) treats `LOYALTY_REDEMPTION` as a
payment mode in `payments[]` (see §3.1.1); the redemption call consumes that
input synchronously so the cash entry sees the post-redemption payment list.

**Rollback semantics:** Anything thrown by `applyRedemption`, `accrueForPosSale`
(loyalty), or `accrueForPosSale` (commission) rolls back the **entire** sale —
PosSale row, PosSaleItem rows, Document row, stock claims, cash entry,
PosSaleEvent. This is the same `$transaction` guarantee already used for
inventory + cash entry. **No partial state is possible** — proved by the
existing throw-mid-checkout integration test pattern (see §12.1).

#### 3.1.1 `pos.validators.ts` change — add `LOYALTY_REDEMPTION` mode

```ts
// pos.validators.ts (line 10)
export const paymentModeSchema = z.enum([
  'cash', 'upi', 'card', 'bank_transfer', 'other',
  'LOYALTY_REDEMPTION',                                // NEW
])
```

And in `posPaymentSchema`, a `superRefine` rule:

```
if mode === 'LOYALTY_REDEMPTION':
  - payments must include partyId at the top level (we already require
    it for accrual — walk-in cannot redeem; rejected with PARTY_REQUIRED_FOR_REDEMPTION)
  - amountPaise must equal points × (program.redemptionPaisePerUnit / program.redemptionUnit)
  - exactly one LOYALTY_REDEMPTION entry per sale (no split redemption in MVP)
```

The redemption row's `amountPaise` participates in the existing
`paymentSumMismatchError` check (`pos-checkout.service.ts:149-150`). No
change to the drift-tolerance logic — the grand total still equals subtotal
+ tax (loyalty is settled at the payment layer, not the line layer; matches
Locked Decision Q2 "no tax recalc").

### 3.2 POS void — `pos-void.service.ts` (extend existing tx)

Current shape (`pos-void.service.ts:119-158`, `isolationLevel: 'Serializable'`):
```
$transaction(async tx => {
  sale lookup + window check
  reverseStock(tx, ...)
  voidCashEntry(tx, ...)
  document.update → status: VOIDED
  posSale.update → status: VOIDED
  PosSaleEvent VOIDED
})
```

Two new in-tx steps inserted **between cash-entry void and document update**:

```
  reverseStock(tx, ...)
  voidCashEntry(tx, ...)
  NEW: commission-accrual.service.reverseForPosSale(tx, posSaleId)  ← writes ‑ve row(s)
  NEW: loyalty-accrual.service.reverseForPosSale(tx, posSaleId)     ← writes ‑ve row(s) + restores REDEEMED
  document.update → VOIDED
  ...
```

Locked Decision Q16: reversal is a NEGATIVE row, not an UPDATE — preserves
forensic history. The commission reversal reads the original CommissionLedger
rows by `posSaleId`, inserts negated counterparts with the same `ruleSnapshot`
and a `meta.source = 'VOID'`. The loyalty reversal does TWO things:
(a) negates ACCRUED rows for the sale (so the customer doesn't keep points
they didn't really earn), and (b) negates REDEEMED rows tied to the sale's
`posSaleId` (so the customer gets their redeemed points back). The combined
result: `SUM(delta) WHERE partyId, businessId` snaps to its pre-sale value.

### 3.3 Document create / update (SALE_INVOICE) — `document/create.ts` + `update.ts`

`document/create.ts:102-232` is already a `$transaction`. Insert one new step
**after `doc.id` exists and AFTER the existing `if (isSaving)` stock block**
(at line ~228, just before the `return tx.document.findFirstOrThrow`):

```ts
if (isSaving && data.type === 'SALE_INVOICE') {
  await commissionAccrual.accrueForDocument(tx, {
    businessId,
    userId,                          // sale-creator (per Locked Decision Q12)
    documentId: doc.id,
    lineItems: data.lineItems,
    taxedTotals: totals,             // for PERCENT_NET basis
    productMap,                      // for PRODUCT/CATEGORY rule applicability
  })
}
```

`document/update.ts:43-44` already computes `wasSaved` + `willBeSaved`. Add
one branch for **DRAFT→SAVED transition** (only):

```ts
if (!wasSaved && willBeSaved && existing.type === 'SALE_INVOICE') {
  await commissionAccrual.accrueForDocument(tx, { ... same args ... })
}
```

**No commission row on edit-while-already-SAVED.** If the document was SAVED
and is edited (e.g. line item added), the existing stock-reversal+re-application
logic does NOT trigger commission re-accrual. Reasoning: commission is earned
once on the SAVE transition. Re-computing commission on every edit would let
the cashier game commission by repeatedly adding then removing a line.

> **FUTURE_EPIC note**: when commission-on-edit becomes a requirement (Phase 6
> V4 split-commission), we'd write a NEGATIVE row + a fresh positive row in the
> same tx — same pattern as void. Schema is ready; no migration needed.

### 3.4 Share-log write — `routes/documents/share.ts` (extend existing tx)

`routes/documents/share.ts:44-65` (`whatsapp`) and `:133-154` (`email`) both
wrap `documentShareLog.create` in a `$transaction`. Add inside both:

```ts
// after const log = await tx.documentShareLog.create(...)
await touchLastContacted(tx, businessId, docData.party.id)
```

`touchLastContacted` lives at the new
`server/src/services/party/last-contacted.service.ts` and is a one-line
`tx.party.update({ where: { id, businessId }, data: { lastContactedAt: new Date() }})`.
Both the share-log row and the `lastContactedAt` bump commit atomically.

### 3.5 Bulk reminders — `services/collections/bulk-reminder.service.ts` (extend existing tx)

`services/collections/bulk-reminder.service.ts:166-201` already wraps
`reminderLog.createMany` and `auditLog.createMany` in a `$transaction`. Add
one in-tx call **after** both `createMany` blocks:

```ts
await touchLastContactedMany(tx, businessId,
  batch.included.map(r => r.partyId))
```

`touchLastContactedMany` issues `tx.party.updateMany({ where: { id: { in: partyIds }, businessId }, data: { lastContactedAt: new Date() }})`.
Single round-trip; no per-party query.

### 3.6 Single-party manual reminder — `services/payment/reminders.ts` (post-commit)

This is the one exception. `services/payment/reminders.ts:31-46` creates
`paymentReminder` **outside** any `$transaction` — the WhatsApp delivery
attempt is non-DB I/O that intentionally doesn't block the route.

Behaviour: after the `paymentReminder.create` succeeds, issue a sibling
`prisma.party.update({ where: { id: data.partyId, businessId }, data: { lastContactedAt: new Date() }})`
in a `.catch()` block (best-effort, log-only on failure). The data race is:
"reminder row exists, but `lastContactedAt` wasn't updated because the process
died between the two writes". That window is ~5 ms and self-heals the next
time the party is contacted. Documented limitation — acceptable per Locked
Decision Q9 (only 3 hook surfaces, no atomicity guarantee specified).

### 3.7 Cron — `loyalty-expiry.cron.ts` (its own tx-per-batch)

Pattern matches `services/subscription/cron-grace-expiry.ts` exactly:

```
runLoyaltyExpiryJob():
  for each business cursor-page (take 200, businessId asc) {
    lock = await pg_try_advisory_lock(hashtextextended('loyalty-expiry:' + businessId))
    if (!lock) continue                                  // another cron worker has this business
    try {
      while (true) {
        $transaction([
          tx.loyaltyLedger.findMany({
            where: businessId, type: 'ACCRUED', expiresAt: { lt: now },
            // EXCLUDE rows already counterbalanced by an EXPIRED row
            // (we check via NOT EXISTS in §4.4)
            take: 500, orderBy: { earnedAt: 'asc' }
          })
          if (rows.length === 0) break
          tx.loyaltyLedger.createMany({ data: rows.map(r => ({
            businessId, partyId: r.partyId, type: 'EXPIRED',
            delta: -r.delta,                            // negate the ACCRUED amount
            expiryRunId,                                // groups one cron pass
            note: `Expired from ${r.id}`,
          }))})
        ])
      }
    } finally {
      pg_advisory_unlock(...)
    }
  }
```

The advisory lock prevents two cron workers (or a manual CLI run during the
nightly cron window) from double-expiring the same business. Idempotency
backup: even if the lock somehow leaks, the `NOT EXISTS (... expiryRunId)`
clause in the SELECT prevents double-expiry. Belt + braces.

`expiryRunId` is a `crypto.randomUUID()` generated once per `runLoyaltyExpiryJob()`
invocation. Rows from the same run share the same id — easy forensics
("which rows were expired in the 2026-05-18 02:30 IST pass?").

### 3.8 Side-effect rule (mirror of subscription writer)

NO loyalty / commission write triggers any side-effect inside the tx
(no notifications, no push, no audit log spam). The pattern from
`services/subscription/subscription.writer.ts:7,46` (side-effects only after
the tx commits) applies here:

| Side-effect | Trigger | Where it runs |
|-------------|---------|---------------|
| `loyalty_accrued` analytics | After POS sale tx commits | `pos-checkout.service.ts` post-tx block |
| `loyalty_redeemed` analytics | After POS sale tx commits | same |
| `commission_accrued` analytics | After POS / Document tx commits | same |
| AuditLog row for program / rule edit | Same tx as the update | service layer |
| Toast on the client | Mutation onSuccess | client only |

---

## 4. Concurrency & race conditions

### 4.1 Two POS sales redeem from the same balance simultaneously

**Scenario:** cashier A is checking out Sunita with 200 points to redeem;
cashier B is doing the same at the next register. Both reach the
$transaction at the same moment. Without protection, both `applyRedemption`
calls compute "balance = 200" from a stale read, both deduct 200, and the
ledger ends at `-200` (overdraft).

**Solution: per-party advisory lock at the head of the loyalty-redeem path.**

```ts
// loyalty-redeem.service.ts (top of applyRedemption)
await tx.$executeRawUnsafe(
  `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
  `loyalty:${businessId}:${partyId}`
)
```

This is the exact pattern used by `services/subscription/subscription.writer.ts:25-30`
(`acquireAdvisoryLock`). The 64-bit hash avoids collisions. The lock is held
for the duration of the transaction — released automatically on commit/rollback.
Sales for the SAME party serialize; sales for DIFFERENT parties don't block
each other.

After acquiring the lock, the service recomputes the balance from the ledger
inside the tx and only then writes the REDEEMED row. The "compute → write"
window is now atomic per-party.

**Why an advisory lock and not `SELECT ... FOR UPDATE` on ledger rows?**
The FIFO redemption can touch arbitrary subsets of ACCRUED rows (oldest-first
until the redemption amount is satisfied). A row-level lock would have to be
acquired in a deterministic order or risk deadlock. The advisory lock is a
single 8-byte key per party — simpler, faster, deadlock-free.

**Performance impact:** at POS checkout we already do ~12 DB round-trips
inside the tx. One extra `pg_advisory_xact_lock` (sub-millisecond on a hot
connection) is in the noise. Contention is bounded — the same party is
extraordinarily unlikely to check out at two registers within the same 50ms
window.

### 4.2 Commission rule changes mid-transaction

**Scenario:** owner edits the "Spices 2%" rule to "Spices 5%" while a POS
sale is in flight. The accrual service has already read the OLD rule and is
about to write the ledger row. Result: the cashier earns 2% but the rule is
now 5% — confusing for the audit.

**Solution: rule snapshot in `CommissionLedger.meta`.**

```ts
// commission-accrual.service.ts (per matched rule)
await tx.commissionLedger.create({
  data: {
    businessId, staffUserId, ruleId: rule.id,
    posSaleId, basisPaise, commissionPaise, periodYearMonth,
    meta: {
      ruleSnapshot: {
        id: rule.id, name: rule.name, scope: rule.scope, scopeId: rule.scopeId,
        mode: rule.mode, rateBps: rule.rateBps,
        flatPerUnitPaise: rule.flatPerUnitPaise,
        appliesTo: rule.appliesTo,
      },
      source: 'POS' | 'INVOICE' | 'VOID',
      appliedAt: new Date().toISOString(),
    },
  },
})
```

`meta` is a JSON column — Prisma `Json?`. No extra migration. Forensics:
"why did this row have 2% when the rule today says 5%?" answers immediately
from `meta.ruleSnapshot`. The `ruleId` FK is `onDelete: SetNull`, so even
deleting the rule keeps the ledger intact with the snapshot preserved.

### 4.3 Cron clock-skew / dual-fire

Render Starter has only one cron worker, but a manual SSH invocation (`node
scripts/run-loyalty-expiry.ts`) during the cron window would double-fire.

**Solution: `pg_try_advisory_lock` per business + idempotent EXPIRED-row
guard (§3.7).** The advisory lock prevents the second invocation from acting
on the same business. The `NOT EXISTS (SELECT 1 FROM LoyaltyLedger WHERE
type='EXPIRED' AND ... )` guard prevents double-expiry even if the lock fails.

### 4.4 SQL guard for double-expiry

The cron SELECT is:

```sql
SELECT id, partyId, delta, earnedAt
FROM "LoyaltyLedger"
WHERE businessId = $1
  AND type = 'ACCRUED'
  AND expiresAt < now()
  AND NOT EXISTS (
    SELECT 1 FROM "LoyaltyLedger" l2
    WHERE l2.businessId = $1
      AND l2.partyId = "LoyaltyLedger".partyId
      AND l2.type = 'EXPIRED'
      AND l2."note" LIKE 'Expired from ' || "LoyaltyLedger".id || '%'
  )
ORDER BY earnedAt ASC
LIMIT 500
```

The `note LIKE 'Expired from <id>'` trick is the back-reference. Cleaner
alternative we considered: a separate `loyalty_expiry_marker` table. Rejected
because adding a table for a single boolean per ACCRUED row is overkill —
the LIKE pattern indexes well on a text column for the small "already-expired"
set we're filtering.

### 4.5 Commission rule conflict resolution (Locked Decision Q15)

Rules are matched per line item by specificity:

```
1. PRODUCT-scoped rule whose scopeId == lineItem.productId
2. CATEGORY-scoped rule whose scopeId == product.categoryId
3. ALL-scoped rule (scope='ALL', scopeId is null)
```

Within the same specificity, **newest `createdAt` wins** (Locked Q15). The
algorithm: load all active rules for the business once (`Map<staffUserId,
Rule[]>`), then per line item filter to applicable rules + take the first by
the specificity order. O(rules × lines), but rules are bounded (~10 per
business) and lines are bounded (~50 per POS sale; ~100 per invoice). No
performance concern.

**Staff filter:** if `rule.staffUserIds.length > 0`, the rule only applies
when the sale's `cashierId` (POS) or `createdBy` (invoice) is in that array.
If empty array, applies to all staff. Implemented in
`commission-accrual.service.ts.findApplicableRules()`.

### 4.6 Loyalty redemption gate when program disabled mid-tx

Scenario: owner disables the loyalty program (PUT /loyalty/program with
`enabled: false`) at the exact moment a sale is checking out with a
LOYALTY_REDEMPTION payment.

The applyRedemption fn re-reads `LoyaltyProgram.enabled` inside the tx
(after acquiring the advisory lock). If disabled, throws `PROGRAM_DISABLED`
which rolls back the whole sale and surfaces a clear error to the cashier:
"Loyalty program was disabled — please remove the loyalty payment line and
retry". Acceptable UX; this scenario is vanishingly rare.

---

## 5. Offline behavior (FE)

Per `.claude/rules/OFFLINE_RULES.md` and Locked Decisions §19. Five clauses:

### 5.1 Loyalty balance preview — cache-on, stale-tolerant

`GET /api/loyalty/balance/:partyId` is called with `cacheReads: true` from
`src/features/loyalty/api/loyalty.service.ts`. When the cashier picks a party
in the cart, the chip displays:

- **Online:** `240 pts (Rs 24)` from a fresh fetch
- **Offline + cached:** `240 pts (Rs 24) · Last synced 11:42` (stale indicator)
- **Offline + no cache:** chip hidden, no error toast (cashier can still ring
  the sale — they just can't see the balance)

### 5.2 Redemption is server-validated even when preview was offline

The optimistic UI shows the cached balance, but the real redemption is
authoritative on the server. Two safeties prevent stale-cache bugs:

1. `openCheckout()` already refuses to open the checkout sheet when offline
   (`src/features/pos/hooks/usePosCheckout.ts:53-56`). Redemption can therefore
   only happen on a live connection.
2. `previewRedemption` is called by the checkout sheet just before the sale —
   that's a server round-trip that returns the **live** balance. If it differs
   from the cached chip, the form inline-errors with `INSUFFICIENT_POINTS` or
   `REDEMPTION_EXCEEDS_CART` and resets the redemption input to 0.

### 5.3 CRM mutations — offline-queued per OFFLINE_RULES

| Mutation | `entityType` | `entityLabel` |
|----------|--------------|---------------|
| `PATCH /api/parties/:id` (tags / followUpAt) | `party` | `data.name ?? "Party"` |

All loyalty/commission CONFIG mutations (`PUT /loyalty/program`,
`POST /commission/rules`) ALSO pass `entityType: 'loyalty-program'` /
`'commission-rule'` and a sensible `entityLabel`. Even though they're done
infrequently by owners, the offline queue UI should still describe them.

### 5.4 Reads — explicit cache opt-in matrix

| Endpoint | `cacheReads` | Reasoning |
|----------|--------------|-----------|
| `GET /api/loyalty/program` | YES | Config only; no PII |
| `GET /api/loyalty/balance/:partyId` | YES | Per-party total + last entry; party names cached via party-list cache so no new leak surface |
| `GET /api/loyalty/ledger/:partyId` | **NO** | Per-row financial detail; per-rule.3 |
| `GET /api/parties?tag=…` | YES (existing cache for list) | Already in scope per Epic A |
| `GET /api/parties/follow-ups` | YES | Party names + dates; no balances |
| `GET /api/parties/tags` | YES | Counts only |
| `GET /api/commission/rules` | YES | Config only |
| `GET /api/commission/ledger?staffUserId=self` | YES | Own ledger only; permission already enforced server-side |
| `GET /api/commission/leaderboard` | **NO** | Multi-staff data; PII for other employees |

### 5.5 No client-side accrual write

Commission and loyalty accrual happen inside POS / Document `$transaction`s
on the server. The client never writes ledger rows. So there is no
offline-queue or conflict-resolution concern for accrual — it's entirely
piggy-backed on the existing POS / Document offline behavior (which today is
"POS = online-only, Documents = full offline support via api()").

---

## 6. Permissions / RBAC delta

The existing `requirePermission(permission)` middleware
(`server/src/middleware/permission.ts:20`) reads from
`BusinessUser.roleRef.permissions: String[]`. Owners (`role === 'owner'`)
bypass — owner always sees everything.

### 6.1 New permission strings

| Permission | Granted by default to | Used by routes |
|------------|------------------------|----------------|
| `loyalty.config` | owner | `PUT /api/loyalty/program` |
| `loyalty.redeem` | owner, cashier | (consumed by POS checkout — checked server-side when payment includes `LOYALTY_REDEMPTION`) |
| `parties.read` | owner, viewer, cashier | `GET /api/loyalty/balance/:partyId`, `GET /api/loyalty/ledger/:partyId`, `GET /api/parties/follow-ups`, `GET /api/parties/tags`, `GET /api/parties?tag=` (already-permission-gated; no change) |
| `commission.config` | owner | `POST/PUT/DELETE /api/commission/rules` |
| `commission.read.self` | owner, all staff | `GET /api/commission/ledger?staffUserId=<self>`, `GET /api/commission/ledger` (no staffUserId = own) |
| `commission.read.all` | owner, manager | `GET /api/commission/leaderboard`, `GET /api/commission/ledger?staffUserId=<other>` |
| `crm.followup.write` | owner, cashier (alias of `parties.write`) | `PATCH /api/parties/:id` when body sets `followUpAt` |

### 6.2 Where the strings are registered

Existing permission registry: `server/src/services/staff/role.constants.ts`
already lists permission strings as part of the "create role" wizard. Add
the 7 new strings to that constant. The DB layer does not store a permission
catalog — only the `Role.permissions: String[]` per business. So adding a
string requires NO migration. UI for owner to assign these to custom roles
already exists at `/settings/roles`.

### 6.3 Special enforcement — `commission.read.self` semantics

`GET /api/commission/ledger?staffUserId=X` is the same endpoint regardless of
whether you're reading your own or someone else's. The route handler logic:

```ts
const requestedStaff = String(req.query.staffUserId ?? req.user!.userId)
if (requestedStaff !== req.user!.userId) {
  // requesting someone else's ledger → must have commission.read.all
  await requirePermission('commission.read.all')(req, res, () => {})
  if (res.headersSent) return
}
// own ledger or has commission.read.all — proceed
```

This pattern is repeated for `GET /api/commission/ledger`. Documented in §11
as a security-agent focus area (own-vs-other gate must be airtight).

### 6.4 Staff widget visibility

`StaffDashboardSection` calls `useCanRead('commission.read.self')` (a thin
wrapper around the existing permission check exposed via React context).
Widget is hidden — not "Disabled" — when the user lacks the permission.

---

## 7. File Plan (HARD GATE — every row ≤ 250 LOC)

Total: **81 files** (49 create + 32 edit), same as SCOPE §10 with the 5
path corrections from §0. Layer order matches CLAUDE.md project rule:

- **Backend layers:** `types → constants → schema (Zod) → utils → service → route`
- **Frontend layers:** `types → constants → utils → hook → sub-components → page → css`

### 7.1 Backend — 32 files (paths real)

| # | Path | Action | Est. LOC | Layer | Build phase | Depends-on |
|---|------|--------|----------|-------|-------------|-----------|
| 1 | `server/prisma/schema.prisma` | edit | +97 | schema | PR1 | — |
| 2 | `server/prisma/migrations/20260518000000_phase5_epic_d_crm_loyalty_commission/migration.sql` | create | ~90 | schema | PR1 | #1 |
| **Loyalty #125** | | | | | | |
| 3 | `server/src/types/loyalty.types.ts` | create | ~80 | types | PR1 | — |
| 4 | `server/src/services/loyalty/loyalty.constants.ts` | create | ~40 | constants | PR1 | — |
| 5 | `server/src/services/loyalty/loyalty.errors.ts` | create | ~50 | constants | PR1 | #4 |
| 6 | `server/src/schemas/loyalty.schema.ts` | create | ~90 | schema | PR1 | #3 |
| 7 | `server/src/services/loyalty/loyalty-balance.service.ts` | create | ~110 | service | PR3 | #3,#4 |
| 8 | `server/src/services/loyalty/loyalty-accrual.service.ts` | create | ~150 | service | PR3 | #4,#5,#7 |
| 9 | `server/src/services/loyalty/loyalty-redeem.service.ts` | create | ~170 | service | PR3 | #4,#5,#7 |
| 10 | `server/src/services/loyalty/loyalty-program.service.ts` | create | ~130 | service | PR3 | #4,#5 |
| 11 | `server/src/services/loyalty/loyalty-expiry.cron.ts` | create | ~150 | service | PR3 | #4 |
| 12 | `server/src/routes/loyalty.routes.ts` | create | ~150 | route | PR3 | #6,#7,#8,#9,#10 |
| 13 | `server/src/lib/cron-scheduler.ts` | edit | +14 | bootstrap | PR3 | #11 |
| 14 | `server/src/services/pos/pos-checkout.service.ts` | edit | +35 | service | PR3 | #8,#9 |
| 15 | `server/src/services/pos/pos.validators.ts` | edit | +25 | schema | PR3 | — |
| 16 | `server/src/services/pos/pos-void.service.ts` | edit | +25 | service | PR3 | #8 |
| **CRM #127** | | | | | | |
| 17 | `server/src/types/party-crm.types.ts` | create | ~60 | types | PR2 | — |
| 18 | `server/src/services/party/followups.service.ts` | create | ~130 | service | PR2 | #17 |
| 19 | `server/src/services/party/tags.service.ts` | create | ~90 | service | PR2 | #17 |
| 20 | `server/src/services/party/last-contacted.service.ts` | create | ~80 | utils/service | PR2 | — |
| 21 | `server/src/routes/documents/share.ts` | edit | +8 | route | PR2 | #20 |
| 22 | `server/src/services/collections/bulk-reminder.service.ts` | edit | +8 | service | PR2 | #20 |
| 23 | `server/src/services/payment/reminders.ts` | edit | +12 | service | PR2 | #20 |
| 24 | `server/src/schemas/party.schemas.ts` | edit | +12 | schema | PR2 | — |
| 25 | `server/src/services/party/list-get.ts` | edit | +18 | service | PR2 | — |
| 26 | `server/src/services/party/update-delete.ts` | edit | +6 | service | PR2 | — |
| 27 | `server/src/routes/party.ts` | edit | +60 | route | PR2 | #18,#19,#25 |
| **Commission #128** | | | | | | |
| 28 | `server/src/types/commission.types.ts` | create | ~80 | types | PR1 | — |
| 29 | `server/src/services/commission/commission.constants.ts` | create | ~40 | constants | PR1 | — |
| 30 | `server/src/services/commission/commission.errors.ts` | create | ~50 | constants | PR1 | #29 |
| 31 | `server/src/schemas/commission.schema.ts` | create | ~120 | schema | PR1 | #28 |
| 32 | `server/src/services/commission/commission-rule.service.ts` | create | ~180 | service | PR5 | #28,#29,#30 |
| 33 | `server/src/services/commission/commission-accrual.service.ts` | create | ~200 | service | PR5 | #29,#30 |
| 34 | `server/src/services/commission/commission-ledger.service.ts` | create | ~140 | service | PR5 | #28 |
| 35 | `server/src/routes/commission.routes.ts` | create | ~200 | route | PR5 | #31,#32,#33,#34 |
| 36 | `server/src/services/pos/pos-checkout.service.ts` (continues edit from #14 — single edit covers both loyalty + commission) | — | (already in #14) | — | PR5 | #33 |
| 37 | `server/src/services/document/create.ts` | edit | +18 | service | PR5 | #33 |
| 38 | `server/src/services/document/update.ts` | edit | +14 | service | PR5 | #33 |
| 39 | `server/src/app.ts` | edit | +6 | bootstrap | PR3+PR5 | #12,#35 |

> **Reconciliation with SCOPE §10's 32-backend-file count:** the SCOPE merged
> #36 with #14 (single edit). This architecture splits the row visually but
> #36 is "no separate edit — the diff at #14 covers both loyalty in PR3 and
> commission in PR5 (rebased)" — true file count is still 32 distinct files.
> Two extra files vs SCOPE: dedicated `loyalty.errors.ts` and `commission.errors.ts`
> (extracted from `constants.ts` to keep error catalogues testable in
> isolation — keeps every file ≤ 80 LOC for the errors layer). Counter-balanced
> by SCOPE row #18 (`party-last-contacted.service.ts`) consolidating with the
> three hook edits (#19, #20, #21) in a single helper here.

### 7.2 Frontend — 49 files (paths real)

| # | Path | Action | Est. LOC | Layer | Build phase | Depends-on |
|---|------|--------|----------|-------|-------------|-----------|
| **Translations** | | | | | | |
| 40 | `src/lib/translations.en.ext38.ts` | create | ~140 | i18n | PR1 | — |
| 41 | `src/lib/translations.hi.ext38.ts` | create | ~140 | i18n | PR1 | — |
| 42 | `src/lib/translations.en.ext39.ts` | create | ~110 | i18n | PR1 | — |
| 43 | `src/lib/translations.hi.ext39.ts` | create | ~110 | i18n | PR1 | — |
| 44 | `src/lib/translations.en.ext40.ts` | create | ~120 | i18n | PR1 | — |
| 45 | `src/lib/translations.hi.ext40.ts` | create | ~120 | i18n | PR1 | — |
| 46 | `src/lib/translations.ts` | edit | +24 | i18n | PR1 | #40-#45 |
| **Loyalty FE #125** | | | | | | |
| 47 | `src/features/loyalty/loyalty.types.ts` | create | ~80 | types | PR4 | — |
| 48 | `src/features/loyalty/loyalty.constants.ts` | create | ~40 | constants | PR4 | — |
| 49 | `src/features/loyalty/loyalty.utils.ts` | create | ~80 | utils | PR4 | #47,#48 |
| 50 | `src/features/loyalty/api/loyalty.service.ts` | create | ~130 | service | PR4 | #47 |
| 51 | `src/features/loyalty/hooks/useLoyaltyProgram.ts` | create | ~90 | hook | PR4 | #50 |
| 52 | `src/features/loyalty/hooks/useLoyaltyBalance.ts` | create | ~80 | hook | PR4 | #50 |
| 53 | `src/features/loyalty/hooks/useLoyaltyLedger.ts` | create | ~90 | hook | PR4 | #50 |
| 54 | `src/features/loyalty/components/LoyaltyProgramForm.tsx` | create | ~210 | sub-component | PR4 | #48,#51 |
| 55 | `src/features/loyalty/components/LoyaltyBalanceChip.tsx` | create | ~90 | sub-component | PR4 | #49,#52 |
| 56 | `src/features/loyalty/components/LoyaltyRedeemSheet.tsx` | create | ~210 | sub-component | PR4 | #49,#50,#52 |
| 57 | `src/features/loyalty/components/LoyaltyLedgerList.tsx` | create | ~170 | sub-component | PR4 | #48,#53 |
| 58 | `src/features/loyalty/pages/LoyaltyProgramPage.tsx` | create | ~150 | page | PR4 | #51,#54 |
| 59 | `src/features/pos/components/payment/PaymentSheet.tsx` | edit | +35 | sub-component | PR4 | #56 |
| 60 | `src/features/pos/components/customer/CustomerSelector.tsx` | edit | +25 | sub-component | PR4 | #55 |
| 61 | `src/features/parties/components/PartyDetailTabs.tsx` | edit | +18 | sub-component | PR4 | #57 |
| 62 | `src/features/pos/api/pos.service.ts` (build `payments[]` payload incl. `LOYALTY_REDEMPTION`) | edit | +15 | service | PR4 | — |
| 63 | `src/features/pos/state/pos.store.ts` (track `loyaltyPointsRedeemed`) | edit | +20 | state | PR4 | — |
| **CRM FE #127** | | | | | | |
| 64 | `src/features/crm/crm.types.ts` | create | ~60 | types | PR2 | — |
| 65 | `src/features/crm/api/crm.service.ts` | create | ~100 | service | PR2 | #64 |
| 66 | `src/features/crm/hooks/useTagSummary.ts` | create | ~60 | hook | PR2 | #65 |
| 67 | `src/features/crm/hooks/useFollowUps.ts` | create | ~80 | hook | PR2 | #65 |
| 68 | `src/features/crm/components/TagFilterBar.tsx` | create | ~150 | sub-component | PR2 | #66 |
| 69 | `src/features/crm/components/FollowUpDatePicker.tsx` | create | ~130 | sub-component | PR2 | — |
| 70 | `src/features/crm/components/FollowUpRow.tsx` | create | ~120 | sub-component | PR2 | — |
| 71 | `src/features/crm/pages/FollowUpsPage.tsx` | create | ~160 | page | PR2 | #67,#70 |
| 72 | `src/features/parties/components/PartyListPage.tsx` | edit | +30 | page | PR2 | #68 |
| 73 | `src/features/parties/components/PartyDetailPage.tsx` | edit | +22 | page | PR2 | — |
| 74 | `src/features/parties/PartyForm.tsx` | edit | +20 | sub-component | PR2 | #69 |
| **Commission FE #128** | | | | | | |
| 75 | `src/features/commission/commission.types.ts` | create | ~80 | types | PR6 | — |
| 76 | `src/features/commission/commission.constants.ts` | create | ~40 | constants | PR6 | — |
| 77 | `src/features/commission/api/commission.service.ts` | create | ~130 | service | PR6 | #75 |
| 78 | `src/features/commission/hooks/useCommissionRules.ts` | create | ~110 | hook | PR6 | #77 |
| 79 | `src/features/commission/hooks/useCommissionLedger.ts` | create | ~110 | hook | PR6 | #77 |
| 80 | `src/features/commission/hooks/useLeaderboard.ts` | create | ~80 | hook | PR6 | #77 |
| 81 | `src/features/commission/components/CommissionRuleForm.tsx` | create | ~230 | sub-component | PR6 | #76,#78 |
| 82 | `src/features/commission/components/CommissionRuleList.tsx` | create | ~140 | sub-component | PR6 | #78 |
| 83 | `src/features/commission/components/CommissionWidget.tsx` | create | ~130 | sub-component | PR6 | #79 |
| 84 | `src/features/commission/components/LeaderboardTable.tsx` | create | ~190 | sub-component | PR6 | #80 |
| 85 | `src/features/commission/pages/CommissionSettingsPage.tsx` | create | ~160 | page | PR6 | #81,#82 |
| 86 | `src/features/commission/pages/CommissionLedgerPage.tsx` | create | ~150 | page | PR6 | #79 |
| 87 | `src/features/commission/pages/LeaderboardPage.tsx` | create | ~130 | page | PR6 | #84 |
| 88 | `src/features/dashboard/components/StaffDashboardSection.tsx` | edit | +25 | sub-component | PR6 | #83 |
| **CSS** | | | | | | |
| 89 | `src/styles/components.crm.css` | create | ~130 | css | PR2 | — |
| 90 | `src/styles/components.loyalty.css` | create | ~110 | css | PR4 | — |
| 91 | `src/styles/components.commission.css` | create | ~120 | css | PR6 | — |

**Final tally:** 81 user-facing files numbered (matches SCOPE total). Largest
row: `CommissionRuleForm.tsx` at 230 LOC (well under 250). Three "errors" files
(#5, #30) and one "utils" file (#49) were added during normalization — offset
by SCOPE rows that the worktree showed were redundant. **No SCOPE goal is
dropped; no row exceeds the 250-LOC cap.**

### 7.3 Scaffold order (what the builder writes first)

PR1 (schema + shared infra) builds types and constants stubs FIRST so
downstream PRs compile against committed interfaces. Order within PR1:

```
1. schema.prisma + migration                          (#1, #2)
2. types files (loyalty.types, party-crm.types,       (#3, #17, #28)
   commission.types)
3. constants + errors files                            (#4, #5, #29, #30)
4. Zod schemas                                         (#6, #31)
5. translation skeletons (empty objects + types)      (#40-#46)
```

Once PR1 is green, PR2-PR6 build in this dependency order:

- PR2: CRM (no cross-deps beyond PR1)
- PR3: Loyalty BE (no cross-deps beyond PR1)
- PR4: Loyalty FE (depends on PR3 for API contracts)
- PR5: Commission BE (no cross-deps beyond PR1, but rebases on PR3 because
  both edit `pos-checkout.service.ts:67-243`)
- PR6: Commission FE (depends on PR5)
- PR7: Security audit fixes (depends on PR6)

---

## 8. PR sequence (refined)

Final 7-PR plan. Each PR independently mergeable per §12 gates.

### PR1 — Schema + Migration + Shared Types (FOUNDATION)

**Files:** #1, #2, #3-#6, #17, #28-#31, #40-#46.
**No user-visible feature.** Adds 4 tables, 2 nullable columns, 10 indexes;
adds typed DTOs + Zod schemas; adds empty translation namespaces. Gate:
`npx prisma migrate dev` succeeds + `tsc -b` clean + translation parity
(ext38/39/40 EN ↔ HI 1:1 keys).
**Mergeable independently.**

### PR2 — CRM Basics #127

**Files:** #17 (consumed from PR1), #18, #19, #20, #21, #22, #23, #24, #25,
#26, #27, #64-#74, #89.
Ships first because lowest blast radius: no money-equivalent writes, no POS
hook, no migration. Wires `lastContactedAt` to existing share/reminder flows;
adds `/parties/follow-ups` page; ships TagFilterBar.
**Depends on:** PR1.
**Gate:** `tsc -b` clean + 4 UI states on every new page at 320px + screenshots
for share-log integration (proves `lastContactedAt` increments).

### PR3 — Loyalty #125 backend

**Files:** #3-#6 (consumed from PR1), #7-#16, #39 (loyalty route mount).
Includes POS checkout / void integration. The cron registration ships here.
**Depends on:** PR1.
**Gate:** integration test forcing a throw mid-checkout asserts no
LoyaltyLedger row + no PosSale row + no Document row (one-rolls-back-all
proof per §12.1). Curl 200/401/400 on each new route. Cron dry-run via
`node -e 'require("./dist/services/loyalty/loyalty-expiry.cron.js").runLoyaltyExpiryJob()'`.

### PR4 — Loyalty #125 frontend

**Files:** #47-#63, #90.
**Depends on:** PR3.
**Gate:** Visual screenshots of LoyaltyProgramPage, LoyaltyRedeemSheet,
LoyaltyBalanceChip, LoyaltyLedgerList at 320 / 375. Offline simulation
(chrome devtools throttle to Offline) shows cached balance with stale caption.

### PR5 — Commission #128 backend

**Files:** #28-#31 (consumed from PR1), #32-#39 (commission portions).
Rebases #14 (`pos-checkout.service.ts`) and adds #37, #38 (document service).
**Depends on:** PR3 (must rebase the POS-checkout edit) + PR1.
**Gate:** integration test: POS sale rings → CommissionLedger row written
in same tx + accrueForDoc on DRAFT→SAVED transition. Void POS → reverse
row written. Permission tests: 403 when `commission.read.self` user requests
another staff's ledger.

### PR6 — Commission #128 frontend

**Files:** #75-#88, #91.
**Depends on:** PR5.
**Gate:** Sortable leaderboard at 320 / 375. Widget hidden for users without
`commission.read.self`. Rule editor saves + edits + soft-deletes.

### PR7 — Security audit fixes

**Files:** TBD by security agent's audit.
**Depends on:** PR1-PR6 merged.
**Output:** `docs/SECURITY_AUDIT_EPIC_D.md` with PASS / CONDITIONAL PASS.

### Dependency graph

```
PR1 ── PR2 ──┐
   │         │
   ├─ PR3 ── PR4 ──┐
   │         │     │
   └─────── PR5 ── PR6 ── PR7
```

PR3 must merge before PR5 (both edit pos-checkout.service.ts). PR2, PR3 can
run in parallel after PR1. PR4 waits for PR3; PR6 waits for PR5.

---

## 9. Rollout + feature flags

Loyalty and Commission are **owner-opt-in per-business**. Locked Decision §19
implicit: the `LoyaltyProgram.enabled = false` default IS the loyalty flag
(no separate column needed). Commission similarly defaults to "no rules
defined" which means no accrual fires.

### 9.1 Loyalty flag = `LoyaltyProgram.enabled`

- Default: `false` on every existing business at migration time (no row exists;
  service returns `null` from `GET /loyalty/program`).
- UI gate (frontend): `LoyaltyBalanceChip`, `LoyaltyRedeemSheet`, and
  `LoyaltyLedgerList` all check `program.enabled === true` before rendering.
  When false, components return `null` (not hidden — never rendered).
- Server gate: `accrueForPosSale` and `applyRedemption` both no-op silently
  when `enabled === false`. Reduces test surface; cashier doesn't see misleading
  errors when owner hasn't opted in.

### 9.2 Commission flag = "any active rule exists"

- Default: no rules in the table for a fresh business.
- UI gate: `CommissionWidget` (staff dashboard) checks
  `useCommissionLedger({ from: monthStart, to: monthEnd }).totalCommissionPaise`.
  If zero AND no rules exist → widget hidden. If zero with rules existing →
  widget shows "Rs 0 this month" (legitimate state).
- Server gate: `commission-accrual.service.accrueForPosSale` short-circuits
  when `findApplicableRules` returns an empty array.

### 9.3 Stage-gated rollout

| Stage | Audience | What | How long |
|-------|----------|------|----------|
| 1. Internal | Sawan's own test business | Enable loyalty + commission rules; ring 10 POS sales; verify ledgers | 24h |
| 2. Beta | 5 friendly businesses (Raju + 4 others) | Owner-opted-in via Sawan-mediated demo | 1 week |
| 3. GA | All businesses | Available in `/settings/loyalty` and `/settings/commission` for any owner to enable | indefinite |

No code-level percentage gate is needed because the feature is opt-in by
default. If a critical bug is found post-GA, the rollback is "Sawan tells
business owners to disable the program" — instantaneous via the UI.

---

## 10. Telemetry — 7 events total (matches SCOPE §14)

Naming follows the existing pattern in
`server/src/services/notifications/notification-manager.ts`
(`notify('EVENT_KEY', payload)`). Events are emitted **after** the originating
transaction commits — per §3.8 side-effect rule.

| # | Event name | Trigger site | Payload |
|---|-----------|--------------|---------|
| 1 | `loyalty_program_enabled` | `loyalty-program.service.upsertProgram` post-commit, only on `enabled: false → true` transition | `{ businessId, accrualRateBps, expiryMonths }` |
| 2 | `loyalty_accrued` | `pos-checkout.service.ts` post-commit (only if ACCRUED row was written) | `{ businessId, partyId, posSaleId, pointsAccrued, equivalentPaise }` |
| 3 | `loyalty_redeemed` | same site, only if REDEEMED row was written | `{ businessId, partyId, posSaleId, pointsRedeemed, equivalentPaise }` |
| 4 | `commission_rule_created` | `commission-rule.service.createRule` post-commit | `{ businessId, ruleId, scope, mode, rateBps, flatPerUnitPaise }` |
| 5 | `commission_accrued` | `pos-checkout.service.ts` and `document/create.ts` / `update.ts` post-commit, **aggregated** to one event per sale even if 3 rules matched | `{ businessId, source: 'POS'|'INVOICE', staffUserId, totalCommissionPaise, rulesAppliedCount }` |
| 6 | `crm_tag_filtered` | client-side, fired when user taps a tag chip in `TagFilterBar` | `{ businessId, tagName, partyCountResult }` |
| 7 | `crm_followup_set` | server-side `PATCH /api/parties/:id` post-commit, only when `followUpAt` is being set or changed | `{ businessId, partyId, daysFromNow, action: 'SET'|'CLEAR' }` |

Events 1-5, 7 are server-side via the existing `notificationManager.notify`
abstraction. Event 6 is client-side via the existing analytics dispatcher.

**Sampling: none.** Volume estimate at scale: 200 businesses × 50 POS sales/day
× ~3 events (accrual, redemption sometimes, commission) = ~30,000 events/day.
Well within whatever analytics sink Sawan eventually configures (today: logged
to stdout).

---

## 11. Open risks for security agent

Five risk categories. Security agent: focus the audit here.

### 11.1 Money-equivalent integrity (loyalty + commission are paise-equivalent)

**Risk:** loyalty points and commission paise convert 1:1 to rupees from the
business's perspective. Any double-write, over-redeem, or skipped reversal is
real money lost.

**Specific things to audit:**

- **§4.1 advisory lock** — confirm `loyalty-redeem.service.ts` acquires
  `pg_advisory_xact_lock` BEFORE reading the balance, and that the read uses
  the lock-holding tx (`tx.loyaltyLedger.findMany`, not `prisma.loyaltyLedger.findMany`).
  If the read uses the un-locked client, the lock is useless.
- **§3.1 step order** — confirm `applyRedemption` runs BEFORE `accrueForPosSale`
  in `pos-checkout.service.ts`. Reversal: customer could redeem points they
  just earned on the same sale (effectively a 50% discount on every line).
- **§3.2 void reversal** — confirm BOTH the accrual AND the redemption rows
  are negated on void. Today the spec says yes; verify the implementation
  writes 2 ledger rows (the negated ACCRUED + the negated REDEEMED) not
  just one.
- **§4.4 cron double-expiry guard** — confirm the `NOT EXISTS` subquery uses
  the correct table alias (the LIKE pattern must reference the *outer* row's
  id, not the inner alias).
- **Negative-balance attack** — what happens if a malicious cashier submits a
  POS sale with `payments: [{ mode: 'LOYALTY_REDEMPTION', amountPaise: 999999 }]`
  for a party with only 100 points? The `applyRedemption` fn computes
  `eligiblePoints = min(requested, available)` and either rejects with
  `INSUFFICIENT_POINTS` or partial-redeems? **DECISION**: hard-reject with
  `INSUFFICIENT_POINTS` (no partial-redeem in MVP — keeps logic simple, gives
  cashier a clear "ask the customer to pay the rest" prompt). Verify the
  implementation matches.

### 11.2 Commission rule tampering (insider abuse)

**Risk:** a cashier with custom-role permission `commission.config` could
edit their own commission rate to 50% before ringing up a big sale.

**Specific things to audit:**

- **AuditLog** — confirm `commission-rule.service.ts` writes an AuditLog row
  for every CREATE / UPDATE / DELETE with `userId` = caller, `changes` =
  before/after snapshot, and `reason` (if provided).
- **Rate cap** — Locked Q19: soft cap 50% with warning, hard cap 100%. Verify
  the Zod schema enforces both (`rateBps ≤ 10_000` hard, `rateBps > 5_000` =
  warning flag in response, server-side enforced).
- **Owner-only by default** — confirm the system role `cashier` does NOT
  include `commission.config` in its default permission set. Owner can grant
  it to a custom role, but the audit trail will show that grant happened.

### 11.3 Cross-tenant leak

**Risk:** an attacker tries `GET /api/loyalty/balance/<partyId-from-different-business>`.

**Specific things to audit:**

- **businessId scoping** on EVERY loyalty + commission read. Pattern: every
  `findFirst` / `findMany` / `update` / `delete` must include `businessId`
  from `req.user.businessId`. Spot-check #7, #9, #34 services.
- **`Party.findFirst` precedence** — `loyalty-balance.service.ts` should
  first do `tx.party.findFirst({ where: { id: partyId, businessId }})` and
  throw 404 if missing, BEFORE doing the ledger aggregate. Otherwise a 404
  vs 200 timing oracle could leak whether a party exists in another business.
- **CommissionLedger.staffUserId** — `GET /api/commission/ledger?staffUserId=X`
  must verify X is a BusinessUser of the caller's businessId, even when the
  caller has `commission.read.all`. Otherwise an owner could query staff IDs
  from another business and get back an empty array vs 404 — same timing
  oracle.

### 11.4 Walk-in collusion (SCOPE §13 #2)

**Risk:** a cashier rings 100 fake walk-in sales, then later updates the
walk-in party to a real one and claims the points.

**Mitigations already in place** (audit):

- Locked Q7 — walk-in `partyId` is the business's sentinel walk-in; accrual
  service short-circuits: `if (party.isWalkIn) return`. Confirm the
  short-circuit happens before any LoyaltyLedger.create call. Test: ring 5
  walk-in sales; verify 0 LoyaltyLedger rows exist for the sentinel party.
- Sentinel party can't be reassigned to a real customer at the PosSale level
  (Posnsale.partyId is immutable post-create); only the walk-in display fields
  on `PosSale` (`walkInName`, `walkInPhone`) can be edited. So the only path
  to "redirect walk-in points to a real party" is to delete the walk-in row
  and re-insert with a real partyId — which is two AuditLog rows.

### 11.5 Insider grant abuse (SCOPE §13 #7)

**Risk:** an engineer with DB access manually inserts 1,000,000 LoyaltyLedger
rows for their own party.

**Mitigations:**

- All admin DB edits go through the existing `AdminAction` audit infra
  (already mandated by `~/.claude/rules/HIGH_RISK_PATHS.md` for the User
  model and impersonation paths). Quarterly review per SCOPE §13.
- No client-facing API allows manual `delta` writes — even owner can't
  "give 500 bonus points" via UI (Locked decision §3 / SCOPE §3 said
  manual adjustment is admin-script-only for MVP).

---

## 12. Acceptance test sketch (verifier turns these into tests)

For each integration site, the contract is "if my new code throws, the
existing functionality still works". Tests go in
`server/src/services/{loyalty,commission}/__tests__/` and
`server/src/services/pos/__tests__/`.

### 12.1 POS checkout one-rolls-back-all

**Test name:** `pos-checkout.integration.test.ts: rolls back PosSale + Document + Inventory when loyalty accrual throws`

**Outline:**

```
beforeEach: seed business + product + party + LoyaltyProgram(enabled=true)
test:
  mock loyalty-accrual.service.accrueForPosSale to throw
  POST /api/pos/sales with valid payload
  expect 500 (or appropriate error code)
  assert posSale.count === 0
  assert document.count === 0
  assert loyaltyLedger.count === 0
  assert stockMovement.count === 0   ← critical: stock claim must roll back
  assert product.currentStock === seed value  ← double-check
```

Same template for commission-accrual throwing.

### 12.2 Concurrent redemption — no overdraft

**Test name:** `loyalty-redeem.integration.test.ts: two parallel sales for same party do not exceed balance`

**Outline:**

```
beforeEach: party with 100 LoyaltyLedger.ACCRUED points
test:
  fire 2 parallel POST /api/pos/sales, each redeeming 80 points
  one must succeed; the other must 400 INSUFFICIENT_POINTS
  final balance must be 20 (not -60)
```

### 12.3 Walk-in does not accrue

**Test name:** `loyalty-accrual.unit.test.ts: walk-in party short-circuits`

**Outline:** call `accrueForPosSale(tx, { posSale: { partyId: walkInPartyId, ... }})`; assert `loyaltyLedger.create` was NOT called.

### 12.4 Commission rule specificity

**Test name:** `commission-accrual.integration.test.ts: PRODUCT > CATEGORY > ALL`

**Outline:** seed 3 active rules (ALL 1%, CATEGORY 2%, PRODUCT 5%) for the
same product. Ring a sale with that product. Assert exactly 1 CommissionLedger
row written with rate = 5% (the PRODUCT-scoped rule).

### 12.5 Commission void reversal

**Test name:** `commission-accrual.integration.test.ts: void writes negative row, sum nets to zero`

**Outline:** ring a sale → commission row exists with `commissionPaise = X`
→ void the sale → second row exists with `commissionPaise = -X` → SUM = 0.

### 12.6 lastContactedAt auto-update on share

**Test name:** `share-integration.test.ts: WhatsApp share bumps party.lastContactedAt`

**Outline:** create party with `lastContactedAt = null` → `POST /api/documents/:id/share/whatsapp` → assert `party.lastContactedAt` is within 5 seconds of now.

### 12.7 Follow-up future-only

**Test name:** `party-followup.unit.test.ts: PATCH /parties/:id rejects past followUpAt`

**Outline:** PATCH with `followUpAt: yesterday` → 400 `INVALID_FOLLOWUP_PAST`.

### 12.8 Permission gate for cross-staff ledger read

**Test name:** `commission-ledger.integration.test.ts: 403 on cross-staff read without commission.read.all`

**Outline:** create staff A and B (both with `commission.read.self` only). A logs in. A requests `GET /api/commission/ledger?staffUserId=<B.userId>` → 403.

### 12.9 Cron idempotency

**Test name:** `loyalty-expiry.cron.integration.test.ts: re-running the cron does not double-expire`

**Outline:** seed party with 100 ACCRUED, `expiresAt: yesterday`. Run cron → 1 EXPIRED row added, balance = 0. Run cron again → still 1 EXPIRED row, balance still 0.

### 12.10 4 UI states at 320px (FE — Playwright per page)

For each of: `LoyaltyProgramPage`, `LoyaltyRedeemSheet` (in checkout sheet),
`FollowUpsPage`, `CommissionSettingsPage`, `CommissionLedgerPage`,
`LeaderboardPage` — assert all four states (loading / error / empty /
success) render without horizontal overflow at 320px.

---

## 13. Risks & alternatives considered

| Risk | What we chose | Alternative we rejected | Why |
|------|---------------|-------------------------|-----|
| Ledger row volume explosion (1.8M rows/year per busy business) | Cursor pagination + `(businessId, periodYearMonth)` index | Materialized monthly aggregates | Premature optimization; Postgres handles ~10M rows per table comfortably on Render Starter. Revisit if any business hits 5M ledger rows. |
| FIFO redemption complexity | Iterate ACCRUED rows by `earnedAt` ASC; consume rows fully then partially | LIFO or "single bulk REDEEMED row spanning all ACCRUED" | FIFO is what the customer expects (oldest points expire first); single bulk row breaks the audit trail when individual ACCRUED rows expire later. |
| Commission split (multiple staff per sale) | Out of scope (Locked Q18 → V4) | Allow `staffUserIds: String[]` per sale | Doubles complexity now for a feature that has clear V4 ownership. Schema is forward-compatible (CommissionLedger already keyed on `staffUserId`). |
| Two-tx commission accrual (sale, then async commission worker) | Sync, in-tx | Async worker (queue accrual after sale commit) | Worker queue would need a new infra primitive (job queue) — too much for one epic. Sync write is fast (≤ 5 ms per rule × ~3 rules = 15 ms tx overhead). |
| Loyalty on SALE_INVOICE | Out of scope (Locked Q4 → FUTURE_EPIC) | Include in MVP | Adds a `accrueForDocument` symmetric path — risks doubling the test surface for one MVP. Schema is type-agnostic; adding later is one-line service-call insertion. |
| Cron run timing | 02:30 IST daily | Hourly | Loyalty expiry is not time-critical (customer doesn't experience expiry instantly). 24-hour slack is fine; reduces DB load. |
| Race between `LoyaltyProgram` disable and concurrent accrual | Re-read inside tx after lock | Don't re-read | Without the re-read, you'd accrue points for a sale checked out 100ms after the program was disabled. Negligible UX impact but breaks the "ledger is truth" invariant. |
| Phone-as-PK leak via party tags | None — tags are free-text owner-set | Hash tag values | Tags don't contain phone numbers in practice; if owner names a tag like "9876543210" that's their data choice (and the marketing campaign UI already exposes it). |
| Document update fires commission on DRAFT→SAVED — what about DRAFT→DRAFT edits to a saved doc? | DRAFT→SAVED transition only (one-shot) | Recompute on every save | Prevents "edit-game" exploit where cashier toggles a line to bump commission. |
| Cron failure leaves unexpired rows visible | Self-heals next day | Retry queue | Daily slip is invisible to the user; not worth building retry infra. |
| Audit insertion volume for `commission_rule` edits | Existing AuditLog handles it (current ~50 rows/business/day) | New CommissionRuleAudit table | AuditLog is already the SSOT for audit; splitting tables fragments forensics. |
| `meta.ruleSnapshot` JSON grows large | Snapshot just rule essentials (~6 fields, ~200 bytes) | Snapshot whole rule object | 200 bytes × 5M rows = 1 GB — fine. Full snapshot could be 1 KB → 5 GB, less acceptable. |

---

## 14. Future-known risks (forward-compat notes)

Per scope-writer blindspot framework (regulatory + cost runaway):

- **GST/RBI clarification on loyalty redemption as discount vs supply** — the
  payment-mode model isolates redemption from `totalTaxableValue`. If
  regulator says redemption MUST reduce taxable value, a single boolean on
  `LoyaltyProgram` (`reduceTaxableValueOnRedemption: Boolean`) and a
  recompute in `applyRedemption` handles it. Schema-ready; no migration.
- **Commission payout to bank** — when Phase 6 #136 Payroll ships, it will
  read `CommissionLedger` and write a `CommissionPayout` table (new). The
  ledger needs a nullable `payoutId String?` reverse field. Add then;
  trivial.
- **Multi-staff commission (V4)** — `CommissionLedger.staffUserId` becomes
  one row per staff per sale (currently exactly 1 staff per sale). Index
  already supports.

---

## 15. Security agent hand-off

**Audit scope:** all 39 backend files + the 4 new tables in `schema.prisma`.

**Specific files to lint:**

1. `server/src/services/loyalty/loyalty-redeem.service.ts` — advisory lock
   acquisition; balance recomputation inside tx; integer overflow on point
   math.
2. `server/src/services/loyalty/loyalty-accrual.service.ts` — walk-in
   short-circuit; min-spend gating; expiry timestamp calculation.
3. `server/src/services/loyalty/loyalty-expiry.cron.ts` — advisory lock; NOT
   EXISTS guard against double-expiry; cursor pagination safety.
4. `server/src/services/commission/commission-accrual.service.ts` — rule
   specificity ordering; staffUserIds gate; ruleSnapshot capture; void
   reversal symmetry.
5. `server/src/services/commission/commission-ledger.service.ts` — `commission.read.self` vs `commission.read.all` gate at the route layer.
6. `server/src/services/pos/pos-checkout.service.ts` — step ordering (redeem
   before accrue); rollback proofs.
7. `server/src/services/pos/pos-void.service.ts` — both loyalty and
   commission reversals fire; sum-nets-to-zero invariant.
8. `server/src/services/pos/pos.validators.ts` — `LOYALTY_REDEMPTION` mode
   schema + paise-math validation.
9. `server/src/routes/loyalty.routes.ts` — businessId scoping on EVERY
   endpoint; 404 vs 200 timing oracle on `/balance/:partyId`.
10. `server/src/routes/commission.routes.ts` — staffUserId own-vs-other gate;
    leaderboard businessId scoping.

**Output:** `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` with PASS or
CONDITIONAL PASS (action items). Format: copy of Epic C audit style.

---

## 16. Acceptance gates (taken into design-plan-active.md)

### Backend

- `npx prisma migrate dev --name epic_d_crm_loyalty` succeeds with zero drift
- `npx tsc -b --noEmit` clean (server)
- `node scripts/enforce.js` 0 errors (server)
- All 12.1-12.9 integration tests pass
- Curl 200/401/400 trio on 15 endpoints (5 loyalty + 4 CRM + 6 commission)
- One-rolls-back-all proof: throw mid-checkout test passes
- Cron dry-run produces expected EXPIRED rows + log lines

### Frontend

- `npx tsc -b --noEmit` clean (client)
- `node scripts/enforce.js` 0 errors (client)
- `node scripts/enforce-offline.mjs` 0 NEW violations
- Translation parity (`ext38/39/40` EN ↔ HI 1:1)
- Screenshots: 6 pages × 4 UI states × 2 viewports (320 + 375) = 48 captures
- No horizontal overflow at 320 / 375 / 768 / 1024 / 1280 / 1536
- Offline simulation on POS: balance chip shows cached value + "Last synced"
- Permission walk-throughs: staff without `commission.read.all` cannot open
  leaderboard URL (route guard returns 403, UI shows "permission denied")

---

## 17. Gate for build

This document plus the SCOPE (with §19 Locked Decisions) are the input to
the security agent. Once `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` is
produced (PASS or CONDITIONAL PASS), the task-manager runs to seed
`.claude/design-plan-active.md` and the seven build PRs begin in the order
of §8. Per `~/.claude/rules/HIGH_RISK_PATHS.md` the
`prisma/schema.prisma` edit and the POS / Document service edits are
high-risk paths — the design-plan must list `scope-writer`, `architect`, and
`security` in `agents_invoked`.

**End of architecture.**
