# ARCHITECTURE — Invoice Templates & Settings (Backend)

> Source SCOPE: `docs/SCOPE_invoice-templates.md` (approved).
> Frontend contract: `src/features/templates/**` (already shipped — NOT rebuilt).
> High-risk path touched: `server/prisma/schema.prisma` → this doc + an approved
> `.claude/design-plan-active.md` are the gate for any code landing.

---

## 0. Open-item resolution (the thing scope-writer flagged for the architect)

**The document model in this schema is named `Document`, NOT `Invoice`.**
(`server/prisma/schema.prisma` line 983.) Its `type` column is a **`String`**
(`SALE_INVOICE`, `PURCHASE_INVOICE`, `ESTIMATE`, `PROFORMA`, `SALE_ORDER`,
`PURCHASE_ORDER`, `DELIVERY_CHALLAN`, `CREDIT_NOTE`, `DEBIT_NOTE`). **There is no
`DocumentType` Prisma enum** — the union lives only in `shared/enums.ts`
(`DOCUMENT_TYPES`, 9 values) and is consumed by the FE as a TS union.

Two consequences, both DEVIATIONS from the SCOPE's literal Prisma snippet
(documented in §11):

1. `TemplateDefault.documentType` is a **`String @db.VarChar(30)`**, validated by
   a Zod allowlist built from `DOCUMENT_TYPES` — **not** a Prisma enum
   `DocumentType` (which does not exist and would be a large, churny new enum).
   Matches how every other model in this schema stores a doc-type (all `String`).
2. The `[SHOULD_SHIP]` template↔document FK lands on **`Document`** (add
   `templateId String?` + `SetNull` relation). See §3.4.

---

## 1. Overview

Three new Prisma models + two enums, a Zod schema layer, a service layer split
into CRUD / default-resolution / settings, two thin Express routers, and a
purge cron. All routes sit behind `auth` and match the **already-shipped**
`src/features/templates/template.service.ts` contract exactly:

- `GET /api/templates` → `data: TemplateSummary[]` (bare array, no `config`)
- `GET /api/templates/:id` → `data: InvoiceTemplate` (full)
- `POST /api/templates` (Idempotency-Key) → 201 `data: InvoiceTemplate`
- `PUT /api/templates/:id` → `data: InvoiceTemplate` (partial merge)
- `DELETE /api/templates/:id` → 200 `data: { id }`
- `POST /api/templates/:id/duplicate` (Idempotency-Key) → 201 `data: InvoiceTemplate`
- `POST /api/templates/:id/set-default` → `data: { id, defaultForTypes: string[] }`
- `GET /api/invoice-settings` → `data: InvoiceSettings` (upsert-on-read)
- `PUT /api/invoice-settings` → `data: InvoiceSettings` (full replace)

Response envelope is the project SSOT `sendSuccess(res, data)` →
`{ success:true, data }`; errors `sendError(res, message, code, status)` →
`{ success:false, error:{ code, message } }`. `api()` on the FE unwraps `data`,
so the service functions return the bare typed value — the SCOPE's "bare
arrays/objects in `data`" requirement is satisfied by `sendSuccess`.

### Mobile-first / performance

Pure backend feature; no new bundle. Budget impact:

| Metric | Target | This feature |
|---|---|---|
| Server TTFB p95 | < 300ms | list = 1 indexed query + 1 defaults join; get = 1 findFirst by PK+businessId |
| DB query p95 | < 100ms | all queries hit `@@index([businessId, isDeleted])` / PK / `@@unique([businessId,documentType])` |
| Initial JS bundle | ≤ 200KB | unchanged (FE already shipped) |

The FE list view already renders 4 UI states (loading/error/empty/success) — the
only backend obligation is to return the exact shapes so those states resolve.

---

## 2. SSOT discovery (reuse, don't rebuild)

No `ssot.config.mjs` toolkit is set up in this repo, so discovery is grep-based.
Every shared capability this feature needs already exists — **import, don't build**:

| Capability | Canonical module | Row action |
|---|---|---|
| Success/error envelope | `server/src/lib/response.ts` (`sendSuccess`/`sendError`) | reuses |
| Async error wrapping | `server/src/middleware/asyncHandler.ts` | reuses |
| Auth (`req.user.{userId,businessId}`) | `server/src/middleware/auth.ts` | reuses |
| Body validation | `server/src/middleware/validate.ts` | reuses |
| Permission gate | `server/src/middleware/permission.ts` (`requirePermission`) | reuses |
| Idempotency (POST replay) | `server/src/middleware/idempotency.ts` (`idempotencyCheck()`) | reuses |
| Per-user write rate limit | `server/src/middleware/rate-limit` (`userMutationLimiter`) | reuses |
| Audit log write | `tx.auditLog.create({ data:{ businessId, entityType, entityId, entityLabel, userId, action, changes } })` (pattern in `services/recurring/crud.ts`) | reuses |
| Soft-delete auto-filter | `server/src/lib/soft-delete` extension + `SOFT_DELETE_MODELS` registry | reuses (register `InvoiceTemplate`) |
| Doc-type SSOT | `shared/enums.ts` → `DOCUMENT_TYPES` / `DocumentType` | reuses |
| Prisma client | `server/src/lib/prisma.ts` (`prisma`, soft-delete extended) | reuses |
| Singleton-settings upsert | `services/inventory-settings.service.ts` (`upsert(where:{businessId})`) | reuses (pattern) |

No new SSOT capability is introduced.

---

## 3. Domain model (Prisma)

### 3.1 InvoiceTemplate

```prisma
model InvoiceTemplate {
  id            String    @id @default(cuid())
  businessId    String
  business      Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String    @db.VarChar(100)
  baseTemplate  String    @db.VarChar(40)     // validated by Zod allowlist, NOT a DB enum (R1)
  config        Json                           // TemplateConfig blob (<=10KB, enforced in service)
  printSettings Json                           // PrintSettings blob
  isActive      Boolean   @default(true)
  isDeleted     Boolean   @default(false)      // repo soft-delete convention (isDeleted + deletedAt)
  deletedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  defaultFor    TemplateDefault[]
  documents     Document[]                     // [SHOULD_SHIP] back-relation for Document.templateId (§3.4)

  @@index([businessId, isActive])
  @@index([businessId, isDeleted])             // list query path
  @@index([deletedAt])                         // backs the purge cron
  @@map("invoice_templates")
}
```

**Invariants:**
- Always scoped: every query filters `businessId = req.user.businessId`. Never
  spread `businessId` as possibly-`undefined` (guards the `req.user.userId`
  drop-undefined IDOR class in project memory — `businessId` is asserted with `!`).
- Soft delete only: register in `SOFT_DELETE_MODELS`; the extension auto-adds
  `isDeleted:false` to reads and rewrites `delete` → `update{isDeleted:true,deletedAt}`.
- `config`/`printSettings` are **opaque** — size-capped (≤10KB serialized) + typed
  as object, never per-key validated (R3). Additive client changes never need a deploy.
- Max **20 non-deleted** templates per business (enforced in a `$transaction`, §5.2).

### 3.2 TemplateDefault

```prisma
model TemplateDefault {
  id           String          @id @default(cuid())
  businessId   String
  business     Business        @relation(fields: [businessId], references: [id], onDelete: Cascade)
  templateId   String
  template     InvoiceTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  documentType String          @db.VarChar(30)   // DEVIATION R6: String + DOCUMENT_TYPES allowlist, not enum
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@unique([businessId, documentType])            // one default per doc type per business
  @@index([businessId])
  @@index([templateId])
  @@map("template_defaults")
}
```

**Invariants:**
- `isDefault` on the API is **derived** = the template has ≥1 `TemplateDefault`
  row (R8). Never a stored boolean → no two-columns-disagree bug.
- `set-default` upserts on `@@unique([businessId, documentType])`, so assigning a
  type to a new template automatically supersedes the previous default for that type.
- `documentType` values MUST be in `DOCUMENT_TYPES` (Zod-enforced at the boundary).
- NOT soft-deleted — hard rows, ≤9/business, cascade-deleted with template/business.

### 3.3 InvoiceSettings

```prisma
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

**Invariants:**
- One row per business (`@unique businessId`); GET upserts defaults on first read.
- `amount` decimal precision is **fixed at 2** — not stored, echoed as `2` by the mapper.
- Round-off stored as **DB enum**, exchanged as **wire strings** — mapped both ways
  at the service boundary (§4). Lossless for all 4 precisions × 3 methods.

### 3.4 [SHOULD_SHIP] Document FK

On the existing `Document` model, add one nullable column (add-only, no backfill):

```prisma
  // [SHOULD_SHIP] which template rendered this doc (nullable forever; legacy docs = null)
  templateId String?
  template   InvoiceTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` so soft/hard-deleting a template never destroys invoice
history. `roundOffAmount`/`roundOffOverride` from the SCOPE snippet are **NOT
added** — `Document.roundOff Int @default(0)` (paise) already records the applied
round-off amount, and money-SSOT mandates paise `Int`, not `Decimal(10,2)`.
DEVIATION documented in §11.

### 3.5 Business back-relations

`Business` gains three back-relations (schema-required for the FKs above):
`invoiceTemplates InvoiceTemplate[]`, `templateDefaults TemplateDefault[]`,
`invoiceSettings InvoiceSettings?`.

---

## 4. Wire ↔ enum boundary mapper (R4)

Single pure module (`invoice-settings.mapper.ts`), lossless both directions:

```
precision:  '1' ↔ ONE   |  '0.50' ↔ HALF  |  '0.10' ↔ TEN_PAISE  |  'none' ↔ NONE
method:     'round' ↔ ROUND  |  'floor' ↔ FLOOR  |  'ceil' ↔ CEIL
```

DB row → API `InvoiceSettings`:
```
{ roundOff: { enabled, precision:<map>, showOnInvoice, method:<map> },
  decimalPrecision: { quantity: quantityDecimals, rate: rateDecimals, amount: 2 } }
```
API → DB (PUT full replace): inverse map; `amount` ignored (fixed 2).

---

## 5. Data flow & service design

Data flow: FE `template.service.ts` → `api()` → Express router (thin) →
`validate(zod)` → service (orchestration + `$transaction`) → `prisma` →
`*-mapper` → `sendSuccess`.

### 5.1 List / get / update / delete
- **list**: `findMany({ where:{ businessId } })` (soft-delete extension adds
  `isDeleted:false`) + `select` excluding `config`/`printSettings`; join
  `defaultFor` to compute `isDefault`/`defaultForTypes`. Mapper → `TemplateSummary[]`.
- **get**: `findFirst({ where:{ id, businessId } })`. Miss → `404 TEMPLATE_NOT_FOUND`
  (never 403 — no cross-tenant existence oracle). Include `defaultFor`.
- **update**: re-load under `{ id, businessId }`; partial-merge supplied fields
  (`name`/`baseTemplate`/`config`/`printSettings`); config-size re-checked if present.
- **delete**: re-load under scope; if any `TemplateDefault` rows exist →
  `400 TEMPLATE_IS_DEFAULT`. Else soft-delete (extension). Returns `{ id }`.
  Last template IS deletable (client-side base preset is always the fallback — R2).

### 5.2 Create / duplicate (capped, idempotent)
Wrapped in `prisma.$transaction`:
1. `count({ where:{ businessId } })` (excludes soft-deleted). `>= 20` →
   `400 TEMPLATE_LIMIT_REACHED` (+ `template_limit_hit` analytics).
2. `create` (duplicate: re-load source under scope → clone `config`/`printSettings`,
   name = `${source.name} (Copy)`, no default rows).
3. `auditLog.create` in the same tx.
`idempotencyCheck()` middleware (X-Idempotency-Key) sits in front → a replayed
create/duplicate returns the stored response, single row.

### 5.3 set-default
`$transaction`: re-load target under scope (404 if missing). For each type in
`documentTypes` (Zod-validated ⊆ `DOCUMENT_TYPES`): `upsert` on
`@@unique([businessId, documentType])` pointing at this template (supersedes prior
default). Delete this template's `TemplateDefault` rows whose `documentType` is
NOT in the new set (clears de-selected types; `[]` clears all for this template).
Return `{ id, defaultForTypes }` (the template's current set after the write).

### 5.4 invoice-settings
`get`: `upsert({ where:{businessId}, create:{businessId}, update:{} })` → mapper.
`put`: validate full body → inverse-map → `upsert` (create+update both set all
columns) → mapper. Mirrors `inventory-settings.service.ts` exactly.

---

## 6. State machines

Template lifecycle (server-authoritative):
```
States:   (none) | ACTIVE | DEFAULT | DELETED
Initial:  (none)
Terminal: DELETED (retained 90d, then hard-purged by cron)

(none)  --create/duplicate--> ACTIVE
ACTIVE  --set-default(types≠[])--> DEFAULT
DEFAULT --set-default([])--------> ACTIVE
ACTIVE  --delete-----------------> DELETED
DEFAULT --delete-----------------> BLOCKED (400 TEMPLATE_IS_DEFAULT; stays DEFAULT)
DELETED --purge-cron(>90d)-------> (hard-deleted)
```
`DEFAULT` is derived (has ≥1 `TemplateDefault`), not a stored state.

Request state machine (per mutating route, FE-observable):
```
IDLE --submit--> VALIDATING --ok--> PERSISTING --ok--> SUCCESS(200/201) --> IDLE
                 VALIDATING --bad--> ERROR(400 VALIDATION_ERROR) --> IDLE
                 PERSISTING --cap--> ERROR(400 TEMPLATE_LIMIT_REACHED) --> IDLE
                 PERSISTING --scope-miss--> ERROR(404 TEMPLATE_NOT_FOUND) --> IDLE
     offline: api() queues mutation (entityType:'template') --reconnect--> replay (idempotent)
```

---

## 7. Error contract (exact codes/messages — from SCOPE)

| Case | HTTP | code | message |
|---|---|---|---|
| No/invalid auth | 401 | `UNAUTHORIZED` | Please sign in to continue. |
| Not owned / missing / soft-deleted target | 404 | `TEMPLATE_NOT_FOUND` | Template not found. |
| Bad body / unknown baseTemplate / config>10KB | 400 | `VALIDATION_ERROR` | `<field>: <reason>` |
| 21st template | 400 | `TEMPLATE_LIMIT_REACHED` | You can create up to 20 templates. Delete one to add another. |
| Delete a default template | 400 | `TEMPLATE_IS_DEFAULT` | This template is the default for one or more document types. Set another default first. |
| Rate limit exceeded (writes) | 429 | (limiter default) | + `Retry-After` |

`401` comes from `auth`; `404` from scope-miss in the service; `400`s thrown as
the app error type and rendered by `sendError`.

---

## 8. Feature flag & rollout

The FE is already live and currently 404s — this backend simply closes the gap.
Gate behind a flag so it can be dark-launched and instantly reversed:

```ts
// server/src/config/features.ts (pattern already in repo)
export const FEATURES = { INVOICE_TEMPLATES: process.env.FEATURE_INVOICE_TEMPLATES !== 'false' }
// in each router, first middleware after auth:
if (!FEATURES.INVOICE_TEMPLATES) return res.status(404).json({ success:false, error:{ code:'NOT_FOUND', message:'Not found.' }})
```
Default ON (`!== 'false'`) because it fixes a live 404; flip to `false` to disable.

Rollout — reversible-via-flag, so direct ship after proof gates:

| Stage | Audience | Gate | Verify before next |
|---|---|---|---|
| Internal | Sawan's business | `FEATURE_INVOICE_TEMPLATES=true` | curl 200/401/400/404 + `/settings/templates` loads |
| 100% | all | default ON | watch 5xx on the two routers 48h |

---

## 9. Ephemeral-data cleanup (HARD-GATE)

Only accumulating rows are soft-deleted templates. `TemplateDefault` (≤9/business,
unique) and `InvoiceSettings` (1/business) are self-bounded.

- **Script:** `server/scripts/cron/purge-deleted-templates.ts`
- **Frequency:** daily 03:00 IST
- **Retention:** 90 days after `deletedAt`
- **Query:** hard-`deleteMany` `invoice_templates WHERE isDeleted = true AND
  deletedAt < now()-90d` (uses `__basePrismaUnsafe`-equivalent raw client so the
  soft-delete extension does not re-intercept the hard delete — see §5 note).
- **Index:** `@@index([deletedAt])`.
- **Observability:** logs rows-deleted/run (a 0-forever value ⇒ cron dead).

---

## 10. Security (summary; full audit is out of this pass — no auth/billing path)

- Auth required on every route (`auth`). No public access.
- Writes gated by `requirePermission('settings.modify')` (same as inventory-settings).
- IDOR: every query filters `businessId`; cross-tenant id → `404` (no existence
  oracle). `set-default`/`duplicate`/`update`/`delete` re-load target under scope
  before mutating. `businessId` asserted non-null (`req.user!.businessId`).
- Rate limit: `userMutationLimiter` on POST/PUT/DELETE (per-user; keyed off userId,
  not IP — abuse via rotating IPs can't bypass the 20-template cap either).
- CSRF: mutations go through `api()` (CSRF token attached); routes use standard
  CSRF middleware, no allowlist exemption.
- Config injection: JSON stored opaque + 10KB cap, no server eval. React-PDF
  renders declarative primitives, no code exec. **Carry-forward:** the FUTURE
  Puppeteer path must HTML-escape `headerText`/`footerText`/`termsText`/custom
  labels (XSS). Not built here.
- Audit: create/update/delete/duplicate/set-default and settings-update each write
  an `auditLog` row (actor userId, businessId, entityId, action) inside the tx.

---

## 11. Deviations from SCOPE

Architect cannot silently overrule SCOPE — each change below is intentional:

| SCOPE said | Architecture does | Reason |
|---|---|---|
| `TemplateDefault.documentType DocumentType` (Prisma enum, "reuse existing enum") | `String @db.VarChar(30)` + `DOCUMENT_TYPES` Zod allowlist | **No `DocumentType` Prisma enum exists** in this schema; doc-types are `String` everywhere (`Document.type`), union lives in `shared/enums.ts`. Matches repo convention; avoids a churny new enum. |
| `InvoiceTemplate` uses `deletedAt` only | `isDeleted Boolean + deletedAt DateTime?`, registered in `SOFT_DELETE_MODELS` | Repo soft-delete extension keys on **both** fields via an SSOT registry; using only `deletedAt` would opt out of auto-filtering, recycle-bin, and enforcement scripts. Purge cron adjusts to `isDeleted = true AND deletedAt < now()-90d`. |
| `[SHOULD_SHIP]` add `templateId` + `roundOffOverride Boolean?` + `roundOffAmount Decimal(10,2)` to invoice/document model | Add **only** `templateId String?` (+ SetNull relation) to `Document` | `Document.roundOff Int` (paise) already records applied round-off; money-SSOT forbids `Decimal(10,2)`. `roundOffOverride` derivable later from settings-vs-doc diff — not needed to close the 404. |
| Per-business `30 writes/min` bespoke limiter | Reuse `userMutationLimiter` (per-user) | SSOT reuse; per-user is strictly finer-grained than per-business for a single-tenant-per-user flow, and the 20-template cap is the real bound on row growth. |

### Known SSOT risk flagged for the invoicing epic (not resolved here)
`DocumentSettings.roundOffTo` (`NONE/NEAREST_1/NEAREST_050/NEAREST_010`) already
exists and semantically overlaps `InvoiceSettings.roundOffPrecision`. This SCOPE
requires the new `/invoice-settings` contract, so `InvoiceSettings` is the SSOT
for the shipped FE. When round-off is actually **applied** to invoice totals
(FUTURE, invoicing epic, via the `Document.templateId` FK), the two MUST be
reconciled to one source. Documented so it isn't silently forgotten; not in scope
to change `DocumentSettings` now.

---

## 12. Migration sequence

Single migration `prisma migrate dev --name invoice_templates`, **add-only**:

1. `CREATE TYPE "RoundOffPrecision"` / `"RoundOffMethod"`.
2. `CREATE TABLE invoice_templates` (+ indexes) / `template_defaults` (+ unique/indexes)
   / `invoice_settings` (+ unique).
3. `ALTER TABLE "Document" ADD COLUMN "templateId" TEXT NULL` + FK (`ON DELETE SET NULL`).

No add-column→backfill→NOT-NULL sequence needed: every new column is either on a
brand-new table or **nullable** (`Document.templateId`). No data migration, no
lock on large tables beyond the nullable-column add (metadata-only in Postgres).
Register `InvoiceTemplate` in `SOFT_DELETE_MODELS` in the same PR (code, not SQL).

---

## 13. SCOPE Conformance Map

| SCOPE decision | Architecture artifact | Status |
|---|---|---|
| `GET /api/templates` → `TemplateSummary[]` (no config) | `routes/invoice-templates.routes.ts` + `template-crud.service.ts` list + `template.mapper.ts` | OK |
| `GET /api/templates/:id` → full `InvoiceTemplate` | `template-crud.service.ts` get + mapper | OK |
| `POST /api/templates` (Idempotency-Key) → 201 | route + `idempotencyCheck()` + crud.create tx | OK |
| `PUT /api/templates/:id` partial merge | `template-crud.service.ts` update | OK |
| `DELETE /api/templates/:id` soft-delete → `{id}` | `template-crud.service.ts` softDelete | OK |
| `POST /api/templates/:id/duplicate` (Idempotency) → " (Copy)" | `template-crud.service.ts` duplicate | OK |
| `POST /api/templates/:id/set-default` → `{id,defaultForTypes}` | `template-default.service.ts` | OK |
| `GET`/`PUT /api/invoice-settings` singleton | `invoice-settings.service.ts` + routes | OK |
| Max 20 templates/business | crud.create `$transaction` count-check | OK |
| 10KB config cap | `invoice-template.schema.ts` refine + `template.constants.ts MAX_CONFIG_BYTES` | OK |
| Default-delete guard | `template-crud.service.ts` softDelete (checks `TemplateDefault`) | OK |
| Tenant isolation (`businessId`) | every query `where:{businessId}`; 404 on miss | OK |
| Idempotency on create/duplicate | `idempotencyCheck()` middleware | OK |
| `baseTemplate` = String + allowlist (R1) | `template.constants.ts BASE_TEMPLATE_ALLOWLIST` + Zod | OK |
| `config`/`printSettings` opaque JSON (R3) | `Json` cols + Zod passthrough object, size-only guard | OK |
| Round-off DB enum ↔ wire strings (R4) | `invoice-settings.mapper.ts` | OK |
| `isDefault` derived (R8) | `template.mapper.ts` (`defaultForTypes.length>0`) | OK |
| Reuse `DocumentType` enum (R6) | **DEVIATED** → `String`+allowlist (no enum exists) — §11 | DEVIATED |
| No `/reset/:baseTemplate` (R2) | omitted (FE never calls it) | OK |
| PDF/image/batch endpoints (R5) | not built | FUTURE_EPIC |
| Mount `/api/templates` + `/api/invoice-settings` (R7) | `app.routes.ts` (2 rows) | OK |
| `[SHOULD_SHIP]` Document FK columns | **DEVIATED** → `Document.templateId String?` only — §11 | DEVIATED |
| Purge cron (daily 03:00 IST, 90d) | `scripts/cron/purge-deleted-templates.ts` | OK |
| Audit row on every mutation | `tx.auditLog.create` in each service tx | OK |
| Analytics events (≤7) | emitted from service (`template_created`, …, `template_limit_hit`) | OK |
| Error codes/messages (§7) | `template.constants.ts` error map + `sendError` | OK |
| Auth on every route; `settings.modify` on writes | `auth` + `requirePermission('settings.modify')` | OK |
| Rate limit on writes | **DEVIATED** → `userMutationLimiter` (per-user) — §11 | DEVIATED |
| DB-seeded base templates (out) | not built (client-side presets) | FUTURE_EPIC |

No MUST_SHIP / SHOULD_SHIP goal is `MISSING`. Deviations are all documented in §11.

---

## 14. Failure-Mode Implementation

| Failure mode | SCOPE mitigation | Architecture site |
|---|---|---|
| Postgres outage (30 min) | client-side React-PDF from Dexie cache; offline queue replays writes | FE (shipped) + `idempotencyCheck()` on create/duplicate |
| Abuse spike (100x creates) | 20-template cap + 10KB cap + per-user write limit | crud.create `$transaction` + `template.constants.ts` + `userMutationLimiter` |
| DB bloat (soft-deleted rows) | 90-day hard purge, indexed | `scripts/cron/purge-deleted-templates.ts` + `@@index([deletedAt])` |
| Client-version lag (30% old) | additive opaque JSON + `String` baseTemplate | `Json` cols + `template.constants.ts` allowlist (no enum) |
| Regulatory change (GST) | config-flag flip, no migration; round-off enum covers CA demands | opaque `config` + `RoundOffPrecision`/`RoundOffMethod` enums |
| Cost runaway | no per-call external spend in MUST_SHIP | N/A (Puppeteer is FUTURE, behind its own cap) |
| Insider abuse | config is data not code; audit row per mutation | `tx.auditLog.create`; XSS carry-forward noted for FUTURE Puppeteer (§10) |

---

## 15. File Plan

SSOT: every `reuses` row imports the canon in §2; the two service splits are
pre-sized to stay ≤250L. No `new-ssot` rows (no toolkit; nothing re-implemented).

| # | Path | Action | Est. Lines | Layer | SSOT | Build phase |
|---|------|--------|-----------|-------|------|-------------|
| 1 | `server/prisma/schema.prisma` | modify | ~55 | schema | new models | API-1 |
| 2 | `server/prisma/migrations/**/migration.sql` | create | ~45 | migration | generated | API-1 |
| 3 | `server/src/lib/soft-delete/models.ts` | modify | ~2 | constants | reuses: soft-delete registry | API-1 |
| 4 | `shared/enums.ts` | modify | ~4 | constants | reuses: add `BASE_TEMPLATE_*`? (no — keep in BE) | — (skip) |
| 5 | `server/src/services/invoice-template/template.constants.ts` | create | ~70 | constants | new consts (MAX_TEMPLATES, MAX_CONFIG_BYTES, BASE_TEMPLATE_ALLOWLIST, error codes) | API-2 |
| 6 | `server/src/services/invoice-template/template.types.ts` | create | ~70 | types | new DTO types (row→API shapes) | API-2 |
| 7 | `server/src/schemas/invoice-template.schema.ts` | create | ~120 | schema (Zod) | reuses: `DOCUMENT_TYPES` | API-2 |
| 8 | `server/src/schemas/invoice-settings.schema.ts` | create | ~60 | schema (Zod) | new | API-2 |
| 9 | `server/src/services/invoice-template/template.mapper.ts` | create | ~90 | utils (pure) | new | API-3 |
| 10 | `server/src/services/invoice-settings.mapper.ts` | create | ~70 | utils (pure) | new (wire↔enum R4) | API-3 |
| 11 | `server/src/services/invoice-template/template-crud.service.ts` | create | ~220 | service | reuses: prisma, auditLog, mapper | API-4 |
| 12 | `server/src/services/invoice-template/template-default.service.ts` | create | ~110 | service | reuses: prisma, auditLog | API-4 |
| 13 | `server/src/services/invoice-settings.service.ts` | create | ~120 | service | reuses: prisma upsert pattern, mapper | API-4 |
| 14 | `server/src/routes/invoice-templates.routes.ts` | create | ~150 | route | reuses: auth, validate, requirePermission, idempotencyCheck, userMutationLimiter, sendSuccess | API-5 |
| 15 | `server/src/routes/invoice-settings.routes.ts` | create | ~55 | route | reuses: auth, validate, requirePermission, sendSuccess | API-5 |
| 16 | `server/src/app.routes.ts` | modify | ~4 | route | mount 2 routers | API-5 |
| 17 | `server/scripts/cron/purge-deleted-templates.ts` | create | ~55 | script | reuses: base prisma client | API-6 |

Row 4 (`shared/enums.ts` `BASE_TEMPLATE_*`) is **skipped** — the base-template
allowlist mirrors the FE union which lives in `template-layout.types.ts`; keeping
it in `template.constants.ts` (BE) avoids coupling `shared/enums.ts` to a
render-only union. No row estimates > 250 lines. Services 11/12 are pre-split
(CRUD vs default-resolution) to stay under cap; mappers 9/10 are separate pure
files (one responsibility each). "Build phase" orders the builder:
schema → constants/types → schemas → mappers → services → routes → cron.

---

## 16. Acceptance (mirrors SCOPE §Acceptance — binary, curl-provable)

Backend proof trio + feature checks:
- `curl GET /api/templates` (authed) → `{success:true,data:[…]}`, no `config` on items
- `curl GET /api/templates/:id` → full entity incl. `config`+`printSettings`
- `curl POST /api/templates` valid → 201, `isDefault:false`, `defaultForTypes:[]`
- same POST + identical `X-Idempotency-Key` → single row
- `curl PUT /:id` `{name}` → merged, other fields intact
- `curl DELETE /:id` (non-default) → 200 `{id}`, absent from list
- `curl DELETE` a default → 400 `TEMPLATE_IS_DEFAULT`
- `curl POST /:id/duplicate` → 201, name ends " (Copy)", `defaultForTypes:[]`
- `curl POST /:id/set-default {documentTypes:["SALE_INVOICE"]}` → `{id,defaultForTypes:["SALE_INVOICE"]}`, prior default superseded
- 21st create → 400 `TEMPLATE_LIMIT_REACHED`
- config > 10KB → 400 `VALIDATION_ERROR`
- cross-tenant `:id` → 404 `TEMPLATE_NOT_FOUND`
- any route unauthed → 401
- `curl GET /api/invoice-settings` first call → upserted defaults (`precision:"1"`,`method:"round"`,`quantity:2`,`rate:2`,`amount:2`)
- `curl PUT /api/invoice-settings` → wire strings persisted; GET round-trips identical
- purge cron: `deletedAt=now()-91d`+`isDeleted` → hard-deleted; `now()-89d` → retained
- FE `/settings/templates` + `/settings/invoice` load with no 404
- `npx tsc -b --noEmit` clean · `node scripts/enforce.js` clean
