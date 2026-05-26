# SECURITY_AUDIT_phase5_sales_workflow

**Status:** APPROVED WITH CONDITIONS
**Auditor:** security agent
**Date:** 2026-05-13
**Sources reviewed:**
- docs/SCOPE_phase5_sales_workflow.md
- docs/ARCHITECTURE_phase5_sales_workflow.md
- server/src/services/document/{convert,create,update}.ts (read for scoping baseline)
- server/src/services/settings/permissions-data.ts (read for permission inventory)
- server/src/middleware/idempotency.ts (existing, must wrap new POSTs)

## 1. Verdict

**APPROVED WITH CONDITIONS.** Four PRs are individually low-risk surface
additions on top of an already tenant-scoped polymorphic Document model,
but they cross billing math, custom-field rendering, and pricing
authority. Five must-fix items below — primarily new permissions for
free-item and price-list editing, server-side DROPDOWN/DATE/NUMBER
validation on `valueJson`, audit-log entries for `isFreeItem=true` and
PriceList writes, and explicit businessId joins on every new query.
No re-architecture required. PR4 (price lists) is the strictest gate.

## 2. Findings

| Sev | Title | PR | Description | Mitigation | Status |
|---|---|---|---|---|---|
| HIGH | Free-item toggle bypasses revenue math without distinct permission | PR1 | `isFreeItem=true` zeroes rate/taxableValue/cgst/sgst/igst/cess. A staff member with `invoicing.create` can hand goods to friends, or mass-mark a fraudulent invoice's lines free to launder revenue away from a partner. | Add new permission `invoicing.bogo` (NOT present today — see §3). Gate the toggle in both API schema and UI. Write `AuditLog` row `{ actorUserId, documentId, lineItemId, productId, qty, action: 'LINE_MARKED_FREE' }` on every line where `isFreeItem` transitions false→true (create OR update). | must-fix |
| HIGH | PriceList write authority not gated | PR4 | A non-OWNER changing a price list silently changes pricing on every invoice created after. Currently no `pricing.edit` permission exists (grep of `permissions-data.ts` confirms). | Introduce `pricing.viewLists` (read) and `pricing.editLists` (write). Default OWNER + ADMIN. STAFF gets read-only. Audit log every PriceListItem mutation `{ priceListId, productId, oldRatePaise, newRatePaise, actorUserId }`. | must-fix |
| HIGH | DROPDOWN/DATE/NUMBER custom-field values not type-validated server-side | PR2 | `valueJson` stored as JSON — DROPDOWN allows arbitrary string at write time even if `CustomFieldDefinition.options[]` is fixed. DATE/NUMBER can carry strings. This bypasses the definition's contract and lets a malicious staffer poison invoice PDFs (e.g., HTML strings rendered in react-pdf headers). | Server-side resolver in POST/PUT `/documents/:id/custom-fields`: load the `CustomFieldDefinition`, dispatch on `type`: DROPDOWN → assert `value ∈ definition.options`; DATE → ISO 8601 parse + range; NUMBER → `Number.isFinite`; TEXT → length ≤ 500, strip control chars. Zod `.strict()` discriminated union on `{ type, value }`. | must-fix |
| HIGH | Cross-tenant read on PriceList / CustomFieldDefinition by id | PR2, PR4 | Every new `GET/PUT/DELETE /price-lists/:id` and `/custom-fields/:id` MUST `findFirst({ where: { id, businessId: req.user.businessId }})`. The DocumentCustomFieldValue join carries TWO businessId legs (Document.businessId AND CustomFieldDefinition.businessId) — both must match the caller AND each other (a def from another business attached to a same-tenant doc is still a leak). | TOCTOU defense: in update/delete paths, scope by businessId in BOTH the lookup AND the mutation `where:` clause. Add integration test `should-404-other-tenant-pricelist.spec.ts`. | must-fix |
| HIGH | Mass assignment on line-item update | PR1 | If line-item Zod schema is `.passthrough()` or accepts arbitrary fields, attacker could set `taxableValue: 0` directly, sidestepping calc bypass logic, or set `documentId` to retarget the line onto a victim's invoice. | Zod `.strict()` whitelist exactly: `{ productId, quantity, rate, discountType, discountValue, isFreeItem, hsn, unit }`. Explicitly omit `documentId`, `businessId`, `cgst`, `sgst`, `igst`, `cess`, `taxableValue` — all derived server-side. Pre-commit `enforce.js` already blocks `.passthrough()` and `data: req.body`. | must-fix |
| MED | resolvePrice() cross-tenant leak risk | PR4 | Helper signature must be `resolvePrice({ businessId, partyId, productId })`. If the helper accepts only `(partyId, productId)` and looks up businessId from party, a swapped partyId would still resolve but silently apply another tenant's price list. | Helper signature MUST require businessId from caller (always `req.user.businessId`). Internally assert `party.businessId === businessId`, `priceList.businessId === businessId`, `product.businessId === businessId`. Throw `TENANT_MISMATCH` on any divergence. | must-fix |
| MED | Custom-field PII over-cache | PR2 | `DocumentCustomFieldValue.valueJson` can store Aadhaar/GSTIN/vehicle no / driver name. If frontend reads with `cacheReads: true`, sensitive data leaks across users on a shared device until logout. | Do NOT pass `cacheReads: true` to any `/documents/:id/custom-fields` or `/documents/:id` reads. Add the path to the offline-rules exemption table in `.claude/rules/OFFLINE_RULES.md` Rule 3 "Do NOT cache" list. | should-fix |
| MED | XSS via custom-field TEXT in react-pdf and clipboard | PR2 | React DOM auto-escapes, but react-pdf `<Text>` rendering and any future copy-to-clipboard / WhatsApp share helper concatenate strings raw. | At render boundary, strip `< > & " '` for PDF cells via shared `sanitizeForPdf(value)`. Frontend must never use `dangerouslySetInnerHTML` for `valueJson`. Cross-check with `enforce.js` (already bans innerHTML / dangerouslySetInnerHTML). | should-fix |
| MED | Conversion authorization | PR3 | Verified `server/src/services/document/convert.ts` line 18 already does `findFirst({ where: { id: documentId, businessId } })`. PR3 is UI-only — no new server check needed, BUT the new client routes must not pass `businessId` from URL/body. | UI passes only `documentId` + target type. businessId always from `req.user.businessId` server-side. Lock down with existing `ALLOWED_CONVERSIONS` check still in place. | informational |
| MED | Idempotency middleware coverage on POST /documents with custom-fields | PR2 | The new payload (Document + N custom-field values inline) is larger. Confirm `server/src/middleware/idempotency.ts` body limit accommodates 50 fields × 500 chars ≈ 25 KB; default Express 100 KB JSON limit should hold, but the idempotency-key cache row stores the request hash + response — verify Redis/DB column is big enough. | Add integration test: 50 custom fields in one POST → idempotent replay returns same documentId. Bump Express `json({ limit: '256kb' })` if not already. | should-fix |
| MED | PriceList bulk-edit rate limit | PR4 | A runaway script (or compromised STAFF token if `pricing.editLists` granted) could thrash DB with bulk updates. | Rate-limit `POST /price-lists/:id/items/bulk` to 1/min per businessId, 10/hour. Single-item PUT: 60/min. Key by businessId not userId (prevents two-user bypass). | should-fix |
| LOW | Audit log retention for isFreeItem | PR1 | Audit rows for free-item lines should survive document deletion (soft or hard) so post-hoc fraud review still works. | Store `audit_log` rows with denormalized `productName`, `qty`, `documentNumber` — do NOT rely on FK to Document being intact. | informational |
| LOW | Migration safety | All | All four PRs are additive: `isFreeItem` defaults `false`; new tables; new nullable column `Party.defaultPriceListId`; new String[] column `CustomFieldDefinition.documentTypes` with default `[]`. No NOT-NULL adds before backfill. | Confirmed safe. Run migrations in dev → staging → prod via standard `prisma migrate deploy`. No backfill required. | informational |
| LOW | Replay/idempotency on PriceList bulk import | PR4 | If price-list bulk import is a future surface, it should carry `Idempotency-Key`. Out of scope for PR4 (single-row CRUD) but flag. | Note in scope doc for follow-up. | informational |

## 3. Required new permissions

Grep of `server/src/services/settings/permissions-data.ts` confirms
present permissions include `invoicing.view|create|edit|share`,
`payments.view|record`, `parties.view`, `inventory.view`, `reports.view`,
`settings.manageStaff`. **Missing today, must be added:**

| Permission | Default roles | Gates |
|---|---|---|
| `invoicing.bogo` | OWNER, ADMIN | Setting `isFreeItem=true` on any DocumentLineItem (create and update paths). STAFF cannot toggle. UI hides the BOGO control when permission absent. |
| `pricing.viewLists` | OWNER, ADMIN, STAFF (read) | GET `/price-lists`, GET `/price-lists/:id`, resolvePrice debug endpoint. |
| `pricing.editLists` | OWNER, ADMIN | POST/PUT/DELETE on PriceList + PriceListItem. Also gates `Party.defaultPriceListId` write (changing a party's default list = pricing authority). |
| `customFields.manage` (likely exists — verify) | OWNER, ADMIN | CRUD on CustomFieldDefinition. *Write* of DocumentCustomFieldValue stays with `invoicing.edit` (it's per-doc data, not schema). |

If `customFields.manage` is not present, add it. Owner role auto-gets
all permissions via `ALL_PERMISSIONS`. Admin filter excludes only
`settings.manageStaff` — these four will land in Admin by default.

## 4. Pre-ship security checklist (per PR)

### PR1 — BOGO (#133)
- [ ] `invoicing.bogo` permission added to `permissions-data.ts` + seed data
- [ ] Zod `.strict()` on line-item create/update — explicit whitelist; reject `taxableValue/cgst/sgst/igst/cess`
- [ ] Server-side: when `isFreeItem === true`, force `rate = 0, taxableValue = 0, cgst = sgst = igst = cess = 0` (never trust client math)
- [ ] AuditLog row on every false→true transition (create OR update)
- [ ] UI hides BOGO toggle when `!hasPermission('invoicing.bogo')`
- [ ] `tsc` clean, `enforce.js` pass, no `.passthrough()`
- [ ] Migration: additive column with default — safe

### PR2 — Invoice custom fields (#134)
- [ ] `DocumentCustomFieldValue` queries always join with `Document.businessId === req.user.businessId` AND `CustomFieldDefinition.businessId === req.user.businessId`
- [ ] Discriminated-union Zod validator on `{ type, value }`: DROPDOWN ∈ options, DATE ISO+range, NUMBER finite, TEXT ≤500 + control-char strip
- [ ] `CustomFieldDefinition.documentTypes` Zod: array of enum from `DocumentType`, length ≤ 8 (no duplicates)
- [ ] No `cacheReads: true` on `/documents/:id` or `/documents/:id/custom-fields`
- [ ] Update `.claude/rules/OFFLINE_RULES.md` "Do NOT cache" list
- [ ] react-pdf renderer routes `valueJson` through `sanitizeForPdf()`
- [ ] Idempotency middleware wraps POST `/documents` (existing) — verify body limit covers ~50 fields
- [ ] Integration test: cross-tenant 404 on `GET /custom-fields/:id`
- [ ] No `dangerouslySetInnerHTML` (already enforced)

### PR3 — Sales pipeline UI (#122)
- [ ] UI-only: server `convert.ts` already scopes by businessId — verified line 18
- [ ] Client routes pass only `{ documentId, targetType }` — never `businessId`
- [ ] Audit log already exists for document conversion (verify; if not, add)
- [ ] `tsc` clean, frontend `enforce.js` pass
- [ ] No new endpoints — no rate-limit changes
- [ ] All API calls via `api()` helper with `entityType: 'document'`, `entityLabel: documentNumber`

### PR4 — Multiple price lists (#132) [STRICTEST]
- [ ] `pricing.viewLists` + `pricing.editLists` permissions added + seeded
- [ ] `resolvePrice({ businessId, partyId, productId })` — businessId is REQUIRED arg, never inferred
- [ ] resolvePrice asserts businessId on party, priceList, product; throws `TENANT_MISMATCH` on divergence
- [ ] Zod `.strict()` on PriceList + PriceListItem; ratePaise integer ≥ 0; effectiveFrom/To ordering check
- [ ] AuditLog on every PriceListItem create/update/delete with old + new ratePaise
- [ ] AuditLog on `Party.defaultPriceListId` change
- [ ] Rate limit POST `/price-lists/:id/items/bulk` 1/min, 10/hour per businessId
- [ ] Rate limit PUT single item 60/min per businessId
- [ ] Integration tests: cross-tenant 404 on GET/PUT/DELETE; resolvePrice precedence (PartyPricing > default > salePrice)
- [ ] Migration additive (new tables + nullable FK) — safe

### Cross-cutting
- [ ] No `console.log` (winston only)
- [ ] No `localStorage` writes for entity data
- [ ] All mutations carry `entityType` + `entityLabel`
- [ ] Pre-commit `enforce.js` ratchets clean
- [ ] No new public routes (every router file mounts `requireAuth`)
- [ ] No source-maps shipped to prod build

## 5. Open questions for build phase

1. **`customFields.manage` permission** — does this exist? If not, add in PR2. If it exists, confirm the assigned roles (does STAFF currently get it? Should be revoked).
2. **AuditLog table contract** — confirm a single `AuditLog` model is in use vs. per-domain audit tables. If single, ensure `action` column accepts new enum values `LINE_MARKED_FREE`, `PRICE_LIST_ITEM_CHANGED`, `PARTY_DEFAULT_PRICE_LIST_CHANGED`.
3. **Conversion audit log** — does `convertDocument()` write an audit row today? Architect doc didn't confirm; if missing, add in PR3.
4. **PriceList scope: business-wide vs. branch-scoped** — multi-location distributors (Amit persona) may want per-branch price lists. Out of PR4 scope, but flag the schema decision (`PriceList.branchId nullable` now vs. migration later).
5. **resolvePrice caching** — if memoized server-side for hot dashboards, cache key MUST include businessId. Architect to clarify caching strategy before build.
6. **`Party.defaultPriceListId` on party delete** — what happens to the FK on soft-delete vs. hard-delete? Recommend `onDelete: SetNull`.
7. **PDF rendering pipeline** — confirm react-pdf renders DocumentCustomFieldValue rows from a single component so the `sanitizeForPdf` boundary has one source of truth.

## Final verdict: APPROVED WITH CONDITIONS

Architecture is sound; existing convert/document services are
tenant-scoped; migrations are additive. Five must-fix items
(new permissions × 3, server-side custom-field type validation, line-item
mass-assignment whitelist) are gating. Strictest blocker is PR4 — pricing
authority is a new powerful primitive and demands new permissions, audit
trail, and rate limits before ship.
