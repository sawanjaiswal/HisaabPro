---
status: approved
feature: phase-5-epic-b-sales-workflow
created: 2026-05-14T19:55:00Z
auditor: security agent
verdict: CONDITIONAL — 2 CRITICAL, 4 HIGH, 1 MEDIUM, 1 LOW must be addressed in their respective PRs before merge.
scope: read-only audit of architecture + 7 spot-read code files. No code modified.
inputs:
  - docs/SCOPE_EPIC_B_sales_workflow.md
  - docs/ARCHITECTURE_EPIC_B_sales_workflow.md
spot_reads:
  - server/src/routes/documents/index.ts
  - server/src/services/document/create.ts (first 100 lines)
  - server/src/services/document/convert.ts (first 60 lines)
  - server/src/services/document/custom-fields.ts (full)
  - server/src/middleware/permission.ts (1-100)
  - server/src/services/pdf.service.ts (full — stub only)
  - server/src/schemas/document.schemas.ts (head + strict/passthrough grep)
  - src/features/invoices/useBogoPermission.ts (full)
  - src/features/auth/auth.types.ts (BusinessSummary shape)
---

# Security Audit — Phase 5 Epic B (Sales Workflow)

Read-only audit limited to net-new surface introduced by the four PRs. Existing flows (convert, custom-fields persistence, party scoping) verified intact.

---

## PR2 — `Document.priceListId` nullable FK

### 2.1 Tenant isolation on incoming `priceListId` — CRITICAL — FAIL (must fix in PR2)

The architecture states "Server validates the price list belongs to the same business (existing pattern from `price-list.service.ts`)" but that pattern is NOT inherited automatically — `createDocument` already explicitly scopes `party.findFirst({ where: { id, businessId } })` and `taxCategory.findMany({ where: { id: { in }, businessId } })` against `businessId`. PR2 must add the same `findFirst({ where: { id: data.priceListId, businessId } })` check BEFORE `prisma.document.create({ data: { priceListId, ... } })` in BOTH `server/src/services/document/create.ts` AND `server/src/services/document/update.ts`. Without it, Tenant A can post a Tenant B price-list ID; the FK constraint succeeds (FK enforces existence only, not ownership), the row writes, and re-resolving entries against the override later leaks Tenant B's entry rates.

Remediation (one block, both files): `if (data.priceListId) { const pl = await prisma.priceList.findFirst({ where: { id: data.priceListId, businessId }, select: { id: true } }); if (!pl) throw notFoundError('Price list'); }`

### 2.2 Zod validation — HIGH — CONDITIONAL (must add `.strict()` in PR2)

`server/src/schemas/document.schemas.ts` does NOT currently use `.strict()` on any schema (grep returned 0). The pre-commit ratchet may exempt existing schemas, but PR2 modifies the schema by adding `priceListId`. New/modified schemas in this file MUST be `.strict()` per `memory/security_defaults.md` (DudhHisaab lesson — `dudhhisaab/no-zod-passthrough` ESLint rule). Use `z.string().cuid().nullable().optional()` (NOT `.uuid()` as the architect wrote on line 242 — Prisma `String @id @default(cuid())` produces CUIDs, not UUIDs; `.uuid()` would reject every valid ID at the validator boundary). The `nullable()` is required so the FE can clear an override; `optional()` is required so legacy clients can omit the field.

Remediation: `priceListId: z.string().cuid().nullable().optional()` AND ensure the parent object schema receives `.strict()`. If sibling fields would break under strict, scope the strictness to the new field via a `.pick()` wrapper or add a focused `priceListOverrideSchema.strict()` and merge.

### 2.3 FK cascade choice — LOW — PASS

Architect chose `onDelete: SetNull` (line 218). Correct — deleting a price list nulls the override on historical invoices rather than orphaning or cascading away business documents. Audit trail survives by virtue of any application-level "soft-delete price list" pattern in `price-list.service.ts`. No change required.

---

## PR1 — `GET /api/documents/:id/lineage`

### 1.1 BusinessId scoping on EVERY hop — CRITICAL — FAIL (must fix in PR1)

`server/src/services/document/lineage.ts` (~90 LOC, planned) must scope EVERY hop by `businessId`, not just the entry document. The walk-up uses `sourceDocumentId` and the walk-down uses the `convertedTo` self-relation (Document where `sourceDocumentId = currentId`). Both lookups MUST be `prisma.document.findFirst({ where: { id: nextId, businessId }, select: ... })` — a missing `businessId` filter on intermediate hops would not be caught by the entry-point auth check, and a Tenant A user holding a real Tenant A document ID could leak Tenant B's `documentNumber`, `type`, `status`, `documentDate` for any cross-tenant link that exists. (Sources of cross-tenant links: data-migration accidents, bad backfills, future admin tools. Defense in depth requires the scope on every step regardless of whether such a link "should exist".)

Remediation: confirm the service literally has `{ id: candidateId, businessId }` on every Prisma call inside both the up-walk and the down-walk loops. Add a service-level test `lineage.test.ts:itDoesNotLeakAcrossTenants` that seeds a cross-tenant lineage row and asserts the walker stops at the boundary.

### 1.2 Auth + rate-limit — PASS

`/api/documents` mounts `auth` + `userMutationLimiter` + `requireFeature('invoicing')` at the router root (`server/src/routes/documents/index.ts:27-29`). New `GET /:id/lineage` inherits all three. The global mutation limiter applies even though this is a GET — overprotective but harmless. No per-endpoint rate-limit required (low cost, auth'd, depth-capped at 6). Audit passes.

### 1.3 Depth cap — PASS

Architect specified hard cap of 6 hops in both directions with a `truncated: true` flag (§6 Risks). Prevents DoS via crafted chain loops. Confirm the service uses a visited-set OR a hard counter — a cycle in `sourceDocumentId` (shouldn't exist due to `@unique` on the self-relation, but defense-in-depth) without a counter would loop until OOM.

Remediation (already in architecture, restating): implement as `for (let i = 0; i < 6 && currentId; i++) { ... }` not `while (currentId)`.

---

## PR3 — BOGO Custom-Role Wiring

### 3.1 Server-side gate honors permission — PASS

`server/src/middleware/permission.ts:78-83` — `requireBogoIfFreeItem` delegates to `requirePermission('invoicing.bogo')`, which loads `bu.roleRef.permissions` from `BusinessUser` and accepts the request if the array contains `'invoicing.bogo'`. Owner role bypasses (line 51). Negative case (staff without `invoicing.bogo` toggling free-item via crafted request) is rejected at the server boundary regardless of FE state. Server-side authority confirmed.

### 3.2 FE permission source missing — HIGH — FAIL (must fix in PR3)

`src/features/auth/auth.types.ts:10-19` defines `BusinessSummary` with `role`, `roleId`, `roleName` — but NO `permissions: string[]` field. The architecture (PR3 design, lines 268-271) and SCOPE (line 105) both assume `current.permissions?.includes('invoicing.bogo')` is callable on the auth context's business object. With the current type/data shape, the optional-chain evaluates `undefined.includes(...)` → `undefined` → `false`, so the hook will still only return `true` for `role === 'owner'` and PR3 ships a no-op widening. The end-user-visible bug is: a custom role with `invoicing.bogo` permission still cannot see the toggle (the server would accept their request — but the UI hides it, so they cannot send one).

Remediation (one of):
- (a) Extend `BusinessSummary` with `permissions: string[]` and populate it server-side in the businesses-list response (`auth.service.ts` / wherever the businesses array is hydrated), then update `useBogoPermission` to read it; OR
- (b) Add a dedicated `GET /api/me/permissions` endpoint and a `usePermissions()` hook that fetches once on login.
Option (a) is simpler — the data already exists on `BusinessUser.roleRef.permissions` server-side; just project it into the response. Add a regression test `useBogoPermission.test.ts:custom_role_with_invoicing_bogo_returns_true` that mocks `businesses[0].permissions = ['invoicing.bogo']` and asserts the hook returns `true`.

### 3.3 UX safety on stale FE — PASS (informational)

Even if 3.2 is shipped buggy (permission field missing), the server is the gate; staff cannot grant free items without the perm. Bad UX, no security regression.

---

## PR4 — Custom Fields PDF Rendering

### 4.1 `showOnInvoice` filtering AND `businessId` scoping on field-def lookup — HIGH — CONDITIONAL (verify in PR4)

`pdf.service.ts` is currently a stub (24 LOC, returns `null`). React-PDF rendering happens client-side (e.g. `LabelPDF.tsx`, `Receipt58mm.tsx`, `PartyLedgerPDF.tsx`). PR4 must therefore add rendering in BOTH places it could matter:

- (a) The client-side React-PDF templates that compose invoice/challan PDFs — these must query `/api/documents/:id/custom-fields` (which already correctly scopes by `businessId`, per `custom-fields.ts:141-156`) AND filter `fieldDef.showOnInvoice === true` client-side before rendering.
- (b) If PR4 introduces server-side rendering (`server/src/services/pdf/custom-fields-block.ts`, ~120 LOC per architect's file plan), that service MUST `prisma.documentCustomFieldValue.findMany({ where: { documentId, businessId, fieldDef: { showOnInvoice: true } } })` — both filters MANDATORY. A missing `showOnInvoice` would expose internal-only fields to printed customer PDFs; a missing `businessId` is a cross-tenant leak.

Remediation: PR4 PR description must explicitly state which path (client vs server rendering) is taken AND show the WHERE clause used. Reviewer checklist item.

### 4.2 HTML / output escaping — PASS

React-PDF `<Text>` auto-escapes; no `dangerouslySetInnerHTML` in any PDF template (grep confirmed). User-supplied `valueJson` flows through `<Text>{value}</Text>` — safe. The 500-char cap in `custom-fields.ts:50` further limits payload abuse. If PR4 introduces a SERVER-side HTML template (Puppeteer/Chromium), that template MUST use `{{value | escape}}` semantics — but architect's file plan shows React-PDF-style components, not an HTML template. Verify at PR4 review time that no raw HTML string concatenation is introduced.

### 4.3 NUMBER / DATE field rendering — MEDIUM — CONDITIONAL (verify in PR4)

`validateValue` (`custom-fields.ts:44-75`) stores `NUMBER` as a JS number and `DATE` as the original string. The PDF renderer must format these (Indian number grouping, localized date) without trusting raw strings. Low risk (validation already typed them), but a future field-type addition (RICH_TEXT, URL) would change the threat model. Out-of-scope warning for the audit log.

---

## Cross-cutting

### CC.1 Mutations use `api()` with entityType/entityLabel — PASS (project rule, FE work)

Architect's PR1/PR2 design explicitly states "All mutations (convert) pass `entityType: 'document'`, `entityLabel: <doc number>`" (line 208). `scripts/enforce-offline.mjs` blocks pre-commit if any mutation in feature code calls raw `fetch()` or omits the metadata. Pass — enforced mechanically.

### CC.2 CSRF inheritance — PASS

New POST/PATCH (`POST /api/documents` accepts `priceListId`; `PATCH /api/documents/:id`) reuse existing mount points under `/api/`, so global CSRF middleware applies. No new `/api/p/` (public) routes introduced. Pass.

### CC.3 Logging / PII — CONDITIONAL (verify in each PR)

`logger.info` calls in the new `lineage.ts` service MUST NOT log full document objects (partyId, party name, totals, line items) — only `{ documentId, businessId, hops }`. PR2 create/update modifications MUST NOT log `priceListId` joined with party PII. Reviewer checklist: grep new files for `logger.info(.*party|logger.info(.*phone|logger.info(.*address` before merge.

### CC.4 Frontend translations — PASS

Translation files `src/translations/en/ext36.ts` + `hi/ext36.ts` planned. Translations are static keys, no user input echoed without escape. React's JSX auto-escapes. Pass.

---

## Verdict Summary

| # | Finding | Severity | Status | PR |
|---|---------|----------|--------|----|
| 2.1 | `Document.priceListId` cross-tenant write — must verify `priceList.businessId === req.user.businessId` | CRITICAL | FAIL | PR2 |
| 1.1 | Lineage walk must scope every hop by `businessId` | CRITICAL | FAIL | PR1 |
| 2.2 | Zod schema must add `.strict()` + use `.cuid()` not `.uuid()` for `priceListId` | HIGH | CONDITIONAL | PR2 |
| 3.2 | `BusinessSummary.permissions: string[]` missing — PR3 widening currently a no-op | HIGH | FAIL | PR3 |
| 4.1 | PDF custom fields filter MUST be `where: { businessId, fieldDef: { showOnInvoice: true } }` | HIGH | CONDITIONAL | PR4 |
| 4.3 | NUMBER/DATE field formatting at render time | MEDIUM | CONDITIONAL | PR4 |
| 1.3 | Lineage hop counter must be `for (i<6)` not `while`, with visited-set | LOW | PASS-with-note | PR1 |
| 2.3 | `onDelete: SetNull` on Document→PriceList FK | LOW | PASS | PR2 |
| 1.2 | Lineage auth + rate-limit inheritance | — | PASS | PR1 |
| 3.1 | Server-side `requireBogoIfFreeItem` honors `invoicing.bogo` | — | PASS | PR3 |
| 4.2 | React-PDF `<Text>` auto-escapes; no innerHTML risk | — | PASS | PR4 |
| CC.1 | Offline mutation metadata enforced by `enforce-offline.mjs` | — | PASS | all |
| CC.2 | CSRF middleware inherited at `/api/` mount | — | PASS | all |
| CC.3 | Logging hygiene — no PII in new `logger.info` | — | CONDITIONAL | all |
| CC.4 | i18n keys static, no echo-without-escape | — | PASS | all |

**Overall verdict: CONDITIONAL.** Both CRITICAL findings (2.1 tenant scoping on price-list override write, 1.1 lineage walk scoping) are within-PR fixes — no architecture change required. The HIGH finding 3.2 (missing `permissions` field on `BusinessSummary`) means PR3 as drafted ships a silently broken feature; the fix is a 2-line backend projection + 1 frontend type field + 1 hook line. Address findings 2.1, 1.1, 2.2, 3.2, 4.1 in their respective PRs before merge. Findings 4.3 and CC.3 are reviewer-checklist items, not blockers.
