# HisaabPro — Billing & Subscription Architecture

> **Status:** DRAFT v2 — specification for `/start-epic subscription-ssot-and-global-billing`
> **Created:** 2026-07-26 · **Author:** Sawan (with Claude)
> **Supersedes:** ad-hoc Razorpay coupling across schema, checkout-session, coupons, addons
> **Required readers:** `architect` (produces ARCHITECTURE.md against this) ·
> `architecture-auditor` (attacks it) · `security` · `task-manager`
>
> This is the **specification** — invariants, contracts, failure modes, and the
> evidence behind each claim. The architect turns it into a module graph and
> migration sequence. Every load-bearing assertion about the current codebase
> cites a file:line so the auditor can verify rather than trust.

---

## §0 — TL;DR for the architect

**The problem is not "which gateway."** It is that a subscriber's price
currently lives in four places, none of which is authoritative, and one of
which is another company's database.

**The fix, in one sentence:** one immutable versioned price table, one ledger of
money attempted, and one provider interface whose only verb is *"charge this
mandate for an amount I give you now."*

Eight decisions, all litigable:

| | Decision | Confidence |
|---|---|---|
| D1 | India = **Cashfree On-Demand**; global = **Stripe**; Razorpay demoted to a second India driver behind the same port | high |
| D2 | **No provider plan objects, ever, on any rail.** No `createPlan` in the port | high — this is the epic |
| D3 | Mandate ceiling = **3× monthly** for INR monthly plans, 2× elsewhere, disclosed at consent | **medium — product call; raised from 2× because of D4** |
| D4 | Price is **policy-driven**, not pinned. Default `FOLLOW_CURRENT_PRICE`; `PRICE_LOCK` / `CONTRACT_PRICE` available per subscription | high — **revised v3, see §7** |
| D5 | **Reject** Cashfree Periodic + `CHANGE_PLAN` despite it being less code | **medium — attack this hardest** |
| D6 | Discounts computed **in our code**; provider offer objects abolished | high |
| D7 | Entitlement **fails closed to FREE after 72h offline**, not LOCKED | **medium — product call** |
| D8 | US/UK domestic tax is a **separate epic**, explicitly out of scope | high |
| D9 | **Pricing Engine and Billing Engine are separate modules.** "What does it cost" ≠ "when do we charge" | high — **new v3** |
| D10 | **`BillingProfile` per business** owns country, currency, tax regime, provider, pricing policy. Subscription owns none of it | high — **new v3** |
| D11 | Jurisdiction is **verified and locked**, never self-declared, with a recorded `verificationSource` | high — **new v3** |

**Effort:** ~28 new files, ~3,600 lines, plus contract + property suites.
**Longest lead item is not code** — it is gateway recurring-payments activation
(§4, B2). File those tickets today.

---

## §1 — Current-state audit (evidence)

Not hypothetical. This is what is in the repo right now.

### 1.1 A subscriber's price lives in four places

| # | Location | Evidence |
|---|---|---|
| 1 | Server hardcoded map | `server/src/services/subscription/checkout-session.service.ts:174-175` — `PRO_MAX_MONTHLY: 199900, PRO_MAX_YEARLY: 1999900` |
| 2 | Client hardcoded map | `src/features/subscription/subscription.constants.ts:24` — `PRO_MAX: 199900, // Rs 1,999/mo` |
| 3 | **Razorpay plan object** | `Subscription.razorpayPlanId` (`schema.prisma`) |
| 4 | **Razorpay offer object** | `Coupon.razorpayOfferId` (`schema.prisma`) — the *discount* is mirrored too |

Locations 1 and 2 drift on any edit that misses one. Locations 3 and 4 are in
another company's database and cannot be changed for existing subscribers.
**This is DudhHisaab's failure, already present, before a single paying
customer.**

### 1.2 Provider identity is welded into six models

`Subscription.razorpaySubId` · `Subscription.razorpayPlanId` ·
`Subscription.lastWebhookEventId` · `Subscription.paymentMethod` (enum contains
the literal `'RAZORPAY'`, conflating *method* with *vendor*) ·
`UpiMandate.razorpayMandateId` · `UpiMandate.razorpayTokenId` ·
`SubscriptionEvent.razorpayEventId` · `BusinessAddon.razorpaySubId` ·
`Coupon.razorpayOfferId` · `PaymentLink.razorpayLinkId`.

### 1.3 There is no money ledger

No `PaymentAttempt`, no `Charge`, no `SettlementRecord`.
(`ReconciliationMatch` and `InvoiceTemplate` belong to the *customer-facing*
invoicing feature and are unrelated.) MRR is therefore uncomputable, and there
is no way to prove the gateway paid us what it owed.

### 1.4 No currency anywhere in billing

Every amount is implicitly INR paise. `Mandate.maxAmountPaise` bakes the
currency into the column name. Global is blocked at the schema.

### 1.5 What is already good — do not rewrite

Genuinely better than most production billing code; the epic builds *under* it:

- `subscription-state-machine.ts` — 19 explicit transitions, **pure, no I/O, no Prisma**
- `subscription.types.ts` — 7 states, typed triggers, typed side-effects
- `SubscriptionEvent.razorpayEventId @unique` (sparse) — correct idempotency primitive
- `entitlement-jwt.service.ts` — RS256, `trustedTime` claim for clock-rewind detection
- `UpiMandate.vpaLast4` — correct PII masking
- `checkout-session.service.ts:32` — coupon→offer resolver already refuses to
  forward user input as an offer id (money-out defence). Keep the *defence*; delete the *mirror*.
- Integer paise throughout — no float money

---

## §2 — First principles

Nine invariants. Each is testable; each has a mechanical guard in §19.

| # | Invariant | Violation looks like |
|---|---|---|
| **I1** | The gateway moves money. It never holds truth. | Reading price/entitlement/status back from a provider |
| **I2** | Price exists in exactly one system: our `PriceVersion` table. | A `createPlan()` call; any `*PlanId` column; a price literal in a service |
| **I3** | Price rows are immutable. A change is a new version. | `UPDATE price_version SET amount_minor` |
| **I10** | **What a subscriber pays is a pure function of (policy, catalog, profile, date) — evaluated fresh, recorded per charge.** | A price copied onto the subscription row; a charge whose price cannot be re-derived from its inputs |
| **I11** | **A price increase reaches a subscriber only after notice, and only within their mandate ceiling.** | A silent increase; a rise that fails at the rail instead of triggering re-mandate |
| **I4** | Every rupee attempted is a row **before** the network call. | Recording only on success |
| **I5** | Idempotency keys are ours, deterministic, never the provider's. | A retry producing two debits |
| **I6** | Entitlement derives from our state machine only. | Granting access on HTTP 200 from a gateway |
| **I7** | A charge above the ceiling fails in our code, before the network. | A ceiling breach returning as a generic decline |
| **I8** | Discounts are computed by us; the provider is told a final amount. | A provider offer/coupon object |
| **I9** | Money is `(integer minorUnits, currency)`. Never a float, never bare. | `amount: 19.99`; an amount without a currency |

**I7 is the one people miss.** No gateway on earth — Cashfree, Razorpay,
Stripe, or NPCI — permits raising a mandate's maximum amount after
authorization. The ceiling is a one-shot, permanent, per-subscriber decision,
and it is the *only* pricing agility that will ever exist for that subscriber.

---

## §3 — Layer map

```
┌───────────────────────────────────────────────────────────────┐
│ L6  Entitlement    entitlement-jwt · offline policy (§13)     │  ✅ / ⚠️
├───────────────────────────────────────────────────────────────┤
│ L5  State machine  19 transitions, pure, no I/O               │  ✅ exists
├───────────────────────────────────────────────────────────────┤
│ L4b PRICING ENGINE  "what does it cost?"          PURE        │  ❌ MISSING
│     policy · catalog · profile · promo · date → PriceDecision │
├───────────────────────────────────────────────────────────────┤
│ L4a BILLING ENGINE  "when do we charge, and did it work?"     │  ⚠️ partial
│     scheduler · dunning · pre-debit · proration · re-mandate  │
├───────────────────────────────────────────────────────────────┤
│ L3  Money ledger   PaymentAttempt · SettlementRecord · recon   │  ❌ MISSING
├───────────────────────────────────────────────────────────────┤
│ L2  Profile        BillingProfile — country · currency · tax  │  ❌ MISSING
│                    · provider · pricing policy (§6.4)          │
├───────────────────────────────────────────────────────────────┤
│ ══  PORT          BillingProvider — one interface              │  ❌ MISSING
├───────────────────────────────────────────────────────────────┤
│ L1  Drivers       cashfree · stripe · razorpay · fake          │  ❌ MISSING
└───────────────────────────────────────────────────────────────┘
```

**D9 — the Pricing Engine and the Billing Engine are separate modules.** They
answer different questions and fail in different ways:

|  | Pricing Engine (L4b) | Billing Engine (L4a) |
|---|---|---|
| Question | *"What does this cost today?"* | *"Charge it, and did it work?"* |
| Nature | **Pure.** No I/O, no clock, no Prisma — `today` is an argument | Impure by definition: network, DB, time |
| Failure mode | Wrong amount — silent, systemic, affects everyone | Failed charge — loud, per-subscriber |
| Testability | Exhaustive table-driven unit tests | Integration + property tests |

Mixing them is how billing systems become unauditable: once "what it costs" can
only be discovered by attempting a charge, you can no longer answer a customer's
*"why was I charged this?"* without replaying production.

**Nothing above the port may import a driver, a provider SDK, or a
provider-named symbol.** Guard G1, §19. **The Pricing Engine may not import
Prisma or the clock.** Guard G9.

---

## §4 — The port

### 4.1 The one primitive we buy

Do not buy a "subscription product." Buy exactly one primitive, which every
serious gateway offers under a different name:

> **Charge this stored mandate, off-session, for an amount I specify at call time.**

| Provider | Their name for it |
|---|---|
| Cashfree | On-Demand subscription → *Raise Payment* |
| Razorpay | charge-at-will / S2S recurring |
| Stripe | `PaymentIntent` + `off_session: true` + saved PM |
| GoCardless | ad-hoc payment against a mandate |

Four gateways, two regulatory regimes, one primitive. That symmetry is what
makes global expansion a driver file rather than a project.

### 4.2 Interface

```ts
// server/src/services/billing/billing-provider.port.ts   ← THE SSOT
export type ProviderId = 'cashfree' | 'stripe' | 'razorpay' | 'fake'
export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'SAR'
export type Rail =
  | 'UPI_AUTOPAY' | 'ENACH'        // India
  | 'CARD' | 'SEPA_DD' | 'ACH'     // global

export type ChargeState = 'CAPTURED' | 'PENDING' | 'FAILED'

/** Normalized across every driver. Drives the dunning ladder (§11). */
export type FailureCode =
  | 'INSUFFICIENT_FUNDS'   // retryable
  | 'TECHNICAL'            // retryable
  | 'MANDATE_REVOKED'      // terminal
  | 'MANDATE_PAUSED'       // terminal until resumed
  | 'MANDATE_EXPIRED'      // terminal → renewal flow (§9.3)
  | 'CEILING_EXCEEDED'     // must never reach a driver (I7)
  | 'AUTH_REQUIRED'        // needs on-session SCA (EU cards)
  | 'UNKNOWN'

export interface MandateRef {
  provider: ProviderId
  providerId: string            // opaque; never parsed
  providerRef?: string | null   // token/PM id where the rail splits the two
}

export interface BillingProvider {
  readonly id: ProviderId
  readonly rails: readonly Rail[]
  readonly currencies: readonly Currency[]

  // ── mandate lifecycle ──────────────────────────────────────────────
  /** Returns the ceiling the RAIL actually granted — may be < requested. */
  createMandate(i: CreateMandateInput): Promise<CreatedMandate>
  fetchMandate(ref: MandateRef): Promise<RemoteMandateState>
  revokeMandate(ref: MandateRef): Promise<void>

  // ── the one verb that matters ──────────────────────────────────────
  chargeOffSession(i: {
    mandate: MandateRef
    amountMinor: number         // integer minor units, post-discount (I8)
    currency: Currency
    idempotencyKey: string      // OURS (§8.3)
    descriptor: string          // bank-statement text
  }): Promise<{
    state: ChargeState
    providerChargeId: string
    failureCode?: FailureCode
    rawStatus: string           // logged, never branched on
  }>

  /** Resolve an attempt whose response we never saw (§10.4). */
  fetchCharge(providerChargeId: string): Promise<{
    state: ChargeState; failureCode?: FailureCode; rawStatus: string
  }>

  // ── compliance, where the rail requires it ─────────────────────────
  /** NPCI mandates T-24h pre-debit notice. Absent on Stripe drivers. */
  sendPreDebitNotice?(i: PreDebitInput): Promise<{ sentAt: Date }>

  refund(i: { providerChargeId: string; amountMinor: number
              idempotencyKey: string; reason: string }): Promise<RefundResult>

  // ── inbound ────────────────────────────────────────────────────────
  /** Verify signature on RAW bytes, then normalize. null = ignore. */
  parseWebhook(raw: Buffer, headers: Record<string, string>): ProviderEvent | null

  /** Daily settlement file → reconciliation input (§12). */
  fetchSettlements?(dateISO: string): Promise<SettlementLine[]>
}
```

### 4.3 What is deliberately absent

**No `createPlan`. No `createOffer`. No `createCoupon`.**

That absence *is* the architecture. Those three methods are the doors through
which DudhHisaab's price, and HisaabPro's current coupon discounts, escaped
into someone else's database. A driver that needs a plan object in order to
charge is a driver we do not use.

### 4.4 Rail routing

Derived, never stored on the business:

```ts
// billing-router.ts — pure, ~40 lines, exhaustively unit-tested
INR                          → cashfree  (UPI_AUTOPAY, fallback ENACH)
USD | GBP | EUR | AED | SAR  → stripe    (CARD, SEPA_DD, ACH)
```

Razorpay is implemented as a **second India driver**. It is *not* a pricing
fallback — it cannot update UPI subscriptions at all. It is a **liquidity**
fallback for Cashfree outage or onboarding refusal. Because it sits behind the
same port and is never asked to remember a price, its update limitation is
irrelevant to us. That is the point of the port.

---

## §5 — Gateway decision & the steelman against it

| Region | Provider | Product | Why |
|---|---|---|---|
| India | **Cashfree** | On-Demand + Raise Payment | No plan objects ⇒ *structurally cannot* mirror our catalog. Variable amount per charge up to `plan_max_amount` |
| Global | **Stripe** | Off-session PaymentIntent on saved PM | Same primitive; broadest currency/rail coverage; strongest idempotency semantics |
| India fallback | Razorpay | charge-at-will | Same port; config flip, not a migration |

### 5.1 Steelman for the rejected option (D5)

Honest case **for** Cashfree Periodic + `CHANGE_PLAN`, which we are rejecting:

- Cashfree owns the schedule, retries, dunning, and pre-debit notices — that is
  §10 + §11, roughly **600 lines and the hardest correctness surface in the epic**
- `CHANGE_PLAN` genuinely reprices an existing subscription (verified against
  the `2025-01-01` manage-subscription schema)
- Fewer moving parts we can get wrong; their scheduler is battle-tested and ours is not
- We inherit their rail-level retry intelligence, which we cannot replicate

### 5.2 Why we reject it anyway

Periodic requires **a Cashfree plan object per price point**. Our pricing
catalog would then have an external mirror that must be reconciled on every
change — which is precisely `razorpayPlanId`, the thing this epic exists to
delete. Choosing it would be choosing the known failure mode on purpose, in a
new vendor's namespace.

Two supporting facts, both from primary docs:
`CHANGE_PLAN` is *"not supported for On-Demand"* and its charge *"cannot exceed
the maximum amount defined in the original plan"* — so **even Periodic does not
escape the ceiling** (§9); and it carries *"Customers won't be notified about
plan changes"* — so notification is ours on either path, which we owe anyway
under NPCI and consumer law. Periodic buys a scheduler, not an escape from the
hard parts.

**This is the single most important decision in the document. The auditor
should attack it first.** If it is wrong, the epic halves in size.

### 5.3 Blocking external unknowns

| ID | Item | Why it blocks |
|---|---|---|
| **B1** | Cashfree *Controlled Notification* / *Controlled Execution* semantics | If these are the NPCI T-24h pre-debit primitives, Cashfree owns the compliance machinery and we own only scheduling + retries. **Changes service count.** Verify before the architect runs |
| **B2** | Recurring-payments activation lead time, Cashfree + Stripe | Both require a support request. **No published SLA** — the widely-cited "25–30 business days" has no primary source and is retracted (§22). Plausibly the longest-lead item in the whole epic. **File both tickets today, in parallel with build** |
| **B3** | Diaspora+Gulf vs US/UK domestic SMB | Blocks §16.2 scope only. Everything else is scopable now |
| **B4** | Effective MDR per rail (UPI Autopay, cards, SEPA/ACH) | Affects unit economics and possibly the price points themselves. **No number asserted here — get it from the commercial term sheets, not from documentation** |

---

## §6 — Data model

### 6.1 Neutralize what exists

Zero production mandates exist. These renames are free today and expensive the
moment a real mandate lands.

| Current | Change | Reason |
|---|---|---|
| `Subscription.razorpaySubId` | → `providerRef String?` | Provider in the name |
| **`Subscription.razorpayPlanId`** | **DROP** | I2 — the DudhHisaab failure verbatim |
| `Subscription.paymentMethod = 'RAZORPAY'` | split → `rail: Rail` + `provider: ProviderId` | Conflates method with vendor |
| `Subscription.lastWebhookEventId` | → `lastProviderEventId` | Naming |
| `model UpiMandate` | → `model Mandate` + `rail: Rail` | India-only concept in a global type |
| `Mandate.razorpayMandateId/TokenId` | → `providerId` + `providerRef` | Naming |
| `Mandate.maxAmountPaise` | → `ceilingMinor Int` + `currency` | I9 |
| `SubscriptionEvent.razorpayEventId` | → `providerEventId` | Keep the sparse `@unique` — it is correct |
| **`Coupon.razorpayOfferId`** | **DROP** | I8 — discounts computed by us (§7.3) |
| `BusinessAddon.razorpaySubId` | → `providerRef` | Naming |
| `PaymentMethod` TS union incl. `'RAZORPAY'` | replace with `Rail` | Same conflation in TS |
| *(absent)* | **ADD `currency` to every money-bearing row** | I9 — blocks global |

Keep unchanged: the 7 subscription states, the 19 transitions, `SubscriptionEvent`
as append-only, `vpaLast4`, integer minor units, the entitlement JWT claim shape.

### 6.2 New — the money ledger

`SubscriptionEvent` is an event log; it answers *"what happened to this
subscription."* It cannot answer *"how much did we attempt to collect in June,
how much settled, and how much is in flight."* Different question, different table.

```prisma
/// Append-only. One row per charge ATTEMPT, written BEFORE the network call (I4).
model PaymentAttempt {
  id             String    @id @default(cuid())
  businessId     String
  subscriptionId String
  mandateId      String?
  priceVersionId String?                       // what we believed the price was
  couponId       String?                       // discount actually applied
  periodStart    DateTime                      // billing period this pays for
  periodEnd      DateTime

  grossMinor     Int                           // catalog price after policy (§7)
  discountMinor  Int       @default(0)         // computed by us (I8)
  taxMinor       Int       @default(0)         // GST/VAT on the subscription (§15)
  amountMinor    Int                           // what we actually charge
  currency       String
  idempotencyKey String    @unique             // OURS (§8.3)

  // ── pricing provenance (I10) — why this amount, forever ──────
  policyApplied  String                        // PricingPolicy at evaluation time
  priceReason    String                        // PriceDecision.reason, human-readable
  noticeSentAt   DateTime?                     // required when this was an increase (I11)

  state          String    @default("CREATED") // CREATED|PENDING|CAPTURED|FAILED|REFUNDED
  attemptNo      Int       @default(1)         // dunning ladder position
  failureCode    String?                       // normalized FailureCode
  rawStatus      String?                       // provider status STRING only — no PII

  provider          String
  providerChargeId  String?   @unique
  settledAt         DateTime?                  // when money actually landed
  settlementId      String?
  invoiceId         String?                    // GST invoice issued (§15)

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([subscriptionId, periodStart, attemptNo])   // structural anti-double-charge
  @@index([businessId, createdAt])
  @@index([state, createdAt])                          // in-flight sweep
  @@index([settlementId])
}

/// One row per provider settlement line. Reconciliation input (§12).
model SettlementRecord {
  id                   String   @id @default(cuid())
  provider             String
  providerSettlementId String
  settledOn            DateTime
  grossMinor           Int
  feeMinor             Int
  taxMinor             Int
  netMinor             Int
  currency             String
  matchedAttempts      Int      @default(0)
  unmatchedMinor       Int      @default(0)     // > 0 ⇒ alert
  raw                  Json     @default("{}")
  createdAt            DateTime @default(now())

  @@unique([provider, providerSettlementId])
  @@index([settledOn])
}
```

`state` is **forward-only**: `CREATED → PENDING → CAPTURED | FAILED`, and
`CAPTURED → REFUNDED`. Enforced in the writer; property-tested under arbitrary
event permutations (§19.3).

**Why `CREATED` precedes the network call:** if the process dies between the
API call and the response, a row written only on success means an *untracked
debit* — real money moved and we have no record. With it, the in-flight sweep
(§10.4) finds the orphan and resolves it via `fetchCharge`.

The `@@unique([subscriptionId, periodStart, attemptNo])` makes double-charging
a **database error**, not a code-review outcome. Belt to §8.3's braces.

### 6.3 New — versioned price catalog

```prisma
/// IMMUTABLE. A price change inserts a new row; it never updates one (I3).
model PriceVersion {
  id                String   @id @default(cuid())
  tier              String                   // FREE | PRO | BUSINESS | PRO_MAX
  currency          String
  amountMinor       Int
  interval          String                   // MONTHLY | YEARLY
  ceilingMultiplier Float    @default(2.0)   // → mandate ceiling at signup (§9)
  effectiveFrom     DateTime
  supersededBy      String?  @unique
  note              String?                  // "2026 Q3 rupee promo"
  createdAt         DateTime @default(now())

  @@unique([tier, currency, interval, effectiveFrom])
  @@index([tier, currency, supersededBy])
}
```

`plans.ts` keeps its real job — **feature limits per tier** — and loses every
notion of money. The split is principled: **features are code** (they ship with
a build, and old ones need not survive); **prices are data** (they change
without a deploy, and old ones *must* survive).

### 6.4 New — `BillingProfile` (D10)

Country, currency, tax regime, provider, and pricing policy do not belong on
`Subscription` — they are properties of **the business as a commercial
counterparty**, stable across subscription churn, upgrades, and cancellations.
Scattering them across `Subscription` means a customer who cancels and
resubscribes silently re-derives their jurisdiction, and a business relocating
country requires touching subscription rows.

```prisma
/// One per business. The commercial identity: who they are, where, on what terms.
model BillingProfile {
  id          String   @id @default(cuid())
  businessId  String   @unique

  // ── jurisdiction (§6.5) ────────────────────────────────────────
  country            String            // ISO 3166-1 alpha-2
  currency           String            // ISO 4217
  taxRegime          String            // IN_GST | GCC_VAT | UK_VAT | EU_VAT | US_SALES | NONE
  taxId              String?           // GSTIN / VAT no / EIN
  placeOfSupply      String?           // IN state code — CGST+SGST vs IGST (§15)
  verificationSource String            // GST | CARD_BIN | UPI_HANDLE | DOC | MANUAL | SELF_DECLARED
  verifiedAt         DateTime?
  lockedAt           DateTime?         // set on first successful charge (§6.5)

  // ── commercial terms ───────────────────────────────────────────
  pricingPolicy      String   @default("FOLLOW_CURRENT_PRICE")  // §7
  policyReason       String?           // required for non-default; audited
  policySetBy        String?           // AdminUser id
  contractId         String?           // CONTRACT_PRICE only

  // ── routing (derived, cached for query-ability) ────────────────
  provider           String            // resolved by billing-router (§4.4)
  rail               String

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([country, taxRegime])
  @@index([pricingPolicy])
}
```

India → USA becomes `billingProfile.update()` plus a re-mandate (the old rail
cannot serve the new country), not a subscription migration.

⚠️ `provider` and `rail` are a **cache of a derivation**, not an input. The
router (§4.4) remains the SSOT; these columns exist so ops can query "how many
businesses are on Cashfree" without recomputing. A drift check asserts
`profile.provider === route(profile.currency)` nightly.

### 6.5 New — jurisdiction verification (D11)

The document previously assumed we know a business's country. We do not, and
self-declaration is a live arbitrage: a US business declaring India gets ₹
pricing (roughly a 5–10× discount at PPP), pays no US sales tax, and we
under-collect and under-remit. That is not a hypothetical — it is the standard
abuse pattern for any SaaS with regional pricing.

**Jurisdiction is verified, ranked by strength, and locked on first charge:**

| `verificationSource` | Strength | Notes |
|---|---|---|
| `GST` | strongest | GSTIN validates against the GSTN registry; encodes state ⇒ gives `placeOfSupply` free |
| `CARD_BIN` | strong | Issuing-country from the BIN. Hard to fake, cheap to check |
| `UPI_HANDLE` | strong | A working UPI mandate is India, definitionally |
| `DOC` | medium | Uploaded registration; needs human review |
| `MANUAL` | medium | Support-agent override; requires `policyReason` + audit row |
| `SELF_DECLARED` | **weakest** | Signup-form default. **Never sufficient on its own for non-INR pricing** |

Rules:

1. `SELF_DECLARED` grants the **least favourable** pricing available for the
   claimed region until upgraded. Cheap regional pricing must be *earned* by
   evidence, not asserted.
2. **`lockedAt` is set on first successful charge.** After that, a country
   change is an admin operation with an audit trail and a re-mandate — not a
   profile edit. Otherwise a subscriber flips to India before each renewal and
   back afterwards.
3. **Conflict detection:** a `CARD_BIN` that disagrees with the declared
   country raises a review flag rather than silently overriding. Legitimate
   cases exist (an Indian founder's US card); fraud looks identical, so a human
   decides.
4. Verification evidence is **not** stored raw — store the source, the outcome,
   and a hash. A BIN is not PII; a full PAN is (§17).

---

## §7 — The Pricing Engine (D4, revised)

### 7.1 What the previous draft got wrong

v2 said: *"`Subscription.priceVersionId` is pinned at signup; the catalog
affects nobody until a consented cohort migration."*

That is **the wrong default for this business.** The stated model has always
been *"if Starter becomes ₹599 tomorrow, everyone renews at ₹599."* Permanent
pinning makes the normal case — a price change reaching the whole base — an
explicit migration campaign, and after three years you are running eleven
cohorts and cannot reason about MRR.

The real problem pinning was solving is **not architectural. It is consent and
communication.** The fix is to make notice and the ceiling mandatory (I11), not
to freeze the price.

### 7.2 The rule (D4, revised)

> A subscriber's price is **evaluated fresh at every renewal** by a pure
> function of `(policy, catalog, profile, promoState, today)`. The *policy*
> decides whether the catalog is followed or a fixed price is honoured.

```ts
// pricing-engine.ts — PURE. No Prisma, no clock, no I/O. `today` is an argument.
export function calculatePrice(input: {
  policy: PricingPolicy
  profile: BillingProfileSnapshot       // country, currency, taxRegime
  product: { tier: Tier; interval: Interval }
  catalog: PriceVersion[]               // all versions, caller-loaded
  promoState: PromoState | null
  contract: ContractTerms | null
  coupon: CouponSnapshot | null
  today: Date
}): PriceDecision
```

```ts
export interface PriceDecision {
  grossMinor: number
  discountMinor: number
  netMinor: number                      // pre-tax; tax added by the tax engine (§15)
  currency: Currency
  priceVersionId: string                // which catalog row was used
  policyApplied: PricingPolicy
  reason: string                        // human-readable — shown in support tooling
  requiresNotice: boolean               // true when this is an increase (I11)
  noticeDays: number
}
```

### 7.3 Policies

| Policy | Behaviour | Use |
|---|---|---|
| **`FOLLOW_CURRENT_PRICE`** | Charges the catalog's current version each renewal | **Default.** Starter, Business — the stated model |
| `FOLLOW_CURRENT_AFTER_PROMO` | Honours the promo version until the promo period ends, then follows current | The ₹1 promo (§7.5) |
| `PRICE_LOCK` | Fixed to a named `priceVersionId`, optionally with `lockUntil` | Grandfathering, retention saves, apologies |
| `CONTRACT_PRICE` | Fixed to a `Contract` row with explicit term dates + renewal terms | Enterprise, annual negotiated |

Non-default policies **require `policyReason` and an `AuditLog` row**. A price
lock is a commercial commitment, and an unexplained one is indistinguishable
from a mistake two years later.

`PRICE_LOCK` **must carry an expiry or an explicit `PERPETUAL` marker.** An
undated lock is how companies end up with 2019 pricing in 2031 and nobody who
remembers why.

### 7.4 Resolution precedence

The reviewer's chain (rule → catalog → pinned → regional → offer) is right but
ambiguous without a stated order. Deterministic precedence, highest first:

```
1. CONTRACT_PRICE      — a signed contract beats everything
2. PRICE_LOCK          — within lockUntil (expired lock falls through)
3. Active promo        — FOLLOW_CURRENT_AFTER_PROMO, inside the promo window
4. Regional catalog    — current PriceVersion for (tier, interval, profile.currency)
5. Base catalog        — current PriceVersion for (tier, interval, INR) + FX floor
                         ⚠️ fallback only; a missing regional price is a config bug.
                         Emit a warning metric — never silently FX a price (§8.2)
```

Coupons apply **after** precedence resolves, to whatever `grossMinor` won.
The rule is total: every input combination resolves, exhaustively table-tested.

### 7.5 The ₹1 promo, restated

A promo is a first-class `PriceVersion` row (`amountMinor: 100`, a promo window)
paired with `FOLLOW_CURRENT_AFTER_PROMO`. It inherits auditability and the
precedence chain rather than being a special case in the charge path.

The existing state machine already models the lifecycle:
`payment.captured.promo → PROMO_ACTIVE`, then
`payment.captured.recurring → ACTIVE` (transitions 1 and 5). No new states.

⚠️ **The mandate ceiling is derived from the STANDARD price, never the promo
price.** A ₹1 promo with a ₹2 ceiling is unrecoverable — month two's ₹1,999
charge is permanently impossible. Highest-severity trap in the design; guard G6.

### 7.6 What makes `FOLLOW_CURRENT_PRICE` safe (I11)

This is the part the reviewer correctly identified as a communication problem —
and the architecture must **enforce** the communication, not merely permit it.
Three mandatory constraints, without which following the catalog is unsafe:

**1. Notice before any increase.**
`PriceDecision.requiresNotice` is set whenever `netMinor` exceeds the last
charged amount. The Billing Engine **refuses to charge** until a price-change
notice is confirmed sent and `noticeDays` have elapsed. Default **30 days** for
increases — separate from, and in addition to, the NPCI T-24h pre-debit notice,
which is about a *specific debit*, not a *change in terms*.

**2. The ceiling is a hard cap on the whole policy.**
`FOLLOW_CURRENT_PRICE` can only follow the catalog **up to `mandate.ceilingMinor`**.
Beyond it the charge does not fail — it routes to re-mandate (§9.4). This is why
D3's multiplier is no longer a matter of taste: **with follow-current as the
default, the ceiling is your entire price-rise runway for that subscriber's
lifetime.** 2× permits exactly one doubling, ever. Hence D3 raised to **3× for
INR monthly plans** (₹1,999 → ₹5,997 ceiling), where the absolute figure stays
unalarming; 2× retained where the absolute number is large enough to hurt consent.

**3. A rate limiter on increases.**
Max **one increase per subscriber per 180 days**, and a configurable maximum
step (default 25%). Enforced in the Pricing Engine, not by policy discipline.
This protects against a fat-fingered catalog edit reaching the entire base
overnight — which, under follow-current, is now *possible in one commit*.
Pinning's real safety benefit was making that mistake slow; the rate limiter
restores it without the cohort tax.

**Decreases are unconstrained** — they take effect on the next renewal with no
notice, no ceiling interaction, no rate limit. Nobody complains about paying less.

### 7.7 Discounts (I8, D6)

Today a coupon resolves to a **Razorpay offer object**
(`Coupon.razorpayOfferId`) — a fourth external price mirror with the same defect
as `razorpayPlanId`.

New rule: **we compute the final amount; the provider is told a number.**

```
amountMinor = grossMinor − discountMinor + taxMinor
```

- `Coupon` keeps `discountType`/`discountValue` (already correct: basis points
  for percentage, minor units for fixed) and **drops `razorpayOfferId`**
- The existing money-out defence at `checkout-session.service.ts:32` — never
  forwarding user input as an offer id — is preserved in spirit: the coupon code
  is resolved server-side against `Coupon`, and only a *computed amount* crosses
  the port. There is no longer an offer id to harvest, which closes the class
  entirely rather than guarding it
- Coupons apply **after** policy precedence resolves (§7.4), to whatever
  `grossMinor` won. They never change which `PriceVersion` was selected

### 7.8 Addons

`BusinessAddon` charges reuse the same ledger and port — an addon purchase is a
`PaymentAttempt` with its own `priceVersionId` (tier field carries the addon
code). Addon prices move into `PriceVersion` alongside plan prices; no second
catalog. Recurring addons ride the same mandate and **count against the same
ceiling** — so `sum(plan + active addons) ≤ ceilingMinor` is a precondition of
addon purchase, checked before sale, not at charge time (§9.2).

---

## §8 — Money, currency, and keys

### 8.1 Minor units are not always ×100 (I9)

A silent, expensive trap the moment Gulf expands beyond the UAE:

| Currency | Exponent | ₹/$ 1 = |
|---|---|---|
| INR, USD, GBP, EUR, AED, SAR | 2 | 100 |
| **KWD, BHD, OMR, JOD, TND** | **3** | **1000** |
| JPY, KRW | 0 | 1 |

A single hardcoded `× 100` charges a Kuwaiti customer **1/10th** of the
intended amount, or ten times it, depending on direction. Minor-unit exponent
is a property of the currency, looked up from one table, never inlined.
Guard G3.

### 8.2 No FX in billing

Prices are **authored per currency** in `PriceVersion`. We never convert at
charge time. A Gulf customer sees a AED price set by us, not an INR price
run through a rate.

⚠️ **SSOT note:** `server/src/services/currency.service.ts` already exists with
`convertToINR` / `convertFromINR` / `getExchangeRate`. That module serves the
*customer's own multi-currency invoicing feature*. It **must not** be imported
by billing — FX-converted subscription prices would drift daily and break both
price pinning (I3) and the ceiling (I7). Add the exclusion as an
`ssot.config.mjs` note so the next person doesn't "helpfully" reuse it.

### 8.3 Idempotency key (I5)

Ours, deterministic, never the provider's:

```
sha256(subscriptionId | periodStartISO | attemptNo)
```

Same period + same attempt ⇒ same key ⇒ the provider dedupes even if our process
died mid-call. A dunning retry increments `attemptNo`, producing a new key — a
*deliberate* second attempt, distinguishable from an accidental double-send.

⚠️ **`priceVersionId` is deliberately NOT in the key.** An earlier draft
included it. That is a bug: a cohort migration mid-period would change the key
and permit a **second debit for a period already paid**. The key identifies
*which period's charge this is*, not *what we charged*. The amount belongs in
the ledger row, not the key.

---

## §9 — The mandate ceiling

### 9.1 Setting it (D3, revised)

At mandate creation:

```
ceilingMinor = standardPriceVersion.amountMinor × ceilingMultiplier
               // 3.0 for INR monthly · 2.0 elsewhere
```

⚠️ **D4 changed this number.** Under v2's price pinning, the ceiling only had to
cover consented migrations. Under `FOLLOW_CURRENT_PRICE` (§7.6), **the ceiling
is the subscriber's entire price-rise runway for the lifetime of their
mandate** — the catalog can rise to it and no further without a re-mandate
campaign. 2× permits exactly one doubling, ever.

Hence 3× for INR monthly plans, where the absolute figure stays unalarming
(₹1,999 → ₹5,997 disclosed ceiling). Where the absolute number is large enough
to hurt consent conversion — annual plans, high-value tiers — 2× is retained and
the trade is accepted consciously. `ceilingMultiplier` lives on `PriceVersion`,
so this is data, not a constant.

Disclosed verbatim at consent — *"HisaabPro may debit up to ₹X per month. You
will be notified 24 hours before every debit."*

`createMandate` returns the ceiling **the rail actually granted**, which may be
lower than requested. **Persist the granted value, never the requested one** —
otherwise every ceiling check is computed against a number the bank never agreed to.

The multiplier trade-off, stated plainly:

- **Too low** → you can never raise prices without a full re-mandate campaign.
  This is exactly myBillBook's ₹499/₹499: max = price means *every* future
  increase fails for *every* existing subscriber, permanently.
- **Too high** → the consent screen reads alarmingly and conversion suffers.

2× is a recommendation. **It is a product decision, not an engineering
constant, and the auditor should challenge it.**

### 9.2 Enforcing it (I7)

```ts
// charge.service.ts — BEFORE any driver call
if (amountMinor > mandate.ceilingMinor) {
  throw new CeilingExceededError(subscriptionId, amountMinor, mandate.ceilingMinor)
}
```

Never let this reach the provider. A rail-side ceiling rejection is
indistinguishable from a bank decline, so the dunning ladder would retry it —
forever, pointlessly, burning rail reputation on a charge *guaranteed* to fail.

Also checked **at point of sale** for addons and upgrades, so a customer is
never sold something that cannot be billed (§7.4).

### 9.3 Mandate expiry

UPI Autopay mandates carry an end date. `MANDATE_EXPIRED` is terminal and must
be *anticipated*, not discovered: a job flags mandates expiring within 30 days
and drives a renewal prompt. Discovering expiry via a failed charge means
revenue already lost plus an involuntary-churn event.

### 9.4 Re-mandate flow

`CEILING_EXCEEDED` and `MANDATE_EXPIRED` route here. Order matters:

```
notify → collect NEW mandate at new ceiling → charge → THEN revoke old mandate
```

Revoking first leaves the subscriber uncollectable if they abandon the new
consent. Both mandates coexist briefly; the ledger's idempotency key prevents
a double charge across the pair.

**Design this now even if it ships later.** Retrofitting means the first cohort
is permanently stuck at their signup ceiling.

---

## §10 — Scheduler

### 10.1 Query, never timer

```sql
SELECT … FROM "Subscription"
WHERE "nextBillingAt" <= now()
  AND "subscriptionState" IN ('ACTIVE','PROMO_ACTIVE','PAST_DUE')
  AND "autoRenew" = true
```

Idempotent and self-healing by construction: a missed run (dyno restart,
deploy) just means the next run sees a larger due set. A fire-once timer loses
that subscriber's revenue permanently and silently.

### 10.2 Exactly-once across instances

Two Render instances running one cron = double charge. Three independent layers:

1. **Claim-on-read** —
   `UPDATE "Subscription" SET "billingClaimedAt" = now() WHERE id = ANY(…) AND ("billingClaimedAt" IS NULL OR "billingClaimedAt" < now() - interval '15 min') RETURNING id`.
   Only the winner proceeds; stale claims self-expire.
2. **Idempotency key** (§8.3) — the provider dedupes even if the claim is lost.
3. **`@@unique([subscriptionId, periodStart, attemptNo])`** — the database
   refuses the second ledger row outright.

Layer 2 alone is *nearly* sufficient, but it does not prevent duplicated **side
effects** (notifications, ledger rows, invoices). Layers 1 and 3 do.

### 10.3 Calendar correctness

- **Anchor day, not date arithmetic.** Store `billingAnchorDay = 31`.
  Jan 31 → Feb 28 → **Mar 31**, not the Feb-28-forever drift that naive
  `addMonths` produces.
- **Timezone** — India bills on **IST** calendar days. `nextBillingAt` is UTC in
  the column; every day-boundary computation converts to the subscription's zone first.
- **Pre-debit notice is a precondition, not a side effect.** A charge is
  **blocked** if a T-24h notice is not confirmed sent. NPCI compliance is not best-effort.

### 10.4 In-flight sweep

Every 15 min: attempts in `CREATED`/`PENDING` older than 15 min →
`fetchCharge` → resolve. Catches process death between ledger write and API
response, plus UPI's asynchronous settlement.

---

## §11 — Dunning

| Attempt | When | Notify | On `INSUFFICIENT_FUNDS` / `TECHNICAL` |
|---|---|---|---|
| 1 | `nextBillingAt` | pre-debit T-24h | → attempt 2 |
| 2 | D+1 | "payment failed" | → attempt 3 |
| 3 | D+3 | reminder | → attempt 4 |
| 4 | D+5 | warning | → attempt 5 |
| 5 | D+7 | final warning | → `grace.expired` → **LOCKED** |

**Terminal immediately — zero retries:** `MANDATE_REVOKED`, `MANDATE_PAUSED`,
`MANDATE_EXPIRED`, `CEILING_EXCEEDED`, `AUTH_REQUIRED`. Retrying these is
guaranteed to fail and damages rail standing. Each routes to its own recovery flow.

Maps onto the existing state machine with **no new states**:
`subscription.charged.failed → PAST_DUE` (`set_grace`); `grace.expired → LOCKED`.

⚠️ **`gracePeriodEndsAt` must equal the attempt-5 date.** Two sources of truth
for "when does access stop" is a bug waiting to happen. Assert the equality in
the writer, test it.

---

## §12 — Async settlement, webhooks, reconciliation

### 12.1 `PENDING` is not `CAPTURED`

UPI Autopay returns `PENDING`; money settles later. **Entitlement is granted on
`CAPTURED` only.** Granting on API-200 gives away free service on every charge
that later fails — and the failure arrives hours after the user is already
working in the product.

The existing state machine already gets this right: triggers are
`payment.captured.*`, never `payment.initiated.*`. Preserve that.

### 12.2 Webhook rules

1. **Verify signature first**, in the driver, on the **raw `Buffer`**. A JSON
   body-parser mounted upstream silently breaks HMAC verification — mount the
   raw parser on the webhook route only.
2. **Idempotent by `providerEventId`** — reuse the existing sparse `@unique` on
   `SubscriptionEvent`. Do not invent a second mechanism.
3. **Out-of-order tolerance.** Webhooks are not ordered. The `PaymentAttempt`
   state machine is forward-only, so a late `PENDING` arriving after `CAPTURED`
   is dropped rather than regressing state.
4. **Ack fast, process async.** Persist the raw event, return 200, process from
   the queue. A slow handler triggers provider retries and duplicate delivery.
5. **Unknown event types are logged and ignored, never 500.** A 500 makes the
   provider retry forever and eventually disable the endpoint.

### 12.3 Reconciliation

Daily: pull the settlement file, match lines to `PaymentAttempt` by
`providerChargeId`, write `SettlementRecord`, stamp `settledAt`.

Alert on:

- `unmatchedMinor > 0` — money we cannot attribute
- `CAPTURED` for > 7 days with no `settledAt` — money we believe we earned and never received
- A settlement line with no matching attempt — a charge we did not initiate

Without this, gateway errors are discovered by a customer. **This is the
difference between a billing system and a billing integration.**

---

## §13 — Entitlement, offline-first (D7)

HisaabPro is offline-first. Billing entitlement is therefore not a
request-time check — a user can be offline for days holding a signed JWT.
Current TTL is **24h** (`entitlement-jwt.service.ts:20`, `TTL_SECONDS = 86_400`).

| Question | Rule |
|---|---|
| A user is `LOCKED` while offline holding a valid JWT | They retain access until the JWT expires. **This is accepted, bounded revenue leakage** — the alternative (fail-closed offline) breaks the core product promise |
| JWT TTL | **24h** for the signed claim; client refreshes opportunistically on any successful sync |
| Hard offline ceiling | After **72h** with no successful refresh, the client **fails closed to FREE tier**, not to LOCKED — the user keeps their data and basic invoicing, loses paid features |
| Clock rewind | Already handled — `trustedTime` claim; a device clock earlier than `trustedTime` is treated as tampering and fails closed |
| Immediate revocation (fraud/chargeback) | Push-fanout invalidation (`push_fanout` side effect already exists) + short-circuit on next sync. Never rely on TTL alone for a fraud case |

**Fail closed to FREE, not to LOCKED** is a deliberate product stance: a
farmer's shop on 2G that cannot reach us for three days must still be able to
bill customers. Losing paid *features* is acceptable; losing the *app* is not.
**D7 is a product call — confirm it.**

---

## §14 — Proration, upgrades, refunds

| Path | Rule |
|---|---|
| **Upgrade** mid-cycle | Charge `(new − old) × remainingDays / periodDays` immediately off the existing mandate. Entitlement changes on `CAPTURED`. Exceeds ceiling → re-mandate (§9.4) |
| **Downgrade** | Scheduled at period end. The existing `pendingDowngradeTier` column already models this — reuse it. No mid-cycle refund by default |
| **Cancel** | Access runs to `expiresAt`; `autoRenew = false`; mandate revoked **at period end**, not immediately |
| **Reactivate** in grace | Existing transitions 13/14/17/19 cover it |
| **Refund** | A **new ledger row** referencing the original, never an update (I4). Full refund in-period → `CANCELLED` + entitlement revoked at once; partial/goodwill → no state change |
| **Chargeback** | `MANDATE_REVOKED` treatment + immediate `LOCKED` + ops alert. **Never auto-retry into a dispute** |

Proration rounds **in the customer's favour** (floor). That rounding rule is a
one-line pure function with its own test — precisely the thing that silently
loses ₹1 × 10,000 subscribers.

Every refund requires `actorUserId` + reason in `SubscriptionEvent`: money
leaving must be attributable to a human.

---

## §15 — Tax & invoicing on the subscription itself

Distinct from HisaabPro's customer-facing invoicing feature. **We are a B2B
SaaS vendor and must issue our own GST invoice.**

- **GST invoice per captured charge**, carrying the customer's GSTIN when
  supplied — B2B customers need it for input tax credit, and its absence is a
  concrete reason to churn. The `enqueue_invoice` side effect already exists in
  the state machine; wire it to a real invoice generator.
- **Place of supply** determines CGST+SGST vs IGST. Derived from the business's
  registered state vs ours.
- **Exports** (diaspora/Gulf) — zero-rated under LUT, or with IGST paid and
  refunded. Requires an LUT filing. Accountant's call, flagged here so it is not discovered late.
- **Deferred revenue** — an annual plan is collected once and *recognized*
  monthly. If HisaabPro's own books are kept in the app, the accounting module
  must not treat the collection as one month's revenue.
- **Credit notes** for refunds — a GST refund needs a credit note, not a deleted invoice.

Numbering must use the existing `DocumentNumberSeries` discipline: gapless,
per-financial-year, auditable.

---

## §16 — Global

### 16.1 The cheap part — payments

Currency on every money row (§8.1) + rail routing (§4.4). Scheduler, dunning,
entitlement, state machine, and catalog are written **once** and never branch on
country. Only three things differ per rail:

1. **Pre-debit notice** — required on NPCI, absent on Stripe (optional port method)
2. **Failure taxonomy** — each driver normalizes to `FailureCode`
3. **SCA / `AUTH_REQUIRED`** — EU cards can demand on-session re-auth mid-subscription;
   India cannot. Needs an email → re-auth → resume flow that India never exercises

### 16.2 The expensive part — tax ⚠️ BLOCKED ON B3

| If "global" means | Additional scope |
|---|---|
| **Diaspora + Gulf** (Indian-context billing, foreign cards) | Stripe + currency column + 3-decimal minor units. Essentially free. Export-of-services GST treatment + LUT |
| **US/UK domestic SMBs** | US sales-tax nexus (50 states, economic thresholds), UK/EU VAT registration + MOSS/OSS filing, non-GST invoice formats, local consumer-cancellation law, likely a local entity |

The second **is not a driver — it is a second product** (D8). It belongs in its
own epic with its own scope. This document assumes diaspora+Gulf until told
otherwise and marks the boundary explicitly, so the assumption is visible
rather than buried.

---

## §17 — Security, privacy, retention

- Provider secrets via `lib/env.ts` only — **high-risk path**, `architect` required
- Webhook signature verification **mandatory**, per driver, on raw bytes
- Never persist: full VPA, PAN, card number, CVV. `vpaLast4` only (already correct)
- `PaymentAttempt.rawStatus` is a **status string, not a raw payload** — no PII into forensics columns
- Ceiling changes, cohort migrations, refunds, admin grants → `AuditLog` via
  `createAuditEntry` (the canonical writer; project memory `audit-writer-ssot`)
- **Every billing query scoped by `businessId`** — cross-tenant billing reads are a P0 class
- Rate-limit mandate creation per business — mandate spam damages rail reputation
- **One subscription per `Business`**, not per user (`Subscription.businessId @unique`
  already enforces it). A user owning three businesses has three subscriptions and
  three mandates. State it so nobody "helpfully" adds a user-level plan later
- ⚠️ **Retention conflict, stated not resolved:** financial records must be
  retained ~8 years (Companies Act); a GDPR/DPDP erasure request wants them gone.
  Resolution: **pseudonymize the subject, retain the money row.** `PaymentAttempt`
  holds no PII by design — only ids and amounts — which is what makes this possible.
  Legal sign-off needed before the first EU customer.

---

## §18 — Rollout & operations

### 18.1 Staged rollout

1. **Shadow mode** — the scheduler runs, computes what it *would* charge, writes
   ledger rows in a `DRY_RUN` state, calls no provider. Run for one full billing
   cycle. Reconcile expected vs. catalog by hand.
2. **Canary cohort** — internal + ≤10 friendly businesses, real money, watched daily.
3. **Ramp** — 10% → 50% → 100%, gated on charge-success-rate.
4. **Kill switch** — `BILLING_CHARGES_ENABLED=false` halts all charging while
   leaving webhooks, reconciliation, and entitlement live. A billing system with
   no off switch is an incident with a schedule.

### 18.2 Runbooks (`docs/runbooks/billing-*.md`)

| Incident | First action |
|---|---|
| Suspected double charge | Query ledger by `subscriptionId + periodStart`; >1 `CAPTURED` ⇒ refund the later, root-cause the key |
| Charge success rate < 90% for 1h | Kill switch, then check rail status before touching code |
| Unmatched settlement money | Freeze reconciliation, do not auto-write; a human attributes it |
| Rail outage | Flip the India driver to Razorpay via config; do **not** re-collect mandates |
| Mandate mass-revocation | Halt dunning immediately — retries against revoked mandates compound rail-reputation damage |

### 18.3 Observability

| Metric | Alert |
|---|---|
| Charge success rate, by rail | < 90% over 1h |
| Involuntary churn (LOCKED via dunning ÷ active) | weekly trend |
| MRR by tier / currency / **price cohort** | dashboard |
| Attempts `PENDING` > 24h | any |
| Unmatched settlement amount | > 0 |
| Webhook processing lag | p99 > 60s |
| Mandates expiring in 30d | count |
| Charges blocked by ceiling | any — signals a cohort needing re-mandate |

**MRR is computed from `PaymentAttempt`**, never from subscription-count ×
catalog price. Those two numbers diverging *is itself* the signal that something
is wrong — which is only possible if they are computed independently.

---

## §19 — Testing & mechanical guards

### 19.1 Provider contract suite

The port is only an abstraction if drivers are provably interchangeable. **One
shared suite** runs against every driver, including `FakeProvider`:

- charge → `CAPTURED`; same idempotency key twice → **one** debit
- every `FailureCode` reachable and correctly normalized
- webhook: valid sig → parsed; tampered → `null`; replayed → deduped
- revoke → subsequent charge yields `MANDATE_REVOKED`
- `createMandate` returning a lower-than-requested ceiling is persisted as granted
- `fetchCharge` resolves an attempt whose response was never seen

A driver that cannot pass the shared suite does not ship. `FakeProvider` is what
every L2–L6 test uses: **no test above the port ever touches a real gateway.**

⚠️ Sandbox limitation to confirm during B1: gateway sandboxes typically do not
emit settlement files, so §12.3 needs a fixture-driven test rather than a live one.

### 19.2 Mechanical guards

| ID | Guard | Mechanism |
|---|---|---|
| **G1** | No driver/SDK import above the port | ESLint `no-restricted-imports`: `cashfree`/`stripe`/`razorpay` and `drivers/**` banned outside `services/billing/drivers/` |
| **G2** | No `*PlanId`/`*OfferId` column ever returns | `ssot.config.mjs` forbidden regex `/(razorpay\|cashfree\|stripe\|provider)(Plan\|Offer)Id/i` |
| **G3** | No float money; no inline `×100` | extend existing enforce.js money pattern; minor-unit exponent from one table only |
| **G4** | No `paymentAttempt.create` outside the ledger writer | guarded gate, same shape as the existing `auditLog.create` gate |
| **G5** | Every driver enumerated by the contract suite | test reads `drivers/` and asserts coverage |
| **G6** | **Ceiling never derived from a promo price** | unit test + assertion in `mandate.service.ts` — the highest-severity trap (§7.3) |
| **G7** | No price literal outside `PriceVersion` | regex for 5–7 digit integers in `services/subscription/**` and `features/subscription/**`; kills the §1.1 drift permanently |
| **G8** | `currency.service.ts` never imported by billing | `no-restricted-imports` (§8.2) |
| **G9** | **Pricing Engine stays pure** — no Prisma, no `new Date()`, no I/O | `no-restricted-imports` + `no-restricted-globals` scoped to `services/billing/pricing/**` (D9) |
| **G10** | **No increase charged without notice** | Assertion in `charge.service.ts`: `requiresNotice ⇒ noticeSentAt != null && elapsed ≥ noticeDays` (I11) |
| **G11** | **No non-INR pricing on a `SELF_DECLARED` profile** | Assertion in the Pricing Engine + nightly audit query (D11, §6.5) |

**G2, G7, G9 and G10 are what make this document self-enforcing after everyone
forgets it.**

### 19.3 Property tests

- Anchor-day math over 5 years incl. leap years — never skips or repeats a month
- Proration ≤ full period price; never negative; always floors
- Dunning ladder always terminates
- Ledger state machine is forward-only under **any** permutation of events
- `gracePeriodEndsAt` always equals the attempt-5 date
- **Pricing precedence is total** — every `(policy × promo × contract × lock ×
  region)` combination resolves to exactly one `PriceVersion`, never zero, never
  ambiguous (§7.4)
- **Pricing is deterministic** — same inputs, same `today`, same `PriceDecision`,
  always. No hidden clock, no hidden read (D9)
- A `FOLLOW_CURRENT_PRICE` subscriber's amount is monotonic between notices —
  it never changes *within* a notice window

---

## §20 — Migration sequence

Ordered so each step is independently revertible.

| # | Step | Risk | Gate |
|---|---|---|---|
| 1 | Add `PriceVersion`, `BillingProfile`, `PaymentAttempt`, `SettlementRecord`; add `billingAnchorDay`, `billingClaimedAt` as **nullable** | low | migration applies clean |
| 2 | Seed `PriceVersion` from the §1.1 literals; **delete the literals** | low | G7 passes |
| 3 | Backfill one `BillingProfile` per business — `country='IN'`, `currency='INR'`, `taxRegime='IN_GST'`, `pricingPolicy='FOLLOW_CURRENT_PRICE'`, `verificationSource` from an existing GSTIN where present else `SELF_DECLARED` | low | zero nulls; GST-derived count reported |
| 4 | Make backfilled columns `NOT NULL` | low | — |
| 4b | **Pricing Engine (pure) + policy resolver + increase guard** — no I/O, ships and is testable before any driver exists | none | precedence table + property tests green |
| 5 | Port + `FakeProvider` + contract suite | none | suite green |
| 6 | Cashfree driver · ledger writer · charge service · ceiling guard | med | contract suite + sandbox charge |
| 7 | Scheduler · claim lock · dunning · in-flight sweep | med | property tests; 2-instance no-double-charge test |
| 8 | Webhooks · reconciliation | med | replay + tamper tests |
| 9 | **Renames:** `UpiMandate`→`Mandate`, drop `razorpayPlanId`, drop `Coupon.razorpayOfferId`, rename provider columns | **med — do while zero prod mandates exist** | tsc + full suite |
| 10 | Shadow mode, one full cycle (§18.1) | none | expected == catalog, by hand |
| 11 | Canary → ramp | high | success rate held |
| 12 | Stripe driver | low | contract suite, unchanged |

**Step 9 is cheap today and expensive forever after.** Do not defer it past the
first production mandate.

Schema steps are **high-risk paths** — `architect` required;
`prisma migrate dev` only, never `db push`
(`.claude/rules/PRISMA_MIGRATION_RULES.md`).

---

## §21 — File plan

Every row ≤ 250 lines; layers per CLAUDE.md file discipline.

| path | action | est | layer |
|---|---|---|---|
| `server/src/services/billing/billing.types.ts` | create | ~140 | types |
| `server/src/services/billing/billing-provider.port.ts` | create | ~130 | port |
| `server/src/services/billing/billing.constants.ts` | create | ~70 | constants |
| `server/src/services/billing/currency-minor-units.ts` | create | ~40 | constants (§8.1) |
| `server/src/services/billing/billing-router.ts` | create | ~40 | utils (pure) |
| `server/src/services/billing/idempotency-key.util.ts` | create | ~40 | utils (pure) |
| `server/src/services/billing/proration.util.ts` | create | ~70 | utils (pure) |
| `server/src/services/billing/anchor-date.util.ts` | create | ~90 | utils (pure) |
| `server/src/services/billing/discount.util.ts` | create | ~90 | utils (pure, §7.3) |
| `server/src/services/billing/drivers/fake.provider.ts` | create | ~160 | driver |
| `server/src/services/billing/drivers/cashfree.provider.ts` | create | ~230 | driver |
| `server/src/services/billing/drivers/cashfree.mapper.ts` | create | ~110 | driver (pure) |
| `server/src/services/billing/drivers/stripe.provider.ts` | create | ~200 | driver |
| `server/src/services/billing/drivers/stripe.mapper.ts` | create | ~100 | driver (pure) |
| `server/src/services/billing/drivers/razorpay.provider.ts` | create | ~200 | driver |
| `server/src/services/billing/ledger.writer.ts` | create | ~170 | service |
| `server/src/services/billing/ledger.queries.ts` | create | ~120 | service |
| `server/src/services/billing/pricing/pricing.types.ts` | create | ~110 | types (D9) |
| `server/src/services/billing/pricing/pricing-engine.ts` | create | ~180 | **pure** — `calculatePrice` (§7.2) |
| `server/src/services/billing/pricing/policy-resolver.ts` | create | ~120 | pure — precedence chain (§7.4) |
| `server/src/services/billing/pricing/increase-guard.ts` | create | ~90 | pure — notice + rate limit (§7.6) |
| `server/src/services/billing/price-catalog.service.ts` | create | ~140 | service (catalog I/O) |
| `server/src/services/billing/billing-profile.service.ts` | create | ~150 | service (§6.4) |
| `server/src/services/billing/jurisdiction.service.ts` | create | ~170 | service (§6.5, D11) |
| `server/src/services/billing/price-change-notice.service.ts` | create | ~120 | service (I11) |
| `server/src/services/billing/charge.service.ts` | create | ~190 | service (orchestration) |
| `server/src/services/billing/mandate.service.ts` | create | ~180 | service |
| `server/src/services/billing/remandate.service.ts` | create | ~120 | service |
| `server/src/services/billing/dunning.service.ts` | create | ~150 | service |
| `server/src/services/billing/reconciliation.service.ts` | create | ~160 | service |
| `server/src/services/billing/subscription-invoice.service.ts` | create | ~180 | service (§15) |
| `server/src/services/billing/cron-billing-run.ts` | create | ~130 | cron |
| `server/src/services/billing/cron-inflight-sweep.ts` | create | ~80 | cron |
| `server/src/services/billing/cron-settlement-pull.ts` | create | ~90 | cron |
| `server/src/services/billing/cron-mandate-expiry.ts` | create | ~80 | cron (§9.3) |
| `server/src/services/billing/webhook.dispatcher.ts` | create | ~140 | service |
| `server/src/routes/billing/webhook.routes.ts` | create | ~110 | route |
| `server/src/routes/billing/mandate.routes.ts` | modify | ~60 | route |
| `server/src/config/plans.ts` | modify | −40 | constants (money out) |
| `server/src/services/subscription/checkout-session.service.ts` | modify | ~−80 | service (literals out) |
| `src/features/subscription/subscription.constants.ts` | modify | ~−20 | constants (literals out) |
| `server/prisma/schema.prisma` | modify | ~+140 | schema ⚠️ high-risk |
| `ssot.config.mjs` | modify | ~+40 | registry (G1–G8) |
| `docs/runbooks/billing-*.md` | create | ~200 | ops (§18.2) |

**~38 files, ~4,300 lines**, plus contract and property suites.

---

## §22 — Acceptance criteria

Each maps to an invariant so the auditor can trace coverage.

**Backend**
- [ ] `npx tsc -b --noEmit` clean
- [ ] Contract suite green: Fake + Cashfree sandbox *(port)*
- [ ] Same idempotency key twice ⇒ exactly one debit — integration, real DB *(I5)*
- [ ] Two concurrent scheduler instances ⇒ one charge per subscription *(I5)*
- [ ] Charge above ceiling ⇒ `CeilingExceededError`, **zero** network calls *(I7)*
- [ ] Ceiling derived from standard price even when signup is a ₹1 promo *(G6 — highest severity)*
- [ ] `UPDATE` on a `PriceVersion` row rejected; a change creates a new row *(I3)*
- [ ] `FOLLOW_CURRENT_PRICE` subscriber **does** renew at the new catalog price after notice elapses *(D4)*
- [ ] `PRICE_LOCK` subscriber's amount is **unchanged** by the same catalog edit *(D4)*
- [ ] An expired `PRICE_LOCK` falls through to the catalog on the next renewal *(§7.3)*
- [ ] `CONTRACT_PRICE` beats an active promo beats regional catalog — exhaustive precedence table *(§7.4)*
- [ ] An increase with no notice sent ⇒ charge **refused**, not attempted *(I11, G10)*
- [ ] A second increase within 180 days ⇒ blocked by the rate limiter *(§7.6)*
- [ ] A decrease applies immediately with no notice and no ceiling check *(§7.6)*
- [ ] Catalog rise **above** the ceiling ⇒ re-mandate flow, **not** a failed charge *(I11)*
- [ ] Pricing Engine is pure: its test suite imports no Prisma and injects `today` *(D9, G9)*
- [ ] Every `PaymentAttempt` amount is re-derivable from its recorded inputs *(I10)*
- [ ] `SELF_DECLARED` profile cannot obtain non-INR regional pricing *(D11, G11)*
- [ ] Country change after `lockedAt` requires admin + audit + re-mandate *(§6.5)*
- [ ] Coupon applied ⇒ discount computed locally; **no** offer id crosses the port *(I8)*
- [ ] `MANDATE_REVOKED` ⇒ zero retries *(§11)*
- [ ] Tampered webhook signature rejected; replayed event deduped *(§12.2)*
- [ ] Killing the process between ledger write and API response ⇒ sweep resolves it *(I4)*
- [ ] Anchor-day property test, 5 years, incl. leap *(§19.3)*
- [ ] Reconciliation flags an unmatched settlement line *(§12.3)*
- [ ] 3-decimal currency (KWD) charges the correct amount *(I9)*
- [ ] `npm run ssot` exit 0 · `node scripts/enforce.js` 0 errors
- [ ] G1 proven: importing a driver above the port fails lint
- [ ] G7 proven: no price literal survives outside `PriceVersion`

**Frontend**
- [ ] Mandate consent screen states the ceiling verbatim, **en + hi**
- [ ] 4 UI states on every billing screen; clean at 320px
- [ ] Dunning states surface a recovery CTA
- [ ] Re-mandate flow reachable from a `CEILING_EXCEEDED` subscription
- [ ] Offline: 72h without refresh degrades to FREE, not LOCKED *(D7)*

---

## §23 — Decisions, open items, retractions

| ID | Item | Status |
|---|---|---|
| D1 | India = Cashfree On-Demand; global = Stripe; Razorpay = 2nd India driver | decided |
| D2 | No provider plan objects on any rail, ever | decided (I2) |
| D3 | Ceiling = **3× INR monthly / 2× elsewhere**, disclosed | **revised v3 — raised because D4 makes the ceiling the price-rise runway** |
| D4 | **Policy-driven pricing.** Default `FOLLOW_CURRENT_PRICE`; `PRICE_LOCK`, `FOLLOW_CURRENT_AFTER_PROMO`, `CONTRACT_PRICE` available | **revised v3 — v2's permanent pinning was the wrong default for this business** |
| D5 | Reject Cashfree Periodic + `CHANGE_PLAN` | **decided — attack this first (§5.1)** |
| D6 | Discounts computed by us; provider offer objects abolished | decided |
| D7 | Offline entitlement fails to FREE after 72h, not LOCKED | **decided — product call, confirm** |
| D8 | US/UK domestic tax = separate epic | decided |
| D9 | Pricing Engine (pure) separate from Billing Engine (impure) | decided — new v3 |
| D10 | `BillingProfile` per business owns country/currency/tax/provider/policy | decided — new v3 |
| D11 | Jurisdiction verified + locked on first charge; `SELF_DECLARED` never earns regional pricing | decided — new v3 |
| B1 | Cashfree Controlled Notification/Execution semantics | **open — verify before architect** |
| B2 | Recurring activation lead time, both gateways | **open — file tickets today** |
| B3 | Diaspora+Gulf vs US/UK domestic | **open — blocks §16.2 only** |
| B4 | Effective MDR per rail | **open — from term sheets, not docs** |

**Retracted claims**, recorded so they do not resurface:

- *"Razorpay activation takes 25–30 business days"* — no primary source. The
  cited third-party page does not contain the figure. Treat as unknown (B2).
- *"Cashfree cannot reprice an existing subscription"* — **false.**
  `CHANGE_PLAN` exists in the `2025-01-01` manage-subscription schema. It is
  rejected on architectural grounds (D5), not capability grounds.
- *"Include `priceVersionId` in the idempotency key"* — a bug from an earlier
  draft; it would permit a second debit for an already-paid period after a
  price change (§8.3).
- *"Price is pinned per subscription at signup"* (v2 D4) — **withdrawn.** Correct
  about consent, wrong as a default: it made the normal case (a price change
  reaching the base) an explicit migration campaign, and produced unbounded
  cohort sprawl. Replaced by policy-driven pricing (§7), which keeps pinning
  available as `PRICE_LOCK` where it is genuinely wanted.

---

## §24 — Honest limits

- **The port is a bet** that off-session-charge-against-stored-mandate remains
  universal. It has held across four gateways and two regulatory regimes. If a
  rail ever requires plan objects in order to charge, we do not support that rail.
- **Rejecting Periodic costs real code** — we own the scheduler, retries, and
  dunning that Cashfree would otherwise run: §10 + §11, roughly 600 lines and
  the hardest correctness surface here. The trade is deliberate and reversible
  only at high cost. It deserves the hardest scrutiny in the audit.
- **G2 and G7 catch shapes, not intent.** Someone can still store a price in a
  differently-named column or a config file. The plan-time SSOT read and code
  review remain the only defence against a semantic rebuild.
- **`FOLLOW_CURRENT_PRICE` moves a class of risk rather than removing it.**
  Under pinning, a bad catalog edit affected only new signups; now one commit
  can reprice the entire base. The rate limiter and the notice window (§7.6)
  bound the blast radius, and shadow mode (§18.1) should catch it — but the
  mistake is now *fast* where pinning made it slow. This is a deliberate trade
  for a business model that wants prices to actually move, and it raises the
  stakes on catalog-edit review.
- **Jurisdiction verification is best-effort.** A determined actor with a
  matching card and address can still obtain regional pricing. §6.5 raises the
  cost and creates an audit trail; it does not make fraud impossible.
- **Offline entitlement leaks revenue by design** (§13). Bounded at 72h,
  accepted deliberately, because the alternative breaks the product's core
  promise to a 2G user.
- **§15 tax treatment needs an accountant**, not an architect. LUT, place of
  supply, and deferred revenue are flagged, not solved.
- **US/UK domestic is out of scope** and this document does not pretend otherwise.
- **No MDR figure is asserted anywhere** (B4). Unit economics are unmodelled here.
