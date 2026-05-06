# GST Phase 2 (v7) — Deployment Guide

> Covers PRs 1–11 shipped on the `hisaabpro` branch.
> PR 8 (NIC e-invoice) and PR 9 (NIC e-way bill) require additional env vars
> and NIC portal credentials; see §5 (Phase 2.1 follow-up).

---

## 1. Prerequisites

- PostgreSQL 14+ (Neon recommended)
- Node 20 LTS
- Existing `Business.gstin` data for any users who want GST enabled
- Razorpay PRO plan — GST returns export is gated behind `requirePlan('PRO')`

---

## 2. Schema Migration (PR 1)

Run the migration before deploying any new server code:

```bash
cd server
npx prisma migrate dev --name gst_phase_2_fields
```

Six columns are added — all additive, all have defaults, no data loss:

| Table | Column | Default |
|-------|--------|---------|
| `Business` | `gstEnabled` | `false` |
| `Business` | `taxPricingMode` | `EXCLUSIVE` |
| `Business` | `gstDeclarationText` | `null` |
| `DocumentSettings` | `taxPricingMode` | `EXCLUSIVE` |
| `Document` | `taxPricingMode` | `EXCLUSIVE` |
| `HsnCode` | `uqc` | `NOS` |

The migration also back-fills `Business.gstEnabled = true` for any row that
already has a `gstin` value, so existing registered businesses are automatically
opted in.

After migrating, seed UQC codes (idempotent — safe to re-run):

```bash
npx tsx prisma/seed.gst.uqc.ts
```

---

## 3. GST Settings Opt-In (PR 2)

**Endpoint:** `PATCH /api/gst/settings`

A business is GST-active only when `gstEnabled = true`. The PATCH handler
auto-flips this flag to `true` the moment a valid GSTIN is saved. Owners can
manually disable GST via the same endpoint.

**UI flow:**
1. Business owner → Settings → GST Settings
2. Enter 15-char GSTIN → field validates format client-side (`gstin.utils.ts`)
3. Save → server verifies format, writes AuditLog (GSTIN masked to last 4 chars),
   sets `gstEnabled = true`
4. All downstream features (tax engine, returns, e-invoice) now activate

**Zero-GST businesses (Raju persona):** leave GSTIN blank. The GST settings page
shows an "Exempt / No GSTIN" banner and no tax columns appear on invoices.

---

## 4. Tax Pricing Modes (PR 3)

Two modes are supported per-business (set in GST Settings) and can be overridden
per-invoice at creation time.

| Mode | Behaviour |
|------|-----------|
| `EXCLUSIVE` | Tax added on top of item price (default) |
| `INCLUSIVE` | Tax back-calculated from item price; taxable value = price ÷ (1 + rate) |

**How to set the default:**

```bash
curl -X PATCH http://localhost:4001/api/gst/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"taxPricingMode": "INCLUSIVE"}'
```

Per-invoice override: pass `taxPricingMode` in the invoice creation body.
The tax engine in `tax-calc.utils.ts` reads the invoice-level value first,
falls back to business default.

Supply type (intra-state → CGST+SGST, inter-state → IGST) is determined
automatically from `Business.stateCode` vs `Party.stateCode`
via `isInterState()`.

---

## 5. Backfill Wizard (PR 7)

For businesses that already have historical invoices created before GST was
enabled, the backfill wizard re-computes tax fields on existing documents.

**UI:** Settings → GST → Backfill Historical Invoices (5-step wizard)

**Endpoints:**

```bash
# Step 1 — preview (read-only, no writes)
POST /api/gst/backfill/preview
Body: { "fromDate": "2024-04-01", "toDate": "2025-03-31" }

# Step 2 — execute (starts async job)
POST /api/gst/backfill/execute
Headers: Idempotency-Key: <uuid>          # required; missing → 400
Body: { "fromDate": "...", "toDate": "...", "dryRun": false }

# Step 3 — poll progress
GET /api/gst/backfill/status/:jobId
```

**Rate limits:** execute is capped at 1 request per hour per
`businessId + userId` composite. Replaying the same `Idempotency-Key`
returns the cached `jobId` without consuming quota.

**AuditLog:** every document touched by backfill writes an `AuditLog` row
(action = `GST_BACKFILL`, entity = `Document`).

---

## 6. GSTR-1 Export (PR 10)

**Spec:** NIC v3.0 GSTR-1 format with 8 builders.

| Builder | Table | Coverage |
|---------|-------|----------|
| B2B | 4A, 4B, 4C, 6B, 6C | Registered buyers with GSTIN |
| B2CL | 5A, 5B | Unregistered, inter-state, > ₹2.5L per invoice |
| B2CS | 7 | Unregistered, intra-state or inter-state ≤ ₹2.5L |
| CDNR | 9B | Credit/debit notes — registered |
| CDNUR | 9B | Credit/debit notes — unregistered |
| HSN | 12 | HSN summary with UQC |
| Nil | 8A, 8B, 8C, 8D | Nil-rated / exempt / non-GST |
| EXPWP / EXPWOP | 6A | Exports (with/without payment) |

**Export endpoint:**

```bash
POST /api/gst/returns/GSTR1/:period/export
Headers:
  Authorization: Bearer $TOKEN
  Idempotency-Key: <uuid>
# period format: YYYY-MM (e.g. 2026-04)
```

**Response** includes:
- `jsonData` — NIC v3.0 envelope (upload to GSTN portal)
- `csvData` — CSV per builder table (for offline reconciliation)
- `summary` — counts + totals per table

**Limits:**
- Rate limit: 5 exports per minute per business
- Period format: `YYYY-MM` (monthly only; quarterly filing not yet supported)
- Amounts in response are rupees (not paise) — conversion happens at service layer
- Maximum document count per export: no hard cap; large businesses should
  expect >10s response time on first export of a high-volume month

**Read existing summary without re-computing:**

```bash
GET /api/gst/returns/GSTR1/:period
```

---

## 7. GSTR-3B Summary (PR 11)

11-section aggregator covering all GSTR-3B liability rows.

**Export endpoint:**

```bash
POST /api/gst/returns/GSTR3B/:period/export
Headers:
  Authorization: Bearer $TOKEN
  Idempotency-Key: <uuid>
```

Same rate limit (5/min), same response shape (`jsonData`, `csvData`, `summary`).

Sections covered: 3.1(a) outward taxable, 3.1(b) zero-rated, 3.1(c) nil/exempt,
3.1(d) inward RCM, 3.2 inter-state breakdown, 4A ITC available
(IGST/CGST/SGST/Cess), 4B ITC reversal, 4C net ITC, 5 exempted turnover,
6.1 payment of tax (IGST/CGST/SGST), 6.2 TDS/TCS.

---

## 8. Phase 2.1 Follow-up: NIC E-Invoice + E-Way Bill (PR 8 / PR 9)

These two PRs are **not yet active** — the service code exists but requires
NIC portal credentials that must be provisioned separately.

When PR 8/9 are enabled, the following env vars are required:

```bash
# NIC IRP credentials (e-invoice)
NIC_IRP_USERNAME=           # IRP portal username
NIC_IRP_PASSWORD=           # IRP portal password (encrypted at rest)

# NIC EWB credentials (e-way bill)
NIC_EWB_USERNAME=           # e-way bill portal username
NIC_EWB_PASSWORD=           # e-way bill portal password (encrypted at rest)

# Environment: "sandbox" | "production"
NIC_ENV=sandbox
```

**Sandbox vs prod:**

| Setting | Sandbox | Production |
|---------|---------|------------|
| `NIC_ENV` | `sandbox` | `production` |
| Base URL | `https://einv-apisandbox.nic.in` | `https://einvoice1-apisandbox.nic.in` |
| IRN | Test IRN (64 chars, not valid) | Real IRN registered with GSTN |
| Credentials | Test creds from NIC sandbox portal | Live production creds |

**Provisioning steps:**
1. Register on https://einvoice1.gst.gov.in (IRP) and https://ewaybillgst.gov.in
2. Generate API credentials under the business's GSTIN
3. Set `NIC_ENV=production` and both credential pairs in `.env`
4. Restart server — the circuit breaker auto-resets
5. Test with a small invoice before enabling for all users

**Per-business opt-in:** even with credentials set, e-invoice and e-way bill
are off by default. Enable per business:

```bash
PATCH /api/gst/settings
Body: { "eInvoiceEnabled": true, "eWayBillEnabled": true }
```

Only businesses with annual turnover > ₹5 Cr are legally required to use
e-invoicing (as of 2024). The `turnoverSlab` field on `Business` tracks this.

---

## 9. Rollback Plan

All schema changes are additive. To disable GST features without a schema
rollback:

1. Set `gstEnabled = false` for affected businesses via admin panel or direct SQL
2. GST routes continue to exist but return empty data for disabled businesses
3. Schema columns can be dropped in a future maintenance window if needed
   (see `-- DOWN` block in migration file)

---

## 10. Monitoring

Key log events to watch post-deploy:

| Event | Logger key | Notes |
|-------|-----------|-------|
| GST settings updated | `gst.settings.updated` | Includes businessId, masked GSTIN |
| GSTR-1 export | `gstr1.export.requested` | Includes period, idempotency key |
| GSTR-3B export | `gstr3b.export.requested` | Includes period |
| Backfill started | `gst.backfill.execute` | Includes jobId, date range |
| Backfill document touched | `gst.backfill.doc.updated` | Per-document audit trail |
