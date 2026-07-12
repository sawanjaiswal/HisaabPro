# SCOPE — Invoice Templates & Settings (Backend)

> Source of truth: `PRDs/invoice-templates-PLAN.md` (settled, "Awaiting Approval")
> + the **already-shipped** frontend contract under `src/features/templates/**`.
> This SCOPE covers the **missing backend** only — the frontend, PDF renderer,
> and Dexie offline layer already exist and are NOT rebuilt here.
> High-risk: touches `server/prisma/schema.prisma` → **architect must run next**.

---

## Summary

Build the missing server side of the invoice-template feature so `/settings/templates`
and `/settings/invoice` stop 404-ing: three Prisma models, template CRUD +
duplicate + set-default endpoints, and the invoice-settings (round-off + decimal)
singleton endpoint. The backend must satisfy the **exact request/response shapes
the shipped frontend already calls** (`GET /templates`, `GET /invoice-settings`,
etc.) — not the PRD's aspirational `/api/v1/...` paths.

---

## Goals

- Persist user invoice templates (config + printSettings JSON) per business. `[MUST_SHIP]`
- `GET /api/templates` → `TemplateSummary[]` (config excluded for list perf). `[MUST_SHIP]`
- `GET /api/templates/:id` → full `InvoiceTemplate` with config + printSettings. `[MUST_SHIP]`
- `POST /api/templates` (create), `PUT /:id` (update), `DELETE /:id` (soft-delete). `[MUST_SHIP]`
- `POST /api/templates/:id/duplicate` (clone, appends " (Copy)"). `[MUST_SHIP]`
- `POST /api/templates/:id/set-default` (per document-type default). `[MUST_SHIP]`
- `GET`/`PUT /api/invoice-settings` (round-off + decimal precision singleton). `[MUST_SHIP]`
- Enforce max 20 templates/business + 10KB config cap + default-delete guard. `[MUST_SHIP]`
- Full tenant isolation (`businessId` scope) + idempotency on POST create/duplicate. `[MUST_SHIP]`
- Store `templateId` / `roundOffOverride` / `roundOffAmount` on the invoice/document
  record so a generated PDF records which template + round-off it used. `[SHOULD_SHIP]`
- Server PDF / image / batch-PDF endpoints (Puppeteer). `[FUTURE_EPIC]`
- DB-seeded base templates. `[FUTURE_EPIC]` — see Resolved Decision R2 (base templates
  are client-side presets in `template.defaults.ts`; DB stores only user templates).

---

## Key Reconciliation: shipped frontend contract vs PRD

The frontend under `src/features/templates/**` is **already built and merged**.
The backend must match it exactly. Where the PRD (written 2026-03-14) disagrees
with the shipped `template.service.ts` + types, the **frontend wins**:

| Concern | PRD says | Shipped frontend says (WINS) |
|---------|----------|------------------------------|
| List endpoint | `/api/v1/templates` | `api('/templates')` → mount `/api/templates` |
| Settings endpoint | `/api/v1/settings/invoice` | `api('/invoice-settings')` → mount `/api/invoice-settings` |
| List response | `{ templates: [...] }` | `TemplateSummary[]` directly (api() unwraps `{success,data}`; `data` IS the array) |
| `baseTemplate` | 6-value Prisma enum | **~30-value** TS union (`template-layout.types.ts`) — store as `String`, not enum (R1) |
| `PrintSettings` | 8 fields | 12 fields incl. `stampStyle`, `copyLabels`, `copyLabelMode`, `copyLabelNames` → store JSON blob (R3) |
| `TemplateConfig.fields` | 23 flags | 29 flags incl. `paymentStatusStamp`, `udyamNumber`, `totalQuantity`, `copyLabel`, `gstTaxSummary?`, `gstDeclaration?` → JSON blob (R3) |
| `TemplateFontSize` | 3 levels | 5 levels (`xs`..`xl`) → inside JSON blob, no server enum |
| `roundOff.precision` | Prisma enum `ONE/HALF/...` | wire strings `'1'\|'0.50'\|'0.10'\|'none'` → map at the boundary (R4) |
| Reset-to-base endpoint | `POST /reset/:baseTemplate` | **not called by frontend** → omit (R2) |
| PDF endpoints | 3 server endpoints | **not called by frontend** → `[FUTURE_EPIC]` (R5) |

---

## User Flow

The frontend flows (gallery, editor, settings) are already built. Backend-observable flows:

### Happy path — create + set default
1. Editor `POST /api/templates` with `{ name, baseTemplate, config, printSettings }`.
2. Server validates, enforces 20-template cap, persists, returns `201` full `InvoiceTemplate`
   (`isDefault:false`, `defaultForTypes:[]`).
3. User `POST /api/templates/:id/set-default` with `{ documentTypes:["SALE_INVOICE"] }`.
4. Server upserts `TemplateDefault` rows (one row per (business, docType), superseding any
   prior default for those types), returns `{ id, defaultForTypes }`.
5. `GET /api/templates` now returns that summary with `isDefault:true, defaultForTypes:["SALE_INVOICE"]`.

### Happy path — invoice settings
1. `GET /api/invoice-settings` → upsert-on-read returns defaults if none exist.
2. `PUT /api/invoice-settings` with full `{ roundOff, decimalPrecision }` → full replace, returns saved.

### Error paths (exact messages, `{ success:false, error:{ code, message } }`)
- No/invalid auth → `401` `{ code:"UNAUTHORIZED", message:"Please sign in to continue." }`
- Template not owned by caller's business → `404` `{ code:"TEMPLATE_NOT_FOUND", message:"Template not found." }`
  (404 not 403 — never confirm existence across tenants; IDOR-safe)
- Bad body (missing name, unknown baseTemplate, config > 10KB) → `400`
  `{ code:"VALIDATION_ERROR", message:"<field>: <reason>" }`
- 21st template → `400` `{ code:"TEMPLATE_LIMIT_REACHED", message:"You can create up to 20 templates. Delete one to add another." }`
- Delete a template that is a default → `400`
  `{ code:"TEMPLATE_IS_DEFAULT", message:"This template is the default for one or more document types. Set another default first." }`
- Delete the last remaining template → allowed (base presets are client-side; there is
  always a fallback) — see R2.
- Duplicate a soft-deleted / missing template → `404` `TEMPLATE_NOT_FOUND`.

---

## Failure Mode Walkthrough (6 months post-launch)

1. **Provider/dependency outage (Postgres down 30 min).** Template CRUD is not on the
   critical invoicing path — PDF generation is 100% client-side (React-PDF) reading the
   Dexie-cached template. Reads: frontend already serves the last-synced template from
   IndexedDB. Writes: `api()` offline queue holds the mutation (`entityType:'template'`)
   and replays on reconnect; POST create/duplicate carry an idempotency key so a
   replayed-after-timeout create does not double-insert. No user-facing failure for the
   money path (making/printing invoices) during a DB outage.

2. **Abuse spike (100x create traffic, rotating IPs).** Row growth is hard-bounded: **max
   20 templates per business** (enforced in a transaction, `SELECT count ... FOR UPDATE`-
   equivalent via `$transaction` re-check) and **10KB config cap** per row → worst case
   per tenant is ~200KB regardless of request volume. Per-business rate limit
   (`30 writes/min`) on the mutating routes rejects floods with `429`. Rotating IPs don't
   help the attacker because the cap is keyed on `businessId`, not IP.

3. **Database bloat (soft-deleted rows reach 100M).** Only ephemeral growth is
   `deletedAt`-stamped template rows. **Cleanup:** `scripts/cron/purge-deleted-templates.ts`,
   runs **daily 03:00 IST**, hard-deletes `invoice_templates WHERE deletedAt < now()-90d`,
   index on `deletedAt` (partial `WHERE deletedAt IS NOT NULL`). Retention 90 days for
   accidental-delete recovery + accounting trace of which template a past invoice used.
   `TemplateDefault` is self-bounded (≤7 rows/business, unique `(businessId,documentType)`).
   `InvoiceSettings` is 1 row/business.

4. **Client-version lag (30% on 6-month-old app).** `config`/`printSettings` are **additive
   JSON blobs**; the server stores them opaquely (validated for size + type, NOT for an
   exhaustive key allowlist) so a newer client writing `gstTaxSummary` and an older client
   reading it round-trips losslessly. `baseTemplate` is a **`String`** (R1) so a new base
   value shipped in a newer client is not rejected by an old server enum. The frontend
   `template.defaults.ts` fills any missing config key with a default at read time, so an
   old client reading a config authored by a new client never dereferences `undefined`.

5. **Regulatory change (GST/e-invoice mandate, 1-week notice).** The config already carries
   optional `gstTaxSummary?`, `gstDeclaration?`, `placeOfSupply`, `udyamNumber` flags — a
   compliance toggle is a config-flag flip, no migration. Round-off method changes (CA
   demand) are covered by the settings enum (`round/floor/ceil` × `1/0.50/0.10/none`). No
   customer PII lives in the template config (only labels, colors, business-authored text)
   → DPDP data-subject-erasure requests never touch this table.

6. **Cost runaway (provider cost 5x).** MUST_SHIP has **no per-call external cost** — no
   SMS, no third-party API; PDF is client-side. The only paid path (server Puppeteer
   PDF/image) is `[FUTURE_EPIC]` and, when built, is the single cost-bearing endpoint and
   must ship behind its own rate limit + daily render cap. Nothing in this SCOPE can bleed
   money.

7. **Insider abuse (engineer with DB access).** Template `config` is **data, not code** —
   React-PDF renders declarative primitives, never executes strings, and SVG is
   unsupported, so a hand-crafted malicious `config` cannot achieve code execution on the
   client PDF path. **Caveat carried forward:** when the Puppeteer HTML render path
   (`[FUTURE_EPIC]`) lands, `headerText`/`footerText`/`termsText`/custom column labels are
   untrusted and MUST be HTML-escaped there (XSS-via-template). All template + settings
   mutations write an **audit-log row** (actor userId, businessId, templateId, action) so a
   privilege/default change is attributable. `set-default` cannot grant any capability — it
   only selects a render preset.

---

## API Contract

Mount: `['/api/templates', invoiceTemplatesRouter]`, `['/api/invoice-settings', invoiceSettingsRouter]`
in `server/src/app.routes.ts`. All routes behind `auth` middleware. Response envelope is
the project-standard `sendSuccess(res, data)` → `{ success:true, data }`; errors
`{ success:false, error:{ code, message } }`.

```ts
// ---- Templates ----
// GET /api/templates                     -> data: TemplateSummary[]
// GET /api/templates/:id                 -> data: InvoiceTemplate
// POST /api/templates                    (Idempotency-Key)  -> 201 data: InvoiceTemplate
// PUT  /api/templates/:id                -> data: InvoiceTemplate  (partial merge of TemplateFormData)
// DELETE /api/templates/:id              -> 200 data: { id }
// POST /api/templates/:id/duplicate      (Idempotency-Key)  -> 201 data: InvoiceTemplate
// POST /api/templates/:id/set-default    -> data: { id: string; defaultForTypes: DocumentType[] }

interface TemplateFormData {           // POST body / PUT partial
  name: string                         // 1..100 chars
  baseTemplate: string                 // must be in BASE_TEMPLATE_ALLOWLIST (R1)
  config: TemplateConfig               // JSON, <= 10KB serialized
  printSettings: PrintSettings         // JSON
}
interface SetDefaultReq { documentTypes: DocumentType[] }   // [] clears this template's defaults

interface TemplateSummary {            // list item (NO config/printSettings)
  id: string; name: string; baseTemplate: string
  isDefault: boolean                   // derived = defaultForTypes.length > 0
  defaultForTypes: DocumentType[]; isActive: boolean; updatedAt: string
}
interface InvoiceTemplate extends TemplateSummary {
  businessId: string; config: TemplateConfig; printSettings: PrintSettings
  createdAt: string; deletedAt: string | null
}

// ---- Invoice settings (singleton per business) ----
// GET /api/invoice-settings              -> data: InvoiceSettings   (upsert-on-read defaults)
// PUT /api/invoice-settings              -> data: InvoiceSettings   (full replace)

interface InvoiceSettings {
  roundOff: { enabled: boolean; precision: '1'|'0.50'|'0.10'|'none';
              showOnInvoice: boolean; method: 'round'|'floor'|'ceil' }
  decimalPrecision: { quantity: 0|1|2|3; rate: 0|1|2|3; amount: 2 }   // amount fixed, echoed
}
// Error: { success:false, error:{ code:string, message:string } }
```

---

## Data Model (Prisma)

Add to `server/prisma/schema.prisma` + one migration (`prisma migrate dev --name invoice_templates`).
`Business` gets three back-relations. `baseTemplate` is **`String`, not an enum** (R1).

```prisma
model InvoiceTemplate {
  id            String    @id @default(cuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String    @db.VarChar(100)
  baseTemplate  String    @db.VarChar(40)     // validated by Zod allowlist, not a DB enum
  config        Json                           // TemplateConfig blob (<=10KB, enforced in service)
  printSettings Json                           // PrintSettings blob
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  deletedAt     DateTime?
  defaultFor    TemplateDefault[]
  @@index([businessId, isActive])
  @@index([deletedAt])                         // backs the purge cron (partial-friendly)
  @@map("invoice_templates")
}

model TemplateDefault {
  id           String          @id @default(cuid())
  businessId   String
  business     Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  templateId   String
  template     InvoiceTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  documentType DocumentType                     // reuse existing enum from documents feature (R6)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  @@unique([businessId, documentType])          // one default per doc type per business
  @@index([businessId])
  @@map("template_defaults")
}

model InvoiceSettings {
  id                    String            @id @default(cuid())
  businessId            String            @unique
  business              Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  roundOffEnabled       Boolean           @default(true)
  roundOffPrecision     RoundOffPrecision @default(ONE)
  roundOffMethod        RoundOffMethod    @default(ROUND)
  roundOffShowOnInvoice Boolean           @default(true)
  quantityDecimals      Int               @default(2) @db.SmallInt   // 0..3
  rateDecimals          Int               @default(2) @db.SmallInt   // 0..3
  createdAt             DateTime          @default(now())
  updatedAt             DateTime          @updatedAt
  @@map("invoice_settings")
}

enum RoundOffPrecision { ONE HALF TEN_PAISE NONE }   // wire<->enum map in service (R4)
enum RoundOffMethod    { ROUND FLOOR CEIL }
```

- `DocumentType` (R6): **do NOT create a new enum** — reuse the existing document/invoice
  document-type enum already in the schema (architect confirms the exact name). If none
  exists yet, this is a dependency the architect must resolve, not a new definition here.
- **`[SHOULD_SHIP]` Invoice/Document FK:** add `templateId String?`, `roundOffOverride
  Boolean?`, `roundOffAmount Decimal? @db.Decimal(10,2)` to the existing invoice/document
  model. Architect confirms whether that model is named `Invoice` or `Document` (repo uses
  `/api/documents`); the migration ordering (add nullable col → no backfill needed) is
  trivial. Deferred out of MUST_SHIP because the shipped frontend contract does not require
  it to stop the 404.

### Ephemeral-data cleanup (HARD-GATE compliance)
No OTP/session/lock tables. The only accumulating rows are soft-deleted templates:
- **Script:** `server/scripts/cron/purge-deleted-templates.ts`
- **Frequency:** daily 03:00 IST
- **Retention:** 90 days after `deletedAt`
- **Index:** `@@index([deletedAt])` on `invoice_templates` (above)

---

## File Plan (HARD GATE)

SSOT check: `npm run ssot` clean — reuse `sendSuccess`/`sendError` (`lib/response`),
`asyncHandler`, `auth`, `validate`, `requirePermission` middleware, and the
`upsert(where:{businessId})` singleton-settings pattern proven in
`services/inventory-settings.service.ts`. No new SSOT capability introduced.

| # | Path | Action | Est. Lines | Layer | Notes |
|---|------|--------|-----------|-------|-------|
| 1 | `server/prisma/schema.prisma` | modify | ~55 | schema | 3 models + 2 enums + Business relations + Invoice FK (R6) |
| 2 | `server/prisma/migrations/**/migration.sql` | create | ~40 | migration | generated via `migrate dev` |
| 3 | `server/src/schemas/invoice-template.schema.ts` | create | ~120 | schema | Zod: create/update/set-default; `baseTemplate` allowlist; 10KB config guard; `.strict()` on top level, passthrough JSON |
| 4 | `server/src/schemas/invoice-settings.schema.ts` | create | ~60 | schema | Zod: roundOff + decimalPrecision wire shape |
| 5 | `server/src/services/invoice-template/template.constants.ts` | create | ~60 | constants | `MAX_TEMPLATES=20`, `MAX_CONFIG_BYTES=10240`, `BASE_TEMPLATE_ALLOWLIST` (mirrors FE union) |
| 6 | `server/src/services/invoice-template/template-mapper.ts` | create | ~90 | utils | DB row → API `InvoiceTemplate`/`TemplateSummary`; compute `isDefault`/`defaultForTypes` |
| 7 | `server/src/services/invoice-template/template-crud.service.ts` | create | ~210 | service | list/get/create/update/softDelete/duplicate; cap + config-size + IDOR scope |
| 8 | `server/src/services/invoice-template/template-default.service.ts` | create | ~110 | service | setDefault (upsert `TemplateDefault`), default-delete guard |
| 9 | `server/src/services/invoice-settings.service.ts` | create | ~120 | service | get/update singleton; wire↔enum map (R4) |
| 10 | `server/src/routes/invoice-templates.routes.ts` | create | ~150 | route | thin handlers, `auth`, `requirePermission('settings.modify')` on writes |
| 11 | `server/src/routes/invoice-settings.routes.ts` | create | ~55 | route | GET/PUT thin handlers |
| 12 | `server/src/app.routes.ts` | modify | ~4 | route | mount 2 routers |
| 13 | `server/scripts/cron/purge-deleted-templates.ts` | create | ~50 | script | 90-day hard-purge of soft-deleted rows |

No row > 250 lines. Services 7/8 are pre-split (CRUD vs default-resolution) to stay under cap.

---

## Security

- **Auth:** required on every route (`auth` middleware). No public/unauthed access.
- **Role:** writes gated by `requirePermission('settings.modify')` (existing permission,
  matches inventory-settings). Reads need auth only.
- **Lockout policy:** **N/A** — not an auth/billing/credential feature (no login, OTP,
  password, payment). The auth blindspots lockout HARD-GATE does not apply; stated
  explicitly so scope-auditor does not flag it.
- **Rate limit:** per-business `30 writes/min` (primitive: existing rate-limit middleware;
  policy: 429 with `Retry-After`) on POST/PUT/DELETE. Reads use the default global limiter.
- **IDOR scope:** every query filters `businessId = req.user!.businessId`; cross-tenant id
  returns `404 TEMPLATE_NOT_FOUND` (never 403 — no existence oracle). `set-default` and
  `duplicate` re-load the target under the tenant scope before mutating. (Guards against
  the `req.user.userId`/drop-undefined IDOR class in project memory — `businessId` is
  asserted non-null, never spread as `undefined`.)
- **CSRF:** mutations go through `api()` which already attaches the CSRF token; routes sit
  behind the standard CSRF middleware (no allowlist exemption).
- **Config injection:** `config`/`printSettings` stored as opaque JSON, size-capped 10KB;
  no server-side eval. Puppeteer HTML path (FUTURE) must HTML-escape text fields — noted in
  Failure Mode #7.
- **Audit log:** create/update/delete/duplicate/set-default and settings-update each write
  an audit row (reuse the existing audit-log writer) with actor + businessId + templateId.

---

## Observability

- **Analytics events (≤7):**
  - `template_created { baseTemplate, businessId }`
  - `template_updated { templateId }`
  - `template_deleted { templateId }`
  - `template_duplicated { fromTemplateId, toTemplateId }`
  - `template_default_set { templateId, documentTypesCount }`
  - `invoice_settings_updated { roundOffPrecision, roundOffMethod }`
  - `template_limit_hit { businessId }` (fires on the 21st-template `400`)
- **Sentry:** alert on `>2%` 5xx over 5 min on the two routers; alert on any
  `TEMPLATE_LIMIT_HIT` rate spike (>50/hr → possible abuse).
- **Metrics/dashboard:** templates-created/day, avg templates/business, purge-cron
  rows-deleted/run (a 0-forever value = cron dead), 4xx-by-code breakdown.
- **Cost alerts:** none for MUST_SHIP (no per-call external spend). Reserved for the
  FUTURE Puppeteer path.

---

## Test Infrastructure

- No external paid provider on this path → **no money burned by tests**. No reserved SMS
  range / payment card needed (that context applies to auth/billing, N/A here).
- CI seeds a throwaway business, exercises full CRUD + set-default + settings against the
  test Postgres. Idempotency verified by replaying the same `Idempotency-Key` and asserting
  a single row. Cap verified by creating 20 then asserting the 21st returns
  `TEMPLATE_LIMIT_REACHED`.
- Purge cron tested with a row stamped `deletedAt = now()-91d` → asserted hard-deleted;
  `now()-89d` → asserted retained.

---

## Accepted Trade-offs

- **`baseTemplate` as `String`, not a Prisma enum** — the frontend has ~30 base presets and
  will add more; an enum forces a migration per preset and would reject configs written by
  newer clients (version-lag failure). Validated by a Zod allowlist instead. Do not
  "fix" this into an enum.
- **`config`/`printSettings` stored opaque (size-typed, not key-exhaustively-validated)** —
  deliberate, so additive client changes never require a server deploy. The frontend owns
  the config schema. Do not add per-key server validation.
- **Base templates are client-side presets, not DB rows** — no per-business seeding, no
  migration on preset changes. Do not add a seed script.
- **Last template is deletable** — because a client-side base preset is always available as
  a fallback; there is no "must keep one row" invariant. Only the default-delete guard applies.
- **No server PDF in MVP** — client React-PDF covers the money path offline; server render
  is FUTURE. Do not scaffold Puppeteer now.

## Resolved Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| R1 | `baseTemplate` = `String` + Zod allowlist | FE union has ~30 values, grows; enum churn + version-lag rejection (see trade-offs) |
| R2 | No `/reset/:baseTemplate` endpoint; base presets client-side | Frontend never calls it; reset-to-base is a pure client apply of `template.defaults.ts` |
| R3 | `config` + `printSettings` = opaque JSON blobs | FE shape is richer than PRD (stampStyle, gstTaxSummary, 5 font sizes…); store as-is, size-cap only |
| R4 | Round-off stored as DB enum, exchanged as wire strings | Clean DB domain (`ONE/HALF/...`) + FE contract strings (`'1'/'0.50'/...`); map at service boundary |
| R5 | PDF/image/batch endpoints deferred `[FUTURE_EPIC]` | Not in the shipped frontend contract; client generates PDFs offline |
| R6 | Reuse existing `DocumentType` enum, don't redefine | Repo already models 7 doc types under `/api/documents`; architect confirms the enum name |
| R7 | Mount at `/api/templates` + `/api/invoice-settings` | Matches shipped `template.service.ts` calls, NOT the PRD's `/api/v1/...` |
| R8 | `isDefault` is derived (`defaultForTypes.length>0`), not a stored column | Single source of truth = `TemplateDefault` rows; avoids the two-columns-can-disagree bug |

## Out of Scope

- Server-side PDF / JPG / PNG / batch-PDF generation (Puppeteer). `[FUTURE_EPIC]`
- Drag-and-drop / custom-HTML template builder, template marketplace. `[FUTURE_EPIC]`
- The React-PDF renderer, gallery UI, editor UI, Dexie offline tables — **already built**,
  not touched here.
- Bluetooth thermal ESC/POS printing (client + native concern). `[FUTURE_EPIC]`
- Round-off / decimal **calculation** applied to actual invoice totals (that lives in the
  invoicing feature; this SCOPE only persists the settings). `[SHOULD_SHIP]` in the
  invoicing epic, wired via the `[SHOULD_SHIP]` Invoice FK columns here.
- GST place-of-supply / e-invoice compliance fields beyond the config flags. `[FUTURE_EPIC]`

## Learnings-file pre-flight (both matched files addressed)

- `scope-writer-blindspots-*-recurring-financial.md` — **N/A**: this feature does not
  auto-create financial records on a timer; templates are user-authored config with a human
  in the loop for every write. No auto-generation, no run-marker, no schedule.
- `scope-writer-blindspots-*-auth.md` — **N/A**: no auth/OTP/credential/lockout surface.
  The IDOR + `req.user.userId`/drop-undefined class (project memory) IS addressed in Security.
- `contexts/india-android-saas.md` — **applied**: offline-queue + Dexie read fallback
  (Failure #1), 6-month app-version lag → additive JSON + `String` baseTemplate (Failure #4,
  R1), no external SMS/payment cost (Failure #6), DPDP (no PII in config, Failure #5).

---

## Acceptance Criteria (binary)

- [ ] `curl GET /api/templates` (authed) → `{ success:true, data:[…TemplateSummary] }`, no `config` field on items
- [ ] `curl GET /api/templates/:id` → full `InvoiceTemplate` incl. `config` + `printSettings`
- [ ] `curl POST /api/templates` valid body → `201` full entity, `isDefault:false`, `defaultForTypes:[]`
- [ ] Same POST replayed with identical `Idempotency-Key` → single row created
- [ ] `curl PUT /api/templates/:id` partial `{name}` → merged, other fields unchanged
- [ ] `curl DELETE /api/templates/:id` (non-default) → `200 {id}`, row `deletedAt` set, absent from list
- [ ] `curl DELETE` on a default template → `400 TEMPLATE_IS_DEFAULT`
- [ ] `curl POST /api/templates/:id/duplicate` → `201`, name ends " (Copy)", `defaultForTypes:[]`
- [ ] `curl POST /api/templates/:id/set-default {documentTypes:["SALE_INVOICE"]}` → `{id, defaultForTypes:["SALE_INVOICE"]}`; prior default for that type superseded
- [ ] 21st create → `400 TEMPLATE_LIMIT_REACHED`
- [ ] config > 10KB → `400 VALIDATION_ERROR`
- [ ] Cross-tenant `:id` → `404 TEMPLATE_NOT_FOUND` (not 403, not 200)
- [ ] Any route without auth → `401`
- [ ] `curl GET /api/invoice-settings` first call → upserted defaults (`precision:"1"`, `method:"round"`, `quantity:2`, `rate:2`, `amount:2`)
- [ ] `curl PUT /api/invoice-settings` → wire strings persisted; GET round-trips identical shape
- [ ] Purge cron: `deletedAt=now()-91d` hard-deleted; `now()-89d` retained
- [ ] Frontend `/settings/templates` and `/settings/invoice` load with **no 404** (root problem closed)
- [ ] `npx tsc -b --noEmit` clean · `node scripts/enforce.js` clean · `npm run ssot` exit 0

## QA Checklist (verifier confirms each)

- [ ] All 6 template routes + 2 settings routes return the shipped-frontend shape (diff against `template.service.ts` return types)
- [ ] `isDefault` on list items equals `defaultForTypes.length > 0` in every case
- [ ] Wire↔enum round-off mapping is lossless both directions (all 4 precisions × 3 methods)
- [ ] Idempotency verified on create AND duplicate
- [ ] Tenant isolation: seed two businesses, confirm neither can read/mutate the other's templates
- [ ] Audit rows written for every mutation
- [ ] Migration is add-only (no data loss); Invoice FK column is nullable (no backfill)
- [ ] Offline: mutation queued with `entityType:'template'` replays cleanly on reconnect
