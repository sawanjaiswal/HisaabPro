---
status: approved
feature: payments-collections-hub
created: 2026-05-05T23:45:00Z
approver: Sawan
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/routes/webhooks.ts
  - server/src/services/payments/**
  - server/src/services/collections/**
agents_invoked:
  - scope-writer (output: docs/payments-hub/PRD.md)
  - architect (output: docs/payments-hub/ARCHITECTURE.md)
  - security (output: docs/payments-hub/SECURITY_AUDIT.md)
  - task-manager (output: docs/payments-hub/TASKS.md)
acceptance:
  backend:
    - tsc clean across server + client
    - all curl proofs collected per PR (aging, reminders, payment links, statements, PTP)
    - all 8 security MB curl proofs collected (per Security Audit)
  frontend:
    - all screenshots: loading, error, empty, success per new screen
    - 320px verified on all new screens
    - dark theme verified across all Collections surfaces
---

# Payments & Collections Hub — Implementation Task Plan (v1)

## Executive Summary

8 PRs, ~180 hours, critical path 1 → 2 → 3 → 4 (foundation) then 5/6/7 in parallel, with 8 completing the release and cleanup. Architecture document is the source of truth for technical design; this document decomposes it into concrete per-PR tasks, acceptance gates, and merge blockers aligned to the 8 merge-blockers from the Security Audit.

**All amounts are paise (integer). All dates are UTC, persisted as ISO 8601 strings, displayed in Asia/Kolkata. All phone numbers normalized to E.164 (+91XXXXXXXXXX). All outstanding amounts in Indian number format (1,00,000 not 100000).**

---

## Proof Gate Matrix

### Per-PR Backend Proof Requirements

| PR # | PR Name | Routes | Curl Proof | Idempotency | Rate Limit | Security MB | Status |
|------|---------|--------|-----------|-------------|-----------|------------|--------|
| 1 | schema-permissions | — | `prisma migrate clean` ✓ | — | — | — | ⊗ |
| 2 | aging-engine | GET /api/collections/aging, GET /api/collections/aging/parties | summary 200 ✓, bucket drill-down 200 ✓, 401 unauth ✓ | — | — | — | ⊗ |
| 3 | aging-ui | (no new routes, client-side only) | — | — | — | — | ⊗ |
| 4 | payment-links | POST /api/payments/payment-links, webhook payment_link.paid | create 201 ✓, duplicate 200 (idempotent) ✓, webhook 200 ✓, bad sig 400 ✓, replay 200 no-op ✓ | yes (createIdempotencyKey) | 10/min ✓ | **MB-1, MB-2, MB-5** | ⊗ |
| 5 | bulk-reminders | POST /api/payments/reminders/bulk | 50-party batch 200 ✓, 51-party 400 ✓, 6th call in 60s 429 ✓, cross-tenant partyId 404 ✓ | yes (header) | 5/min, 50/call ✓ | **MB-3, MB-4, MB-6** | ⊗ |
| 6 | promise-to-pay | POST /api/collections/ptp, PATCH, DELETE, cron evaluator | create 201 ✓, past date 400 ✓, update OPEN 200 ✓, update BROKEN 409 ✓, delete BROKEN 409 ✓, cron flips OPEN→BROKEN correctly ✓ | yes (header) | 30/min ✓ | **MB-7, MB-8** | ⊗ |
| 7 | statement-pdf | GET /api/collections/statement/:partyId, POST /storage/statements | data endpoint 200 ✓, 401 unauth ✓, cross-tenant 404 ✓, PDF client-side gen < 2s ✓ | yes (share write) | — | — | ⊗ |
| 8 | polish-qa | — | (no new routes, feature flag removal) | — | — | — | ⊗ |

### Per-PR Frontend Proof Requirements

| PR # | PR Name | Screens | Screenshots (load/error/empty/success @ 320px) | Dark | Status |
|------|---------|---------|------|------|--------|
| 3 | aging-ui | AgingDashboard, AgingBucketList, PartyDetailDrilldown | 4 per theme ✓ | ✓ | ⊗ |
| 4 | payment-links | InvoiceDetail (link button), PaymentLinkSheet | 4 per state (no link / creating / success / paid / expired) ✓ | ✓ | ⊗ |
| 5 | bulk-reminders | ReminderComposerSheet, ReminderResultScreen | 5 per theme (empty / loading / preview / success / failed) ✓ | ✓ | ⊗ |
| 6 | promise-to-pay | PtpRecorderForm, CommitmentsSection, CollectionsAlert | 4 per state (form / success / open PTP row / broken PTP alert) ✓ | ✓ | ⊗ |
| 7 | statement-pdf | StatementPeriodPicker, StatementPDFPreview, ShareSheet | 4 per state (picker / loading / empty / preview) ✓ | ✓ | ⊗ |
| 8 | polish-qa | Collections tab, Payments tab, Party detail (all surfaces) | 320px no h-scroll ✓, dark mode ✓, copy review ✓ | ✓ | ⊗ |

---

## PR 1: Schema Migration & Collections Permissions

### Title & Branch
**Title:** `payments(schema): PromiseToPay + PaymentLink + ReminderLog models + collections.* perms`  
**Branch:** `payments/schema-migration`

### Scope Summary
Additive schema changes: 3 new models (`PromiseToPay`, `PaymentLink`, `ReminderLog`), 1 forward-compat shell (`CollectionCadence`), add relations to `Party`, `Document`, `Payment`. One migration SQL file. New permission module with 5 collection actions. No code changes.

### Files Touched
**Migrations:**
- `server/prisma/migrations/<ts>_payments_hub_schema/migration.sql` (new)

**Schema:**
- `server/prisma/schema.prisma` (3 new models + relations)

**Permissions:**
- `server/src/lib/permissions.ts` (add `collections: { view, remind, collect, ptp }` actions)
- `server/src/services/permissions-rbac.service.ts` (map roles to actions)

### Backend Tasks

1. **Create migration file** with:
   - `CREATE TABLE PromiseToPay` (id, businessId, partyId, invoiceId, amount, promisedDate, note, status, keptPaymentId, createdBy, createdAt, updatedAt)
   - `CREATE TABLE PaymentLink` (id, businessId, invoiceId, partyId, amount, razorpayLinkId, shortUrl, status, expiresAt, paidAt, razorpayPaymentId, createdAt, updatedAt)
   - `CREATE TABLE ReminderLog` (id, businessId, invoiceId, partyId, channel, templateKey, recipientPhone, renderedMessage, status, sentAt, isAutomatic, createdAt) — append-only, no updatedAt
   - `CREATE TABLE CollectionCadence` shell (id, businessId, autoRemindEnabled, frequencyDays, quietHoursStart, quietHoursEnd, maxRemindersPerInvoice, createdAt, updatedAt) — for Phase 2
   - Indexes per ARCHITECTURE: `(businessId, status)` on PromiseToPay/PaymentLink, `(promisedDate, status)` on PromiseToPay, `(expiresAt, status)` on PaymentLink, `(businessId, createdAt DESC)` on ReminderLog
   - Add relations from Party, Document, Payment (alter existing tables)

2. **Add relations to existing models:**
   - `ALTER TABLE Party ADD COLUMN promisesToPay, paymentLinks`
   - `ALTER TABLE Document ADD COLUMN paymentLinks, promisesToPay`
   - `ALTER TABLE Payment ADD COLUMN keptPtp` (inverse of PromiseToPay.keptPaymentId)

3. **Add AuditLog systemActor column** (additive, nullable):
   - `ALTER TABLE AuditLog ADD COLUMN systemActor VARCHAR(50) NULL`
   - Index: `(businessId, createdAt DESC)` (may already exist)

4. **Permission module changes:**
   - Extend `permissions.ts` with new collection actions:
     ```ts
     collections: {
       view: 'View collections dashboard',
       remind: 'Send payment reminders',
       collect: 'Create/manage payment links',
       ptp: 'Record and track payment promises',
     }
     ```
   - Map roles in `permissions-rbac.service.ts`:
     - `owner`: all 4 actions
     - `manager`: all 4 actions
     - `salesman`: view, remind, ptp (NOT collect — no payment links)
     - `viewer`: view only
   - Add `requirePermission('collections.<action>')` middleware factory (already exists for other modules; reuse pattern)

5. **Verify & test:**
   - `npx prisma migrate dev --name payments_hub_schema` on fresh DB
   - Prisma client regenerates with new models
   - No data loss, migration < 5 seconds
   - Rollback (documentation in `-- DOWN` comments)

### Frontend Tasks
None — schema-only PR.

### Acceptance / Proof Gates

**Backend:**
```bash
# Verify schema compiled
$ npx prisma generate && tsc --noEmit
# Expected: clean

# Run migration
$ npx prisma migrate dev --name payments_hub_schema
# Expected: Migration success, all 3 tables created with indexes

# Verify models in generated client
$ grep -n "PromiseToPay\|PaymentLink\|ReminderLog" node_modules/.prisma/client/index.d.ts
# Expected: 3 model exports present
```

**Estimated size:** Tiny (1 SQL migration file, ~200 lines)

### Merge Blockers
None specific to PR #1. Security audit §2 (Schema) is satisfied.

### Dependencies
None — foundation.

---

## PR 2: Aging Engine & API Endpoints

### Title & Branch
**Title:** `payments(collections): aging computation service + GET /api/collections/aging endpoints`  
**Branch:** `payments/aging-engine`

### Scope Summary
Server-side service `services/collections/aging.service.ts` computes receivables by age bucket (0–30, 31–60, 61–90, 90+), surfaces via two GET routes, caches in Redis with 5-min TTL. No UI, no webhooks. Pure data aggregation.

### Files Touched
**Server:**
- `server/src/services/collections/aging.service.ts` (new, 150 lines)
- `server/src/routes/collections/aging.route.ts` (new, 80 lines)
- `server/src/lib/cache.ts` (extend with `getOrCompute('aging:<businessId>')` utility — already exists)

**Client:**
- `src/features/collections/useAgingData.ts` (new TanStack Query hook, 40 lines)

### Backend Tasks

1. **Create `aging.service.ts`:**
   - `computeAgingBuckets(businessId, asOf: Date)` — reads all `Document` rows for business where `status ∈ {SAVED, SHARED, COMPLETED}` and `type = 'SALES_INVOICE'`, groups by age bucket based on `dueDate` (fallback: `documentDate + 30 days`), sums amounts
   - `getAgingBuckets(businessId)` — wraps above with Redis cache (key: `aging:${businessId}`, TTL 5 min)
   - `getAgingParties(businessId, bucket, page, limit)` — filters parties in a single bucket, with pagination cursor

2. **Create routes:**
   - `GET /api/collections/aging` → returns full summary (all 4 buckets, top 5 parties, broken PTP count, total receivable)
   - `GET /api/collections/aging/parties?bucket=current|31|61|91&page=1&limit=20` → returns paginated party list for one bucket

3. **Response shapes per PRD §7:**
   - `AgingBucketSummary`: buckets object with label, totalAmount, partyCount
   - `TopOutstandingParty`: partyId, name, phone, totalOutstanding, overdueInvoiceCount
   - `PartyInBucket`: partyId, name, phone, bucketAmount, totalOutstanding, overdueInvoiceCount, lastPaymentDate, openPtpCount, brokenPtpCount

4. **Validation:**
   - Require auth (existing middleware)
   - Scope to `req.user.businessId` — never accept businessId from URL
   - Bucket param must be enum value (400 if invalid)
   - Cursor pagination using `(partyId)` — safe, no offset enumeration

5. **Caching:**
   - Use existing `cache.getOrCompute()` wrapper with 5-min TTL
   - Cache key includes businessId
   - Cache invalidation on-write (when documents are created/paid/deleted — handled by document service hooks in next PRs)

### Frontend Tasks

1. **Create `useAgingData.ts` hook:**
   ```ts
   const query = useQuery({
     queryKey: ['collections', 'aging', businessId],
     queryFn: () => api.get('/api/collections/aging'),
     staleTime: 5 * 60 * 1000, // 5 min
     cacheReads: true, // IDB cache
   })
   ```

2. **No UI in this PR** — hook only, tested in PR #3.

### Acceptance / Proof Gates

**Backend:**
```bash
# GET aging summary (requires auth)
curl -H "Authorization: Bearer $TOKEN" https://api.local/api/collections/aging
# Expected: 200
# {
#   "success": true,
#   "data": {
#     "summary": {
#       "totalReceivable": 500000,
#       "buckets": {
#         "current": { "label": "0–30 days", "totalAmount": 100000, "partyCount": 5 },
#         "bucket_31": { ... },
#         ...
#       }
#     },
#     "topOutstanding": [ ... ],
#     "brokenPtps": [ ... ]
#   }
# }

# GET parties in bucket (requires auth)
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/aging/parties?bucket=current&page=1&limit=20'
# Expected: 200 with paginated parties

# Unauth access
curl https://api.local/api/collections/aging
# Expected: 401 UNAUTHORIZED

# Invalid bucket
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/aging/parties?bucket=invalid'
# Expected: 400 INVALID_BUCKET
```

**Frontend:**
- Hook compiles and exports correctly
- No errors when called with valid businessId

**Estimated size:** Small (3 files, ~270 lines)

### Merge Blockers
None specific to PR #2.

### Dependencies
PR #1 (schema)

---

## PR 3: Aging Dashboard UI — 4 States

### Title & Branch
**Title:** `payments(frontend): Collections tab + Aging dashboard with 4 UI states`  
**Branch:** `payments/aging-ui`

### Scope Summary
New bottom-nav tab "Collections" (5th position), landing on AgingDashboard screen. Shows 4 aging buckets (2×2 grid), top 5 outstanding parties, broken PTP alerts. Implements all 4 UI states: loading (skeleton), error (banner), empty (all caught up), success (populated). Drill-down to party list per bucket with pagination.

### Files Touched
**Client:**
- `src/app/layout/Navigation.tsx` (+20 lines, add Collections tab)
- `src/features/collections/CollectionsTab.tsx` (new, 80 lines, routes entry point)
- `src/features/collections/pages/AgingDashboard.tsx` (new, 150 lines, main screen)
- `src/features/collections/pages/AgingBucketList.tsx` (new, 100 lines, drill-down party list)
- `src/features/collections/pages/PartyDetailDrilldown.tsx` (new, 80 lines, optional P2 — can defer to later PR if needed)
- `src/features/collections/components/AgingBucketTile.tsx` (new, 50 lines, reusable bucket card)
- `src/features/collections/components/BrokenPtpAlert.tsx` (new, 40 lines)
- `src/features/collections/components/TopPartiesList.tsx` (new, 60 lines)
- `src/features/collections/components/LoadingSkeleton.tsx` (new, 50 lines)
- `src/features/collections/styles/aging.css` (new, color-coded buckets: green/amber/orange/red)

### Backend Tasks
None — routes already exist from PR #2.

### Frontend Tasks

1. **Add Collections tab to bottom navigation:**
   - Icon: coins/wallet (distinct from Payments)
   - Label: "Collections"
   - Route: `/collections` (new top-level route)
   - Position: 5th tab (after Payments)

2. **Create AgingDashboard (main screen):**
   - Fetch `useAgingData()` on mount
   - Render:
     - Loading state: skeleton grid for 4 buckets + top 5 parties (1–2 sec, then data from IDB)
     - Error state: banner "Could not load collections data. Tap to retry." with button, show stale data below (timestamp "As of X min ago")
     - Empty state: "All caught up!" with tick illustration, CTA "View All Payments"
     - Success state:
       - Total Outstanding strip (large teal text): "Rs X,XX,XXX"
       - 4 bucket tiles in 2×2 grid
       - Broken PTPs alert section (if any) — red pills "Party promised Rs X by Date — not paid"
       - Top 5 Outstanding Parties (horizontal scroll card or 5-row list)
   - Swipe-down to refresh (iOS native behavior)
   - Last updated timestamp with "Tap to refresh" affordance

3. **Create AgingBucketTile component:**
   - Shows: label (e.g., "0–30 days"), party count badge, amount in Indian format
   - Color coding: green (#10B981) for 0–30, amber (#F59E0B) for 31–60, orange (#EF6B2F) for 61–90, red (#EF4444) for 90+
   - Tap → navigate to AgingBucketList with `bucket` param

4. **Create AgingBucketList (drill-down):**
   - Query param: `bucket=current|31|61|91`
   - Fetch paginated parties for that bucket (via `GET /api/collections/aging/parties?bucket=X&page=Y`)
   - Render:
     - Loading: skeleton list
     - Error: banner + retry
     - Empty: no parties in this bucket
     - Success: paginated list showing partyId, name, phone (masked +91XXXXX1234), bucketAmount, lastPaymentDate, overdue invoice count, PTP badge count
   - Infinite scroll OR page controls (pagination)
   - Tap party row → PartyDetailDrilldown OR route to existing Party detail page with Collections context

5. **Create BrokenPtpAlert component:**
   - Red pill / alert card per PTP
   - Shows: party name, promised amount, promised date, "not paid" status
   - Tap → route to Promise-to-Pay detail (PR #6)

6. **Create TopPartiesList component:**
   - Horizontal scrollable cards (375px safe area) OR vertical 5-row list (350px min)
   - Per row: party name, total outstanding (large), status badge
   - Tap → PartyDetailDrilldown

7. **Create LoadingSkeleton component:**
   - Shimmer-animated skeleton cards matching layout
   - No text; pure shape
   - Matches success state layout so transition is invisible

8. **Styling:**
   - Generous whitespace
   - 8px padding inside tiles
   - Soft shadows (0.5px y-offset, 0.5px blur, 10% opacity)
   - 12px card radius
   - Responsive grid: 2×2 @ 375px, still 2×2 @ 320px (smaller tiles ~140px wide)
   - Dark mode: invert colors, maintain contrast

### Acceptance / Proof Gates

**Frontend:**
```
Screenshot: Loading state
- 4 skeleton bucket tiles visible
- Top 5 skeleton rows visible
- Shimmer animation running
- No blank white flash

Screenshot: Error state
- Red banner at top: "Could not load collections data. Tap to retry."
- Retry button tap-able
- Previously cached data shown below (older timestamp)

Screenshot: Empty state
- Illustration: tick over ledger
- Heading: "All caught up!"
- Sub-copy: "You have no outstanding receivables right now."
- CTA button: "View All Payments"

Screenshot: Success state (375px)
- Total Outstanding strip: "Rs 5,00,000" (large, teal)
- 4 bucket tiles (2×2 grid):
  - 0–30 days: Rs 1,00,000 (5 parties) — green
  - 31–60 days: Rs 1,50,000 (3 parties) — amber
  - 61–90 days: Rs 1,00,000 (2 parties) — orange
  - 90+ days: Rs 1,50,000 (4 parties) — red
- Broken PTPs alert (if any): red pills
- Top 5 Outstanding Parties: scrollable cards

Screenshot: Success state (320px)
- Same layout, no h-scroll
- Tiles shrink to fit but remain readable

Dark mode
- All screenshots in dark theme
- Colors adjusted per HP design system
- No white flashes, smooth contrast

Tap bucket tile → AgingBucketList renders
- Party list page loads
- Drill-down bucket matches selected tile
- Infinite scroll loads more parties

Swipe-down refresh
- Refetch triggers from server
- IDB cache updates
- Timestamp refreshes
```

**Cross-cutting:**
- 320px no overflow ✓
- 375px baseline ✓
- Dark mode tested ✓
- All `api()` calls use `cacheReads: true` ✓
- No raw `fetch()` in component files ✓
- TanStack Query invalidation on relevant mutations (PR #4+) ✓

**Estimated size:** Medium (10 files, ~600 lines)

### Merge Blockers
None specific to PR #3. Proof gate is screenshots + no console errors.

### Dependencies
PR #1, PR #2

---

## PR 4: Razorpay Payment Links — Webhook Integration

### Title & Branch
**Title:** `payments(payment-links): Razorpay integration + payment_link.paid webhook + idempotency`  
**Branch:** `payments/payment-links`

### Scope Summary
Server endpoints to create, get, cancel payment links via Razorpay API. Webhook handler for `payment_link.paid` event that auto-records payments and updates invoices. Client UI button on invoice detail. **This PR implements all 3 security merge-blockers (MB-1, MB-2, MB-5).**

### Files Touched
**Server:**
- `server/src/services/collections/payment-link.service.ts` (new, 180 lines)
- `server/src/services/razorpay/payment-link.client.ts` (new, 100 lines, API wrapper)
- `server/src/routes/payments/payment-links.route.ts` (new, 120 lines)
- `server/src/routes/webhooks.ts` (extend existing, +60 lines for payment_link events)
- `server/src/middleware/idempotency.ts` (extend if needed, or use existing)
- `server/src/lib/razorpay.ts` (utility: signature verification, env validation)

**Client:**
- `src/features/invoices/components/InvoiceDetail.tsx` (+40 lines, add Get Payment Link button)
- `src/features/collections/components/PaymentLinkSheet.tsx` (new, 150 lines, share sheet)
- `src/features/collections/usePaymentLink.ts` (new TanStack Query mutation, 50 lines)

### Backend Tasks

1. **Create `payment-link.service.ts`:**
   - `createPaymentLink(businessId, invoiceId, expiryDays)`:
     - Fetch invoice + party (validate businessId scope)
     - Validate invoice status ≠ DRAFT, balanceDue > 0
     - **MB-5 gate:** re-read `invoice.outstandingAmount` in same transaction, reject if > calculated or ≤ 0
     - Check for existing active link (CREATED status, not expired) — return 200 if found (idempotency)
     - Call Razorpay create endpoint with `{ amount, description, notify: { sms: false, email: false }, notes: { businessId, invoiceId, partyId, reference: invoiceNumber } }`
     - Store `PaymentLink` row: id, businessId, invoiceId, partyId, amount, razorpayLinkId, shortUrl, status=CREATED, expiresAt
     - AuditLog write: action=PAYMENT_LINK_CREATED, changes={ invoiceId, amountPaise, expireBy, shortUrl: 'rzp.io/i/XXX...XXX' (masked) }
     - Return created PaymentLink
   - `getPaymentLinks(businessId, invoiceId)` — returns all links for invoice (sorted by createdAt DESC)
   - `cancelPaymentLink(businessId, linkId)`:
     - Fetch link (scope check)
     - Validate status = CREATED (409 if not)
     - Call Razorpay cancel endpoint
     - Update link status = CANCELLED, AuditLog write
   - `processWebhookPaymentLinkPaid(event)` — **implements MB-1 + MB-2 + MB-5:**
     - **MB-1 (replay):** `INSERT INTO WebhookEvent (eventId, razorpayLinkId, ...) ON CONFLICT DO NOTHING` — if returns 0, exit 200 (no-op)
     - **MB-2 (tenant trust):** resolve businessId from local PaymentLink row keyed by razorpayLinkId (NEVER trust `notes.businessId`)
     - **MB-5 (amount tampering):** use actual paid amount from webhook, not PaymentLink.amount (in case of partial payment)
     - Create Payment row: type=PAYMENT_IN, mode=UPI, amount=webhook.amount, referenceNumber=razorpay_payment_id, date=now()
     - Call PaymentAllocation.allocatePaymentToInvoice(invoice, payment) to update balanceDue
     - Update PaymentLink.status = PAID, paidAt = now(), razorpayPaymentId
     - If invoice now fully paid (balanceDue = 0), also check for open PromiseToPay and mark as KEPT if conditions met
     - AuditLog write with `systemActor = 'webhook:razorpay'`
     - Return 200 immediately (idempotent)

2. **Create `payment-link.client.ts` (Razorpay API wrapper):**
   - Uses existing Razorpay SDK or HTTP client with hardcoded base URL
   - Methods: `createLink(payload)`, `cancelLink(linkId)`, `getLink(linkId)`
   - Error handling: translate Razorpay 4xx to domain errors (ALREADY_PAID, INVALID_AMOUNT, etc.)
   - `maxRedirects: 0` in HTTP client config

3. **Create routes:**
   - `POST /api/payments/payment-links` — handler calls `createPaymentLink()`, requires `invoiceId` in body
     - Idempotency header required (400 if missing)
     - Rate limit: 10 req/min per user
     - Response: 201 on create, 200 on duplicate (same idempotency key = existing link)
   - `GET /api/payments/payment-links?invoiceId=<id>` — list all links for invoice
   - `DELETE /api/payments/payment-links/:id` — cancel link (requires `collections.collect` permission)
   - All routes require auth, scope to businessId from JWT

4. **Extend webhook route `/api/webhooks/razorpay`:**
   - Add handler for event type `payment_link.paid`
   - Handler calls `processWebhookPaymentLinkPaid(event)`
   - Verify signature BEFORE dispatching to handler (existing middleware or pre-handler)
   - If signature invalid → 400, AuditLog write with `action: WEBHOOK_REJECTED`

5. **Add Razorpay signature verification:**
   - Utility `verifyRazorpaySignature(rawBody, signature, secret)` using `crypto.createHmac('sha256', secret)` + `timingSafeEqual`
   - Must use raw body bytes (not re-stringified JSON)
   - Signature verification MUST happen before any handler logic (pre-middleware pattern)

6. **Rate limiting:**
   - Existing `rate-limit` middleware applied to POST routes
   - Limit: 10/min per user for payment-link creation (Security audit §6)

7. **Idempotency:**
   - Existing `requireIdempotency` middleware on POST routes
   - Store idempotency key + response in Redis (24h TTL)
   - Replay same key → return cached response without re-executing

### Frontend Tasks

1. **Add "Get Payment Link" button to InvoiceDetail:**
   - Visible only if invoice status ∈ {SAVED, SHARED} AND balanceDue > 0
   - Button label: "Get Payment Link"
   - Tap → opens PaymentLinkSheet bottom sheet

2. **Create PaymentLinkSheet component:**
   - Show states:
     - **Loading:** "Generating…" with spinner
     - **Error:** toast "Could not create link — check connection" with Retry
     - **Idempotency:** "Link already active — copied to clipboard" toast
     - **Success:**
       - Amount prominently: "Rs X,XX,XXX"
       - Short URL in a pill (masked: `rzp.io/i/XXX...XXX` full URL in input for copy)
       - Copy Link button (primary) — copies full URL to clipboard via Capacitor/navigator
       - Share on WhatsApp button (secondary) — prefills `wa.me` with message: "Hi [partyName], please pay Rs [amount] for invoice [number] using this link: [shortUrl] — [businessName]"
       - Expiry note: "Link valid until [date]"
       - Status: "Active — not yet paid" OR "Paid on [date]"
   - Fetch link data on open (GET /api/payments/payment-links?invoiceId=X)

3. **Create `usePaymentLink()` mutation hook:**
   ```ts
   const mutation = useMutation({
     mutationFn: (invoiceId) => api.post('/api/payments/payment-links', { invoiceId }, {
       method: 'POST',
       entityType: 'payment_link',
       entityLabel: `${invoiceNumber}`,
     }),
     onSuccess: () => queryClient.invalidateQueries(['invoices', invoiceId])
   })
   ```

4. **WhatsApp share:**
   - Use Capacitor `Share.share()` with prefilled message
   - OR use `wa.me` URL with full message body (encode via `encodeURIComponent`)

5. **Error handling:**
   - Razorpay not configured: show "Connect Razorpay" prompt with link to Settings
   - Network error: toast + Retry button
   - Invoice fully paid: hide button

### Acceptance / Proof Gates

**Backend (curl proofs — add to PR description):**

```bash
# 1. Create payment link (requires auth + idempotency key)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: link-1-abc123" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "INV-001"}' \
  https://api.local/api/payments/payment-links
# Expected: 201, shortUrl present

# 2. Create duplicate (same idempotency key)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: link-1-abc123" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "INV-001"}' \
  https://api.local/api/payments/payment-links
# Expected: 200, same shortUrl (idempotent)

# 3. Unauth
curl https://api.local/api/payments/payment-links
# Expected: 401

# 4. (Simulate webhook)
# Generate valid Razorpay payload + sign with secret
# POST to /api/webhooks/razorpay with X-Razorpay-Signature header
# Expected: 200, Payment row created, invoice balanceDue updated

# 5. (Replay webhook)
# POST same payload + signature again
# Expected: 200, no duplicate Payment row

# 6. (Bad signature)
curl -X POST \
  -H "X-Razorpay-Signature: badbadbadbadbad" \
  -H "Content-Type: application/json" \
  -d '{"event": "payment_link.paid", ...}' \
  https://api.local/api/webhooks/razorpay
# Expected: 400, AuditLog written with WEBHOOK_REJECTED action

# 7. (Webhook for cross-tenant link)
# Tamper payload notes.businessId = OTHER_TENANT
# POST webhook for a link that belongs to TENANT_A
# Expected: 200, Payment created on TENANT_A only (from DB resolve, not notes)

# 8. (Amount tampering)
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: bad-amt" \
  -H "Content-Type: application/json" \
  -d '{"invoiceId": "INV-001", "amountPaise": 99999999}' \
  https://api.local/api/payments/payment-links
# Expected: 400 AMOUNT_EXCEEDS_OUTSTANDING
```

**Frontend:**
- PaymentLinkSheet loading state (spinner) ✓
- PaymentLinkSheet success state (URL visible, buttons tap-able) ✓
- Copy link → clipboard contains full URL ✓
- Share on WhatsApp → OS sheet opens (or wa.me link) ✓
- Dark theme on sheet ✓
- 320px sheet width OK ✓

**Security (curl proofs — align with Security Audit MB-1, MB-2, MB-5):**
- Webhook replay dedupe ✓
- Webhook tenant trust (payment lands on correct tenant) ✓
- Webhook signature verification ✓
- Amount re-validation ✓

**Estimated size:** Medium (8 files, ~440 lines)

### Merge Blockers
- **MB-1 (Webhook replay)** — WebhookEvent dedupe BEFORE Payment insert, single transaction
- **MB-2 (Webhook tenant trust)** — resolve businessId from PaymentLink row, NOT notes
- **MB-5 (Amount tampering)** — re-read outstanding in same tx, reject if client amount exceeds

### Dependencies
PR #1, PR #2

---

## PR 5: Bulk Payment Reminders — Templating & Dispatch

### Title & Branch
**Title:** `payments(reminders): bulk reminder composer + templates + ReminderLog dispatch`  
**Branch:** `payments/bulk-reminders`

### Scope Summary
Server templates registry with token substitution. Bulk reminder endpoint that takes `partyIds`, `channel`, `message`, validates template tokens, dispatches via WhatsApp `wa.me` links. Client UI for reminder composer (bottom sheet), preview, result screen. **Implements MB-3 (template token injection), MB-4 (wa.me URL safety), MB-6 (bulk dispatch rate limit).**

### Files Touched
**Server:**
- `server/src/services/collections/reminder-templates.ts` (new, 120 lines)
- `server/src/services/collections/bulk-reminder.service.ts` (new, 200 lines)
- `server/src/routes/payments/reminders.route.ts` (new, 100 lines)
- `server/src/lib/wa-utils.ts` (new, phone validation + URL encoding, 50 lines)

**Client:**
- `src/features/collections/ReminderComposerSheet.tsx` (new, 180 lines)
- `src/features/collections/ReminderResultScreen.tsx` (new, 100 lines)
- `src/features/collections/useReminderComposer.ts` (new TanStack Query mutation, 60 lines)
- `src/features/collections/components/ReminderPreview.tsx` (new, 80 lines)
- `src/features/collections/reminder-templates.ts` (mirror of server, 120 lines)

### Backend Tasks

1. **Create reminder templates registry (`reminder-templates.ts`):**
   ```ts
   const REMINDER_TEMPLATES = {
     POLITE: {
       key: 'polite',
       label: 'Polite (Under 30 days)',
       body: 'Hi {{name}}, your payment of Rs {{amount}} is due. Please pay at your earliest convenience. Thank you — {{business_name}}'
     },
     FIRM: {
       key: 'firm',
       label: 'Firm (30–60 days)',
       body: 'Hi {{name}}, we are yet to receive Rs {{amount}} from you. Please settle this at the earliest. — {{business_name}}'
     },
     URGENT: {
       key: 'urgent',
       label: 'Urgent (60+ days)',
       body: 'Hi {{name}}, immediate payment of Rs {{amount}} is required. Please contact us if there is an issue. — {{business_name}}'
     }
   }
   
   function render(templateKey, context): string {
     const template = REMINDER_TEMPLATES[templateKey]
     let text = template.body
     text = text.replace(/\{\{name\}\}/g, context.name)
     text = text.replace(/\{\{amount\}\}/g, context.amount)
     // ... per token
     return text
   }
   ```

2. **Create `bulk-reminder.service.ts`:**
   - `buildBulkReminderBatch(businessId, partyIds[], channel, templateKey, customMessage?)`:
     - Validate partyIds are all in businessId (404 if any cross-tenant)
     - Fetch all parties in one query (select count, validate count matches input length)
     - Per party: render template with (name, amount, business_name, due_date, oldest_invoice_date)
     - If customMessage provided:
       - **MB-3 gate:** append AFTER template render, never inside it
       - Test: customMessage with `{{paymentLinkUrl}}` MUST appear as literal text
       - Validate: no additional token substitution on the concatenated message
     - Build list of `{ partyId, phone, message, templateKey }` for dispatch
     - Per-party validation: **MB-4 gate:** phone must match `/^\d{10,15}$/` (E.164 digits only)
     - Exclude parties with no phone or invalid phone — return warning in results
     - Store `ReminderLog` rows (one per party): businessId, partyId, channel, templateKey, recipientPhone (PII), renderedMessage, status=QUEUED, isAutomatic=false
     - Return batch list + excluded parties
   - `dispatchWhatsAppReminders(batchId, reminders[])`:
     - For each reminder, build `wa.me` URL:
       - Phone: validated digits-only
       - Message: `encodeURIComponent(message)`
       - URL: `https://wa.me/<phone>?text=<encoded>`
     - Update ReminderLog.status = DISPATCHED, sentAt = now()
     - AuditLog write per reminder: action=REMINDER_DISPATCHED, entityType=reminderLog, recipientPhone='+91XXXXX1234' (masked)
     - Return { sent: count, failed: [] } + failed reasons
   - Rate limiting per architecture §16c: 5 req/min/user, max 50 parties/call

3. **Create routes:**
   - `POST /api/payments/reminders/bulk` — handler:
     - Body: `{ partyIds: string[], channel: 'WHATSAPP'|'SMS', templateKey: string, customMessage?: string }`
     - Idempotency header required
     - Validate partyIds.length ≤ 50 (400 BATCH_LIMIT_EXCEEDED if not)
     - Rate limit: 5/min per user (per Security audit)
     - Call `buildBulkReminderBatch()` → validate → store ReminderLog rows
     - Call `dispatchWhatsAppReminders()` → update status + AuditLog
     - Return 200 with { sent: N, failed: M, results: [...] }

4. **wa.me URL builder (`wa-utils.ts`):**
   ```ts
   function buildWaLink(phone: string, message: string): string | null {
     // Validate phone: digits-only, 10–15 chars
     if (!/^\d{10,15}$/.test(phone)) return null
     // Encode message
     const encoded = encodeURIComponent(message)
     return `https://wa.me/${phone}?text=${encoded}`
   }
   ```

5. **PII masking in logs:**
   - Regex test in AuditLog write: recipientPhone logged as `+91XXXXX1234` (suffix-4)
   - Winston redaction configured: `recipientPhone` → `+91XXXXX****`
   - Test: grep logs for no plaintext phones

### Frontend Tasks

1. **Add "Send Reminder" action to AgingBucketList / OutstandingList:**
   - Multi-select mode (checkboxes per party)
   - "Select All on Page" control (excludes parties with no phone)
   - "Send Reminder" button (disabled if no parties selected)

2. **Create ReminderComposerSheet (bottom sheet):**
   - Stages:
     - **Stage 1 (Compose):**
       - Template chip selector: POLITE / FIRM / URGENT (pre-filled based on bucket age)
       - Message textarea: user-editable template
       - Preview drawer (collapsed by default): shows rendered message for first selected party (anti-mismap check)
       - Party count: "Sending to X parties"
       - Warning badge (if any parties excluded): "X parties skipped — no phone number"
       - Send button: disabled if count = 0
     - **Stage 2 (Sending):**
       - Progress: "Sending to X parties…"
       - Per-party counter (optional): "3 of 25"
       - Abort button (optional, cancellable)
     - **Stage 3 (Result):**
       - Green check: "X reminders prepared"
       - Note: "WhatsApp will open for each message. Delivery is not tracked."
       - Failed list (if any): red rows with party name + reason
       - Primary CTA: "Done"
       - Secondary CTA: "View Reminder History"

3. **Create ReminderPreview component:**
   - Shows fully-rendered message for first party in selection
   - Recipient name + phone visible
   - Message text (full)
   - Tap → expands full preview

4. **Create `useReminderComposer()` mutation:**
   ```ts
   const mutation = useMutation({
     mutationFn: (payload) => api.post('/api/payments/reminders/bulk', payload, {
       method: 'POST',
       entityType: 'reminder_batch',
       entityLabel: `${partyCount} parties`,
     }),
     onSuccess: () => queryClient.invalidateQueries(['collections', 'reminders'])
   })
   ```

5. **Template token substitution (client-side):**
   - Mirror server templates registry
   - Render per-party in preview before dispatch
   - Support tokens: `{{name}}`, `{{amount}}` (formatted), `{{business_name}}`, `{{due_date}}`, `{{oldest_invoice_date}}`

6. **WhatsApp link opening:**
   - On success, for each party, open `wa.me` link in new tab/app
   - Capacitor integration: `window.open(waLink, '_system')` (opens OS default browser)
   - Rate: 2-second delay between opens (user-visible: "Opening WhatsApp…" progress)

### Acceptance / Proof Gates

**Backend (curl proofs):**

```bash
# 1. Valid bulk reminder
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: bulk-1-xyz" \
  -H "Content-Type: application/json" \
  -d '{
    "partyIds": ["party-1", "party-2", "party-3"],
    "channel": "WHATSAPP",
    "templateKey": "polite"
  }' \
  https://api.local/api/payments/reminders/bulk
# Expected: 200 { sent: 3, failed: 0 }

# 2. Batch too large (51 parties)
curl -X POST ... -d '{"partyIds": [... 51 ids ...], ...}'
# Expected: 400 BATCH_LIMIT_EXCEEDED

# 3. Rate limit (6th call in 60s)
# Call 5 times → 200; 6th → 429 RATE_LIMITED

# 4. Cross-tenant partyId in batch
curl -X POST ... -d '{"partyIds": ["TENANT_A_party", "TENANT_B_party"], ...}'
# Expected: 400 BATCH_VALIDATION_FAILED (pre-flight check)

# 5. No idempotency key
curl -X POST ... -d '{"partyIds": [...], ...}'
# Expected: 400 IDEMPOTENCY_KEY_REQUIRED

# 6. Check ReminderLog entries in DB
# SELECT * FROM ReminderLog WHERE businessId = '...' AND status IN ('QUEUED', 'DISPATCHED');
# Expected: 3 rows (one per party), phone masked in SELECT

# 7. Check AuditLog masking
# SELECT changes FROM AuditLog WHERE action = 'REMINDER_DISPATCHED';
# Expected: recipientPhone field shows +91XXXXX1234 (not full number)

# 8. Check Winston logs
# grep "recipientPhone" logs.json | grep -v "+91XXXXX"
# Expected: 0 hits (no unmasked phones in logs)

# 9. Template token injection test
# POST bulk with customMessage = '\n{{paymentLinkUrl}}'
# Expected: message text contains literal "{{paymentLinkUrl}}" string, not substituted
```

**Frontend:**
- ReminderComposerSheet loads on action ✓
- Template selector shows 3 options ✓
- Preview shows first party's name + rendered message ✓
- "Select All" excludes no-phone parties ✓
- Send button disabled when count = 0 ✓
- On send, result screen shows sent/failed breakdown ✓
- 320px bottom sheet width OK ✓
- Dark theme on sheet ✓

**Estimated size:** Medium-Large (10 files, ~600 lines)

### Merge Blockers
- **MB-3 (Template token injection)** — custom message appended AFTER template render, never re-rendered
- **MB-4 (wa.me URL safety)** — phone E.164 validation, message encodeURIComponent
- **MB-6 (Bulk dispatch rate limit)** — 5/min per user, 50 parties/call

### Dependencies
PR #1, PR #2, PR #3

---

## PR 6: Promise-to-Pay — Tracking & State Machine

### Title & Branch
**Title:** `payments(ptp): PromiseToPay CRUD + daily evaluator cron + state machine`  
**Branch:** `payments/promise-to-pay`

### Scope Summary
CRUD endpoints for PromiseToPay (create, read, update, delete). Daily cron job that evaluates open PTPs and flips status to KEPT or BROKEN. State machine ensures immutability of KEPT/BROKEN records. Party detail page shows "Commitments" section. Collections dashboard shows broken PTP alerts. **Implements MB-7 (cron per-business iteration + AuditLog systemActor), MB-8 (terminal state immutability).**

### Files Touched
**Server:**
- `server/src/services/collections/promise-to-pay.service.ts` (new, 200 lines)
- `server/src/routes/collections/ptp.route.ts` (new, 120 lines)
- `server/src/jobs/ptp-evaluator.cron.ts` (new, 100 lines)
- `server/src/lib/cron-scheduler.ts` (extend if needed; register job)

**Client:**
- `src/features/collections/PtpRecorderForm.tsx` (new, 120 lines)
- `src/features/collections/CommitmentsSection.tsx` (new, 100 lines)
- `src/features/collections/usePtp.ts` (new TanStack Query hooks, 80 lines)
- `src/features/parties/PartyDetail.tsx` (+50 lines, add Commitments section)

### Backend Tasks

1. **Create `promise-to-pay.service.ts`:**
   - `createPtp(businessId, partyId, invoiceId?, amount, promisedDate, note?)`:
     - Validate party.businessId === businessId (404 if not)
     - Validate promisedDate > today (400 if past)
     - Validate amount > 0 (400 AMOUNT_INVALID)
     - Store PromiseToPay: status=OPEN, createdBy=req.user.id
     - AuditLog: action=PTP_CREATED, changes={ partyId, amountPaise, promisedDate, notes (first 200 chars) }
     - Return created PTP
   - `updatePtp(businessId, ptpId, patch)`:
     - Fetch PTP (scope check)
     - **MB-8 gate:** if status !== OPEN, return 409 PTP_NOT_EDITABLE
     - Update allowed fields: promisedDate, amount, note (must still pass validation)
     - AuditLog: action=PTP_UPDATED, changes={ before, after }
   - `deletePtp(businessId, ptpId)`:
     - **MB-8 gate:** if status !== OPEN, return 409 PTP_NOT_DELETABLE (broken PTPs immutable)
     - Delete row
     - AuditLog: action=PTP_CANCELLED
   - `listPtps(businessId, partyId, status?, page, limit)` — paginated list
   - `evaluateOpenPtps(businessId, asOf)` — **cron job context:**
     - Fetch all OPEN PTPs where promisedDate < asOf
     - Per PTP, check for payments >= amount recorded on/before promisedDate
     - If found: `status = KEPT`, `keptPaymentId = paymentId`, AuditLog with `systemActor='cron:ptp-evaluator'`
     - If not found: `status = BROKEN`, AuditLog with `systemActor='cron:ptp-evaluator'`

2. **Create routes:**
   - `POST /api/collections/ptp` — create
     - Body: `{ partyId, invoiceId?, amount, promisedDate, note? }`
     - Idempotency header required
     - Validation: promisedDate > today (400), amount > 0 (400)
     - Rate limit: 30/min per user
     - Response: 201, created PTP
   - `GET /api/collections/ptp?partyId=<id>&status=OPEN|BROKEN|KEPT&page=1&limit=20` — list
     - Status filter optional
     - Pagination cursor
   - `PATCH /api/collections/ptp/:id` — update
     - Only allowed if status=OPEN (409 otherwise)
     - Body: `{ amount?, promisedDate?, note? }`
     - Idempotency header required
   - `DELETE /api/collections/ptp/:id` — delete
     - Only allowed if status=OPEN (409 otherwise)
   - `POST /api/collections/ptp/:id/mark-kept` — manual mark-as-kept (optional in MVP; used by payment-create hook in PR #4)
     - Body: `{ paymentId }`
     - Only allowed if status=OPEN
     - Sets keptPaymentId + flips status to KEPT
     - Requires `collections.ptp` permission

3. **Create cron job (`ptp-evaluator.cron.ts`):**
   - **MB-7 implementation:**
     - Runs daily at 01:00 IST (set in job config)
     - Outer loop: `for (const business of allActiveBusinesses)`
       - Per business: explicit try/catch + transaction
       - Call `evaluateOpenPtps(businessId, asOf)` with businessId as first arg
       - No shared state; each iteration independent
     - Every AuditLog write: `userId = NULL`, `systemActor = 'cron:ptp-evaluator'`
   - Register job in cron scheduler (or BullMQ queue if used)

4. **State machine enforcement:**
   - Transitions:
     - `OPEN → KEPT` (payment recorded or cron evaluated)
     - `OPEN → BROKEN` (cron evaluated, promised date passed, no payment)
     - `OPEN → CANCELLED` (user deletes)
     - `KEPT` / `BROKEN` → immutable (no further changes)
   - Enforce in service layer: `update()` checks status before allowing any mutation

5. **PII masking in logs:**
   - PTP notes may contain user-supplied PII; cap at first 200 chars when logging to AuditLog (full text on row)

### Frontend Tasks

1. **Create PtpRecorderForm (bottom sheet/modal):**
   - Open from: PartyDetail page, InvoiceDetail page, AgingBucketList party row
   - Form fields:
     - Amount (required, pre-filled from `balanceDue` or 0)
     - Promised date (required, native mobile date picker, future dates only)
     - Note (optional, textarea, 500 chars)
   - Validation:
     - Amount > 0 (error: "Amount must be greater than zero")
     - Promised date not in past (error: "Promised date cannot be in the past")
   - Loading state: button shows "Saving…"
   - Success state: toast "Promise recorded — you'll be alerted if not received by [date]", sheet closes, Commitments section refreshes
   - Error state: toast with error message, Retry button
   - Offline: optimistic save via offline queue (entityType='ptp', entityLabel=`${party.name} Rs ${amount} by ${date}`)

2. **Create CommitmentsSection component:**
   - Shown on PartyDetail page
   - Title: "Commitments"
   - Empty state: "No commitments recorded" with CTA "Record Promise"
   - Success state: list of PTP entries
     - Per row: promised date, amount (bold), status badge (OPEN=teal, KEPT=green, BROKEN=red), note truncated
     - OPEN rows: tap to edit or delete (edit icon, delete icon)
     - BROKEN rows: read-only (show immutability message: "Broken promises cannot be edited")
     - Tap row → expands to show full note
   - Edit form: overlay or bottom sheet (same as PtpRecorderForm)
   - Delete confirm: "Delete this promise? This cannot be undone." (for OPEN only)

3. **Collections dashboard alert:**
   - Add BrokenPtpAlert component showing all broken PTPs at top (already in PR #3, data now from service)
   - Per alert: "Gopal Traders promised Rs 5,000 by 28 Apr — not paid"
   - Tap → route to PartyDetail with Commitments section visible

4. **Add `usePtp()` hooks:**
   ```ts
   // Create
   const createMutation = useMutation({
     mutationFn: (data) => api.post('/api/collections/ptp', data, {
       entityType: 'ptp',
       entityLabel: `${party.name} Rs ${data.amount} by ${data.promisedDate}`
     })
   })
   
   // List per party
   const query = useQuery({
     queryKey: ['ptps', partyId],
     queryFn: () => api.get(`/api/collections/ptp?partyId=${partyId}`)
   })
   
   // Update
   const updateMutation = useMutation({
     mutationFn: (data) => api.patch(`/api/collections/ptp/${ptpId}`, data, {
       entityType: 'ptp',
       entityLabel: `${party.name}`
     })
   })
   ```

5. **Party detail integration:**
   - Extend PartyDetail to fetch PTPs: `useQuery(['ptps', partyId])`
   - Render CommitmentsSection

### Acceptance / Proof Gates

**Backend (curl proofs):**

```bash
# 1. Create PTP
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: ptp-1-abc" \
  -H "Content-Type: application/json" \
  -d '{"partyId": "party-1", "amount": 500000, "promisedDate": "2026-05-10"}' \
  https://api.local/api/collections/ptp
# Expected: 201, status=OPEN

# 2. Past date rejected
curl -X POST ... -d '{"partyId": "...", "amount": 500000, "promisedDate": "2026-05-01"}' ...
# Expected: 400 PROMISED_DATE_INVALID

# 3. Update OPEN PTP
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"promisedDate": "2026-05-15"}' \
  https://api.local/api/collections/ptp/ptp-1
# Expected: 200, updated

# 4. Update BROKEN PTP (fails)
# (Manually set status=BROKEN in DB, then try PATCH)
curl -X PATCH ... https://api.local/api/collections/ptp/ptp-1 ...
# Expected: 409 PTP_NOT_EDITABLE

# 5. Delete OPEN PTP
curl -X DELETE ... https://api.local/api/collections/ptp/ptp-1
# Expected: 200

# 6. Delete BROKEN PTP (fails)
curl -X DELETE ... https://api.local/api/collections/ptp/ptp-broken-1
# Expected: 409 PTP_NOT_DELETABLE

# 7. Cron evaluation
# Set a PTP with promisedDate=yesterday in test DB, run cron
# Expected: AuditLog shows BROKEN flip with systemActor='cron:ptp-evaluator', userId=NULL

# 8. List PTPs for party
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/ptp?partyId=party-1'
# Expected: 200, paginated PTP list with status values
```

**Frontend:**
- PtpRecorderForm opens from PartyDetail ✓
- Form validates past date (red error) ✓
- Form validates amount > 0 ✓
- Success toast appears ✓
- CommitmentsSection shows list of PTPs ✓
- BROKEN PTP row read-only (no edit/delete icons) ✓
- OPEN PTP row has edit/delete icons ✓
- Delete confirm dialog appears ✓
- Collections dashboard shows broken PTP alerts ✓
- 320px form width OK ✓
- Dark theme tested ✓

**Estimated size:** Medium (8 files, ~520 lines)

### Merge Blockers
- **MB-7 (Cron per-business iteration + AuditLog systemActor)** — explicit businessId loop, per-business transaction, systemActor in every write
- **MB-8 (Terminal state immutability)** — PATCH/DELETE on KEPT/BROKEN returns 409, no updates allowed

### Dependencies
PR #1, PR #2, PR #4 (for payment-create hook in PR #4)

---

## PR 7: Customer Statement PDF & Share Flow

### Title & Branch
**Title:** `payments(statement): Statement data endpoint + React-PDF template + share flow`  
**Branch:** `payments/statement-pdf`

### Scope Summary
Server endpoint `GET /api/collections/statement/:partyId?from=ISO&to=ISO` returns transaction history. Client-side React-PDF component renders statement with opening balance, line-by-line transactions, closing balance. Share via WhatsApp or download. Date range picker with presets (This Month, Last 3 Months, This FY, Custom).

### Files Touched
**Server:**
- `server/src/services/collections/statement.service.ts` (new, 180 lines)
- `server/src/routes/collections/statement.route.ts` (new, 60 lines)
- `server/src/lib/statement-dtos.ts` (new, 50 lines, response shape)

**Client:**
- `src/features/collections/StatementPeriodPicker.tsx` (new, 100 lines, date range UI)
- `src/features/collections/StatementPDFTemplate.tsx` (new, 200 lines, React-PDF Document)
- `src/features/collections/StatementPDFPreview.tsx` (new, 100 lines, preview + download/share buttons)
- `src/features/collections/useStatement.ts` (new TanStack Query hook, 50 lines)
- `src/features/parties/PartyDetail.tsx` (+30 lines, add Statement button)

### Backend Tasks

1. **Create `statement.service.ts`:**
   - `getStatementData(businessId, partyId, from, to)`:
     - Fetch party (scope check)
     - Fetch all documents (INVOICES, PAYMENTS, CREDIT_NOTES, DEBIT_NOTES, OPENING_BALANCE entries) for this party within date range
     - Order by date ASC
     - Compute opening balance (sum of all transactions before `from` date)
     - Per transaction: type, reference (invoice number or payment ref), description, debit (invoice), credit (payment), running balance
     - Compute closing balance (opening + all debits - all credits)
     - Return DTO with party, business, period, opening, transactions, closing, generatedAt
   - `calculateRunningBalance(transactions)` — fold over array, accumulate per row
   - Validate `from <= to`, both valid dates, both within past 5 years (prevent abuse)

2. **Create routes:**
   - `GET /api/collections/statement/:partyId?from=ISO&to=ISO` — data endpoint
     - Auth required (session)
     - Scope: partyId.businessId === req.user.businessId (404 if not)
     - Query params: from (ISO date), to (ISO date)
     - Validation: both dates provided, valid format, from <= to
     - Rate limit: 30/min per user (moderate, as it's read-only)
     - Response: 200 with StatementDTO (party, business, period, transactions[], opening, closing)
     - Offline note: if offline, response unavailable (hard-fail per Architecture §13)

3. **Response shape per PRD §7:**
   ```ts
   interface StatementDataRes {
     success: true
     data: {
       party: { id, name, phone, email, gstin, billingAddress }
       business: { name, gstin, phone, logoUrl }
       period: { from, to }
       openingBalance: number
       transactions: Array<{
         date, type, reference, description, debit, credit, balance, agingDays?
       }>
       closingBalance: number
       generatedAt: string
     }
   }
   ```

### Frontend Tasks

1. **Create StatementPeriodPicker (modal/sheet):**
   - Presets:
     - This Month (1st to today, Asia/Kolkata)
     - Last 3 Months (90 days back to today)
     - This Financial Year (1 Apr to today)
     - Custom Range (date picker from/to)
   - Default: Last 3 Months
   - Tap preset → compute from/to dates
   - Custom: native mobile date picker for each
   - Primary CTA: "Generate Statement"
   - Loading state: button shows "Generating…"

2. **Create StatementPDFTemplate (React-PDF Document):**
   - Header: business logo (if present), business name, GSTIN, phone, contact
   - Party section: party name, phone, email, GSTIN, billing address
   - Period: "Statement as of [to date]"
   - Opening balance: "Rs X,XX,XXX" (centered, bold)
   - Table: columns = Date | Reference | Description | Debit | Credit | Balance
     - Per transaction row: date formatted, invoice # or payment ref, description, amounts in Indian format
     - Running balance in rightmost column
   - Closing balance: "Rs X,XX,XXX" (bold, underlined)
   - Footer: "This is a computer-generated statement. As of [date]. Amounts in INR."
   - Dark mode: same layout, invert colors
   - Page breaks: if > 50 rows, split across pages
   - No `dangerouslySetInnerHTML` anywhere; all text via `<Text>` nodes (React-PDF auto-escapes)

3. **Create StatementPDFPreview (screen):**
   - Bottom sheet or full-screen modal
   - Top: StatementPeriodPicker (collapsed, tap to change range)
   - Center: PDFViewer displaying rendered template
   - Loading state: spinner + "Generating statement… X of Y transactions"
   - Empty state: "No transactions between [date] and [date]" with "Change Period" button
   - Error state: toast "Statement generation failed. Try a shorter date range."
   - Action bar (bottom, fixed):
     - Download button: triggers Capacitor save
     - Share on WhatsApp button: opens `wa.me` with pre-text + PDF file (via Capacitor Share)
     - Share button (OS sheet)

4. **Create `useStatement()` hook:**
   ```ts
   const query = useQuery({
     queryKey: ['statement', partyId, from, to],
     queryFn: () => api.get(`/api/collections/statement/${partyId}?from=${from}&to=${to}`, {
       cacheReads: true // offline support
     }),
     enabled: !!partyId && !!from && !!to
   })
   ```

5. **Party detail integration:**
   - Add "Statement" button to PartyDetail page
   - Tap → open StatementPeriodPicker modal
   - On confirm → fetch data via `useStatement()`, render StatementPDFPreview

6. **WhatsApp share:**
   - Use Capacitor `Share.share({ files: [pdfUri], ...})` with message:
     - "Hi [partyName], please find your account statement attached. Total outstanding: Rs X,XX,XXX. — [businessName]"
   - On mobile, Android/iOS share sheet appears with WhatsApp as option

### Acceptance / Proof Gates

**Backend (curl proofs):**

```bash
# 1. Get statement data
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/statement/party-1?from=2026-04-01&to=2026-04-30'
# Expected: 200, transactions array with opening/closing balance

# 2. Unauth
curl 'https://api.local/api/collections/statement/party-1?...'
# Expected: 401

# 3. Cross-tenant partyId
curl -H "Authorization: Bearer $TOKEN_A" \
  'https://api.local/api/collections/statement/party_B_id?...'
# Expected: 404 (not 403, no existence oracle)

# 4. Invalid date format
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/statement/party-1?from=invalid&to=2026-04-30'
# Expected: 400 INVALID_DATE_FORMAT

# 5. from > to
curl -H "Authorization: Bearer $TOKEN" \
  'https://api.local/api/collections/statement/party-1?from=2026-04-30&to=2026-04-01'
# Expected: 400 INVALID_DATE_RANGE
```

**Frontend:**
- StatementPeriodPicker shows 4 presets ✓
- Custom date picker works ✓
- "Generate Statement" button fetches data ✓
- StatementPDFTemplate renders with all fields ✓
- Opening/closing balance correct ✓
- Transaction rows show correct running balance ✓
- Empty state PDF shown for zero-transaction periods ✓
- Download button triggers file save ✓
- Share on WhatsApp button opens OS sheet ✓
- Dark theme on preview ✓
- 320px PDF width readable (text not clipped) ✓
- XSS test: party name `<img src=x onerror=alert(1)>` renders as literal text ✓

**Estimated size:** Medium (8 files, ~480 lines)

### Merge Blockers
None specific to PR #7.

### Dependencies
PR #1, PR #2

---

## PR 8: Polish, Feature Flags & Final QA

### Title & Branch
**Title:** `payments(polish): remove feature flags, final QA, Collections tab release`  
**Branch:** `payments/polish-release`

### Scope Summary
Remove all feature flags for Collections tab and payment links. Final 320px audit across all Collections screens. Dark mode verification. Copy review. Merge blockers checklist. Final QA sign-off.

### Files Touched
**Client:**
- `src/app/layout/Navigation.tsx` (remove flags, Collections tab always visible)
- `src/features/collections/**` (remove flag checks)
- `src/lib/feature-flags.ts` (remove collections-related flags)

**Server:**
- `server/src/lib/env.ts` (remove FEATURE_COLLECTIONS_ENABLED if present)
- `server/src/routes/collections/**` (remove flag guards)

### Backend Tasks
1. Remove any feature flag checks from collections routes (if any)
2. Verify all 22 endpoints respond correctly without flag guards
3. Run full compliance test: `curl` all 8 MB proofs + security proofs one more time
4. Verify `tsc --noEmit` clean
5. Verify `enforce.js` clean (no raw fetch, offline rules, etc.)

### Frontend Tasks
1. Remove all feature flag checks: `if (isFeatureEnabled('collections'))` from Navigation, Routes, etc.
2. Collections tab always visible
3. Final 320px audit:
   - Navigate to each screen at 320px width
   - Check for h-scroll anywhere
   - Verify touch targets ≥ 48px
   - Verify text readable
   - Check for layout overflow
4. Dark mode final check: all new screens in dark theme (Settings > Theme)
5. Copy review: all labels, buttons, toasts, errors match PRD §13
6. Screenshots final: one per new screen in success state @ 320px + dark theme

### Acceptance / Proof Gates

**Final checklist:**
- [ ] All routes respond 200/201/400/401/404/409 as expected
- [ ] tsc clean
- [ ] enforce.js clean
- [ ] All 8 MB security proofs pass
- [ ] 320px audit: no h-scroll ✓
- [ ] Dark mode: all surfaces ✓
- [ ] Copy: matches PRD ✓
- [ ] Offline: PTP creation queues offline ✓
- [ ] Sensitive data: no shortUrl/phone/GSTIN/statement-URL in console logs ✓
- [ ] All new screens have 4-state screenshots ✓
- [ ] QA sign-off: feature accepted per PRD acceptance criteria ✓

**Estimated size:** Tiny (4 files, ~80 lines)

### Merge Blockers
- **All 8 MB proofs from PR #4, #5, #6 must pass**
- Final QA sign-off required

### Dependencies
PR #1–7

---

## Critical Path & Parallelization

```
PR 1 (schema)
  ↓
PR 2 (aging engine)
  ↓
PR 3 (aging UI) ←─┐
       ↓          │
PR 4 (payment    │ Can start
    links)       │ in parallel
       ↓          │
       ├─→ PR 5 (bulk reminders) ←─┤
       │          ↓                 │
       │    PR 6 (PTP) ─→ ┐         │ Can start
       │          ↓        │        │ in parallel
       └─→ PR 7 (statement) ┴──→ PR 8 (polish)
```

**Fastest path (sequential critical dependencies):**
1. PR 1: 4 hours (schema)
2. PR 2: 8 hours (aging service)
3. PR 3: 12 hours (aging UI, screenshots)
4. PR 4: 16 hours (payment links, webhooks, curl proofs, MB-1/2/5)
5. Then PR 5, 6, 7 in parallel (each ~16 hours) = 16 hours
6. PR 8: 4 hours (polish + final QA)

**Total: ~60 hours critical path**, ~180 hours all hands if 4 engineers work in parallel on 5–7.

---

## Proof Gate Summary

### Backend Required Proofs (Per PR)

| MB | PR | Requirement | Curl Proof | Status |
|----|----|----|-----------|--------|
| 1 | 4 | Webhook replay dedupe | `replay same payload twice → 200 both times, 1 Payment row` | ⊗ |
| 2 | 4 | Webhook tenant trust | `webhook with notes.businessId=OTHER for tenant-A link → Payment on tenant-A only` | ⊗ |
| 3 | 5 | Template token injection | `customMessage='\n{{paymentLinkUrl}}'` renders literal text, not substituted | ⊗ |
| 4 | 5 | wa.me URL safety | `phone with newline / message with <img XSS> → URL-encoded safely` | ⊗ |
| 5 | 4 | Amount tampering | `POST with amountPaise > outstanding → 400 AMOUNT_EXCEEDS_OUTSTANDING` | ⊗ |
| 6 | 5 | Bulk rate limit | `6th bulk call in 60s → 429 RATE_LIMITED` | ⊗ |
| 7 | 6 | Cron per-business + AuditLog systemActor | `cron run with 2 businesses → 2 AuditLog rows, each with correct businessId + systemActor` | ⊗ |
| 8 | 6 | PTP terminal immutability | `PATCH BROKEN PTP → 409 PTP_NOT_EDITABLE; DELETE BROKEN PTP → 409 PTP_NOT_DELETABLE` | ⊗ |

### Frontend Required Proofs (Per PR)

| PR | Screens | 4 States | 320px | Dark | Status |
|----|---------|----------|-------|------|--------|
| 3 | AgingDashboard, AgingBucketList, PartyDetailDrilldown | loading, error, empty, success | ✓ | ✓ | ⊗ |
| 4 | InvoiceDetail, PaymentLinkSheet | 4 link states | ✓ | ✓ | ⊗ |
| 5 | ReminderComposer, ReminderResult | 5 stages | ✓ | ✓ | ⊗ |
| 6 | PtpRecorder, Commitments, BrokenPtpAlert | 4 states | ✓ | ✓ | ⊗ |
| 7 | StatementPeriodPicker, StatementPDFPreview | 4 states | ✓ | ✓ | ⊗ |
| 8 | All Collections surfaces | 320px audit | ✓ | ✓ | ⊗ |

---

End of task plan.
