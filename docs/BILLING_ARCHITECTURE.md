# HisaabPro — Billing & Subscription Architecture

> **Status:** DRAFT — spec for `/start-epic subscription-ssot-and-global-billing`
> **Created:** 2026-07-26
> **Author:** Sawan (with Claude)
> **Supersedes:** ad-hoc Razorpay coupling in `server/prisma/schema.prisma` +
> `server/src/services/razorpay*.ts`
> **Consumers:** `architect` (must produce ARCHITECTURE.md against this),
> `architecture-auditor` (must attack this), `security`, `task-manager`
>
> This document is the **specification**, not the design. It states the
> invariants, the contracts, and the failure modes. The architect turns it into
> a migration sequence and module graph.

---

## 0. Why this document exists

DudhHisaab shipped a subscription system where the price lived in Razorpay
(`razorpayPlanId String? @unique`). Changing the price in the app did not change
what existing subscribers paid, and there was no endpoint that could fix it.
The revenue was permanently pinned to a number stored in someone else's
database.

HisaabPro's schema currently contains **the same column**
(`Subscription.razorpayPlanId`). No production mandates exist yet. This is the
last cheap moment to fix it.

The scope of this document is deliberately wider than "pick a gateway,"
because the gateway is the least important decision on this page.

---

## 1. First principles

Seven invariants. Each is testable; each has a mechanical guard named in §17.

| # | Invariant | Violation looks like |
|---|-----------|----------------------|
| **I1** | **The gateway moves money. It never holds truth.** | Reading entitlement, price, or status back from a provider API |
| **I2** | **Price exists in exactly one system: our `PriceVersion` table.** | A `createPlan()` call; a `providerPlanId` column |
| **I3** | **Price rows are immutable. A change is a new version.** | `UPDATE price_version SET amount_minor = …` |
| **I4** | **Every rupee attempted is a row before the API call, not after.** | Charging first and recording on success |
| **I5** | **Every charge is idempotent under our key, not the provider's.** | Retry producing two debits |
| **I6** | **Entitlement is derived from our state machine only.** | Granting access on an HTTP 200 from the gateway |
| **I7** | **A charge above the mandate ceiling fails in our code, before the network.** | A ceiling breach arriving back as a generic decline |

**I7 deserves emphasis.** No gateway on earth — Cashfree, Razorpay, Stripe, or
NPCI itself — permits raising a mandate's maximum amount after authorization.
The ceiling is a one-shot, permanent, per-subscriber decision. It is the only
pricing agility that will ever exist for that subscriber.

---

## 2. Layer map

```
┌──────────────────────────────────────────────────────────────┐
│ L6  Entitlement       entitlement-jwt.service.ts             │  ✅ exists
│                       signed claims → what the user can do    │
├──────────────────────────────────────────────────────────────┤
│ L5  State machine     subscription-state-machine.ts           │  ✅ exists
│                       19 transitions, pure, no I/O            │
├──────────────────────────────────────────────────────────────┤
│ L4  Catalog           PriceVersion (immutable, versioned)     │  ⚠️ partial
│                       plans.ts = features; PriceVersion = ₹    │
├──────────────────────────────────────────────────────────────┤
│ L3  Money ledger      PaymentAttempt · Settlement · Recon     │  ❌ MISSING
│                       append-only; the source of MRR          │
├──────────────────────────────────────────────────────────────┤
│ L2  Billing cycle     scheduler · dunning · pre-debit notice  │  ⚠️ partial
│                       proration · re-mandate flow             │
├──────────────────────────────────────────────────────────────┤
│ ══  PORT             BillingProvider — one interface          │  ❌ MISSING
├──────────────────────────────────────────────────────────────┤
│ L1  Drivers          cashfree · stripe · razorpay · fake      │  ❌ MISSING
└──────────────────────────────────────────────────────────────┘
```

L5 and L6 already exist and are genuinely good — pure, tested, provider-free.
The epic is L1–L4 plus the port. **Nothing above the port may import a driver,
a provider SDK, or a provider-named symbol.** That rule is mechanically
enforced (§17, guard G1).

---

## 3. The port

### 3.1 The one primitive we buy

Do not buy a "subscription product." Buy exactly one primitive, which every
serious gateway offers under a different name:

> **Charge this stored mandate, off-session, for an amount I specify at call time.**

| Provider | Product name |
|---|---|
| Cashfree | On-Demand subscription → *Raise Payment* |
| Razorpay | charge-at-will / S2S recurring |
| Stripe | `PaymentIntent` + `off_session: true` + saved PM |
| GoCardless | ad-hoc payment against a mandate |

Same primitive, four names. This symmetry is what makes global expansion a
driver file rather than a project.

### 3.2 Interface

```ts
// server/src/services/billing/billing-provider.port.ts   ← THE SSOT
export type Currency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'AED' | 'SAR'

export type Rail =
  | 'UPI_AUTOPAY' | 'ENACH'        // India
  | 'CARD' | 'SEPA_DD' | 'ACH'     // global

export type ChargeState = 'CAPTURED' | 'PENDING' | 'FAILED'

/** Normalized across every driver. Drives the dunning ladder. */
export type FailureCode =
  | 'INSUFFICIENT_FUNDS'   // retryable
  | 'TECHNICAL'            // retryable
  | 'MANDATE_REVOKED'      // terminal — do NOT retry
  | 'MANDATE_PAUSED'       // terminal until resumed
  | 'CEILING_EXCEEDED'     // must never reach a driver (I7)
  | 'AUTH_REQUIRED'        // needs on-session SCA (Stripe/EU)
  | 'UNKNOWN'

export interface MandateRef {
  provider: ProviderId
  providerId: string           // opaque; never parsed
  providerRef?: string | null  // token/PM id where the rail splits the two
}

export interface BillingProvider {
  readonly id: ProviderId                     // 'cashfree' | 'stripe' | 'razorpay'
  readonly rails: readonly Rail[]
  readonly currencies: readonly Currency[]

  // ── mandate lifecycle ─────────────────────────────────────────────
  /** Returns the ceiling the RAIL actually granted — may differ from requested. */
  createMandate(i: CreateMandateInput): Promise<CreatedMandate>
  fetchMandate(ref: MandateRef): Promise<RemoteMandateState>
  revokeMandate(ref: MandateRef): Promise<void>

  // ── the one verb that matters ─────────────────────────────────────
  chargeOffSession(i: {
    mandate: MandateRef
    amountMinor: number         // integer minor units. never float
    currency: Currency
    idempotencyKey: string      // OURS. see §6.3
    descriptor: string          // bank-statement text
  }): Promise<{
    state: ChargeState
    providerChargeId: string
    failureCode?: FailureCode
    rawStatus: string           // logged, never branched on
  }>

  // ── compliance, where the rail requires it ────────────────────────
  /** NPCI mandates T-24h pre-debit notice. No-op on Stripe rails. */
  sendPreDebitNotice?(i: PreDebitInput): Promise<void>

  // ── refunds ───────────────────────────────────────────────────────
  refund(i: { providerChargeId: string; amountMinor: number;
              idempotencyKey: string }): Promise<RefundResult>

  // ── inbound ───────────────────────────────────────────────────────
  /** Verify signature + normalize. Returns null for events we ignore. */
  parseWebhook(raw: Buffer, headers: Record<string, string>): ProviderEvent | null

  /** Daily settlement file → ledger reconciliation input (§11). */
  fetchSettlements?(dateISO: string): Promise<SettlementLine[]>
}
```

### 3.3 What is deliberately absent

**There is no `createPlan`.** No provider plan objects, ever, on any rail. That
absence *is* the architecture — it is the door DudhHisaab walked through, and
it is welded shut here. A driver that needs a plan object to charge is a driver
we do not use.

### 3.4 Rail routing

Derived, never stored on the business:

```ts
// billing-router.ts — pure, ~40 lines, exhaustively unit-tested
INR                          → cashfree  (UPI_AUTOPAY, fallback ENACH)
USD | GBP | EUR | AED | SAR  → stripe    (CARD, SEPA_DD, ACH)
```

Razorpay remains implemented as a **second India driver**. It is not a
"pricing fallback" — it cannot update UPI subscriptions at all — it is a
*liquidity* fallback for the case where Cashfree is down or declines
onboarding. Because it sits behind the same port and we never ask it to
remember a price, its update limitation is irrelevant to us.

---

## 4. Gateway decision

| Region | Provider | Product | Why |
|---|---|---|---|
| India | **Cashfree** | On-Demand subscription + Raise Payment | No plan objects ⇒ structurally cannot mirror our catalog. Variable amount per charge up to `plan_max_amount` |
| Global | **Stripe** | Off-session PaymentIntent on saved PM | Same primitive; broadest currency/rail coverage; strong idempotency semantics |
| India (fallback) | Razorpay | charge-at-will | Behind the same port; config flip, not a migration |

**Explicitly rejected: Cashfree Periodic + `CHANGE_PLAN`.** It works, and it
would hand Cashfree the schedule, retries, and dunning — genuinely less code.
But it requires a Cashfree plan object per price point, which recreates the
external pricing mirror that this entire epic exists to eliminate. Choosing it
would be choosing the known failure mode on purpose. **This trade is the single
most important decision in the document and the auditor should attack it.**

### Open (blocking, external)

- **B1** — Cashfree *Controlled Notification* / *Controlled Execution*
  semantics. If these are the NPCI T-24h pre-debit primitives, Cashfree owns
  the compliance machinery and we own only scheduling + retries. Changes
  service count. **Verify before the architect runs.**
- **B2** — Recurring-payments activation lead time, Cashfree and Stripe.
  Support request; no published SLA (the widely-cited 25–30 business days
  figure has no primary source and is retracted). Likely the longest-lead
  item — **file both tickets today**, in parallel with build.

---

## 5. Data model

### 5.1 Neutralize what exists

No production mandates exist yet, so these are free today and expensive later.

| Current | Change | Reason |
|---|---|---|
| `Subscription.razorpaySubId` | → `providerRef String?` | Provider in the name |
| **`Subscription.razorpayPlanId`** | **DROP** | I2. The DudhHisaab failure, verbatim |
| `Subscription.paymentMethod = 'RAZORPAY'` | split → `rail: Rail` + `provider: ProviderId` | Conflates method with vendor |
| `Subscription.lastWebhookEventId` | → `lastProviderEventId` | Naming |
| `model UpiMandate` | → `model Mandate` + `rail: Rail` | India-only concept in a global type |
| `Mandate.razorpayMandateId/TokenId` | → `providerId` + `providerRef` | Naming |
| `Mandate.maxAmountPaise` | → `ceilingMinor Int` + `currency` | Currency baked into the name |
| `SubscriptionEvent.razorpayEventId` | → `providerEventId` | Keep the sparse `@unique` — it is correct |
| *(absent)* | **ADD `currency` to Subscription, Mandate, every money row** | Blocks global entirely |
| `PaymentMethod` type (`…\|'RAZORPAY'`) | replace with `Rail` union | Same conflation in TS |

Keep unchanged (already correct): `subscriptionState` + its 7 states, the 19
transitions, `SubscriptionEvent` as an append-only log, `vpaLast4` masking,
integer minor units, the entitlement JWT claim shape.

### 5.2 New: the money ledger

`SubscriptionEvent` is an event log — it answers *"what happened to this
subscription."* It cannot answer *"how much did we attempt to collect in June,
how much settled, and how much is still in flight."* Those are different
questions and need a different table.

```prisma
/// Append-only. One row per charge ATTEMPT, written BEFORE the network call (I4).
model PaymentAttempt {
  id             String    @id @default(cuid())
  businessId     String
  subscriptionId String
  mandateId      String?
  priceVersionId String?                        // what we believed the price was

  amountMinor    Int
  currency       String
  idempotencyKey String    @unique              // OURS (§6.3)

  state          String    @default("CREATED")  // CREATED|PENDING|CAPTURED|FAILED|REFUNDED
  attemptNo      Int       @default(1)          // dunning ladder position
  failureCode    String?                        // normalized FailureCode
  rawStatus      String?                        // provider verbatim, for forensics

  provider          String
  providerChargeId  String?  @unique
  settledAt         DateTime?                   // when money actually landed
  settlementId      String?

  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([businessId, createdAt])
  @@index([subscriptionId, createdAt])
  @@index([state, createdAt])                   // in-flight sweep
  @@index([settlementId])
}

/// One row per provider settlement line. Reconciliation input (§11).
model SettlementRecord {
  id              String   @id @default(cuid())
  provider        String
  providerSettlementId String
  settledOn       DateTime
  grossMinor      Int
  feeMinor        Int
  taxMinor        Int
  netMinor        Int
  currency        String
  matchedAttempts Int      @default(0)
  unmatchedMinor  Int      @default(0)          // > 0 ⇒ alert
  raw             Json     @default("{}")
  createdAt       DateTime @default(now())

  @@unique([provider, providerSettlementId])
  @@index([settledOn])
}
```

`state` transitions are **forward-only**: `CREATED → PENDING → CAPTURED |
FAILED`, and `CAPTURED → REFUNDED`. Enforced in the writer, tested.

**Why `CREATED` before the network call:** if the process dies between the API
call and the response, a row without `CREATED` means an untracked debit. With
it, the in-flight sweep (§8.4) finds the orphan and resolves it from the
provider.

### 5.3 New: versioned price catalog

```prisma
/// IMMUTABLE. A price change inserts a new row; it never updates one (I3).
model PriceVersion {
  id            String   @id @default(cuid())
  tier          String                   // FREE | PRO | BUSINESS | PRO_MAX
  currency      String
  amountMinor   Int
  interval      String                   // MONTHLY | YEARLY
  ceilingMultiplier Float @default(2.0)  // → mandate ceiling at signup
  effectiveFrom DateTime
  supersededBy  String?  @unique
  note          String?                  // "2026 Q3 rupee promo"
  createdAt     DateTime @default(now())

  @@unique([tier, currency, interval, effectiveFrom])
  @@index([tier, currency, supersededBy])
}
```

`plans.ts` keeps its job — **feature limits per tier** — and loses any notion
of money. Features are code (they ship with the build); prices are data (they
change without a deploy, and old ones must survive).

---

## 6. Price cohorts — the subtlety

### 6.1 The naive rule is dangerous

"The catalog is the only place a price exists" is necessary but **not
sufficient**. Taken literally it means editing the catalog silently reprices
every existing subscriber at their next charge. That is the *opposite* of the
DudhHisaab failure and strictly worse: DudhHisaab failed to reprice; this
would reprice **without consent**. Under NPCI mandate rules and Indian
consumer law, that is a compliance incident, not a UX bug.

### 6.2 The rule

> `Subscription.priceVersionId` is **pinned at signup**. The scheduler charges
> the pinned version. A catalog change creates a new version and affects
> **nobody** until an explicit, consented cohort migration moves them.

Grandfathering becomes a query (`WHERE priceVersionId = …`), not a spreadsheet.
Cohort migration is an explicit admin operation with its own audit trail,
notification, and — if the new price exceeds the subscriber's ceiling — a
re-mandate flow (§7.2).

This is still one SSOT. One table holds every price that has ever existed. It
simply has time as a dimension.

### 6.3 Idempotency key

Ours, deterministic, never the provider's:

```
sha256(subscriptionId | priceVersionId | billingPeriodStartISO | attemptNo)
```

Same period + same attempt ⇒ same key ⇒ the provider dedupes even if our
process died mid-call. A dunning retry increments `attemptNo`, producing a new
key — a *deliberate* second debit attempt, distinguishable from an accidental
double-send.

---

## 7. The ceiling

### 7.1 Setting it

At mandate creation: `ceilingMinor = priceVersion.amountMinor × ceilingMultiplier`
(default **2.0**), disclosed verbatim in the consent screen — *"HisaabPro may
debit up to ₹X per month. You will be notified 24 hours before every debit."*

`createMandate` returns the ceiling **the rail actually granted**, which may be
lower than requested. Persist the granted value, never the requested one.

Multiplier trade-off, stated plainly: too low and you can never raise prices
without a full re-mandate campaign (this is exactly the myBillBook ₹499/₹499
situation — max = price means *every* future increase fails); too high and the
consent screen looks alarming and hurts conversion. **2× is the recommendation,
and it is a product decision the auditor should challenge, not an engineering
constant.**

### 7.2 Enforcing it (I7)

```ts
// in charge.service.ts, BEFORE any driver call
if (amountMinor > mandate.ceilingMinor) {
  throw new CeilingExceededError(subscriptionId, amountMinor, mandate.ceilingMinor)
}
```

Never let this reach the provider. A rail-side ceiling rejection is
indistinguishable from a bank decline, so the dunning ladder would retry it —
forever, pointlessly, burning rail reputation on a charge that is *guaranteed*
to fail.

`CEILING_EXCEEDED` is terminal. It routes to the **re-mandate flow**: notify →
collect a new mandate at the new ceiling → charge → revoke the old mandate.
Order matters — revoking first leaves the subscriber uncollectable if they
abandon the new consent.

Design this flow now even if it ships later. Retrofitting it means the
first cohort is permanently stuck at their signup ceiling.

---

## 8. Scheduler

### 8.1 Query, never timer

```sql
SELECT … FROM "Subscription"
WHERE "nextBillingAt" <= now()
  AND "subscriptionState" IN ('ACTIVE','PROMO_ACTIVE','PAST_DUE')
  AND "autoRenew" = true
```

Idempotent and self-healing by construction: a missed cron run (dyno restart,
deploy) simply means the next run picks up a larger due set. A fire-once timer
loses that subscriber's revenue permanently and silently.

### 8.2 Exactly-once under multiple instances

Two Render instances running one cron = double charge. Two layers:

1. **Claim-on-read** —
   `UPDATE "Subscription" SET "billingClaimedAt" = now() WHERE id = ANY(…) AND ("billingClaimedAt" IS NULL OR "billingClaimedAt" < now() - interval '15 min') RETURNING id`
   Only the winner proceeds. Stale claims self-expire.
2. **Idempotency key** (§6.3) — backstop. Even a lost race cannot double-debit,
   because both instances compute the same key.

Belt and braces. The key alone is *nearly* sufficient; the claim prevents the
duplicated side effects (notifications, ledger rows) that the key does not cover.

### 8.3 Calendar correctness

- **Anchor day, not date arithmetic.** Store `billingAnchorDay = 31`. Jan 31 →
  Feb 28 → **Mar 31**, not the Feb-28-forever drift naive `addMonths` produces.
- **Timezone** — India bills on **IST** calendar days. `nextBillingAt` is UTC in
  the column; all day-boundary math converts to the subscription's zone first.
- **T-24h pre-debit notice** is scheduled off `nextBillingAt`, and a charge is
  **blocked** if the notice was not confirmed sent (NPCI compliance is a
  precondition, not a best-effort side effect).

### 8.4 In-flight sweep

Every 15 min: `PaymentAttempt WHERE state IN ('CREATED','PENDING') AND createdAt < now() - 15min`
→ `fetchCharge` from the provider → resolve. Catches process death between the
ledger write and the API response, and UPI's asynchronous settlement.

---

## 9. Dunning

| Attempt | When | Notify | On `INSUFFICIENT_FUNDS` / `TECHNICAL` |
|---|---|---|---|
| 1 | `nextBillingAt` | pre-debit T-24h | → attempt 2 |
| 2 | D+1 | "payment failed" | → attempt 3 |
| 3 | D+3 | reminder | → attempt 4 |
| 4 | D+5 | warning | → attempt 5 |
| 5 | D+7 | final warning | → `grace.expired` → **LOCKED** |

**Terminal immediately — no retries:** `MANDATE_REVOKED`, `MANDATE_PAUSED`,
`CEILING_EXCEEDED`, `AUTH_REQUIRED`. Retrying these is guaranteed to fail and
damages rail standing. Each routes to its own user-facing recovery flow.

Maps onto the existing state machine without new states:
`subscription.charged.failed` → `PAST_DUE` (`set_grace`), `grace.expired` →
`LOCKED`. **`gracePeriodEndsAt` must equal the attempt-5 date** — two sources of
truth for "when does access stop" is a bug waiting to happen. Assert it in the
writer.

---

## 10. Async settlement & webhooks

### 10.1 `PENDING` is not `CAPTURED`

UPI Autopay returns `PENDING`; money settles later. **Entitlement is granted on
`CAPTURED` only.** Granting on API-200 gives away free service on every charge
that later fails, and the failure arrives hours after the user is already using
the product.

The existing state machine gets this right — `payment.captured.*` triggers, not
`payment.initiated.*`. Preserve that.

### 10.2 Webhook rules

1. **Verify signature first**, before parsing, in the driver. Body must be raw
   `Buffer` — a JSON body-parser upstream breaks HMAC verification.
2. **Idempotent by `providerEventId`** — the existing sparse `@unique` on
   `SubscriptionEvent` is exactly right. Reuse it; do not invent a second
   mechanism.
3. **Out-of-order tolerance.** Webhooks are not ordered. Never apply a state
   transition that is stale relative to the ledger; the `PaymentAttempt` state
   machine is forward-only, so a late `PENDING` after a `CAPTURED` is dropped.
4. **Ack fast, process async.** Return 200 immediately after persisting the raw
   event; process from the queue. A slow handler causes provider retries and
   duplicate delivery.
5. **Unknown event types are logged and ignored**, never 500 — a 500 makes the
   provider retry forever and eventually disable the endpoint.

---

## 11. Reconciliation

Daily job: pull the settlement file, match each line to a `PaymentAttempt` by
`providerChargeId`, write a `SettlementRecord`, stamp `settledAt`.

Alert on:

- `unmatchedMinor > 0` — money we cannot attribute
- Attempt `CAPTURED` for > 7 days with no `settledAt` — money we believe we
  earned and never received
- Settlement line with no matching attempt — a charge we did not initiate

Without this, gateway errors are discovered by a customer, not by us. This is
the difference between a billing system and a billing integration.

---

## 12. Proration, upgrades, downgrades

| Path | Rule |
|---|---|
| **Upgrade** mid-cycle | Charge `(new − old) × remainingDays / periodDays`, immediately, off the existing mandate. Entitlement changes on `CAPTURED`. If it exceeds the ceiling → re-mandate flow (§7.2) |
| **Downgrade** | Scheduled at period end. Existing `pendingDowngradeTier` column already models this — reuse it. Never refund mid-cycle by default |
| **Cancel** | Access runs to `expiresAt`; `autoRenew = false`; mandate revoked at period end, not immediately |
| **Reactivate** within grace | Existing transitions 13/14/17/19 cover this |

Proration rounds **in the customer's favour** (floor). The rounding rule is a
one-line pure function with its own test — it is exactly the kind of thing that
silently loses ₹1 × 10,000 subscribers.

---

## 13. Refunds & chargebacks

- Refund is a **new ledger row** referencing the original, never an update to it
  (append-only, I4).
- Full refund within the period → `CANCELLED` + entitlement revoked at once.
- Partial/goodwill refund → no state change.
- **Chargeback** → `MANDATE_REVOKED` treatment + immediate `LOCKED`, plus an
  ops alert. Never auto-retry into a dispute.
- Every refund requires `actorUserId` + reason in `SubscriptionEvent` — money
  leaving must be attributable to a human.

---

## 14. Global

### 14.1 Cheap part — payments

Currency on every money row + rail routing (§3.4). Scheduler, dunning,
entitlement, state machine, and catalog are written **once** and never branch
on country. Per-rail differences are confined to three places:

1. Pre-debit notice — required on NPCI, no-op on Stripe (optional port method)
2. Failure taxonomy — each driver normalizes to `FailureCode`
3. SCA / `AUTH_REQUIRED` — EU cards can demand on-session re-auth; India cannot

### 14.2 Expensive part — tax and compliance ⚠️ BLOCKED

**Open question B3 — the last input needed before scoping:**

| If "global" means | Additional scope |
|---|---|
| **Diaspora + Gulf** (Indian-context billing, foreign cards) | Stripe + currency column. Essentially free. Export-of-services GST treatment, LUT filing |
| **US/UK domestic SMBs** | US sales-tax nexus (50 states, economic thresholds), UK/EU VAT registration + MOSS filing, non-GST invoice formats, local consumer-cancellation law, possibly a local entity |

The second is **not a driver — it is a second product**. It should be a
separate epic with its own scope, not absorbed here. This document assumes
diaspora+Gulf until told otherwise, and marks the boundary explicitly so the
assumption is visible rather than buried.

---

## 15. Security & PII

- Provider secrets via `lib/env.ts` only — **high-risk path**, needs `architect`
- Webhook signature verification is **mandatory**, per driver, on raw bytes
- Never persist: full VPA, PAN, card number, CVV. `vpaLast4` only (already correct)
- `PaymentAttempt.rawStatus` is a status string, **not** the raw provider
  payload — no PII into forensics columns
- Ceiling changes, cohort migrations, refunds, admin grants → `AuditLog` via
  `createAuditEntry` (the canonical writer; see project memory `audit-writer-ssot`)
- All billing queries scoped by `businessId` — cross-tenant billing reads are a
  P0 class of bug
- Rate-limit mandate creation per business (mandate-spam / rail-reputation abuse)

---

## 16. Observability

Minimum viable, emitted as metrics not just logs:

| Metric | Alert |
|---|---|
| Charge success rate, by rail | < 90% over 1h |
| Involuntary churn (LOCKED via dunning ÷ active) | weekly trend |
| MRR by tier / currency / price cohort | dashboard |
| Attempts `PENDING` > 24h | any |
| Unmatched settlement amount | > 0 |
| Webhook processing lag | p99 > 60s |
| Mandates expiring in 30d | count |

MRR is computed **from `PaymentAttempt`**, not from subscription counts ×
catalog price. Those two numbers diverging is itself the signal that something
is wrong.

---

## 17. Testing & mechanical guards

### 17.1 Provider contract suite

The port is only an abstraction if drivers are provably interchangeable.
**One shared test suite** runs against every driver including a `FakeProvider`:

- charge → `CAPTURED`; same idempotency key twice → one debit
- each `FailureCode` reachable and correctly normalized
- webhook signature: valid → parsed; tampered → `null`; replayed → deduped
- mandate revoke → subsequent charge yields `MANDATE_REVOKED`
- `createMandate` returning a lower-than-requested ceiling is persisted as granted

A driver that cannot pass the shared suite does not ship. `FakeProvider` is
also what unit tests for L2–L6 use — **no test above the port ever touches a
real gateway.**

### 17.2 Mechanical guards (SSOT registry rows)

| ID | Guard | Mechanism |
|---|---|---|
| **G1** | No import of a driver or provider SDK above the port | ESLint `no-restricted-imports` on `services/billing/drivers/**` + `cashfree`/`stripe`/`razorpay` outside `drivers/` |
| **G2** | No `providerPlanId`-shaped column ever returns | `ssot.config.mjs` forbidden regex `/(razorpay\|cashfree\|stripe|provider)PlanId/i` |
| **G3** | No float money | existing enforce.js pattern; extend to `amountMinor`/`ceilingMinor` |
| **G4** | No direct `paymentAttempt.create` outside the ledger writer | guarded gate, same shape as the existing `auditLog.create` gate |
| **G5** | Every driver registered in the contract suite | test that enumerates `drivers/` and asserts suite coverage |

G2 is the one that makes this document self-enforcing after everyone forgets it.

### 17.3 Property tests

- Anchor-day math over 5 years incl. leap years — never skips or repeats a month
- Proration never exceeds the full period price; never negative
- Dunning ladder always terminates
- Ledger state machine is forward-only under any event permutation

---

## 18. Migration sequence

Ordered so each step is independently revertible.

| # | Step | Risk | Gate |
|---|---|---|---|
| 1 | Add `PriceVersion`, `PaymentAttempt`, `SettlementRecord`; add `currency`, `priceVersionId`, `billingAnchorDay`, `billingClaimedAt` as **nullable** | low | migration applies clean |
| 2 | Seed `PriceVersion` from current `plans.ts` money values | low | row count matches tiers |
| 3 | Backfill `currency='INR'`, `priceVersionId`, `billingAnchorDay` on existing rows | low | zero nulls |
| 4 | Make backfilled columns `NOT NULL` | low | — |
| 5 | Port interface + `FakeProvider` + contract suite | none | suite green |
| 6 | Cashfree driver; ledger writer; charge service; ceiling guard | med | contract suite + sandbox charge |
| 7 | Scheduler + claim lock + dunning + in-flight sweep | med | property tests; 2-instance no-double-charge test |
| 8 | Webhooks + reconciliation | med | replay + tamper tests |
| 9 | **Rename** `UpiMandate`→`Mandate`, drop `razorpayPlanId`, rename provider columns | **med — do while zero prod mandates exist** | tsc + full suite |
| 10 | Stripe driver | low | contract suite (unchanged) |

**Step 9 is cheap today and expensive forever after.** Do not defer it past
first production mandate.

Schema steps are **high-risk paths** — `architect` required, and
`prisma migrate dev` only, never `db push` (`.claude/rules/PRISMA_MIGRATION_RULES.md`).

---

## 19. File plan

Every row ≤ 250 lines. Layers per CLAUDE.md file discipline.

| path | action | est | layer |
|---|---|---|---|
| `server/src/services/billing/billing.types.ts` | create | ~130 | types |
| `server/src/services/billing/billing-provider.port.ts` | create | ~120 | port |
| `server/src/services/billing/billing.constants.ts` | create | ~60 | constants |
| `server/src/services/billing/billing-router.ts` | create | ~40 | utils (pure) |
| `server/src/services/billing/idempotency-key.util.ts` | create | ~40 | utils (pure) |
| `server/src/services/billing/proration.util.ts` | create | ~70 | utils (pure) |
| `server/src/services/billing/anchor-date.util.ts` | create | ~90 | utils (pure) |
| `server/src/services/billing/drivers/fake.provider.ts` | create | ~150 | driver |
| `server/src/services/billing/drivers/cashfree.provider.ts` | create | ~230 | driver |
| `server/src/services/billing/drivers/cashfree.mapper.ts` | create | ~110 | driver (pure) |
| `server/src/services/billing/drivers/stripe.provider.ts` | create | ~200 | driver |
| `server/src/services/billing/drivers/razorpay.provider.ts` | create | ~200 | driver |
| `server/src/services/billing/ledger.writer.ts` | create | ~160 | service |
| `server/src/services/billing/ledger.queries.ts` | create | ~110 | service |
| `server/src/services/billing/price-catalog.service.ts` | create | ~130 | service |
| `server/src/services/billing/charge.service.ts` | create | ~190 | service (orchestration) |
| `server/src/services/billing/mandate.service.ts` | create | ~180 | service |
| `server/src/services/billing/remandate.service.ts` | create | ~120 | service |
| `server/src/services/billing/dunning.service.ts` | create | ~150 | service |
| `server/src/services/billing/reconciliation.service.ts` | create | ~160 | service |
| `server/src/services/billing/cron-billing-run.ts` | create | ~130 | cron |
| `server/src/services/billing/cron-inflight-sweep.ts` | create | ~80 | cron |
| `server/src/services/billing/cron-settlement-pull.ts` | create | ~90 | cron |
| `server/src/services/billing/webhook.dispatcher.ts` | create | ~140 | service |
| `server/src/routes/billing/webhook.routes.ts` | create | ~110 | route |
| `server/src/routes/billing/mandate.routes.ts` | modify | ~60 | route |
| `server/src/config/plans.ts` | modify | −40 | constants (remove money) |
| `server/prisma/schema.prisma` | modify | ~+120 | schema ⚠️ high-risk |
| `ssot.config.mjs` | modify | ~+30 | registry (G1–G5) |

**~28 files, ~3,600 lines.** Plus the contract suite and property tests.

---

## 20. Acceptance criteria

**Backend**
- [ ] `npx tsc -b --noEmit` clean
- [ ] Contract suite green against Fake + Cashfree sandbox
- [ ] Same idempotency key twice ⇒ exactly one debit (integration, real DB)
- [ ] Two concurrent scheduler instances ⇒ exactly one charge per subscription
- [ ] Charge above ceiling ⇒ `CeilingExceededError`, **zero** network calls
- [ ] Editing a `PriceVersion` row ⇒ blocked; a change creates a new version
- [ ] Existing subscriber's charge amount unchanged after a catalog change
- [ ] `MANDATE_REVOKED` ⇒ zero retries
- [ ] Tampered webhook signature ⇒ rejected; replayed event ⇒ deduped
- [ ] Anchor-day property test over 5 years, incl. leap
- [ ] Reconciliation flags an unmatched settlement line
- [ ] `npm run ssot` exit 0 · `node scripts/enforce.js` 0 errors
- [ ] G1 proven: an import of a driver above the port fails lint

**Frontend**
- [ ] Mandate consent screen states the ceiling verbatim, en + hi
- [ ] 4 UI states on every billing screen; 320px clean
- [ ] Dunning states surface a recovery CTA
- [ ] Re-mandate flow reachable from a `CEILING_EXCEEDED` subscription

---

## 21. Decisions & open items

| ID | Item | Status |
|---|---|---|
| D1 | India = Cashfree On-Demand; global = Stripe; Razorpay = 2nd India driver | **decided** |
| D2 | No provider plan objects on any rail, ever | **decided (I2)** |
| D3 | Ceiling = 2× monthly, disclosed | **decided — auditor should challenge** |
| D4 | Price pinned per subscription; cohort migration is explicit + consented | **decided** |
| D5 | Reject Cashfree Periodic + `CHANGE_PLAN` | **decided — highest-value thing to attack** |
| B1 | Cashfree Controlled Notification/Execution semantics | **open — verify before architect** |
| B2 | Recurring activation lead time, both gateways | **open — file tickets now** |
| B3 | Diaspora+Gulf vs US/UK domestic SMBs | **open — BLOCKS §14.2 scope** |

**Retracted claims** (recorded so they don't resurface): Razorpay activation
"25–30 business days" — no primary source. "Cashfree cannot reprice an existing
subscription" — false; `CHANGE_PLAN` exists, and it is rejected on architectural
grounds (D5), not capability grounds.

---

## 22. Honest limits

- **The port is a bet** that off-session-charge-against-stored-mandate stays
  universal. It has held across four gateways and two regulatory regimes. If a
  rail ever requires plan objects to charge, we do not support that rail.
- **Rejecting Periodic costs real code** — we own the scheduler, retries, and
  dunning that Cashfree would otherwise run. That is roughly §8+§9, ~600 lines
  and the hardest correctness surface in the epic. The trade is deliberate and
  reversible only at high cost. It is the right thing to litigate hardest.
- **G2's regex catches the shape, not the intent.** Someone can still store a
  price in a differently-named column. The plan-time read and code review remain
  the only defence against a semantic rebuild.
- **US/UK domestic is out of scope** and this document does not pretend
  otherwise.
