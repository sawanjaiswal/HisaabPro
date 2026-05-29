phase: 5 Sales/Marketing (features 121-134)

# Phase 5 Feature Audit — Sales & Marketing (#121–#134)

Adversarial verification of `docs/HISAABPRO.md` matrix rows 1041–1058 against
real code. Each row checked: evidence located, opened, confirmed real logic
(not stub/TODO/throw). Money/security claims re-verified at source.

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 121 | Online Store `/p/store/:slug` | VERIFIED | `routes/public/store.routes.ts` (GET `/:slug` → `getPublicStorefront` + `sanitizeStorefrontForPublic`), `storefront.service.ts`, `StorefrontProduct` model (schema:868) | Real public route; sanitized response; slug length-capped at 64. |
| 121 | Slug rules + reserved registry | VERIFIED | `src/features/storefront/slug-rules.ts` (FE), `server/src/lib/reserved-slugs.ts` (33-entry registry + SLUG_REGEX + isReservedSlug), consumed by `lib/storefront-slug.ts` | Matrix cites bare `slug-rules.ts`; server-side registry lives in `reserved-slugs.ts`. Both real. |
| 122 | Sales Pipeline lineage | VERIFIED | `routes/documents/lineage.ts` (GET `/:id/lineage` → `getDocumentLineage`, tenant-scoped via `req.user.businessId`), `convert-restore.ts` | Zod-validated, businessId-scoped. Real. |
| 123 | WhatsApp Marketing — Templates | VERIFIED | `services/marketing/marketing-template.service.ts` (list/get/create/update/delete, businessId-scoped), `MarketingTemplate` model (schema:3735) | Full CRUD, no stubs. |
| 123 | WhatsApp Marketing — Campaigns wizard | VERIFIED | `MarketingCampaign`/`MarketingCampaignRecipient` models, `campaign-dispatch.service.ts` (`launchCampaign`/`cancelCampaign`), FE 5-step `CampaignWizardStep1-5` + `useCampaignWizard` + `CampaignWizardPage` | Real multi-step wizard + dispatch. |
| 123 | Aisensy provider (cred-blocked) | VERIFIED | `routes/webhooks/marketing-aisensy.routes.ts` + `marketing/aisensy-signature.ts` (`verifyAisensySignature` HMAC) | Code complete to cred boundary: HMAC signature verify (401 on bad sig) before processing. Matrix path `marketing-aisensy.routes.ts` resolves under `routes/webhooks/`, not a top-level file. |
| 124 | SMS Marketing MSG91 (cred-blocked) | VERIFIED | `routes/webhooks/marketing-msg91.routes.ts` + `marketing/msg91-marketing-signature.ts` (`verifyMsg91Token`) | Code complete to cred boundary: token verify (401 on mismatch). Same path note as #123. |
| 125 | Loyalty — FIFO accrual + advisory-locked redeem | VERIFIED | `services/loyalty/loyalty-redeem.service.ts`, `loyalty-accrual.service.ts`, `loyalty-balance.service.ts`, `LoyaltyProgram`/`LoyaltyLedger` models | Redeem takes `pg_try_advisory_xact_lock` keyed on (businessId,partyId) hash; balance precheck INSIDE lock; 409 on lock-fail. No double-spend. FIFO via aggregate of unexpired deltas. |
| 125 | POS step 10.5/10.6 + expiry cron | VERIFIED | `services/pos/pos-checkout.loyalty.ts` (10.5 `applyRedemption`, 10.6 `accrueForSale` inside POS `$transaction`), `loyalty-expiry.cron.ts` (04:15 IST, writes EX offset rows) | Real integration + cron. |
| 126 | Service Reminders — rules + cron + opt-out | VERIFIED | `ReminderRule`/`ReminderInstance`/`ReminderConfig` models, `marketing/reminder-rule.service.ts`, `reminder-trigger.service.ts`, `reminder-cron.service.ts` | All present, real services. |
| 127 | CRM Basics — tags + follow-ups + lastContactedAt | VERIFIED | `routes/parties/crm.routes.ts` + `src/features/crm/` (8 files) | DRIFT (path only): matrix cites `routes/collections/crm.routes.ts`; actual is `routes/parties/crm.routes.ts`. Feature real. |
| 128 | Commission — rules CRUD + ruleSnapshot + ledger | VERIFIED | `services/commission/*` (`commission-rule.service.ts`, `commission-accrual.service.ts`, `commission-snapshot.utils.ts`, `commission-ledger.service.ts`), `CommissionRule`/`CommissionLedger` models | `cloneRuleSnapshot` deep-clones rule into immutable ledger meta at accrual; `cloneFromPriorMeta` re-snapshots from prior row (not live rule) on void/restore. Immutable-at-sale confirmed. |
| 129 | UPI QR + invoice deep-link | VERIFIED | `services/upi-link.service.ts` (`buildUpiLink`, VPA regex, ₹1L cap, integer am), invoice template QR | Real builder. Intentional FE mirror `src/lib/upi.ts` (documented manual-sync). |
| 130 | Web invoice links — "HMAC-signed" | DRIFT | `routes/public/invoice.routes.ts`, `SharedLink` model, `shared-link.service.ts`, `middleware/resolve-public-token` | Feature is REAL and secure, but NOT HMAC. Mechanism = 32-byte crypto-random opaque token, `sha256(token)` stored as `tokenHash`, lookup by hash + expiry/revoke + businessId IDOR guard. Matrix label "HMAC-signed" is inaccurate (token-hash, not HMAC-signature). |
| 131 | Party invite — OTP + one-shot signup binding | VERIFIED | `routes/public/invite/` + `invite.routes.ts`, `party-invite.service.ts`, `invite-otp.service.ts`, `src/features/invite-claim/` | All present. |
| 132 | Multiple price lists + cross-tenant guard | VERIFIED | `services/price-list.service.ts` (`assertOwnership` → `where:{id,businessId,isDeleted:false}`), `price-list-entry.service.ts`, `price-list-assign.service.ts`, `PriceList`/`PriceListEntry` models | Cross-tenant guard present on every query path. |
| 133 | BOGO — `invoicing.bogo` permission gate | VERIFIED | `middleware/permission.ts:82` (`requirePermission('invoicing.bogo')` when free items present), `settings/permissions-data.ts:16,265`, `document/create-tax-prep.ts` + `update-recompute.ts` (free lines → 0 revenue/tax), FE `useBogoPermission.ts` | DRIFT (path only): matrix cites `pricing-resolver.ts BOGO branch`; BOGO logic actually lives in `document/` services + `permission.ts`, NOT pricing-resolver. Role gate real. |
| 134 | Invoice custom fields — react-pdf section | VERIFIED | `DocumentCustomFieldValue` model (schema:592), FE `pdf/InvoicePdfDocument.tsx` (`<PdfCustomFieldsSection rows={customFieldRows}>`) + `PdfCustomFieldsSection` + `filterPdfCustomFieldRows` (showOnInvoice + docType + businessId scoped) | Real renderer with security pre-filter. |

## SSOT violations

- Price computation: single SSOT confirmed. `resolvePrice`/`computeEntryPrice`
  live ONLY in `server/src/services/pricing-resolver.ts`. `price-list-assign.service.ts`
  and `party/pricing.ts` feed *inputs* into the resolver; they do not re-implement
  the math. No violation.
- UPI link building is duplicated by design: `server/src/services/upi-link.service.ts`
  and `src/lib/upi.ts` (FE) — header documents "keep in sync manually (both ~30 LOC)".
  Acceptable dual-impl (server vs client), but a divergence risk; noted, not blocking.

## Non-standard code

- none found — no `as any`, no `@ts-ignore`, no `raw fetch()`, and no in-scope
  Phase-5 service file exceeds 250 lines (all of `storefront.service.ts`,
  `loyalty/*`, `marketing/*`, `commission/*`, `price-list*.ts`,
  `pricing-resolver.ts`, `party-invite.service.ts`, `shared-link.service.ts`,
  `upi-link.service.ts` are ≤250L).
