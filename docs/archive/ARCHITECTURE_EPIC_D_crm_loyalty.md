# Architecture — Epic D (CRM #127 + Loyalty #125 + Commission #128) — v5

> **v5 changelog (from v4 — auditor Pass 4 typo follow-up, no design change):**
> Auditor Pass 4 caught 3 token mismatches in the v4 §3.1 code block against
> the REAL `server/src/routes/pos-sales.ts:62`. Fixed in v5:
> - Leaf route path `/sales` → `/` (the `/sales` segment is consumed by the
>   parent `pos.ts:15 router.use('/sales', salesRoutes)`).
> - Import name `requireAuth` → `auth` (real export at `pos-sales.ts:10`).
> - Existing chain `requirePermission('pos.create')` + `idempotencyCheck()`
>   now explicitly preserved AFTER `posCheckoutAuth` (silently dropped in v4).
> Same three corrections propagated to file plan #14b note and §17.1 acceptance
> bullet. No other sections touched. Builder MUST match the v5 §3.1 snippet
> exactly; do not improvise the middleware order.
>
> **v4 changelog (from v3 — micro-patch, no design change):**
> Fixes auditor Pass 3 NEW_M1: phantom `pos.routes.ts` → real `pos-sales.ts`
> (verified: `server/src/routes/pos-sales.ts:60` is where `router.post('/sales',
> requireAuth, requireIdempotencyKey, asyncHandler(...))` lives today). Affected
> sites: §3.1 code block, file plan #14b. Builder slots `posCheckoutAuth`
> between `requireAuth` and `requireIdempotencyKey`. Also folds security
> Pass-2 NEW_S1 (loyalty balance/ledger 404 PARTY_NOT_FOUND) and NEW_S2
> (loyalty_redemption cross-tenant partyId 400 PARTY_NOT_IN_TENANT) into
> §17.1 as MUST acceptance bullets. No SCOPE Locked Decision (§19) altered.
>
> **v3 changelog (from v2):** Folds 5 MUST_FIX + 4 SHOULD_FIX from security audit
> (`docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md`). Closes A01 Broken Access Control
> and A04 Insecure Design failure classes. See §3.5, §3.6, §4.2, §6.1, §6.3, §6.4, §17.
> Also closes Pass 2 architecture-auditor carry-overs NEW_S1 (DetailTab type dup) and
> NEW_S2 (Stock Manager wording clarity). No SCOPE Locked Decision (§19) is altered.

# ARCHITECTURE — Phase 5 Epic D: CRM + Loyalty + Commission

**Features:** #125 Loyalty · #127 CRM Basics · #128 Staff Performance & Commission
**Status:** REVISED v5 — 2026-05-17 (post auditor Pass-4 token-mismatch fix)
**Companion:** `docs/SCOPE_EPIC_D_crm_loyalty.md` (§19 Locked Decisions)
**Cleared for build:** pending auditor Pass-5 re-run

---

## Revision history

- **v3 (2026-05-17 PM)** — Fixed 5 MUST_FIX + 4 SHOULD_FIX from security audit
  Pass 1 (`docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md`). Summary of closures:
  - **M1** (A04) §4.2 commission ledger write — explicit deep clone of
    `rule.config`/snapshot fields via `JSON.parse(JSON.stringify(...))` INSIDE
    the same Prisma tx, BEFORE the `commissionLedger.create` call. Callout
    box added. §17.3 grep-test added.
  - **M2** (A01) §3.6 NEW server-only Party fields subsection —
    `lastContactedAt`, `followUpAt`, `loyaltyPointsCache`, `loyaltyOptOut`
    explicitly listed; EVERY input Zod schema in `parties.routes.ts` MUST
    `.omit(...)` or build from an allow-list excluding them. §17.2 added
    PATCH-rejection test.
  - **M3** (A04) §3.5 follow-up query — `withinDays` capped at 365 via
    Zod `.max(365)`. Covering composite index
    `@@index([businessId, lastContactedAt, isActive])` added to §2.5. §17.2
    boundary-test added.
  - **M4** (A01) §6.3 — cross-tenant `staffUserId` precheck specified that
    returns **404 STAFF_NOT_FOUND** (NOT 200-empty, NOT 403) to defeat the
    UUID-enumeration timing oracle. §17.3 oracle test added.
  - **M5** (A04) §6.3 — replaced fragile inline `res.headersSent` chain
    with `commissionLedgerAuth` factory middleware (single-pass, two
    terminal branches). New file `server/src/middleware/commission-ledger-auth.ts`
    added to file plan (#27c, ~50 LOC). §17.3 grep-test added.
  - **S1** (A03) §2.1 + §3.1.1 + §6.1 loyalty math — every points×paise
    multiply uses `BigInt` cross-multiplication; documented `Number.MAX_SAFE_INTEGER`
    overflow class avoided.
  - **S2** (A04) §6.1 — `commissionRuleSchema.strict()` `rateBps` capped at
    `10000` (100%) at the Zod boundary; FE warning at 5000 (50%); service
    layer never accepts a value that bypassed the Zod gate.
  - **S3** (A01) §6.1 + §3.1.1 — POS checkout handler MUST call
    `requirePermission('loyalty.redeem')` BEFORE opening the tx whenever
    `payments[].mode === 'loyalty_redemption'` is present. Reject with
    `PERMISSION_DENIED` if missing. §17.1 added.
  - **S4** (operational) §8 + §17 — PR3 (loyalty BE) and PR5 (commission BE)
    both write to `pos-checkout.service.ts` AND `pos-void.service.ts`; PR5
    MUST rebase onto PR3 before merge to avoid losing the
    `restorePosSale` loyalty refund logic. PR-sequence call-out added.
  - **NEW_S1** (Pass 2 carry-over) §0.2 + §7.2 row #61b — `DetailTab` type
    is duplicated in `PartyDetailPage.tsx` and `usePartyDetail.ts`; builder
    note added to update BOTH lines in PR4. (Either extract to
    `party.types.ts` or update both; documented.)
  - **NEW_S2** (Pass 2 carry-over) §6.4 — wording about `parties.view`
    clarified: "all 5 staff roles already have `parties.view`" (the v2
    "except Stock Manager (which has it)" parenthetical was
    self-contradicting copy-paste leftover; the role IS literally named
    `Stock Manager` in `permissions-data.ts:256` — only the wording was
    confusing, not the seed data).
- **v2 (2026-05-17 PM)** — Fixed 6 MUST_SHIP + 5 SHOULD_SHIP gaps surfaced
  by architecture-auditor (`docs/ARCHITECTURE_AUDIT_EPIC_D_crm_loyalty.md`).
  Summary of closures:
  - **M1** cron slot 02:30 IST → 04:15 IST (02:30 occupied by `runExpenseRecurringGenerator`)
  - **M2** `LOYALTY_REDEMPTION` → `loyalty_redemption` (lowercase parity with cash/upi/card)
  - **M3** Five phantom FE paths re-derived from real worktree; loyalty opt-out lives in `PartyFormBasic.tsx`; new `PartyDetailLoyaltyTab.tsx`; `StaffDashboardSection.tsx` re-tagged CREATE
  - **M4** Permission registry pinned to `server/src/services/settings/permissions-data.ts` (real file; 290 lines, 8 system roles)
  - **M5** 7 analytics events rerouted to a new `server/src/lib/analytics.ts` thin wrapper around `logger.info(...)`; NOT `notificationManager`
  - **M6** New §3.4.1 covering `restorePosSale` with symmetric VR (void-reversal) entries on both ledgers
  - **S1** Permission keys renamed to `<resource>.<action>` house style (`commission.view`, `commission.view_all`, `loyalty.configure`, `crm_followup.create`)
  - **S2** Loyalty unit math spelled out: `pointsEarned = floor(subtotalPaise * earnBps / 1_000_000)` + unit-test row added
  - **S3** `loyalty_redemption` cash-register reconciliation documented
  - **S4** Advisory-lock source citation corrected to `subscription.writer.ts:25-31`
  - **S5** New §6.4 with full 5 × 7 (staff-role × new-permission) default table
- **v1 (2026-05-17 AM)** — Initial architecture draft.

---

## 0. SCOPE conformance & intentional deviations

The SCOPE was drafted before the architect walked the actual worktree. Several
file paths in SCOPE §10 do not exist in the worktree; they are renamed below to
the real files. **No business logic changes — only path corrections.** Every
SCOPE Locked Decision (§19) and every Goal in §2 lands intact in this document.

### 0.1 Path corrections vs SCOPE §10

| SCOPE row | SCOPE path (assumed) | Real path (worktree) | Why the rename |
|-----------|----------------------|----------------------|----------------|
| #16 | `services/parties/party-followups.service.ts` | `server/src/services/party/followups.service.ts` | Repo uses singular `party/` directory (see `services/party.service.ts` barrel re-export) |
| #17 | `services/parties/party-tags.service.ts` | `server/src/services/party/tags.service.ts` | Same |
| #18 | `services/parties/party-last-contacted.service.ts` | `server/src/services/party/last-contacted.service.ts` | Same |
| #19 | `services/document/share-log.service.ts` | `server/src/routes/documents/share.ts` (edit existing) | Share log is written from the route handler, not a service — Epic C never extracted it |
| #20 | `services/marketing/reminder-log.service.ts` | `server/src/services/collections/bulk-reminder.service.ts` (edit existing) | ReminderLog is written from the collections bulk-reminder service, not marketing |
| #21 | `services/payment/payment-reminder.service.ts` | `server/src/services/payment/reminders.ts` (edit existing) | Real filename is `reminders.ts`, not `payment-reminder.service.ts` |

### 0.2 Path corrections vs SCOPE §10 frontend (v2 — M3 fix; v3 NEW_S1 note)

| SCOPE row | SCOPE path (assumed) | Real path (worktree) | Why the rename |
|-----------|----------------------|----------------------|----------------|
| #51/#62 | `src/features/parties/components/PartyListPage.tsx` | `src/features/parties/PartiesPage.tsx` (edit) | Real list page lives at feature root; no `components/PartyListPage.tsx` exists |
| #53/#63 | `src/features/parties/components/PartyDetailPage.tsx` | `src/features/parties/PartyDetailPage.tsx` (edit) | Real detail page lives at feature root, NOT under `components/` |
| #53 (new) | `src/features/parties/components/PartyDetailTabs.tsx` (edit) | `src/features/parties/components/PartyDetailLoyaltyTab.tsx` (CREATE — new tab) + `PartyDetailPage.tsx` TABS array edit | No master `PartyDetailTabs.tsx` exists; tab list is inline in `PartyDetailPage.tsx`. **v3 NEW_S1**: the `DetailTab` union type is declared in TWO files — `PartyDetailPage.tsx:32` AND `usePartyDetail.ts:10`. PR4 builder MUST update BOTH lines when adding `'loyalty'` to the union (or, preferred path, extract `DetailTab` to `src/features/parties/party.types.ts` and import in both files; that's a small refactor that pays for itself the next time tabs change). Adding to one but not the other yields a TS narrowing error at `setActiveTab` — 30-second pre-emptive note avoids the round-trip. |
| #64 | `src/features/parties/PartyForm.tsx` (edit) | `src/features/parties/components/PartyFormBasic.tsx` (edit) | No master `PartyForm.tsx`; the form is 4 sub-components. Loyalty opt-out toggle lives in `PartyFormBasic.tsx`. |
| #78 | `src/features/dashboard/components/StaffDashboardSection.tsx` (edit) | same path — **CREATE not EDIT** | File does not exist; widget is a new section mounted from `DashboardPage.tsx`. |

These corrections add **two** new files vs SCOPE's assumptions and remove **zero** required hooks.

### 0.3 Race-window note on `services/payment/reminders.ts`

`services/payment/reminders.ts:31` creates the `PaymentReminder` row **outside**
any `$transaction` (the side-effect WhatsApp delivery is non-DB I/O). For CRM
hook #21, the `touchLastContacted` call is therefore a sibling
`prisma.party.update` (post-commit), not an in-transaction call. The race
window is "user creates reminder, app crashes before `lastContactedAt` update"
— acceptable; the worst case is one missed contact timestamp, which the next
reminder will heal.

---

## 1. Overview & component diagram

Epic D layers three retention/team features onto existing entities without
introducing any new transports, new external providers, or new top-level
domains. Every mutation hangs off an existing `$transaction` (POS checkout,
document save, share-log write, reminder dispatch). The single new background
process is a daily loyalty-expiry cron whose advisory-lock pattern mirrors
`server/src/services/subscription/subscription.writer.ts:25-31`
(`acquireAdvisoryLock`) **exactly** (cron-grace-expiry was the original
inspiration but is itself unguarded — the subscription writer is the
correct citation; revised v2 / S4).

### 1.1 Boundary diagram

```
                    ┌────────────────────────────────────────────────────────┐
                    │                  Existing surfaces                     │
                    │                                                        │
  POST /pos/sales   │  pos-checkout.service.ts  $transaction {              │
  ─────────────────►│    1..12  existing steps                              │
                    │    12.5   loyalty-redeem.service.applyRedemption  ◄──┼─── NEW (in-tx, FIFO)
                    │    12.6   loyalty-accrual.service.accrueForPosSale ◄──┼─── NEW (in-tx)
                    │    12.7   commission-accrual.service.accrueForPos ◄──┼─── NEW (in-tx)
                    │    13     PosSaleEvent CREATED                        │
                    │  }                                                    │
                    │                                                        │
                    │  PRE-tx gate (v3 — S3):                               │
                    │  if payments[].mode includes 'loyalty_redemption' →    │
                    │    requirePermission('loyalty.redeem') BEFORE tx       │
                    │                                                        │
  POST /pos/:id/   │  pos-void.service.ts      $transaction {              │
  void              │    existing reverseStock / voidCashEntry              │
  ─────────────────►│    NEW   commission-accrual.service.reverseForPos ◄──┼─── NEW (in-tx, ‑ve row)
                    │    NEW   loyalty-accrual.service.reverseForPosSale ◄─┼─── NEW (in-tx, ‑ve row)
                    │    PosSaleEvent VOIDED                                │
                    │  }                                                    │
                    │                                                        │
  POST /pos/:id/   │  pos-void.service.ts      $transaction {  (v2 §3.4.1) │
  restore           │    existing reapplyStock / restoreCashEntry           │
  ─────────────────►│    NEW   commission-accrual.service.restoreForPos  ◄──┼─── NEW (in-tx, VR type)
                    │    NEW   loyalty-accrual.service.restoreForPosSale ◄─┼─── NEW (in-tx, VR type)
                    │    PosSaleEvent RESTORED                              │
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
  Cron 04:15 IST   │  loyalty-expiry.cron.ts   per-business loop {         │
  (v2 — was 02:30) │    pg_advisory_xact_lock(loyalty:{businessId})        │
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
  GET  /parties/   │  party/followups.service.ts  withinDays capped (M3)    │
  follow-ups        │                                                        │
  GET  /parties/   │  party/tags.service.ts        UNNEST aggregate         │
  tags              │                                                        │
  GET  /parties?   │  party/list-get.ts (edit)     already-supported tag    │
  tag=…             │  via hasSome; add followUpBefore                      │
                    │                                                        │
  /commission/*    │  commission-rule.service.ts   CRUD + applicability     │
                   │  commission-ledger.service.ts cursor list + leaderbd   │
                   │  + commission-ledger-auth.ts middleware (v3 — M5)      │
                   │                                                        │
                    └────────────────────────────────────────────────────────┘
```

The **only** code paths that share a transaction with money-equivalent rows
(loyalty + commission) are `pos-checkout.service.ts`, `pos-void.service.ts`
(including the restore path covered in §3.4.1), `document/create.ts`, and
`document/update.ts`. Everything else is read-only or non-money-equivalent.

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
  accrualRateBps         Int      @default(100)        // basis points; see math note below
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

**Earn-rate math (v2 — S2; v3 — S1 BigInt insurance hardened):**

```
pointsEarned = floor(subtotalPaise * earnBps / 1_000_000)
```

The formula reads as: "every 100 paise (Rs 1) at 100 bps (1%) earns 1 point".
Worked examples:
- `accrualRateBps = 100` (1% earn), Rs 100 sale → 100 × 100 paise = 10 000 paise
  → `floor(10000 * 100 / 1_000_000) = floor(1.0) = 1` point.
- Same rate, Rs 999 sale (99 900 paise) → `floor(99900 * 100 / 1_000_000) = floor(9.99) = 9` points.
- Same rate, Rs 0 / Rs 50 (5 000 paise) → `floor(5000 * 100 / 1_000_000) = floor(0.5) = 0` points.
- `accrualRateBps = 200` (2% earn), Rs 100 sale → `floor(10000 * 200 / 1_000_000) = floor(2.0) = 2` points.

**v3 / S1 — BigInt insurance on the multiply (overflow-class kill).**
`Number.MAX_SAFE_INTEGER = 2^53 − 1 = 9_007_199_254_740_991`. For an
unrealistic-but-non-impossible whale tenant: `subtotalPaise = 10^12`
(Rs 10 Cr single sale) × `earnBps = 10_000` (100%) = `10^16` — exceeds
`MAX_SAFE_INTEGER`. The pure helper MUST do the multiply in BigInt and
floor-convert back at the boundary:

```ts
// server/src/services/loyalty/loyalty.utils.ts
export function computePointsEarned(subtotalPaise: number, earnBps: number): number {
  // Reject anything non-integer at the boundary
  if (!Number.isInteger(subtotalPaise) || subtotalPaise < 0) return 0
  if (!Number.isInteger(earnBps) || earnBps < 0) return 0
  const product = BigInt(subtotalPaise) * BigInt(earnBps)
  // 1_000_000n = (10_000 bps→fraction) × (100 paise→rupee)
  const points = product / 1_000_000n  // BigInt division IS floor for non-negative inputs
  // Down-cast guard: points < 2^53 holds for any sane points balance
  return Number(points)
}
```

Unit test contract (test #12.11): `computePointsEarned(10000, 100) === 1`;
`computePointsEarned(99900, 100) === 9`; `computePointsEarned(0, 100) === 0`;
`computePointsEarned(10000, 200) === 2`; `computePointsEarned(50000, 50) === 2`.
PLUS overflow-class assertion:
`computePointsEarned(1_000_000_000_000, 10_000) === 10_000_000_000` (10 billion
points, fits in `Number` cleanly — the BigInt insurance is purely about the
intermediate multiply not overflowing the JS number representation mid-way).

### 2.2 New: `LoyaltyLedger`

```prisma
model LoyaltyLedger {
  id            String   @id @default(cuid())
  businessId    String
  partyId       String
  type          String   @db.VarChar(20)              // AC | RD | EX | AD | VD | VR (see constants)
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

**`LoyaltyEntryType` constant set** (lives in `loyalty.constants.ts`):

| Code | Meaning | Sign | When written |
|------|---------|------|--------------|
| `AC` | Accrued — points earned | + | On every POS sale (non-walk-in, after min-spend gate) |
| `RD` | Redeemed — points spent | − | On every POS sale where a `loyalty_redemption` payment was submitted |
| `EX` | Expired — points aged out | − | Nightly cron 04:15 IST (v2) |
| `AD` | Adjusted — owner correction | ± | Admin-script only in MVP |
| `VD` | Void — sale was voided | − | On `voidPosSale`, negates both AC and RD rows for the sale |
| `VR` | Void-restore — sale was un-voided | + | On `restorePosSale` (v2 §3.4.1), counter-negates the VD entries written on void |

The four-row "AC → VD → VR" sequence on a voided-then-restored sale produces
`SUM(delta) = +AC` (net effect: points are back) — symmetric and auditable.

### 2.3 New: `CommissionRule`

```prisma
model CommissionRule {
  id               String   @id @default(cuid())
  businessId       String
  name             String   @db.VarChar(80)
  scope            String   @db.VarChar(20)         // ALL | PRODUCT | CATEGORY
  scopeId          String?                           // productId or categoryId; null when scope=ALL
  mode             String   @db.VarChar(30)         // PERCENT_GROSS | PERCENT_NET | FLAT_PER_UNIT
  rateBps          Int?                              // basis points for PERCENT modes; capped at 10000 (100%) by Zod (v3 — S2)
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
  commissionPaise Int                               // earned (signed; void / restore produce negative or compensating rows)
  periodYearMonth String   @db.VarChar(7)           // "2026-05" — denormalized for leaderboard speed
  createdAt       DateTime @default(now())
  meta            Json?                              // { ruleSnapshot (DEEP CLONED — v3 M1), source: 'POS'|'INVOICE'|'VOID'|'RESTORE' }

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

### 2.5 `Party` additions (v3 — M3 composite index added)

```prisma
// In existing Party model — add ONLY these two nullable columns + 3 indexes.
lastContactedAt DateTime?    // touched on share + reminder events (SERVER-ONLY — see §3.6)
followUpAt      DateTime?    // owner-set future date; powers /parties/follow-ups

@@index([businessId, followUpAt])                       // follow-up queue
@@index([businessId, lastContactedAt])                  // dormant-party scans (Phase 6)
@@index([businessId, lastContactedAt, isActive], map: "idx_party_business_lastcontact_active")
                                                        // v3 — M3: covering index for /api/parties/follow-ups
                                                        // queries (filter by businessId, range on
                                                        // lastContactedAt, exclude inactive)
```

Both new columns are nullable (no backfill needed). SCOPE §1 confirmed neither
exists today; the worktree schema check at `server/prisma/schema.prisma:349-424`
confirms — only `lastTransactionAt` (different concept) exists.

**v3 — M3 covering-index justification.** The follow-up query (`§3.5`) is:

```sql
SELECT id, name, lastContactedAt, followUpAt
FROM "Party"
WHERE "businessId" = $1
  AND "lastContactedAt" >= $2     -- now() - withinDays
  AND "isActive" = true
ORDER BY "lastContactedAt" ASC
LIMIT 200
```

Without a composite index, the planner does a heap scan for any `withinDays >
30` — even with `withinDays` capped at 365 (v3 — M3), a tenant with 50k parties
can produce 5-second p95 latency on Render Starter. The 3-column composite
`(businessId, lastContactedAt, isActive)` lets the planner do an index-only
scan: businessId is the leading high-selectivity column, lastContactedAt is the
range filter, isActive is the equality filter. Expected p95 < 30ms even for
365-day windows on the largest tenant.

> **Note on opt-out (v3 — M2 ref):** the per-party "loyalty opted out" flag is
> NOT a new column in v3 schema (still deferred). The UI toggle in
> `PartyFormBasic.tsx` (FE plan §7.2 row #74) is wired to a **no-op mutation
> today** and ready for a future single-column addition. When that column is
> added later, it MUST appear in §3.6's server-only fields list.

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
9. `CREATE INDEX "idx_party_business_lastcontact_active" ON "Party"("businessId","lastContactedAt","isActive") ;` (v3 — M3)

Zero destructive DDL. Zero backfill. Zero `make-NOT-NULL` step. Conforms to
`.claude/rules/PRISMA_MIGRATION_RULES.md` — no `db push`, no raw GIN.

**Render Starter sizing check:** 9 DDL statements + 12 index builds on
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
(2) The validator (`pos.validators.ts`) treats `loyalty_redemption` as a
payment mode in `payments[]` (see §3.1.1); the redemption call consumes that
input synchronously so the cash entry sees the post-redemption payment list.

**Rollback semantics:** Anything thrown by `applyRedemption`, `accrueForPosSale`
(loyalty), or `accrueForPosSale` (commission) rolls back the **entire** sale —
PosSale row, PosSaleItem rows, Document row, stock claims, cash entry,
PosSaleEvent. This is the same `$transaction` guarantee already used for
inventory + cash entry. **No partial state is possible** — proved by the
existing throw-mid-checkout integration test pattern (see §12.1).

**v3 / S3 — Pre-tx permission gate for redemption.**

The POS checkout handler MUST call `requirePermission('loyalty.redeem')`
BEFORE entering the transaction whenever `payments[]` includes a
`loyalty_redemption` mode line. Reject with `PERMISSION_DENIED` (403) at
the route layer — do not open the tx, do not consume idempotency tokens.
Reasoning: without an explicit middleware gate, the only protection is
"cashier role includes loyalty.redeem in seed data" — which falls apart
the moment owner creates a custom role that has `pos.create` but lacks
`loyalty.redeem` (a common configuration where junior cashier can ring
but not discount). The check belongs at the route layer where every other
permission gate lives, not buried in service code.

Concrete route-layer shape (verified against real file
`server/src/routes/pos-sales.ts:62`, which is mounted via
`server/src/routes/pos.ts:15 router.use('/sales', salesRoutes)` under
`/api/pos`, so the leaf path is `'/'` not `'/sales'`):

```ts
// server/src/routes/pos-sales.ts:62 (POST /api/pos/sales)
// Slot posCheckoutAuth between `auth` and `requireIdempotencyKey` so the
// permission gate fires BEFORE the idempotency token row is read/written.
// Preserve every existing middleware in the chain — DO NOT remove
// requirePermission('pos.create') or idempotencyCheck().
router.post(
  '/',
  auth,                            // existing
  posCheckoutAuth,                 // NEW v3 / S3 — only fires when payments include loyalty_redemption
  requireIdempotencyKey,           // existing
  requirePermission('pos.create'), // existing (broader gate)
  idempotencyCheck(),              // existing
  asyncHandler(async (req, res) => { /* existing handler body */ })
)

// New helper middleware (lives next to the route, ~25 LOC)
function posCheckoutAuth(req: Request, res: Response, next: NextFunction) {
  const payments: Array<{ mode: string }> = req.body?.payments ?? []
  const hasLoyaltyRedemption = payments.some(p => p?.mode === 'loyalty_redemption')
  if (!hasLoyaltyRedemption) return next()
  // Defer to existing permission middleware
  return requirePermission('loyalty.redeem')(req, res, next)
}
```

Builder note: `posCheckoutAuth` is a small factory analogous to v3's
`commissionLedgerAuth` (§6.3) and uses the same single-pass-with-two-terminals
pattern. No `res.headersSent` chain.

#### 3.1.1 `pos.validators.ts` change — add `loyalty_redemption` mode (v2 — M2; v3 — S1 BigInt cross-multiply)

```ts
// pos.validators.ts (line 10) — extend existing lowercase enum
export const paymentModeSchema = z.enum([
  'cash', 'upi', 'card', 'bank_transfer', 'other',
  'loyalty_redemption',                                // NEW (lowercase parity)
])
```

The lowercase form matches every existing peer (`'cash'`, `'upi'`,
`'card'`, `'bank_transfer'`, `'other'`). DB column, route bodies, audit
logs, FE switch statements, CSV exports, and the day-end report
(`server/src/services/report/report-daybook.ts`) all assume lowercase.

And in `posPaymentSchema`, a `superRefine` rule (v3 / S1 — BigInt
cross-multiplication for paise math):

```ts
posPaymentSchema.superRefine((p, ctx) => {
  if (p.mode !== 'loyalty_redemption') return
  if (!p.partyId) {
    return ctx.addIssue({ code: 'custom', path: ['partyId'],
      message: 'PARTY_REQUIRED_FOR_REDEMPTION' })
  }
  if (typeof p.loyaltyPoints !== 'number' || p.loyaltyPoints <= 0) {
    return ctx.addIssue({ code: 'custom', path: ['loyaltyPoints'],
      message: 'INVALID_LOYALTY_POINTS' })
  }
  // v3 / S1: integer cross-multiplication check — no float math anywhere
  // Want:  p.amountPaise === p.loyaltyPoints * (redemptionPaisePerUnit / redemptionUnit)
  // Rearranged to integer-safe form:
  //         p.amountPaise * redemptionUnit === p.loyaltyPoints * redemptionPaisePerUnit
  // BigInt insurance because amountPaise can be up to 10^12 (Rs 10 Cr) and
  // loyaltyPoints can be up to 10^10 — both intermediates can exceed 2^53.
  const lhs = BigInt(p.amountPaise) * BigInt(program.redemptionUnit)
  const rhs = BigInt(p.loyaltyPoints) * BigInt(program.redemptionPaisePerUnit)
  if (lhs !== rhs) {
    return ctx.addIssue({ code: 'custom', path: ['amountPaise'],
      message: 'LOYALTY_REDEMPTION_MATH_MISMATCH' })
  }
})
```

Plus the existing "exactly one loyalty_redemption per sale" rule
(no split redemption in MVP). The redemption row's `amountPaise` participates
in the existing `paymentSumMismatchError` check (`pos-checkout.service.ts:149-150`).

#### 3.1.2 Cash-register accounting — loyalty_redemption stays out of cash bucket (v2 — S3 fix)

`pos-checkout.cash.ts:51` reads `payments.filter(p => p.mode === 'cash')`
which **naturally excludes** `loyalty_redemption` rows. The day-end /
daybook report (`report-daybook.ts`) gets a +15L edit to surface
`loyalty_redemption` as its own tender row (file plan row #16b).

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
  NEW: commission-accrual.service.reverseForPosSale(tx, posSaleId)  ← writes ‑ve VD row(s)
  NEW: loyalty-accrual.service.reverseForPosSale(tx, posSaleId)     ← writes VD rows: negates AC and restores RD
  document.update → VOIDED
  ...
```

Locked Decision Q16: reversal is a NEGATIVE row, not an UPDATE — preserves
forensic history. The commission reversal reads the original CommissionLedger
rows by `posSaleId`, **deep-clones the ruleSnapshot from each original row's
`meta.ruleSnapshot`** (v3 / M1 invariant — never reach back to the live
`CommissionRule` row), inserts negated counterparts with the same snapshot
and a `meta.source = 'VOID'`. See §4.2 for the deep-clone callout box.

### 3.3 Document create / update (SALE_INVOICE) — `document/create.ts` + `update.ts`

`document/create.ts:102-232` is already a `$transaction`. Insert one new step
**after `doc.id` exists and AFTER the existing `if (isSaving)` stock block**
(at line ~228):

```ts
if (isSaving && data.type === 'SALE_INVOICE') {
  await commissionAccrual.accrueForDocument(tx, {
    businessId,
    userId,                          // sale-creator (per Locked Decision Q12)
    documentId: doc.id,
    lineItems: data.lineItems,
    taxedTotals: totals,
    productMap,
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

**No commission row on edit-while-already-SAVED.** Commission is earned once
on the SAVE transition.

### 3.4 Share-log write — `routes/documents/share.ts` (extend existing tx)

`routes/documents/share.ts:44-65` (`whatsapp`) and `:133-154` (`email`) both
wrap `documentShareLog.create` in a `$transaction`. Add inside both:

```ts
await touchLastContacted(tx, businessId, docData.party.id)
```

`touchLastContacted` lives at `server/src/services/party/last-contacted.service.ts`.

### 3.4.1 POS restore — `pos-void.service.ts:restorePosSale` (v2 — M6 fix)

`server/src/services/pos/pos-void.service.ts:160-196` exposes
`restorePosSale` alongside `voidPosSale`. The current implementation
re-applies stock, restores the cash entry, flips `Document.status` back
to `SAVED` and `PosSale.status` to `ACTIVE` — but does NOT touch the
loyalty or commission ledgers without v2's M6 fix.

**Decision (v2):** symmetric `VR` (void-reversal) entries on both ledgers,
written inside the existing `$transaction` block at
`pos-void.service.ts:165-196` (`isolationLevel: 'Serializable'`).

Extended shape — two new in-tx steps inserted **between cash-entry restore
and document update**:

```
$transaction(async tx => {
  sale lookup + restore-window check (existing, 4h cap)
  reapplyStock(tx, ...)
  restoreCashEntry(tx, ...)
  NEW: commission-accrual.service.restoreForPosSale(tx, posSaleId)  ← writes positive compensating row(s)
  NEW: loyalty-accrual.service.restoreForPosSale(tx, posSaleId)     ← writes VR rows: counter-negates the VD entries
  document.update → SAVED
  posSale.update → ACTIVE
  PosSaleEvent RESTORED
}, { isolationLevel: 'Serializable' })
```

**Commission restore semantics** (v3 — M1 deep-clone applies here too):

1. Acquire per-business `pg_advisory_xact_lock`.
2. Fetch the negation rows (`meta.source = 'VOID'`) for the `posSaleId`.
3. For each negation row, deep-clone the `meta.ruleSnapshot` from the
   negation row (NEVER reach back to the live `CommissionRule.config`,
   which may have been edited between void and restore — that's the M1
   attack vector applied to restore), insert a paired compensating row
   with `commissionPaise = -negationRow.commissionPaise` (positive again)
   and `meta.source = 'RESTORE'`, preserving the deep-cloned snapshot:
   ```ts
   const ruleSnapshot = JSON.parse(JSON.stringify(negationRow.meta.ruleSnapshot))
   await tx.commissionLedger.create({
     data: { ..., commissionPaise: -negationRow.commissionPaise,
             meta: { ruleSnapshot, source: 'RESTORE' } }
   })
   ```

**Permission gate:** `restorePosSale` already gates on `pos.void`. No
new permission required.

**Telemetry:** `loyalty_restored` and `commission_restored` analytics events.

### 3.5 Bulk reminders + follow-up query (v3 — M3 withinDays cap)

`services/collections/bulk-reminder.service.ts:166-201` already wraps
`reminderLog.createMany` and `auditLog.createMany` in a `$transaction`. Add
one in-tx call **after** both `createMany` blocks:

```ts
await touchLastContactedMany(tx, businessId,
  batch.included.map(r => r.partyId))
```

**v3 / M3 — `withinDays` parameter on `GET /api/parties/follow-ups` MUST
be capped at 365.** Unbounded ranges are a DoS vector: a tenant with 50k
parties hitting `?withinDays=99999` triggers a heap scan on `Party` with
no index help, locking up Render Starter's single Postgres for seconds.
Cap, plus a covering composite index (added to §2.5), kills both the
DoS surface and the slow-path.

Zod schema for the follow-up route (`server/src/schemas/party.schemas.ts`,
new entry — file plan row #24):

```ts
// server/src/schemas/party.schemas.ts (new export, ~12L addition)
export const followUpsQuerySchema = z.object({
  withinDays: z.coerce.number()
    .int()
    .min(1)
    .max(365, 'WITHIN_DAYS_EXCEEDS_MAX')   // v3 / M3
    .default(30),
  cursor: z.string().optional(),
}).strict()
```

Route handler in `server/src/routes/party.ts`:

```ts
router.get('/api/parties/follow-ups', requireAuth,
  requirePermission('parties.view'),
  async (req, res) => {
    const parsed = followUpsQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_WITHIN_DAYS_RANGE', issues: parsed.error.issues }
      })
    }
    // ... call service ...
  }
)
```

Service-layer fail-safe (defence in depth — `party/followups.service.ts`):
even though Zod has already enforced the cap, the service-layer should
also clamp at 365 so any future caller (cron, admin script, internal
service-to-service call) cannot bypass:

```ts
export async function getFollowUpsDue(businessId: string, withinDays: number) {
  const clampedDays = Math.min(Math.max(1, withinDays | 0), 365)  // belt + braces
  const cutoff = new Date(Date.now() + clampedDays * 24 * 60 * 60 * 1000)
  // ... query with index `idx_party_business_lastcontact_active` ...
}
```

§17.2 acceptance test: PATCH `/api/parties/follow-ups?withinDays=400` returns
400 `INVALID_WITHIN_DAYS_RANGE`. PATCH `?withinDays=365` returns 200.
PATCH `?withinDays=1` returns 200. PATCH `?withinDays=0` returns 400.

### 3.6 Server-only Party fields (v3 — M2 NEW SECTION)

This subsection is the v3 contract for input-schema discipline on the
`Party` model. It exists because v3 / M2 (OWASP A01 Broken Access Control)
identified that fields like `lastContactedAt` and `loyaltyOptOut` — which
are intended to be set server-side from event hooks (share, reminder,
cron) — become mass-assignment vectors if the input Zod schemas accept
them in `PATCH /api/parties/:id` and similar mutation endpoints.

**The contract.** The following Party fields are **SERVER-ONLY**. They MUST
be omitted from every input Zod schema in `server/src/routes/parties.routes.ts`
(and its delegate `server/src/schemas/party.schemas.ts`). The schemas
affected: `createPartySchema`, `partyUpdateSchema`, `partyPatchSchema`,
and any future input schema added to the `parties` resource.

| Field | Why server-only | Set by |
|-------|----------------|--------|
| `lastContactedAt` | Forging hides ghosting customers from CRM (e.g. setting `'2030-01-01'` would defeat the "not contacted in 30d" follow-up trigger forever) | `touchLastContacted(tx, businessId, partyId)` from share-log + bulk-reminder + payment-reminder hooks (§3.4, §3.5, §3.6) |
| `followUpAt` | While this IS a user-mutable field (the owner sets it via the form), the routes for setting it pass through the explicit `followUpAt` validator in `partyPatchSchema` which enforces "future date only" (`INVALID_FOLLOWUP_PAST`). Any other input schema that touches Party MUST NOT accept it as a free-form write. | `PATCH /api/parties/:id` with `partyPatchSchema` (only) |
| `loyaltyPointsCache` | Denormalized loyalty balance for fast reads. Source of truth is `SUM(LoyaltyLedger.delta)`. Letting the client write it would orphan the actual ledger. **Note:** not actually added to schema in v3 (deferred — see §2.5 note), but listed here so when it IS added later, the input-schema discipline already applies. | Future: `loyalty-balance.service.recomputeCache(partyId)` called from accrual/redeem hooks |
| `loyaltyOptOut` | Consent flag. Client writing this could opt other parties out of loyalty silently. **Note:** not added in v3 schema (UI toggle is a no-op today per §2.5). Listed here so future addition is discipline-clean. | Future: dedicated `PUT /api/parties/:id/loyalty-opt-out` route with audit log |

**The two enforcement patterns** (either is acceptable; PR2 builder picks one):

**Pattern A — `.omit()` from the generated Prisma type:**

```ts
// server/src/schemas/party.schemas.ts
import { z } from 'zod'
import type { Party } from '@prisma/client'

// Build a base from the Prisma row type
type PartyInputRaw = Omit<Party,
  'id' | 'createdAt' | 'updatedAt' | 'businessId' |
  // v3 / M2 SERVER-ONLY EXCLUSIONS:
  'lastContactedAt' | 'followUpAt' | 'loyaltyPointsCache' | 'loyaltyOptOut'
>

// Then build Zod schemas from the narrowed type
export const createPartySchema = z.object<Record<keyof PartyInputRaw, z.ZodType>>({
  name: z.string().trim().min(1).max(120),
  phone: z.string().optional(),
  // ... etc — ONLY keys that are NOT in the omit list ...
}).strict()
```

**Pattern B — hand-rolled allow-list (preferred — no Prisma coupling in schemas):**

```ts
// server/src/schemas/party.schemas.ts
export const createPartySchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  notes: z.string().max(2000).optional(),
  // ... ONLY explicit user-editable fields ...
}).strict()

export const partyPatchSchema = createPartySchema.partial().extend({
  // followUpAt IS user-mutable but via a dedicated, validated path:
  followUpAt: z.coerce.date()
    .refine(d => d.getTime() > Date.now(),
      { message: 'INVALID_FOLLOWUP_PAST' })
    .optional()
    .nullable(),  // allow clearing
}).strict()

export const partyUpdateSchema = partyPatchSchema  // alias for PUT
```

Pattern B is preferred for HisaabPro because:
1. It doesn't couple schemas to the Prisma generated type (which changes
   every migration).
2. `.strict()` rejects unknown keys outright — including any new
   server-only field added later that the developer forgot to omit.
3. It's grep-friendly — `git grep "createPartySchema\b"` shows the entire
   allow-list at a glance.

**Enforcement (§17.2 acceptance):**
1. Pre-commit grep (added to `scripts/enforce.js` — file plan row #91b):
   ```
   grep -nE "lastContactedAt|loyaltyPointsCache|loyaltyOptOut" \
     server/src/schemas/party.schemas.ts && exit 1 || exit 0
   ```
   The keys MUST NOT appear in any input schema file. Block at pre-commit.
2. Integration test: `PATCH /api/parties/:id` body
   `{ lastContactedAt: '1970-01-01' }` → 400 ZodError. AND verify the
   server-side `lastContactedAt` value is unchanged (still `null` or
   the value set by the last hook).
3. Tenant-isolation row #2 in §11.3 already covers this (cross-tenant
   attacker tries to forge `lastContactedAt`).

**Future column adds.** When `loyaltyPointsCache` and `loyaltyOptOut` get
added to the schema in a later epic, the migration MUST be accompanied
by a one-line edit to the grep check above and a manual confirmation
that the input schemas still exclude them. If a follow-up developer
adds them as user-mutable, they hit pattern-B's `.strict()` rejection
and the grep check at pre-commit — three lines of defence.

### 3.7 Cron — `loyalty-expiry.cron.ts` (v2 — M1: 04:15 IST)

Pattern mirrors `services/subscription/subscription.writer.ts:25-31`.

```
runLoyaltyExpiryJob():
  for each business cursor-page (take 200, businessId asc) {
    lock = await pg_try_advisory_lock(hashtextextended('loyalty-expiry:' + businessId))
    if (!lock) continue
    try {
      while (true) {
        $transaction([
          tx.loyaltyLedger.findMany({
            where: businessId, type: 'AC', expiresAt: { lt: now },
            take: 500, orderBy: { earnedAt: 'asc' }
          })
          if (rows.length === 0) break
          tx.loyaltyLedger.createMany({ data: rows.map(r => ({
            businessId, partyId: r.partyId, type: 'EX',
            delta: -r.delta,
            expiryRunId,
            note: `Expired from ${r.id}`,
          }))})
        ])
      }
    } finally {
      pg_advisory_unlock(...)
    }
  }
```

**Cron slot (v2 — M1): `'15 4 * * *'` IST (04:15 IST).** See v2 changelog
above for slot inventory. The advisory lock prevents double-fire.

### 3.8 Side-effect rule (v2 — M5)

All analytics events route through `analyticsEmit(event, ctx)` from
`server/src/lib/analytics.ts`. Events are emitted AFTER the originating
transaction commits.

---

## 4. Concurrency & race conditions

### 4.1 Two POS sales redeem from the same balance simultaneously

**Solution: per-party advisory lock at the head of the loyalty-redeem path.**

```ts
await tx.$executeRawUnsafe(
  `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`,
  `loyalty:${businessId}:${partyId}`
)
```

Pattern from `subscription.writer.ts:25-31`. The lock is held for the
duration of the transaction. Sales for the SAME party serialize; sales
for DIFFERENT parties don't block each other.

### 4.2 Commission rule snapshot — DEEP CLONE required (v3 — M1 callout box)

**Scenario:** owner edits the "Spices 2%" rule to "Spices 5%" while a POS
sale is in flight. Or, more subtle: the accrual service has already read
the rule, written a row with `meta: { ruleSnapshot: rule }` (taking the
live reference), and a later code path mutates `rule.config` before the
JSON serialization fires — the snapshot in the ledger is now wrong.

**Solution: explicit deep clone of the rule config snapshot INSIDE the same
Prisma transaction, BEFORE the `commissionLedger.create` call.**

```ts
// commission-accrual.service.ts (per matched rule, inside $transaction)
// v3 / M1 — DEEP CLONE the snapshot fields. Do NOT take the live `rule`
// reference. Prisma's Json field accepts the object by reference; any
// subsequent mutation of `rule` — by a future refactor, test, or
// chained service call — would mutate the snapshot in memory before
// the row is serialized. Worse, in the void/restore path (§3.4.1),
// the original rule may have been DELETED or EDITED between accrual
// and reversal; reaching back to live `rule.config` then would
// silently shift the audit trail.
//
// JSON.parse(JSON.stringify(...)) is the universal deep-clone idiom
// for plain-data shapes (Prisma JSON columns are plain-data by
// definition). It strips Dates → ISO strings, which is what we want
// for forensics-table immutability anyway.
const ruleSnapshot = JSON.parse(JSON.stringify({
  ruleId: rule.id,
  name: rule.name,
  scope: rule.scope,
  scopeId: rule.scopeId,
  mode: rule.mode,
  rateBps: rule.rateBps,
  flatPerUnitPaise: rule.flatPerUnitPaise,
  appliesTo: rule.appliesTo,
  // Capture createdAt at snapshot-time as ISO string (Date.toJSON yields ISO)
  createdAt: rule.createdAt.toISOString(),
  snapshotAt: new Date().toISOString(),
}))

await tx.commissionLedger.create({
  data: {
    businessId, staffUserId, ruleId: rule.id,
    posSaleId, basisPaise, commissionPaise, periodYearMonth,
    meta: {
      ruleSnapshot,                          // ← deep-cloned, frozen
      source: 'POS' | 'INVOICE' | 'VOID' | 'RESTORE',
      appliedAt: new Date().toISOString(),
    },
  },
})
```

> **WHY DEEP CLONE — pinned callout for builder:**
> Prisma's JSON column type (`Json` in Prisma schema, `jsonb` in
> Postgres) accepts the JavaScript object by reference and serializes
> it at query-prepare time. Between "build the data object" and
> "Prisma writes the row", any mutation of the source object IS
> reflected in the written row — there is no snapshot-at-construction.
> Worse, if the row is reused across multiple `tx.create` calls (e.g.
> a future refactor that bulk-inserts), a single shared reference
> propagates through every row.
>
> Equally important for v3 / M1: the **void path (§3.2)** and
> **restore path (§3.4.1)** must NOT reach back to the live
> `CommissionRule` to rebuild the snapshot — the rule may have been
> edited (or even soft-deleted) between accrual and reversal. Both
> paths MUST deep-clone the snapshot from the **original ledger row's
> `meta.ruleSnapshot`**, propagating the historical rule shape
> forward through the void→restore lifecycle. This is what makes the
> AC→VD→VR chain forensically intact: every row's snapshot is its
> own frozen copy, immune to admin retroactive edits.
>
> The `JSON.parse(JSON.stringify(...))` idiom removes the failure
> class entirely. Cost: ~50µs per row, negligible against the ~15ms
> tx round-trip.

**`meta` is a JSON column** — Prisma `Json?`. No extra migration. The
`ruleId` FK is `onDelete: SetNull`, so even deleting the rule keeps the
ledger intact with the snapshot preserved (and the snapshot is the
source of truth for the historical rule shape — not the rule row
itself, which may not exist anymore).

§17.3 grep-test: `git grep -n "JSON.parse(JSON.stringify" \
  server/src/services/commission/commission-accrual.service.ts` MUST
return at least 2 matches (one for forward accrual, one for void/restore
re-snapshot from prior `meta.ruleSnapshot`).

### 4.3 Cron clock-skew / dual-fire

Render Starter has only one cron worker, but a manual SSH invocation
during the cron window would double-fire. Solution: `pg_try_advisory_lock`
per business + idempotent EX-row guard (§3.7). Same as v2.

### 4.4 SQL guard for double-expiry

Same as v2 — `NOT EXISTS (... type='EX' AND note LIKE 'Expired from <id>%')`
subquery in the cron SELECT.

### 4.5 Commission rule conflict resolution (Locked Decision Q15)

Rules are matched per line item by specificity:

```
1. PRODUCT-scoped rule whose scopeId == lineItem.productId
2. CATEGORY-scoped rule whose scopeId == product.categoryId
3. ALL-scoped rule (scope='ALL', scopeId is null)
```

Within the same specificity, newest `createdAt` wins. Same as v2.

### 4.6 Loyalty redemption gate when program disabled mid-tx

Same as v2. The `applyRedemption` fn re-reads `LoyaltyProgram.enabled`
inside the tx (after acquiring the advisory lock). If disabled, throws
`PROGRAM_DISABLED`.

---

## 5. Offline behavior (FE)

Per `.claude/rules/OFFLINE_RULES.md` and Locked Decisions §19. Five clauses
(same as v2 — no security-relevant changes):

### 5.1 Loyalty balance preview — cache-on, stale-tolerant

`GET /api/loyalty/balance/:partyId` is called with `cacheReads: true`.

### 5.2 Redemption is server-validated even when preview was offline

Two safeties: `openCheckout()` refuses offline; `previewRedemption` is a
server round-trip at checkout time.

### 5.3 CRM mutations — offline-queued per OFFLINE_RULES

| Mutation | `entityType` | `entityLabel` |
|----------|--------------|---------------|
| `PATCH /api/parties/:id` (tags / followUpAt) | `party` | `data.name ?? "Party"` |

All loyalty/commission CONFIG mutations also pass `entityType` and
`entityLabel`.

### 5.4 Reads — explicit cache opt-in matrix

| Endpoint | `cacheReads` | Reasoning |
|----------|--------------|-----------|
| `GET /api/loyalty/program` | YES | Config only |
| `GET /api/loyalty/balance/:partyId` | YES | Per-party total |
| `GET /api/loyalty/ledger/:partyId` | **NO** | Per-row financial detail |
| `GET /api/parties?tag=…` | YES (existing) | Already in scope per Epic A |
| `GET /api/parties/follow-ups` | YES | Party names + dates only |
| `GET /api/parties/tags` | YES | Counts only |
| `GET /api/commission/rules` | YES | Config only |
| `GET /api/commission/ledger?staffUserId=self` | YES | Own ledger only |
| `GET /api/commission/leaderboard` | **NO** | Multi-staff data |

### 5.5 No client-side accrual write

Commission and loyalty accrual happen inside POS / Document `$transaction`s
on the server.

---

## 6. Permissions / RBAC delta

The existing `requirePermission(permission)` middleware
(`server/src/middleware/permission.ts:20`) reads from
`BusinessUser.roleRef.permissions: String[]`. Owners bypass.

### 6.1 New permission strings (v2 — S1 house style; v3 — S2 rate cap location, S3 redeem middleware)

The HisaabPro permission registry follows `<resource>.<action>` two-segment
convention. The v1 draft's three-segment forms (`commission.read.self`,
`loyalty.config`) don't fit. v2 renames everything:

| Permission key (v2/v3) | v1 name (deprecated) | Granted by default to | Used by routes |
|---------------------|-----------------------|------------------------|----------------|
| `loyalty.configure` | `loyalty.config` | owner | `PUT /api/loyalty/program` |
| `loyalty.redeem` | (unchanged) | owner, cashier | **v3 / S3**: enforced at route layer in `posCheckoutAuth` middleware (§3.1) BEFORE the checkout tx opens whenever any `payments[].mode === 'loyalty_redemption'` is present. Reject with 403 `PERMISSION_DENIED`. |
| `parties.view` | (unchanged) | owner, viewer, all 5 staff roles (v3 NEW_S2 clarified) | `GET /api/loyalty/balance/:partyId`, `GET /api/loyalty/ledger/:partyId`, `GET /api/parties/follow-ups`, `GET /api/parties/tags`, `GET /api/parties?tag=` |
| `commission.configure` | `commission.config` | owner | `POST/PUT/DELETE /api/commission/rules`. **v3 / S2**: `rateBps` capped at 10_000 (100%) at the Zod boundary in `commissionRuleSchema.strict()`. |
| `commission.view` | `commission.read.self` | owner, all staff | `GET /api/commission/ledger?staffUserId=<self>` |
| `commission.view_all` | `commission.read.all` | owner, manager | `GET /api/commission/leaderboard`, `GET /api/commission/ledger?staffUserId=<other>` (gated by `commissionLedgerAuth` factory — see §6.3) |
| `crm_followup.create` | `crm.followup.write` | owner, cashier | `PATCH /api/parties/:id` when body sets `followUpAt` |

**v3 / S2 — rate-cap location is the Zod boundary.** `commissionRuleSchema`
in `server/src/schemas/commission.schema.ts`:

```ts
export const commissionRuleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  scope: z.enum(['ALL', 'PRODUCT', 'CATEGORY']),
  scopeId: z.string().cuid().optional().nullable(),
  mode: z.enum(['PERCENT_GROSS', 'PERCENT_NET', 'FLAT_PER_UNIT']),
  // v3 / S2 HARD CAP — 10000 bps = 100%
  rateBps: z.number().int().min(0).max(10000,
    'COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT').optional().nullable(),
  flatPerUnitPaise: z.number().int().min(0).optional().nullable(),
  appliesTo: z.enum(['POS', 'INVOICE', 'BOTH']),
  staffUserIds: z.array(z.string().cuid()).default([]),
  isActive: z.boolean().default(true),
}).strict().superRefine((v, ctx) => {
  // Mode-specific required fields
  if (v.mode === 'FLAT_PER_UNIT' && v.flatPerUnitPaise == null) {
    ctx.addIssue({ code: 'custom', path: ['flatPerUnitPaise'],
      message: 'FLAT_PER_UNIT_PAISE_REQUIRED' })
  }
  if (v.mode !== 'FLAT_PER_UNIT' && v.rateBps == null) {
    ctx.addIssue({ code: 'custom', path: ['rateBps'],
      message: 'RATE_BPS_REQUIRED' })
  }
})
```

FE warning at 5000 bps (50%) is a UI-only soft signal in
`CommissionRuleForm.tsx` (file plan row #81) — server never accepts a
value that bypassed the Zod gate. §17.3 boundary test:
`POST /api/commission/rules` with `rateBps: 15000` returns 400
`COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`.

### 6.2 Where the strings are registered (v2 — M4)

**Real registry:** `server/src/services/settings/permissions-data.ts`
(290 lines, 8 system roles). Merge procedure same as v2.

### 6.3 `commission.view` factory middleware + cross-tenant precheck (v3 — M4, M5)

**v2 (deprecated) pattern — fragile inline `res.headersSent` chain:**

```ts
// DO NOT USE — superseded by v3
const requestedStaff = String(req.query.staffUserId ?? req.user!.userId)
if (requestedStaff !== req.user!.userId) {
  await requirePermission('commission.view_all')(req, res, () => {})
  if (res.headersSent) return  // ← fragile
}
```

The fragility comes from three sources:
1. `requirePermission` writes to `res` synchronously before `next()` is
   called — the `() => {}` next-shim swallows a thrown next-error.
2. `res.headersSent` returns `true` only after the response is FLUSHED,
   not when `.status().json()` is called — timing varies.
3. Future middleware-chain refactor (async `next` wrapping) silently
   breaks this — no test catches it.

**v3 / M5 — factory middleware pattern. Single-pass, two terminal branches:**

```ts
// server/src/middleware/commission-ledger-auth.ts (NEW v3 — file plan row #27c, ~50L)
import type { Request, Response, NextFunction } from 'express'
import { requirePermission } from './permission.js'

/**
 * Auth for GET /api/commission/ledger.
 *
 * Two paths, both single-pass (no headersSent chain):
 *  1. No staffUserId, OR staffUserId === caller.userId
 *     → viewing own ledger; rely on baseline requireAuth.
 *  2. staffUserId is different (or absent) AND caller is NOT that user
 *     → must hold `commission.view_all`; defer to requirePermission.
 *
 * The cross-tenant 404 check (v3 / M4) happens INSIDE the route handler,
 * not in this middleware — it needs prisma access which is route-scoped.
 */
export function commissionLedgerAuth(req: Request, res: Response, next: NextFunction) {
  const targetUserId = typeof req.query.staffUserId === 'string'
    ? req.query.staffUserId
    : undefined
  // Path 1: viewing own ledger (or no staffUserId param) → no extra permission
  if (!targetUserId || targetUserId === req.user?.userId) {
    return next()
  }
  // Path 2: viewing someone else's → must hold commission.view_all
  return requirePermission('commission.view_all')(req, res, next)
}
```

Route mount (`server/src/routes/commission.routes.ts`):

```ts
import { commissionLedgerAuth } from '../middleware/commission-ledger-auth.js'

router.get('/api/commission/ledger',
  requireAuth,
  commissionLedgerAuth,         // v3 / M5 — replaces inline chain
  commissionLedgerHandler
)

router.get('/api/commission/leaderboard',
  requireAuth,
  requirePermission('commission.view_all'),
  commissionLeaderboardHandler
)
```

**v3 / M4 — Cross-tenant staffUserId precheck returns 404, NOT 200-empty, NOT 403.**

The audit identified an IDOR + timing oracle: `GET /api/commission/ledger?staffUserId=<UUID_of_other_tenant>`
currently might either return `{ rows: [], summary: { totalPaise: 0 } }`
(200-empty leaks "this UUID is a real user somewhere") or return 403
(leaks "I exist but you don't own me"). Both are timing oracles for UUID
enumeration.

The handler MUST do an explicit tenant-membership check BEFORE running
the ledger query, returning **404 STAFF_NOT_FOUND** when the UUID is not
a `BusinessUser` of the caller's `businessId`:

```ts
// server/src/routes/commission.routes.ts — commissionLedgerHandler
async function commissionLedgerHandler(req: Request, res: Response) {
  const targetUserId = (req.query.staffUserId as string | undefined) ?? req.user!.userId

  // v3 / M4 — Cross-tenant precheck. Collapses 200-empty + 403 into a
  // single 404 that's indistinguishable from "that UUID does not exist
  // anywhere in the system" — kills the enumeration oracle.
  //
  // We use isActive: true so historic / soft-deleted staff also yield
  // 404 — same security posture.
  if (targetUserId !== req.user!.userId) {
    const target = await prisma.businessUser.findFirst({
      where: {
        userId: targetUserId,
        businessId: req.user!.businessId,
        isActive: true,
      },
      select: { userId: true },
    })
    if (!target) {
      // 404, NOT 403. NOT 200-empty.
      return res.status(404).json({
        success: false,
        error: { code: 'STAFF_NOT_FOUND' }
      })
    }
  }

  // Now safe to query the ledger
  const result = await commissionLedger.list({
    businessId: req.user!.businessId,
    staffUserId: targetUserId,
    from: req.query.from,
    to: req.query.to,
    cursor: req.query.cursor,
  })
  return res.json({ success: true, data: result })
}
```

§17.3 acceptance tests (added):
1. **Cross-tenant precheck oracle test:** GET `/api/commission/ledger?staffUserId=<other_tenant_user_uuid>`
   returns **404 STAFF_NOT_FOUND**. NOT 200 with empty rows. NOT 403.
2. **Factory middleware grep test:**
   `git grep -n "commissionLedgerAuth\|res.headersSent" server/src/routes/commission.routes.ts`
   — the factory MUST be imported and used; `res.headersSent` MUST NOT
   appear in this route file.
3. **Single-pass behaviour test:** GET `/api/commission/ledger` (no
   staffUserId) by a staff user with `commission.view` but NOT
   `commission.view_all` returns 200 with their own ledger. GET with
   `staffUserId=<other staff in same tenant>` returns 403.

The same cross-tenant precheck pattern is also applied to:
- `GET /api/loyalty/balance/:partyId` — Party precheck before ledger
  aggregate; 404 PARTY_NOT_FOUND for cross-tenant.
- `GET /api/loyalty/ledger/:partyId` — same.

These are already in §11.3 "cross-tenant leak" risks for security agent
to verify; v3 elevates them from "audit focus" to "mandatory route
handler pattern" in line with the M4 fix.

### 6.4 System role × new permission defaults table (v2 — S5; v3 — NEW_S2 wording clarified)

The 5 non-management system roles × 7 new permission keys = 35 cells.
Owner / Partner / Manager get every new key by default (via the existing
`ALL_PERMISSIONS` derivations — see §6.2). The table below is the
exhaustive defaults set for the 5 staff roles to merge into `SYSTEM_ROLES`
(lines 231-289 of `permissions-data.ts`):

| System role | `loyalty.configure` | `loyalty.redeem` | `commission.configure` | `commission.view` | `commission.view_all` | `crm_followup.create` | Rationale |
|-------------|---------------------|------------------|------------------------|--------------------|------------------------|-----------------------|-----------|
| Salesman    | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | Salesmen ring sales and earn commission; should see own ledger and set follow-ups. ✅ on redeem in anticipation of Phase 6 Salesman-creates-invoice-with-redemption flow. |
| Cashier     | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | Cashier is the canonical POS operator (already has `pos.read`, `pos.create`); needs `loyalty.redeem` to apply redemptions at checkout (now hard-enforced at route layer per v3 / S3 — see §3.1), `commission.view` to see own earnings, `crm_followup.create` to capture follow-up notes inline. |
| Stock Manager | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Inventory role; no sales floor exposure. None of the loyalty/commission/follow-up flows apply. (Note: this seed-role label is literally `Stock Manager` in `permissions-data.ts:256` — no underscore-cased alias exists.) |
| Delivery Boy | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Delivers and collects payments; no checkout, no commission rule. |
| Accountant  | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | Read-only on ledgers; sees own commission row (in case Accountant is also a sales-creator in a small business); does not configure rules and does not see other staff. |

**v3 NEW_S2 clarified wording — `parties.view` already covers Epic D reads.**
The v2 closing parenthetical ("`parties.view` ... already granted to every
staff role today except Stock Manager (which has it)") was a
self-contradicting copy-paste leftover. The accurate statement is: **all 5
staff roles in `permissions-data.ts` already include `parties.view` in
their `permissions: [...]` array** (Salesman line 234, Cashier line 247,
Stock Manager line 259, Delivery Boy line 268, Accountant line 277).
Therefore, no new grants for `parties.view` are required for Epic D
loyalty-balance / loyalty-ledger / parties-tags reads. The wording
correction is doc-only; no implementation impact.

If owner wants to override these defaults, the existing `/settings/roles`
UI lets them create a custom role — no code change.

### 6.5 Staff widget visibility

`StaffDashboardSection` calls `useCanRead('commission.view')`. Widget is
hidden when the user lacks the permission.

---

## 7. File Plan (HARD GATE — every row ≤ 250 LOC)

Total: **85 files** (53 create + 32 edit) — up from v2's 83 due to v3
additions: (a) new `server/src/middleware/commission-ledger-auth.ts` (M5
factory middleware, ~50L), (b) new `scripts/enforce.js` rule entry (M2
server-only fields grep, ~25L incremental). The v2 file count (83) becomes
v3 (85) by adding these two; no existing file exceeds the 250-LOC cap.

Layer order matches CLAUDE.md project rule:
- **Backend layers:** `types → constants → schema (Zod) → utils → service → route`
- **Frontend layers:** `types → constants → utils → hook → sub-components → page → css`

### 7.1 Backend — 34 files (paths real; v3 deltas marked)

| # | Path | Action | Est. LOC | Layer | Build phase | Depends-on |
|---|------|--------|----------|-------|-------------|-----------|
| 1 | `server/prisma/schema.prisma` | edit | +99 (+2 v3 for new composite index) | schema | PR1 | — |
| 2 | `server/prisma/migrations/20260518000000_phase5_epic_d_crm_loyalty_commission/migration.sql` | create | ~95 (+5 v3 for new index) | schema | PR1 | #1 |
| 2b | `server/src/lib/analytics.ts` (v2 — M5) | create | ~60 | lib | PR1 | — |
| **Loyalty #125** | | | | | | |
| 3 | `server/src/types/loyalty.types.ts` | create | ~80 | types | PR1 | — |
| 4 | `server/src/services/loyalty/loyalty.constants.ts` | create | ~50 | constants | PR1 | — |
| 4b | `server/src/services/loyalty/loyalty.utils.ts` (v2 — S2 host for `computePointsEarned`; v3 — S1 BigInt insurance) | create | ~90 (+10 v3 BigInt + extra unit test fixtures) | utils | PR1 | #4 |
| 5 | `server/src/services/loyalty/loyalty.errors.ts` | create | ~50 | constants | PR1 | #4 |
| 6 | `server/src/schemas/loyalty.schema.ts` | create | ~90 | schema | PR1 | #3 |
| 7 | `server/src/services/loyalty/loyalty-balance.service.ts` | create | ~110 | service | PR3 | #3,#4 |
| 8 | `server/src/services/loyalty/loyalty-accrual.service.ts` | create | ~180 | service | PR3 | #4,#4b,#5,#7 |
| 9 | `server/src/services/loyalty/loyalty-redeem.service.ts` | create | ~170 | service | PR3 | #4,#5,#7 |
| 10 | `server/src/services/loyalty/loyalty-program.service.ts` | create | ~130 | service | PR3 | #4,#5 |
| 11 | `server/src/services/loyalty/loyalty-expiry.cron.ts` | create | ~150 | service | PR3 | #4 |
| 12 | `server/src/routes/loyalty.routes.ts` | create | ~150 | route | PR3 | #6,#7,#8,#9,#10 |
| 13 | `server/src/lib/cron-scheduler.ts` | edit | +14 | bootstrap | PR3 | #11 |
| 14 | `server/src/services/pos/pos-checkout.service.ts` | edit | +35 | service | PR3 | #8,#9 |
| 14b | `server/src/routes/pos-sales.ts` (v3 / S3 — add `posCheckoutAuth` route-level middleware between `auth` and `requireIdempotencyKey` on existing `router.post('/', auth, requireIdempotencyKey, requirePermission('pos.create'), idempotencyCheck(), asyncHandler(...))` at line 62; preserve all 5 existing middlewares; +25L) | edit | +25 | route | PR3 | #14 |
| 15 | `server/src/services/pos/pos.validators.ts` (v3 / S1 — BigInt cross-multiply added) | edit | +30 (+5 v3 BigInt) | schema | PR3 | — |
| 16 | `server/src/services/pos/pos-void.service.ts` (covers BOTH void AND restore — v2 §3.4.1; v3 / M1 deep-clone snapshot from prior `meta.ruleSnapshot`) | edit | +50 (+5 v3 deep-clone notes) | service | PR3 | #8 |
| 16b | `server/src/services/report/report-daybook.ts` (v2 — S3 tender breakdown) | edit | +15 | service | PR3 | #15 |
| **CRM #127** | | | | | | |
| 17 | `server/src/types/party-crm.types.ts` | create | ~60 | types | PR2 | — |
| 18 | `server/src/services/party/followups.service.ts` (v3 / M3 service-layer clamp) | create | ~140 (+10 v3 clamp + composite-index notes) | service | PR2 | #17 |
| 19 | `server/src/services/party/tags.service.ts` | create | ~90 | service | PR2 | #17 |
| 20 | `server/src/services/party/last-contacted.service.ts` | create | ~80 | utils/service | PR2 | — |
| 21 | `server/src/routes/documents/share.ts` | edit | +8 | route | PR2 | #20 |
| 22 | `server/src/services/collections/bulk-reminder.service.ts` | edit | +8 | service | PR2 | #20 |
| 23 | `server/src/services/payment/reminders.ts` | edit | +12 | service | PR2 | #20 |
| 24 | `server/src/schemas/party.schemas.ts` (v3 / M2 — allow-list schemas; v3 / M3 — `followUpsQuerySchema` with `.max(365)`) | edit | +35 (+23 v3 for M2 allow-list rewrite + M3 query schema) | schema | PR2 | — |
| 25 | `server/src/services/party/list-get.ts` | edit | +18 | service | PR2 | — |
| 26 | `server/src/services/party/update-delete.ts` | edit | +6 | service | PR2 | — |
| 27 | `server/src/routes/party.ts` (v3 / M3 — wire `followUpsQuerySchema` + INVALID_WITHIN_DAYS_RANGE error code) | edit | +70 (+10 v3 for query parse + error path) | route | PR2 | #18,#19,#25 |
| 27b | `server/src/services/settings/permissions-data.ts` (v2 — M4) | edit | +30 | constants | PR1 | — |
| 27c | `server/src/middleware/commission-ledger-auth.ts` (NEW v3 — M5 factory middleware) | create | ~50 | middleware | PR5 | — |
| **Commission #128** | | | | | | |
| 28 | `server/src/types/commission.types.ts` | create | ~80 | types | PR1 | — |
| 29 | `server/src/services/commission/commission.constants.ts` | create | ~40 | constants | PR1 | — |
| 30 | `server/src/services/commission/commission.errors.ts` (v3 — add `STAFF_NOT_FOUND`, `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`) | create | ~55 (+5 v3 new error codes) | constants | PR1 | #29 |
| 31 | `server/src/schemas/commission.schema.ts` (v3 / S2 — `rateBps.max(10000)`) | create | ~125 (+5 v3 for cap) | schema | PR1 | #28 |
| 32 | `server/src/services/commission/commission-rule.service.ts` | create | ~180 | service | PR5 | #28,#29,#30 |
| 33 | `server/src/services/commission/commission-accrual.service.ts` (v3 / M1 — explicit deep-clone snapshot on accrual + on void + on restore) | create | ~240 (+20 v3 for deep-clone callout + 3 call sites) | service | PR5 | #29,#30 |
| 34 | `server/src/services/commission/commission-ledger.service.ts` (v3 / M4 — cross-tenant precheck helper) | create | ~150 (+10 v3 for precheck shape) | service | PR5 | #28 |
| 35 | `server/src/routes/commission.routes.ts` (v3 / M4 + M5 — handler does cross-tenant 404 precheck; uses `commissionLedgerAuth` factory middleware) | create | ~225 (+25 v3 for precheck + factory wire) | route | PR5 | #31,#32,#33,#34,#27c |
| 36 | `server/src/services/pos/pos-checkout.service.ts` (continues edit from #14 — single edit covers both loyalty + commission) | — | (already in #14) | — | PR5 | #33 |
| 37 | `server/src/services/document/create.ts` | edit | +18 | service | PR5 | #33 |
| 38 | `server/src/services/document/update.ts` | edit | +14 | service | PR5 | #33 |
| 39 | `server/src/app.ts` | edit | +6 | bootstrap | PR3+PR5 | #12,#35 |
| 91b | `scripts/enforce.js` (v3 / M2 — grep rule blocking server-only Party fields in input schemas) | edit | +25 | tooling | PR2 | #24 |

**Largest backend row (v3):** `commission-accrual.service.ts` at 240 LOC
(was 220 in v2; +20 for the M1 deep-clone callout + 3 call sites:
forward accrual, void reversal re-snapshot from prior `meta.ruleSnapshot`,
restore counter-cancellation re-snapshot from prior `meta.ruleSnapshot`).
**Still under 250 LOC.** If line-counting pushes it over during build,
extract the snapshot-helper into a 30-line `commission-snapshot.utils.ts`
(file plan addendum — not pre-allocated to keep the v3 delta tight).

`commission.routes.ts` at 225 LOC (was 200 in v2; +25 for the M4 cross-tenant
precheck + factory middleware wire). **Still under 250 LOC.**

### 7.2 Frontend — 50 files (paths real — v2 path fixes per §0.2; v3 NEW_S1 builder note on #61b)

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
| 61 | `src/features/parties/components/PartyDetailLoyaltyTab.tsx` (v2 — M3) | create | ~190 | sub-component | PR4 | #57 |
| 61b | `src/features/parties/PartyDetailPage.tsx` (v2 — M3, expand TABS array + render new tab) **v3 NEW_S1 builder note: `DetailTab` union is declared in BOTH this file (line 32) AND `usePartyDetail.ts` (line 10) — add `'loyalty'` to both, OR extract to `party.types.ts` and import in both. Adding to one only = TS narrowing error at `setActiveTab`.** | edit | +18 | page | PR4 | #61 |
| 61c | `src/features/parties/usePartyDetail.ts` (v3 NEW_S1 — add `'loyalty'` to `DetailTab` union OR refactor to import) | edit | +2 (or +1 for the import line if extracted to `party.types.ts`) | hook | PR4 | #61b |
| 62 | `src/features/pos/api/pos.service.ts` (build `payments[]` payload incl. `loyalty_redemption`) | edit | +15 | service | PR4 | — |
| 63 | `src/features/pos/state/pos.store.ts` (track `loyaltyPointsRedeemed`) | edit | +20 | state | PR4 | — |
| **CRM FE #127** | | | | | | |
| 64 | `src/features/crm/crm.types.ts` | create | ~60 | types | PR2 | — |
| 65 | `src/features/crm/api/crm.service.ts` | create | ~100 | service | PR2 | #64 |
| 66 | `src/features/crm/hooks/useTagSummary.ts` | create | ~60 | hook | PR2 | #65 |
| 67 | `src/features/crm/hooks/useFollowUps.ts` (v3 / M3 — handles `INVALID_WITHIN_DAYS_RANGE` toast) | create | ~85 (+5 v3 for error mapping) | hook | PR2 | #65 |
| 68 | `src/features/crm/components/TagFilterBar.tsx` | create | ~150 | sub-component | PR2 | #66 |
| 69 | `src/features/crm/components/FollowUpDatePicker.tsx` | create | ~130 | sub-component | PR2 | — |
| 70 | `src/features/crm/components/FollowUpRow.tsx` | create | ~120 | sub-component | PR2 | — |
| 71 | `src/features/crm/pages/FollowUpsPage.tsx` | create | ~160 | page | PR2 | #67,#70 |
| 72 | `src/features/parties/PartiesPage.tsx` (v2 — M3) | edit | +30 | page | PR2 | #68 |
| 73 | `src/features/parties/PartyDetailPage.tsx` (v2 — M3; same file as #61b but separate row reserves the CRM landing) | edit | +22 | page | PR2 | — |
| 74 | `src/features/parties/components/PartyFormBasic.tsx` (v2 — M3; loyalty opt-out toggle is a no-op today per §2.5 — wires to backend opt-out column in future epic) | edit | +28 | sub-component | PR2 | #69 |
| **Commission FE #128** | | | | | | |
| 75 | `src/features/commission/commission.types.ts` | create | ~80 | types | PR6 | — |
| 76 | `src/features/commission/commission.constants.ts` | create | ~40 | constants | PR6 | — |
| 77 | `src/features/commission/api/commission.service.ts` (v3 / M4 — handles `STAFF_NOT_FOUND` toast) | create | ~135 (+5 v3) | service | PR6 | #75 |
| 78 | `src/features/commission/hooks/useCommissionRules.ts` (v3 / S2 — shows `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT` and 50% soft-cap warning) | create | ~115 (+5 v3) | hook | PR6 | #77 |
| 79 | `src/features/commission/hooks/useCommissionLedger.ts` | create | ~110 | hook | PR6 | #77 |
| 80 | `src/features/commission/hooks/useLeaderboard.ts` | create | ~80 | hook | PR6 | #77 |
| 81 | `src/features/commission/components/CommissionRuleForm.tsx` (v3 / S2 — UI warning at 5000 bps soft-cap; HARD block at 10000) | create | ~235 (+5 v3 for warning UI) | sub-component | PR6 | #76,#78 |
| 82 | `src/features/commission/components/CommissionRuleList.tsx` | create | ~140 | sub-component | PR6 | #78 |
| 83 | `src/features/commission/components/CommissionWidget.tsx` | create | ~130 | sub-component | PR6 | #79 |
| 84 | `src/features/commission/components/LeaderboardTable.tsx` | create | ~190 | sub-component | PR6 | #80 |
| 85 | `src/features/commission/pages/CommissionSettingsPage.tsx` | create | ~160 | page | PR6 | #81,#82 |
| 86 | `src/features/commission/pages/CommissionLedgerPage.tsx` | create | ~150 | page | PR6 | #79 |
| 87 | `src/features/commission/pages/LeaderboardPage.tsx` | create | ~130 | page | PR6 | #84 |
| 88 | `src/features/dashboard/components/StaffDashboardSection.tsx` (v2 — M3 CREATE) | create | ~120 | sub-component | PR6 | #83 |
| 88b | `src/features/dashboard/DashboardPage.tsx` (mount `StaffDashboardSection`) | edit | +10 | page | PR6 | #88 |
| **CSS** | | | | | | |
| 89 | `src/styles/components.crm.css` | create | ~130 | css | PR2 | — |
| 90 | `src/styles/components.loyalty.css` | create | ~110 | css | PR4 | — |
| 91 | `src/styles/components.commission.css` | create | ~120 | css | PR6 | — |

**Final tally (v3):** 85 files total (34 backend + 50 frontend + 1 tooling
edit at #91b). 53 create + 32 edit. Largest row: `CommissionRuleForm.tsx`
at 235 LOC (was 230 in v2; +5 for the warning UI per v3 / S2). Backend
largest: `commission-accrual.service.ts` at 240 LOC. **No row exceeds the
250-LOC cap.**

**v3 vs v2 file delta:**
- NEW: #27c `commission-ledger-auth.ts` (~50L) — M5 factory middleware
- NEW: #61c `usePartyDetail.ts` edit (~2L) — NEW_S1 DetailTab parity
- NEW: #91b `scripts/enforce.js` edit (~25L) — M2 server-only fields grep
- Re-estimated upward (still under cap): #1 (+2), #2 (+5), #4b (+10), #15 (+5), #16 (+5), #18 (+10), #24 (+23), #27 (+10), #30 (+5), #31 (+5), #33 (+20), #34 (+10), #35 (+25), #67 (+5), #77 (+5), #78 (+5), #81 (+5), #14b (NEW edit row, +25L for posCheckoutAuth wire)

### 7.3 Scaffold order (what the builder writes first)

PR1 (schema + shared infra) builds types and constants stubs FIRST so
downstream PRs compile against committed interfaces. Order within PR1:

```
1. schema.prisma + migration (incl. v3 / M3 composite index)         (#1, #2)
2. analytics wrapper                                                  (#2b)
3. types files                                                        (#3, #17, #28)
4. constants + errors files (incl. v3 STAFF_NOT_FOUND, RATE_MAX)      (#4, #4b, #5, #29, #30)
5. permissions-data.ts merge                                          (#27b)
6. Zod schemas (incl. v3 / M2 allow-list patterns, S2 rateBps cap)    (#6, #24, #31)
7. translation skeletons                                              (#40-#46)
```

Once PR1 is green, PR2-PR6 build in this dependency order:

- PR2: CRM (no cross-deps beyond PR1) — includes the v3 / M2 enforce.js grep edit
- PR3: Loyalty BE (no cross-deps beyond PR1) — includes v3 / S3 posCheckoutAuth
- PR4: Loyalty FE (depends on PR3 for API contracts)
- PR5: Commission BE — **MUST rebase on PR3** (see §8 for v3 / S4 details)
- PR6: Commission FE (depends on PR5)
- PR7: Security audit fixes (depends on PR6)

---

## 8. PR sequence (refined; v3 / S4 PR3+PR5 rebase contract)

Final 7-PR plan. Each PR independently mergeable per §12 gates.

> **v3 / S4 critical rebase note for PR5:** PR3 (loyalty backend) and PR5
> (commission backend) BOTH write to TWO of the same files:
> 1. `server/src/services/pos/pos-checkout.service.ts` (loyalty step 10.5/10.6 vs commission step 10.7)
> 2. `server/src/services/pos/pos-void.service.ts` (loyalty void/restore vs commission void/restore)
>
> If PR5 is opened BEFORE PR3 merges, the merge will look clean (git diffs
> would not conflict because the lines are separate). But if PR5 is opened
> based on a stale main and merges WITHOUT a rebase onto PR3, **PR5's
> branch will overwrite PR3's loyalty restore-refund logic with PR3-less
> versions of those service files** — a silent loss of the restore symmetry
> v2 fixed in M6. The §17 acceptance contract enforces this with a grep
> check: `git grep -n "applyRedemption\|restoreForPosSale" server/src/services/pos/`
> AFTER PR5 merges must still return the loyalty service calls. CI will
> reject PR5 if those calls disappear.
>
> **Operational rule:** open PR5 against the same branch state PR3 was
> opened against. Once PR3 merges, rebase PR5 onto main BEFORE the final
> review pass. The integration test `pos-checkout.integration.test.ts:
> step ordering 10.5 → 10.6 → 10.7` asserts ALL THREE in-tx step calls
> are present per checkout — adding it BEFORE PR5 merges (in PR3's test
> file) is the safety net.

### PR1 — Schema + Migration + Shared Types (FOUNDATION)

**Files:** #1, #2 (incl. v3 / M3 composite index), #2b, #3-#6, #4b (incl.
v3 / S1 BigInt utils), #17, #24 (incl. v3 / M2 + M3 schema rewrites),
#28-#31 (incl. v3 / S2 rate cap), #27b, #40-#46.

No user-visible feature. Gate: `npx prisma migrate dev` succeeds + `tsc -b`
clean + translation parity + `PERMISSION_MATRIX` lints clean.

### PR2 — CRM Basics #127

**Files:** #17 (consumed), #18 (incl. v3 / M3 service-layer clamp + composite
index doc), #19, #20, #21, #22, #23, #24 (consumed), #25, #26, #27 (incl. v3 /
M3 route wire), #64-#74 (incl. v3 NEW_S1 #61b note in PR4 docstring but #74
opt-out toggle still a no-op), #89, #91b (v3 / M2 enforce.js grep edit).

Ships first because lowest blast radius. Wires `lastContactedAt` to existing
share/reminder flows.

**Depends on:** PR1.
**Gate:** `tsc -b` clean + 4 UI states + screenshots for share-log integration.
PATCH `/api/parties/follow-ups?withinDays=400` returns 400. PATCH
`{ lastContactedAt: '1970-01-01' }` returns 400. Pre-commit grep blocks
adding server-only Party fields to input schemas.

### PR3 — Loyalty #125 backend

**Files:** #3-#6 (consumed), #4b (consumed), #7-#16, #14b (v3 / S3 posCheckoutAuth
wire), #16b, #39 (loyalty route mount).

Includes POS checkout / void / restore integration. Cron at 04:15 IST.

**Depends on:** PR1.
**Gate:** integration test forcing a throw mid-checkout asserts no LoyaltyLedger
+ no PosSale + no Document + no stock movement. Curl 200/401/400/403 on each
new route. POS sale POST with `loyalty_redemption` payment by a user lacking
`loyalty.redeem` → 403 PERMISSION_DENIED (NEVER opens the tx). Cron dry-run.
Void/restore symmetry test §12.12.

### PR4 — Loyalty #125 frontend

**Files:** #47-#60, #61 (PartyDetailLoyaltyTab CREATE), #61b (PartyDetailPage
TABS edit), #61c (v3 NEW_S1 — usePartyDetail.ts DetailTab parity), #62, #63, #90.

**Depends on:** PR3.
**Gate:** Visual screenshots. Offline simulation. **Pre-merge grep:**
`git grep "type DetailTab" src/features/parties/` returns matches in BOTH
`PartyDetailPage.tsx` AND `usePartyDetail.ts` with `'loyalty'` present (OR a
single import in both from the shared types file, with the type definition
in `party.types.ts`).

### PR5 — Commission #128 backend

**Files:** #28-#31 (consumed), #32-#39 (commission portions), #27c (v3 / M5
factory middleware).

**Depends on:** PR3 (MUST rebase per v3 / S4 — see top-of-section callout) + PR1.
**Gate:**
- Integration test: POS sale rings → CommissionLedger row written + ruleSnapshot
  is a deep clone (assert via `JSON.stringify(deepClone) === JSON.stringify(originalRule)`
  AND `deepClone !== originalRule` — i.e. structural-equal but reference-unequal).
- §17.3 grep test: `git grep -n "JSON.parse(JSON.stringify"
  server/src/services/commission/commission-accrual.service.ts` → ≥ 2 matches
  (accrue + void re-snapshot + restore re-snapshot).
- §17.3 cross-tenant test: `GET /api/commission/ledger?staffUserId=<other_tenant_user_uuid>`
  → 404 STAFF_NOT_FOUND (NOT 200, NOT 403).
- §17.3 factory grep: `git grep -n "commissionLedgerAuth\|res.headersSent"
  server/src/routes/commission.routes.ts` → factory imported and used;
  `res.headersSent` absent.
- §17.3 rate-cap test: `POST /api/commission/rules` with `rateBps: 15000`
  → 400 `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`.
- §17.3 PR3+PR5 same-file rebase test: `git grep -n
  "applyRedemption\|restoreForPosSale" server/src/services/pos/` MUST still
  return the loyalty service calls AFTER PR5 merges.
- Permission tests: 403 when `commission.view` user requests another staff's
  ledger; same-tenant other-staff → 403 (factory denies); cross-tenant → 404
  (handler precheck).
- Day-end report tender breakdown.

### PR6 — Commission #128 frontend

**Files:** #75-#87, #88 (CREATE), #88b, #91. Includes v3 / S2 UI warnings.

**Depends on:** PR5.
**Gate:** Sortable leaderboard. Widget hidden for users without `commission.view`.
Rate form blocks at 100% (server returns `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`),
warns at 50%.

### PR7 — Security audit fixes (re-run)

**Files:** TBD by security agent's re-audit.
**Depends on:** PR1-PR6 merged.
**Output:** `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` Pass-2 with PASS or
CONDITIONAL PASS.

### Dependency graph

```
PR1 ── PR2 ──┐
   │         │
   ├─ PR3 ── PR4 ──┐
   │         │     │
   └─────── PR5 ── PR6 ── PR7
            (MUST rebase on PR3 — v3 / S4)
```

PR3 must merge before PR5 (both edit pos-checkout.service.ts AND
pos-void.service.ts).

---

## 9. Rollout + feature flags

Loyalty and Commission are **owner-opt-in per-business**.

### 9.1 Loyalty flag = `LoyaltyProgram.enabled`

Default `false`. UI gate (frontend) and server gate (services) both
short-circuit.

### 9.2 Commission flag = "any active rule exists"

Default: no rules. Widget hidden when zero AND no rules.

### 9.3 Stage-gated rollout

| Stage | Audience | What | How long |
|-------|----------|------|----------|
| 1. Internal | Sawan's own test business | Enable loyalty + commission rules; ring 10 POS sales; verify ledgers; void+restore a sale | 24h |
| 2. Beta | 5 friendly businesses | Owner-opted-in via demo | 1 week |
| 3. GA | All businesses | Available in `/settings/loyalty` and `/settings/commission` | indefinite |

---

## 10. Telemetry — 9 events total (v2 — adds `*_restored` pair; routed via `analyticsEmit`)

```ts
// server/src/lib/analytics.ts (v2 — M5)
import logger from './logger.js'
export type AnalyticsEvent =
  | 'loyalty_program_enabled'
  | 'loyalty_accrued'
  | 'loyalty_redeemed'
  | 'loyalty_restored'
  | 'commission_rule_created'
  | 'commission_accrued'
  | 'commission_restored'
  | 'crm_tag_filtered'
  | 'crm_followup_set'
export function analyticsEmit(event: AnalyticsEvent, ctx: Record<string, unknown>): void {
  logger.info(`analytics.${event}`, { event, ...ctx })
}
```

Events emitted AFTER originating tx commits — per §3.8 side-effect rule.

| # | Event name | Trigger site | Payload |
|---|-----------|--------------|---------|
| 1 | `loyalty_program_enabled` | `loyalty-program.service.upsertProgram` post-commit | `{ businessId, accrualRateBps, expiryMonths }` |
| 2 | `loyalty_accrued` | `pos-checkout.service.ts` post-commit | `{ businessId, partyId, posSaleId, pointsAccrued }` |
| 3 | `loyalty_redeemed` | same site | `{ businessId, partyId, posSaleId, pointsRedeemed }` |
| 4 | `loyalty_restored` | `pos-void.service.ts` post-commit | `{ businessId, partyId, posSaleId, pointsRestored, restoredBy }` |
| 5 | `commission_rule_created` | `commission-rule.service.createRule` post-commit | `{ businessId, ruleId, scope, mode, rateBps, flatPerUnitPaise }` |
| 6 | `commission_accrued` | `pos-checkout.service.ts` and `document/*` post-commit | `{ businessId, source: 'POS'|'INVOICE', staffUserId, totalCommissionPaise, rulesAppliedCount }` |
| 7 | `commission_restored` | `pos-void.service.ts` post-commit | `{ businessId, posSaleId, staffUserId, restoredCommissionPaise }` |
| 8 | `crm_tag_filtered` | client-side, fired in `TagFilterBar` | `{ businessId, tagName, partyCountResult }` |
| 9 | `crm_followup_set` | server-side `PATCH /api/parties/:id` post-commit | `{ businessId, partyId, daysFromNow, action: 'SET'|'CLEAR' }` |

---

## 11. Open risks for security agent (carried from v2; v3 closes M1-M5)

### 11.1 Money-equivalent integrity

- §4.1 advisory lock — confirmed
- §3.1 step order — confirmed
- §3.2 void reversal — both AC and RD
- §3.4.1 restore reversal — VR rows
- §4.4 cron double-expiry guard
- **v3 / M1 deep-clone snapshot** — §4.2 callout; §17.3 grep test
- Negative-balance attack: hard-reject with `INSUFFICIENT_POINTS`

### 11.2 Commission rule tampering (insider abuse)

- AuditLog on every CREATE/UPDATE/DELETE
- **v3 / S2 rate cap at Zod boundary (10000 bps = 100% hard)**
- Owner-only by default (§6.4)

### 11.3 Cross-tenant leak (v3 / M4 fully addressed)

- businessId scoping on EVERY read
- **v3 / M4 cross-tenant precheck** on `/api/commission/ledger?staffUserId=`
  returns 404 STAFF_NOT_FOUND
- Same pattern applied to `/api/loyalty/balance/:partyId` (Party precheck → 404 PARTY_NOT_FOUND)
- §17.3 oracle test mandated

### 11.4 Walk-in collusion

- Walk-in `isWalkIn` short-circuit
- Sentinel party immutable post-create

### 11.5 Insider grant abuse

- AdminAction audit trail
- No client-facing manual `delta` write API

### 11.6 Mass assignment / forging server-side fields (v3 / M2 NEW)

- **v3 / M2 server-only Party fields** (§3.6): `lastContactedAt`,
  `followUpAt` (path-restricted), `loyaltyPointsCache` (future),
  `loyaltyOptOut` (future) all explicitly omitted from input Zod
  schemas; `.strict()` schemas reject unknown keys; pre-commit grep
  rule in `scripts/enforce.js` (file plan #91b) blocks reintroduction;
  PATCH-rejection acceptance test §17.2.

### 11.7 DoS via unbounded query (v3 / M3 NEW)

- **v3 / M3 `withinDays` capped at 365** at Zod boundary; service-layer
  clamp belt-and-braces; covering composite index
  `(businessId, lastContactedAt, isActive)` in §2.5; boundary
  acceptance test §17.2.

### 11.8 Fragile middleware chain (v3 / M5 NEW)

- **v3 / M5 factory middleware** `commissionLedgerAuth` replaces inline
  `res.headersSent` chain. Single-pass, two terminals. §17.3 grep test
  forbids `res.headersSent` from `commission.routes.ts`.

---

## 12. Acceptance test sketch (verifier turns these into tests)

### 12.1 POS checkout one-rolls-back-all

(unchanged from v2)

### 12.2 Concurrent redemption — no overdraft

(unchanged from v2)

### 12.3 Walk-in does not accrue

(unchanged from v2)

### 12.4 Commission rule specificity

(unchanged from v2)

### 12.5 Commission void reversal

(unchanged from v2)

### 12.6 lastContactedAt auto-update on share

(unchanged from v2)

### 12.7 Follow-up future-only

(unchanged from v2)

### 12.8 Permission gate for cross-staff ledger read (v3 / M4 + M5 augmented)

**Test name:** `commission-ledger.integration.test.ts: factory + cross-tenant precheck`

**Outline:**

```
1. seed Tenant A with userA1 (commission.view) and userA2 (commission.view)
2. seed Tenant B with userB1
3. userA1 GET /api/commission/ledger (no staffUserId)         → 200 own ledger
4. userA1 GET /api/commission/ledger?staffUserId=userA1.id    → 200 own ledger
5. userA1 GET /api/commission/ledger?staffUserId=userA2.id    → 403 (factory denies — needs commission.view_all)
6. userA1 GET /api/commission/ledger?staffUserId=userB1.id    → 404 STAFF_NOT_FOUND (handler precheck, NOT 403)
7. owner (Tenant A, has view_all) GET ?staffUserId=userA2.id  → 200 userA2 ledger
8. owner (Tenant A) GET ?staffUserId=userB1.id                → 404 STAFF_NOT_FOUND (still, even owner can't cross tenants)
```

### 12.9 Cron idempotency

(unchanged from v2)

### 12.10 4 UI states at 320px

(unchanged from v2)

### 12.11 Loyalty unit math (v2 — S2; v3 / S1 — BigInt overflow row added)

```
expect(computePointsEarned(10000, 100)).toBe(1)            // ₹100 at 1% → 1pt
expect(computePointsEarned(99900, 100)).toBe(9)            // ₹999 at 1% → 9pts (floor)
expect(computePointsEarned(0, 100)).toBe(0)
expect(computePointsEarned(10000, 200)).toBe(2)
expect(computePointsEarned(50000, 50)).toBe(2)             // ₹500 at 0.5% → 2.5 → 2

// v3 / S1 — BigInt overflow class
expect(computePointsEarned(1_000_000_000_000, 10_000)).toBe(10_000_000_000)
// 10^12 paise * 10^4 bps = 10^16 — exceeds Number.MAX_SAFE_INTEGER mid-multiply.
// BigInt insurance gives 10^10 points cleanly.
```

### 12.12 Restore symmetry (v2 — M6; v3 / M1 — deep-clone assertion)

**Test name:** `pos-void-restore.integration.test.ts: void-then-restore preserves loyalty + commission AND ledger snapshots are deep-cloned`

**Outline:**

```
1. Ring POS sale: AC=+10 loyalty, +₹20 commission (with ruleSnapshot = ruleConfigA)
2. ASSERT commissionLedger[0].meta.ruleSnapshot !== ruleConfigA (different reference)
   AND   JSON.stringify(...) is equal (structurally identical)
3. Read balances → +10 loyalty, +2000 paise commission
4. ADMIN EDIT rule: change ratePct from 2 → 5 (the M1 attack)
5. ASSERT commissionLedger[0].meta.ruleSnapshot.rateBps STILL = 200 (the deep clone froze the historical value)
6. Void the sale
7. ASSERT void reversal row also has ruleSnapshot.rateBps = 200 (re-snapshot from prior ledger row's snapshot, NOT live rule which now reads 500)
8. Restore the sale
9. ASSERT restore compensating row also has ruleSnapshot.rateBps = 200 (re-snapshot chain unbroken)
10. SUM(commissionPaise) for the staffUserId → +2000 paise (original value, untouched by admin edit)
11. SUM(loyaltyDelta) for the partyId → +10
12. Verify 3 commissionLedger rows (original, void, restore) — each independently snapshotted
13. Verify 3 loyaltyLedger rows (AC, VD, VR)
```

### 12.13 Server-only Party field rejection (v3 / M2)

**Test name:** `parties.routes.integration.test.ts: PATCH rejects server-only field mass-assignment`

**Outline:**

```
1. seed party with lastContactedAt = null
2. PATCH /api/parties/:id  body { name: 'Updated', lastContactedAt: '1970-01-01' }
   → expect 400 ZodError (strict() rejects unknown key 'lastContactedAt')
3. Verify party.name UNCHANGED (entire PATCH rejected, not partial-applied)
4. Verify party.lastContactedAt UNCHANGED (still null)
5. Repeat for: followUpAt: '1970-01-01' (PAST date variant → INVALID_FOLLOWUP_PAST)
6. (Future) Repeat for: loyaltyPointsCache, loyaltyOptOut once columns exist
```

### 12.14 withinDays boundary (v3 / M3)

**Test name:** `party-followups.integration.test.ts: withinDays boundary`

```
- GET /api/parties/follow-ups?withinDays=1     → 200
- GET /api/parties/follow-ups?withinDays=30    → 200 (default, omitted also OK)
- GET /api/parties/follow-ups?withinDays=365   → 200
- GET /api/parties/follow-ups?withinDays=366   → 400 INVALID_WITHIN_DAYS_RANGE
- GET /api/parties/follow-ups?withinDays=0     → 400
- GET /api/parties/follow-ups?withinDays=-1    → 400
- GET /api/parties/follow-ups?withinDays=999999 → 400 (DoS surface killed)
```

### 12.15 Loyalty redeem permission (v3 / S3)

**Test name:** `pos-checkout.integration.test.ts: loyalty.redeem permission required at route layer`

```
1. seed user U with role { permissions: ['pos.read', 'pos.create'] } (NO loyalty.redeem)
2. seed party P with 100 loyalty points
3. POST /api/pos/sales as U body { payments: [{ mode: 'loyalty_redemption', amountPaise: 100, loyaltyPoints: 1, partyId: P.id }] }
   → expect 403 PERMISSION_DENIED (route-layer gate, BEFORE tx opens)
4. ASSERT zero PosSale rows for the businessId (tx never opened)
5. ASSERT zero idempotency rows consumed
6. Repeat with cash-only payments → 200 (no loyalty payment present, gate skipped)
7. Repeat as cashier role (has loyalty.redeem) → 200
```

### 12.16 Loyalty balance/ledger cross-tenant 404 (v4 / NEW_S1 from security Pass-2)

**Test name:** `loyalty-balance.integration.test.ts: cross-tenant partyId returns 404 PARTY_NOT_FOUND`

```
1. seed two tenants T1 (caller) and T2 (victim) with parties P1 (in T1) and P2 (in T2)
2. seed user U in T1 with parties.view permission
3. GET /api/loyalty/balance/{P2.id} as U
   → expect 404 PARTY_NOT_FOUND (NOT 403, NOT 200-empty — kills timing oracle)
4. GET /api/loyalty/ledger/{P2.id} as U
   → expect 404 PARTY_NOT_FOUND
5. GET /api/loyalty/balance/{P1.id} as U
   → expect 200 { totalPaise: <value>, expiringSoonPaise: <value> }
6. ASSERT response time delta between step-3 (cross-tenant) and step-5 (own-tenant)
   is within statistical noise (i.e. both perform the same precheck path) —
   timing-oracle resistance smoke check.
```

### 12.17 loyalty_redemption cross-tenant partyId rejected (v4 / NEW_S2 from security Pass-2)

**Test name:** `pos-checkout.integration.test.ts: loyalty_redemption with cross-tenant partyId rejected pre-tx`

```
1. seed two tenants T1 (caller) and T2 with party P2 (in T2) holding 100 loyalty points
2. seed user U in T1 with cashier role (has pos.create AND loyalty.redeem)
3. POST /api/pos/sales as U body
   { payments: [{ mode: 'loyalty_redemption', amountPaise: 100, loyaltyPoints: 1,
                 partyId: P2.id /* OTHER TENANT */ }] }
   → expect 400 PARTY_NOT_IN_TENANT (validator-layer, BEFORE tx opens)
4. ASSERT zero PosSale rows for T1.businessId
5. ASSERT zero idempotency rows consumed (token not burned)
6. ASSERT P2.loyaltyPointsCache unchanged in T2 (no debit row written)
7. Repeat with a real T1-party partyId having 100 points → 200, normal redemption flow
```

---

## 13. Risks & alternatives considered

(unchanged from v2 except for v3 additions:)

| Risk | What we chose | Alternative we rejected | Why |
|------|---------------|-------------------------|-----|
| **v3 / M1** Admin can rewrite history via mutable ruleSnapshot | Explicit `JSON.parse(JSON.stringify(...))` deep clone INSIDE tx, both at accrue site and at void/restore re-snapshot sites | Store snapshot as encoded string (e.g. `JSON.stringify` once and never parse back until display) | Encoded-string approach loses queryability (`meta.ruleSnapshot.rateBps` filter would require server-side parse). Deep clone keeps JSON queryable while breaking the live-reference link. |
| **v3 / M2** Server-only fields accepted in input schemas | Hand-rolled allow-list with `.strict()` + grep at pre-commit | Prisma `.omit()` from generated type | Allow-list avoids Prisma-type coupling that breaks on every migration; `.strict()` rejects unknown keys outright; grep gives a third line of defence. |
| **v3 / M3** Unbounded `withinDays` DoS | Cap at 365 at Zod boundary + composite covering index + service-layer clamp belt-and-braces | No cap, rely on Postgres query planner | Planner does heap scan once `withinDays > 30`; tested 99999 case locks Render Starter for 5+s. Cap is cheap and aligns with realistic use ("which customers haven't been contacted in the last year"). |
| **v3 / M4** Cross-tenant `staffUserId` 200-empty/403 oracle | Explicit precheck → 404 STAFF_NOT_FOUND | 200-empty (current state) or 403 (intuitive but leaky) | Both 200-empty and 403 leak existence + tenant boundary via response shape + timing. 404 collapses both into "indistinguishable from non-existent". Same UUID enumeration defence used by GitHub / Stripe. |
| **v3 / M5** Fragile inline `res.headersSent` chain | Factory middleware with single-pass and two terminals | Move check into handler (option B in v2 audit) | Factory keeps the auth concern in middleware layer (testable in isolation, reusable for future similar endpoints); handler stays focused on data orchestration. |
| **v3 / S1** Point/paise math overflow on whales | `BigInt` cross-multiplication in `loyalty.utils.ts` AND `pos.validators.ts` superRefine | Number-only math + comment | Whales (Rs 10 Cr single sale) cross 2^53 mid-multiply; one line of BigInt insurance is universally cheap and removes the failure class. |
| **v3 / S2** Rate cap location ambiguity | Zod `rateBps.max(10000)` at schema layer | Service-layer cap | Service-layer caps run after Zod parse; if Zod accepts 50000, service-layer rejection wastes a round-trip and risks a future code path that misses the check. Schema-layer is the choke point. |
| **v3 / S3** Implicit loyalty.redeem via seed-data assumption | Explicit `posCheckoutAuth` route-layer middleware that requires `loyalty.redeem` whenever payments include `loyalty_redemption` | Service-layer permission check inside checkout | Service-layer check means the tx opens, idempotency consumed, then 403 — wastes resources and obscures the security boundary. Route-layer gate is the standard HisaabPro pattern. |
| **v3 / S4** PR3+PR5 same-file silent overwrite | PR5 rebase contract in §8 + grep-test post-merge | PR3+PR5 ordered serial merge | Ordering doesn't prevent rebase-less merge; explicit rebase rule + post-merge grep test is the durable safeguard. |

---

## 14. Future-known risks (forward-compat notes)

(unchanged from v2)

---

## 15. Security agent hand-off

**v3 revision summary for security re-audit:**

All 5 MUST_FIX items from
`docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md` are folded into this v3 design
contract. Re-audit focus:

1. **M1 deep clone (§4.2):** confirm `commission-accrual.service.ts` has
   `JSON.parse(JSON.stringify(...))` at the accrual call site AND
   re-snapshots the prior ledger row's `meta.ruleSnapshot` (NOT the
   live rule) at the void and restore sites.
2. **M2 server-only fields (§3.6):** confirm `party.schemas.ts` uses
   either Pattern A (`.omit`) or Pattern B (allow-list with `.strict()`)
   — preferred Pattern B. Confirm grep rule in `scripts/enforce.js`
   (#91b) blocks `lastContactedAt|loyaltyPointsCache|loyaltyOptOut` in
   the schema file. Confirm test 12.13.
3. **M3 withinDays cap (§3.5):** confirm `followUpsQuerySchema` has
   `.max(365)`; confirm service-layer clamp; confirm composite index
   in §2.5. Confirm test 12.14.
4. **M4 cross-tenant precheck (§6.3):** confirm
   `commission-ledger.routes.ts` handler does the `prisma.businessUser.findFirst`
   precheck BEFORE the ledger query and returns 404 STAFF_NOT_FOUND
   (not 200, not 403). Confirm test 12.8 step 6.
5. **M5 factory middleware (§6.3):** confirm `commission-ledger-auth.ts`
   exists (file plan #27c); confirm route uses it; confirm `res.headersSent`
   absent from `commission.routes.ts`.

SHOULD_FIX (4): S1 BigInt cross-multiply, S2 rate cap location, S3
`loyalty.redeem` route middleware, S4 PR3+PR5 rebase contract — all
encoded in §3.1, §3.5, §6.1, §6.3, §8.

NICE_TO_HAVE (2) deferred to future epic per audit recommendation.

**Specific files to lint for v3:**

(unchanged from v2 list + 3 new files added by v3:)
14. `server/src/middleware/commission-ledger-auth.ts` (NEW v3 — M5
    factory middleware) — confirm two-terminal pattern, no `headersSent`.
15. `server/src/schemas/party.schemas.ts` (v3 — M2 + M3) — confirm
    allow-list pattern; confirm server-only fields absent; confirm
    `followUpsQuerySchema.max(365)`.
16. `server/src/routes/commission.routes.ts` (v3 — M4 + M5) — confirm
    factory used; confirm cross-tenant precheck; confirm 404 not 200/403.

---

## 16. Acceptance gates (taken into design-plan-active.md)

### Backend

(v2 list +) v3 acceptance:
- M1: `git grep -n "JSON.parse(JSON.stringify"
  server/src/services/commission/commission-accrual.service.ts` returns ≥ 2 matches
- M2: pre-commit grep blocks server-only Party fields in input schemas
- M3: `GET /api/parties/follow-ups?withinDays=400` → 400; `=365` → 200
- M4: `GET /api/commission/ledger?staffUserId=<other_tenant_user>` → 404 STAFF_NOT_FOUND
- M5: `git grep -n "commissionLedgerAuth\|res.headersSent" server/src/routes/commission.routes.ts`
  — factory present, headersSent absent
- S1: `computePointsEarned(1_000_000_000_000, 10_000) === 10_000_000_000` test passes
- S2: `POST /api/commission/rules` with `rateBps: 15000` → 400
  `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT`
- S3: POS POST with `loyalty_redemption` by user lacking `loyalty.redeem`
  → 403 PERMISSION_DENIED (BEFORE tx opens; verify zero PosSale rows)
- S4: post-PR5-merge grep test confirms loyalty calls still present in `pos/`

### Frontend

(v2 list unchanged)

---

## 17. Gate for build (v3 / per-PR contract with new MUST acceptance lines)

This document plus the SCOPE (with §19 Locked Decisions) are the input to
the security agent re-run. Once `docs/SECURITY_AUDIT_EPIC_D_crm_loyalty.md`
Pass-2 is produced (PASS or CONDITIONAL PASS), the task-manager runs to
seed `.claude/design-plan-active.md`.

### 17.1 Loyalty #125 — per-PR

- [ ] `GET /api/loyalty/program` returns `null` for businesses with no program
- [ ] `PUT /api/loyalty/program` rejects negative rates
- [ ] `LoyaltyLedger` row written inside the SAME `$transaction` as `PosSale`
- [ ] Redemption uses FIFO oldest-AC-first
- [ ] Expiry cron writes EX rows for entries where `expiresAt < now`
- [ ] Walk-in party does NOT accrue points
- [ ] `GET /api/loyalty/balance/:partyId` honors `cacheReads: true`
- [ ] Loyalty UI page passes 4 UI states at 320px
- [ ] `loyalty_redemption` is **lowercase** in every wire-format and DB row (v2 — M2)
- [ ] Restore reverses negation rows symmetrically (v2 — M6 / test 12.12)
- [ ] Cron registered at **04:15 IST** in `cron-scheduler.ts` (v2 — M1)
- [ ] **(v3 / S1)** `computePointsEarned` uses `BigInt` mult in `loyalty.utils.ts`;
      `pos.validators.ts` superRefine uses BigInt cross-multiply
      (test 12.11 BigInt row passes)
- [ ] **(v3 / S3)** POST `/api/pos/sales` body with `payments[].mode === 'loyalty_redemption'`
      by user lacking `loyalty.redeem` → 403 `PERMISSION_DENIED` AT ROUTE LAYER
      (NOT inside the tx). `posCheckoutAuth` middleware mounted in `pos-sales.ts:62`
      between `auth` and `requireIdempotencyKey` per #14b (test 12.15 passes;
      grep `pos-sales.ts` for `posCheckoutAuth` returns 1+ match in PR7 QA;
      existing `requirePermission('pos.create')` and `idempotencyCheck()` preserved
      after the new middleware)
- [ ] **(v4 / NEW_S1 from security Pass-2)** GET `/api/loyalty/balance/:partyId`
      and GET `/api/loyalty/ledger/:partyId` with cross-tenant `partyId` return
      404 `PARTY_NOT_FOUND` (NOT 403, NOT 200-empty — kills the timing-oracle
      enumeration vector exactly as M4 does for staffUserId). Pre-tx
      `party.findFirst({ where: { id, businessId: req.user.businessId } })`
      returns null → 404. Integration test added in §12 (new row 12.16).
- [ ] **(v4 / NEW_S2 from security Pass-2)** POST `/api/pos/sales` with
      `payments[].mode === 'loyalty_redemption'` AND `partyId` referencing a
      party in another tenant returns 400 `PARTY_NOT_IN_TENANT` BEFORE the tx
      opens (validator-layer check inside `posCheckoutAuth` or
      `pos.validators.ts` superRefine). Idempotency token NOT consumed.
      Integration test added in §12 (new row 12.17).

### 17.2 CRM #127 — per-PR

- [ ] `GET /api/parties?tag=vip` returns only matching parties
- [ ] `GET /api/parties/tags` returns aggregated tags with counts
- [ ] `GET /api/parties/follow-ups?withinDays=7` returns parties where
      `followUpAt <= now + 7d AND followUpAt IS NOT NULL`
- [ ] Sharing an invoice triggers `lastContactedAt = now()`
- [ ] `PATCH /api/parties/:id` with past `followUpAt` returns 400 `INVALID_FOLLOWUP_PAST`
- [ ] FollowUpsPage 4 UI states pass at 320px
- [ ] TagFilterBar handles 0-tag / 1-tag / 50-tag states
- [ ] All 5 FE edits target **real** worktree files (v2 — M3)
- [ ] **(v3 / M2)** PATCH `/api/parties/:id` body `{ lastContactedAt: '1970-01-01' }`
      returns 400 ZodError; party.lastContactedAt UNCHANGED (test 12.13 passes)
- [ ] **(v3 / M2)** Pre-commit grep blocks `lastContactedAt|loyaltyPointsCache|loyaltyOptOut`
      in `server/src/schemas/party.schemas.ts` (scripts/enforce.js rule #91b)
- [ ] **(v3 / M2)** Input schemas use `.strict()` (allow-list Pattern B preferred)
- [ ] **(v3 / M3)** `GET /api/parties/follow-ups?withinDays=400` → 400
      `INVALID_WITHIN_DAYS_RANGE`; `?withinDays=365` → 200 (test 12.14 passes)
- [ ] **(v3 / M3)** Migration adds composite index
      `idx_party_business_lastcontact_active` per §2.5

### 17.3 Commission #128 — per-PR

- [ ] `POST /api/commission/rules` creates rule
- [ ] CommissionLedger row written inside SAME `$transaction` as POS sale / invoice
- [ ] PRODUCT > CATEGORY > ALL rule specificity (test 12.4)
- [ ] Voiding writes a NEGATIVE commission row (sum nets to 0)
- [ ] **Restoring** writes a COMPENSATING commission row (sum returns to original)
      (v2 — M6)
- [ ] `GET /api/commission/ledger?staffUserId=X` returns 403 when caller has
      `commission.view` but is not staffUserId X AND X is same-tenant
- [ ] `GET /api/commission/leaderboard` returns 403 without `commission.view_all`
- [ ] Staff widget hidden when user lacks `commission.view`
- [ ] All 4 UI states pass on CommissionSettingsPage, CommissionLedgerPage, LeaderboardPage
- [ ] Permission keys in `PERMISSION_MATRIX` per §6.4 (v2 — S1, S5)
- [ ] Day-end report shows `loyalty_redemption` as own tender line (v2 — S3)
- [ ] Analytics emits via `analyticsEmit(...)` — NOT `notificationManager.notify` (v2 — M5)
- [ ] **(v3 / M1)** `commission-accrual.service.ts` calls
      `JSON.parse(JSON.stringify(...))` at ledger.create site. Grep test:
      `git grep -n "JSON.parse(JSON.stringify" server/src/services/commission/commission-accrual.service.ts`
      → ≥ 2 matches (accrue + re-snapshot in void/restore)
- [ ] **(v3 / M1)** Test 12.12 step 5: admin-editing the rule mid-flight does NOT
      change historical ledger rows' `meta.ruleSnapshot.rateBps`
- [ ] **(v3 / M4)** `GET /api/commission/ledger?staffUserId=<other_tenant_user_uuid>`
      returns **404 STAFF_NOT_FOUND** (NOT 200-empty rows, NOT 403)
      (test 12.8 step 6)
- [ ] **(v3 / M4)** Same-tenant precheck not bypassed for owners — owner
      requesting other-tenant user's UUID still gets 404 (test 12.8 step 8)
- [ ] **(v3 / M5)** `server/src/middleware/commission-ledger-auth.ts` exists
      (file plan #27c)
- [ ] **(v3 / M5)** `git grep -n "commissionLedgerAuth\|res.headersSent"
      server/src/routes/commission.routes.ts` — factory imported AND used;
      `res.headersSent` MUST NOT appear
- [ ] **(v3 / S2)** `POST /api/commission/rules` with `rateBps: 15000`
      → 400 `COMMISSION_RATE_EXCEEDS_MAX_100_PERCENT` (Zod-boundary cap)
- [ ] **(v3 / S2)** FE CommissionRuleForm shows warning at 5000 bps (50%)
      and hard-blocks save at 10000 bps (100%)
- [ ] **(v3 / S4)** Post-PR5-merge: `git grep -n "applyRedemption\|restoreForPosSale"
      server/src/services/pos/` STILL returns the loyalty service calls.
      (If empty, PR5 silently overwrote PR3 — block merge.)

---

**End of architecture (v3).**
