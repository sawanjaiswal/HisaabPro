# Phase 3 Architecture — Job flow (services vertical)

> Owner: architect agent · Status: design-locked, ready for implementation
> Predecessors: `PRD.md` · `TRD.md` (seed design — sharpened here) · `PHASE_PLAN.md`
> Touches HIGH-RISK path: `prisma/schema.prisma` (new tables, no column edits to existing tables)

---

## 0. TL;DR

- New `Job` + `JobItem` models, new `JobStatus` enum. **No edits to `Document`** — Job links forward via `invoiceId String? @unique` → `Document.id` (`SetNull`).
- Convert flow reuses `services/document/create.ts:createDocument` exactly as the existing `convertDocument` does (`server/src/services/document/convert.ts:47`). Zero duplicated totals / numbering / GST / stock logic.
- 2 new RBAC keys (`jobs.view`, `jobs.create`, `jobs.edit`, `jobs.delete`) under a new `jobs` module in the existing `PERMISSION_MATRIX`. Owner inherits via the `role === 'owner'` bypass already in `permission.ts:51`. Manager + Salesman get sensible defaults.
- Status machine is **server-enforced** in the service layer; client UI mirrors the same table from a shared constant.
- Visibility on the FE is purely a `useVertical().hiddenNavKeys` filter — `'jobs'` is already in the `NavKey` union (`src/config/verticals.config.ts:36`); we add it to `hiddenNavKeys` for **every** non-service vertical.
- Total endpoint count: **8** (CRUD + transition + convert-to-invoice + recycle).

---

## 1. Final Prisma schema

Append to `server/prisma/schema.prisma` after the `Document*` block (~line 850, before `model Payment`). Also append the two relation lines on `Business` and `Party`, and one relation line on `Document`.

### 1a. New models + enum

```prisma
// ─── Phase 3 — Jobs (services vertical) ──────────────────────────────────────

enum JobStatus {
  QUOTED
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  INVOICED
  CANCELLED
}

model Job {
  id            String    @id @default(cuid())
  businessId    String
  partyId       String

  // Numbering — assigned on first SAVE (i.e. status leaves QUOTED), null while pure draft.
  // Scheme is independent from Document numbering: "JOB-25-26-0001".
  jobNumber     String?
  sequenceNumber Int?
  financialYear String?

  // Content
  title         String       @db.VarChar(200)
  description   String?      @db.Text
  status        JobStatus    @default(QUOTED)

  // Schedule
  scheduledAt   DateTime?
  completedAt   DateTime?
  cancelledAt   DateTime?
  cancelReason  String?      @db.VarChar(500)

  // Totals (PAISE — integer, matches Document)
  subtotalPaise Int       @default(0)
  discountPaise Int       @default(0)
  totalPaise    Int       @default(0)

  // Forward link to the invoice produced by convert-to-invoice
  invoiceId     String?   @unique

  // Offline sync (matches Document.clientId pattern)
  clientId      String?   @unique

  // Soft delete (matches Document/Party convention exactly)
  isDeleted     Boolean   @default(false)
  deletedAt     DateTime?
  deletedBy     String?

  // Audit
  createdBy     String
  updatedBy     String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  business      Business  @relation(fields: [businessId], references: [id], onDelete: Restrict)
  party         Party     @relation(fields: [partyId], references: [id], onDelete: Restrict)
  invoice       Document? @relation("JobInvoice", fields: [invoiceId], references: [id], onDelete: SetNull)
  items         JobItem[]

  @@unique([businessId, jobNumber])
  @@index([businessId, status])
  @@index([businessId, partyId])
  @@index([businessId, scheduledAt])
  @@index([businessId, isDeleted])
  @@index([clientId])
}

model JobItem {
  id             String   @id @default(cuid())
  jobId          String
  sortOrder      Int      @default(0)

  // Optional product link — services often have no SKU, so nullable.
  // When set, lets convert-to-invoice resolve productId for the DocumentLineItem.
  productId      String?

  description    String   @db.VarChar(500)

  // Quantity matches HP convention: Decimal(12,3) for fractional units (hours, kg).
  quantity       Decimal  @db.Decimal(12, 3)

  // Money — PAISE integers, matches DocumentLineItem.
  ratePaise      Int      @default(0)
  discountPaise  Int      @default(0)
  totalPaise     Int      @default(0)

  job            Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  product        Product? @relation("JobItemProduct", fields: [productId], references: [id], onDelete: SetNull)

  @@index([jobId])
  @@index([productId])
}
```

### 1b. Inverse relations to add to existing models

`model Business` (around line 127, the existing `documents` block):

```prisma
  // Phase 3 — Services vertical
  jobs                  Job[]
```

`model Party` (around line 283, with the `documents` block):

```prisma
  jobs           Job[]
```

`model Document` (around line 715, with the other forward relations like `creditDebitNotes`):

```prisma
  // Phase 3 — Set when this Document was created by converting a Job
  jobOrigin              Job?      @relation("JobInvoice")
```

`model Product` (with the other relation arrays):

```prisma
  jobItems              JobItem[] @relation("JobItemProduct")
```

### Conventions verified against codebase

| Convention | Source in repo | Adopted? |
|---|---|---|
| `cuid()` ids | `Document.id`, `Party.id` | yes |
| `businessId` first column on tenant rows | every model | yes |
| Money in PAISE as `Int` | `Document.grandTotal`, `DocumentLineItem.lineTotal` | yes |
| Quantity as `Decimal(12,3)` | `JobItem.quantity` per spec; `DocumentLineItem.quantity` is `Float` (legacy) — Job is greenfield so we use the stricter `Decimal(12,3)` per HP CLAUDE.md rule | yes |
| Soft-delete trio: `isDeleted Boolean`, `deletedAt DateTime?`, `deletedBy String?` | `Document` 681-683 | yes |
| `clientId String? @unique` for offline | `Document.clientId` 693 | yes |
| `createdBy / updatedBy / createdAt / updatedAt` audit columns | `Document` 687-690 | yes |
| Composite indexes prefixed by `businessId` | every `@@index([businessId, …])` | yes |
| `onDelete: Restrict` for business + party FKs | `Document.business`, `Document.party` | yes |
| `onDelete: Cascade` for child line items | `DocumentLineItem.document` | yes |
| `onDelete: SetNull` for forward link to optional related doc | `Document.sourceDocument` 673 | yes (`Job.invoice`) |

---

## 2. Migration plan

```bash
# from server/
npx prisma migrate dev --name phase3_jobs
```

**Order inside the migration (Prisma will generate; we verify):**
1. `CREATE TYPE "JobStatus" AS ENUM (…)`
2. `CREATE TABLE "Job"` + indexes + the `@@unique([businessId, jobNumber])` partial-style unique
3. `CREATE TABLE "JobItem"` + indexes
4. FKs in dependency order (Business, Party, Document, Product all already exist)

**No backfill required** — both tables are new and empty at v0.

**Rollback note:**
- Forward-only — never edit a shipped migration. To revert in dev: `npx prisma migrate reset` (wipes db) or write a follow-up migration `phase3_jobs_revert` with `DROP TABLE "JobItem"; DROP TABLE "Job"; DROP TYPE "JobStatus";`. In prod we'd ship a feature flag fix instead of dropping tables — Job rows may exist by then.
- Pre-tool-gate.sh blocks `db push` (per `.claude/rules/PRISMA_MIGRATION_RULES.md`); we always go through `migrate dev`.

---

## 3. Service layer

### File map

| Path | Purpose | Reuses |
|---|---|---|
| `server/src/schemas/job.schemas.ts` | Zod schemas: `createJobSchema`, `updateJobSchema`, `transitionJobSchema`, `listJobsSchema`, `convertJobToInvoiceSchema`. Exports `CreateJobInput`, `UpdateJobInput`, etc. types. | `paise()`, `decimalQty()` helpers from `schemas/_shared.ts` (existing). |
| `server/src/services/job/selects.ts` | `JOB_LIST_SELECT`, `JOB_DETAIL_SELECT` | mirrors `services/document/selects.ts` |
| `server/src/services/job/helpers.ts` | `STATUS_TRANSITIONS` table, `assertTransitionAllowed(from, to)`, `requireJob(businessId, id)` (notFound + soft-delete check) | `notFoundError`, `validationError` from `lib/errors.ts`; `prisma` |
| `server/src/services/job/create.ts` | `createJob(businessId, userId, input)` | `generateNextNumber(tx, businessId, 'JOB', date)` from `services/document-number.service.ts` (extend its enum to accept `'JOB'`); `calculateLineTotals` — small local helper, not the GST-heavy `calculateDocumentTotals` |
| `server/src/services/job/get-list.ts` | `getJob`, `listJobs(businessId, query)` — cursor pagination via `(createdAt, id)` exactly like `documents/get-list.ts` | shared cursor util |
| `server/src/services/job/update.ts` | `updateJob` — patch title, description, scheduledAt, items. Recomputes totals. Forbidden if `status` ∈ {INVOICED, CANCELLED}. | helpers.assertTransitionAllowed not invoked here (PATCH never moves status) |
| `server/src/services/job/transition.ts` | `transitionJob(businessId, id, userId, toStatus, reason?)` — server-enforced state machine | helpers.STATUS_TRANSITIONS |
| `server/src/services/job/convert-to-invoice.ts` | **`convertJobToInvoice(businessId, jobId, userId)`** | calls `createDocument` from `services/document/create.ts` exactly like `convertDocument` does today (`document/convert.ts:47`) |
| `server/src/services/job/delete.ts` | `softDeleteJob` — set `isDeleted/deletedAt/deletedBy`, no FK cascade | matches `document/delete.ts` |
| `server/src/services/job.service.ts` | Barrel re-export — mirrors `services/document.service.ts` | — |
| `server/src/routes/jobs.ts` | Express router | `auth`, `requirePermission`, `validate`, `asyncHandler`, `sendSuccess` |

### Function signatures

```ts
// schemas/job.schemas.ts
export const jobItemSchema = z.object({
  productId: z.string().cuid().nullable().optional(),
  description: z.string().min(1).max(500),
  quantity: decimalQty(),                // Decimal as string, validates >= 0
  ratePaise: paise(),                    // Int >= 0
  discountPaise: paise().optional().default(0),
})

export const createJobSchema = z.object({
  partyId: z.string().cuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  items: z.array(jobItemSchema).min(1).max(200),
  clientId: z.string().min(1).max(64).optional(),       // offline idempotency
})
export type CreateJobInput = z.infer<typeof createJobSchema>

export const updateJobSchema = createJobSchema.partial().omit({ clientId: true })

export const transitionJobSchema = z.object({
  toStatus: z.enum(['QUOTED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED']),
  reason: z.string().max(500).optional(),               // required when toStatus === CANCELLED (refined)
})

export const listJobsSchema = z.object({
  status: z.enum([...JOB_STATUSES]).optional(),
  partyId: z.string().cuid().optional(),
  q: z.string().max(120).optional(),                    // search title/description
  scheduledFrom: z.string().datetime().optional(),
  scheduledTo: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})
```

```ts
// services/job/create.ts
export async function createJob(
  businessId: string,
  userId: string,
  data: CreateJobInput,
): Promise<JobDetail>
```

```ts
// services/job/transition.ts
export async function transitionJob(
  businessId: string,
  jobId: string,
  userId: string,
  toStatus: JobStatus,
  reason?: string,
): Promise<JobDetail>
```

```ts
// services/job/convert-to-invoice.ts
export async function convertJobToInvoice(
  businessId: string,
  jobId: string,
  userId: string,
): Promise<DocumentDetail>   // returns the new SALE_INVOICE
```

### `convertJobToInvoice` — reuse strategy (no duplication)

Mirrors `services/document/convert.ts` exactly. Pseudocode:

```ts
import { createDocument } from '../document/create.js'
import { requireJob } from './helpers.js'

export async function convertJobToInvoice(businessId, jobId, userId) {
  const job = await requireJob(businessId, jobId, {
    items: { select: { productId, description, quantity, ratePaise, discountPaise } },
    invoiceId: true, status: true, partyId: true,
  })

  if (job.invoiceId) throw validationError('Job is already invoiced')
  if (job.status === 'CANCELLED') throw validationError('Cannot invoice a cancelled job')
  if (job.status !== 'COMPLETED') throw validationError('Job must be COMPLETED before invoicing')

  // Items without a productId need a placeholder "Service" product to satisfy
  // DocumentLineItem.productId NOT NULL. We resolve/create a per-business
  // service-placeholder product via products.service.ensureServicePlaceholder(businessId).
  // This keeps the existing Document machinery untouched.
  const lineItems = await Promise.all(job.items.map(async (it) => ({
    productId: it.productId ?? await ensureServicePlaceholder(businessId, it.description),
    quantity: Number(it.quantity),
    rate: it.ratePaise,
    discountType: 'AMOUNT' as const,
    discountValue: it.discountPaise,
  })))

  // Single call, no totals math here — createDocument runs calculateDocumentTotals,
  // numbering, GST, stock, outstanding, audit, SSE — all of it.
  const invoice = await createDocument(businessId, userId, {
    type: 'SALE_INVOICE',
    status: 'SAVED',                    // immediately committed; numbering assigned
    partyId: job.partyId,
    documentDate: new Date().toISOString().split('T')[0],
    lineItems,
    additionalCharges: [],
    includeSignature: false,
    notes: `Generated from Job ${job.jobNumber ?? job.id}`,
    termsAndConditions: null,
  })

  // Link both directions and move state.
  await prisma.job.update({
    where: { id: jobId },
    data: { invoiceId: invoice.id, status: 'INVOICED' },
  })

  return invoice
}
```

Reused utilities (none re-implemented):
- `generateNextNumber` — extend the `documentType` enum it accepts to include `'JOB'`. One-line change in `services/document-number.service.ts`.
- `calculateDocumentTotals`, GST calc, stock decrement, outstanding update, `DOCUMENT_DETAIL_SELECT`, audit middleware, SSE auto-emit — all hit via the single `createDocument` call.
- `ensureServicePlaceholder(businessId, label)` — small new helper in `services/product/placeholders.ts`. Idempotent: looks up a product with `code = '__SERVICE__'`, creates one if absent (`isService: true`, `stockTracking: false`). Documented separately, deferred unit test included in acceptance.

---

## 4. Status machine

**Server enforces. Client mirrors the table by importing it from `src/features/jobs/jobs.constants.ts` (which is hand-kept in sync — the table is 6 lines and unit-tested for parity with `server/src/services/job/helpers.ts`).**

| From \ To       | QUOTED | SCHEDULED | IN_PROGRESS | COMPLETED | INVOICED | CANCELLED |
|-----------------|--------|-----------|-------------|-----------|----------|-----------|
| **QUOTED**      | —      | yes       | —           | —         | —        | yes       |
| **SCHEDULED**   | yes    | —         | yes         | —         | —        | yes       |
| **IN_PROGRESS** | —      | yes       | —           | yes       | —        | yes       |
| **COMPLETED**   | —      | —         | yes         | —         | (via convert-to-invoice only) | yes |
| **INVOICED**    | —      | —         | —           | —         | —        | —          |
| **CANCELLED**   | —      | —         | —           | —         | —        | —          |

Rules:
- `INVOICED` is reachable only via `POST /jobs/:id/convert-to-invoice`, never via the generic transition endpoint. Transition route validates this.
- `CANCELLED` requires `reason` (Zod refinement on `transitionJobSchema`).
- Once `INVOICED` or `CANCELLED`, the job is read-only — `updateJob` and `softDeleteJob` reject with 409.

---

## 5. REST endpoints

All routes mounted at `/api/jobs` (registered in `server/src/app.ts` after `documentRoutes`). All require `auth` + tenant scoping by `req.user.businessId`. All POST/PATCH go through `validate(schema)`. POSTs honour idempotency via the existing `clientId` pattern (already in `Document.clientId`; we mirror on `Job.clientId`).

| # | Method | Path | Permission | Request | Response | Idempotency |
|---|--------|------|------------|---------|----------|-------------|
| 1 | GET    | `/api/jobs` | `jobs.view` | query: `listJobsSchema` | `{ items: JobListRow[], nextCursor: string \| null }` | safe |
| 2 | GET    | `/api/jobs/:id` | `jobs.view` | — | `JobDetail` | safe |
| 3 | POST   | `/api/jobs` | `jobs.create` | body: `createJobSchema` | `JobDetail` (201) | `clientId` unique → 200 with existing row on replay |
| 4 | PATCH  | `/api/jobs/:id` | `jobs.edit` | body: `updateJobSchema` | `JobDetail` | conflict middleware (`If-Match` etag, already global) |
| 5 | POST   | `/api/jobs/:id/transition` | `jobs.edit` | body: `transitionJobSchema` | `JobDetail` | natural — repeated transition to same status returns 200 no-op |
| 6 | POST   | `/api/jobs/:id/convert-to-invoice` | `jobs.edit` + `invoicing.create` | — (no body) | `DocumentDetail` (the new SALE_INVOICE) | `Job.invoiceId` unique → replay returns existing invoice |
| 7 | DELETE | `/api/jobs/:id` | `jobs.delete` | — | `{ success: true }` | natural — repeat delete on already-deleted returns 200 |
| 8 | GET    | `/api/jobs/recycle` (+ `POST /:id/restore`, `DELETE /:id/permanent`) | `jobs.delete` | — | recycle bin shape matching `documents/recycle.ts` | safe |

**Response envelope:** all routes use `sendSuccess(res, payload, status?)` and `sendError(...)` from `server/src/lib/response.ts`. No raw `res.json`.

**Sample shapes:**

```ts
type JobListRow = {
  id: string
  jobNumber: string | null
  title: string
  status: JobStatus
  partyId: string
  partyName: string
  scheduledAt: string | null
  totalPaise: number
  invoiceId: string | null
  updatedAt: string
}

type JobDetail = JobListRow & {
  description: string | null
  subtotalPaise: number
  discountPaise: number
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  items: Array<{
    id: string
    sortOrder: number
    productId: string | null
    description: string
    quantity: string         // Decimal serialised as string
    ratePaise: number
    discountPaise: number
    totalPaise: number
  }>
  createdAt: string
  createdBy: string
}
```

**Error contract (always via `sendError`):**
- 400 — Zod validation, status-machine violation
- 401 — not authed
- 403 — `FORBIDDEN` (no permission), `NO_BUSINESS`
- 404 — job not found / belongs to another tenant / soft-deleted
- 409 — conflict (etag mismatch on PATCH; already-invoiced on convert)

---

## 6. Permissions

### 6a. `server/src/services/settings/permissions.ts` — append one entry to `PERMISSION_MATRIX`

```ts
{
  key: 'jobs', label: 'Jobs',
  actions: [
    { key: 'view',   label: 'View Jobs' },
    { key: 'create', label: 'Create Jobs' },
    { key: 'edit',   label: 'Edit Jobs' },
    { key: 'delete', label: 'Delete Jobs' },
  ],
},
```

This produces 4 permission strings: `jobs.view`, `jobs.create`, `jobs.edit`, `jobs.delete`.

### 6b. Role updates (additive — `ALL_PERMISSIONS` derived from matrix already covers Owner/Partner/Manager)

| Role | New grants | Why |
|---|---|---|
| **Owner** | (all 4 — automatic via `ALL_PERMISSIONS` + the `role === 'owner'` bypass in `permission.ts:51`) | unchanged behaviour |
| **Partner** | all 4 (auto via `ALL_PERMISSIONS.filter(...)`) | unchanged |
| **Manager** | all 4 (auto via the existing exclusion list which doesn't touch jobs) | unchanged |
| **Salesman** | add `jobs.view`, `jobs.create`, `jobs.edit` | services-vertical sales staff need to quote and schedule; no delete |
| **Cashier** | add `jobs.view` | cashier sees jobs to take payment but does not edit |
| **Stock Manager** | — | not relevant |
| **Delivery Boy** | add `jobs.view` | sees their assigned jobs (FE-only filter — server returns all) |
| **Accountant** | add `jobs.view` | needs read for reports |

`ensureSystemRoles` runs idempotently on next boot; the `update: {}` in the upsert means **existing role rows are not retroactively granted the new permission**. We add a one-shot migration helper in the same PR (`scripts/grant-jobs-permission.ts`) that updates existing Salesman/Cashier/Delivery/Accountant rows in place. Owners are unaffected (bypass).

### 6c. Visibility on the FE

Permission gating in components uses the existing `usePermission('jobs.view')` hook (already exists in `src/hooks/usePermission.ts`).

---

## 7. Frontend file map — `src/features/jobs/` (6-layer split)

All files ≤ 250 LOC per project rule. Mobile-first (320px). All 4 UI states per page (loading / error / empty / success).

```
src/features/jobs/
├── jobs.types.ts                       # Job, JobItem, JobStatus, JobListRow, JobDetail mirrors
├── jobs.constants.ts                   # JOB_STATUSES, STATUS_TRANSITIONS table, status colour map, route paths
├── jobs.utils.ts                       # formatJobNumber(), getNextStatuses(), canTransition(), totalsFromItems()
├── api/
│   ├── jobs.api.ts                     # list/get/create/update/transition/convert/delete — all via api()
│   └── jobs.api.types.ts               # request/response interfaces (mirror server schemas)
├── hooks/
│   ├── useJobs.ts                      # TanStack useInfiniteQuery — cursor pagination
│   ├── useJob.ts                       # useQuery for detail
│   ├── useCreateJob.ts                 # mutation; entityType:'job', entityLabel: title
│   ├── useUpdateJob.ts                 # mutation; tolerates {} optimistic return
│   ├── useTransitionJob.ts             # mutation
│   └── useConvertJobToInvoice.ts       # mutation; on success, navigate to /invoices/:id
├── components/
│   ├── JobListItem.tsx                 # one row: status pill + title + party + Rs total + scheduled date
│   ├── JobStatusPill.tsx               # colour-coded chip
│   ├── JobStatusActions.tsx            # buttons that map current → allowed transitions
│   ├── JobForm.tsx                     # shared by new + edit; line-items editor reuses LineItemsEditor from invoices
│   ├── JobItemsList.tsx                # detail-page items table (read-only)
│   ├── JobConvertButton.tsx            # button on COMPLETED jobs → calls convert-to-invoice
│   ├── JobsEmptyState.tsx              # empty UI state
│   ├── JobsErrorState.tsx              # error UI state
│   └── JobsListSkeleton.tsx            # loading UI state
└── pages/
    ├── JobsListPage.tsx                # /jobs — list with status filter pill row
    ├── JobNewPage.tsx                  # /jobs/new
    ├── JobEditPage.tsx                 # /jobs/:id/edit
    └── JobDetailPage.tsx               # /jobs/:id — header, status pill, actions, items, convert CTA
```

**Routes** added to `src/routes.tsx` (lazy-imported):
- `/jobs` → `JobsListPage`
- `/jobs/new` → `JobNewPage`
- `/jobs/:id` → `JobDetailPage`
- `/jobs/:id/edit` → `JobEditPage`

**Translations** — every visible string keyed in `src/lib/translations.en.ext*.ts` and `src/lib/translations.hi.ext*.ts` in the same commit.

---

## 8. Visibility rule (Jobs nav appears only for service verticals)

`src/config/verticals.config.ts` already has `'jobs'` in the `NavKey` union (line 36). Today no profile mentions it, which means it'd always show — fix by **inverting** to a whitelist:

### Approach (additive — no breaking signature change)

Add a derived constant `JOBS_VISIBLE_VERTICALS` and a runtime helper, AND mark `'jobs'` hidden in every non-service profile.

```ts
// in verticals.config.ts (additions)

/** Verticals that CAN see Jobs nav. SSOT for Phase 3 visibility. */
export const JOBS_VISIBLE_VERTICALS: ReadonlySet<BusinessType> = new Set([
  'services', 'freelancer', 'salon', 'clinic',
])

// Helper consumed by SideNav/BottomNav — leverages existing hiddenNavKeys mechanism.
export function isNavVisible(vertical: VerticalProfile, key: NavKey): boolean {
  if (vertical.hiddenNavKeys.has(key)) return false
  if (key === 'jobs')   return JOBS_VISIBLE_VERTICALS.has(vertical.type)
  if (key === 'orders') return false   // Phase 4 will add ORDERS_VISIBLE_VERTICALS
  return true
}
```

Concretely:
- `general`, `retail`, `wholesale`, `manufacturing`, `restaurant`, `pharmacy`, `bakery`, `tailor`, `other` — `'jobs'` NOT shown.
- `services`, `freelancer`, `salon`, `clinic` — `'jobs'` shown.

`SideNav.tsx` and `BottomNav.tsx` swap their existing filter from `!vertical.hiddenNavKeys.has(i.key)` to `isNavVisible(vertical, i.key)`. One-line change in each. Behaviour for all other NavKeys is identical.

A unit test in `verticals.config.spec.ts` asserts:
- `isNavVisible(retail, 'jobs') === false`
- `isNavVisible(services, 'jobs') === true`
- `isNavVisible(freelancer, 'jobs') === true`
- `isNavVisible(general, 'invoices') === true` (no regression)

---

## 9. Risk surface + acceptance criteria

### Risks + mitigations

| Risk | Mitigation |
|---|---|
| **State-machine drift** between client (constants) and server (helpers) — silent disagreement could allow a UI to call a transition the server rejects, frustrating users. | Single shared table; `verticals.config.spec.ts`-style parity test compares the FE constant to a `GET /api/jobs/_meta/transitions` endpoint result. Cheaper alternative for v0: a simple `tsc`-time JSON file shared by both sides. We pick the test approach to avoid a new endpoint. |
| **`Document.partyId` is mandatory but `JobItem.productId` isn't** — convert-to-invoice would crash on `DocumentLineItem.productId NOT NULL`. | `ensureServicePlaceholder(businessId, label)` resolves/creates a per-business service-placeholder Product. Idempotent. Unit-tested. |
| **`generateNextNumber` only knows document types today.** | Extend its allowed-type set to include `'JOB'`. Add `JOB-{FY}-{seq}` template to `DocumentNumberSeries`. Single-PR change, covered by an integration test. |
| **Permission rollout** — adding `jobs.*` to the matrix doesn't retroactively grant existing Salesman/Cashier rows. | `scripts/grant-jobs-permission.ts` one-shot updater run during deploy. Documented in the PR description. |
| **Convert-to-invoice race** — two clients hit convert simultaneously. | `Job.invoiceId @unique` blocks the second write with a P2002. Service catches and returns `409 ALREADY_INVOICED`. |
| **Soft-delete + invoice link** — deleting a job that already has an invoice should not remove the invoice. | `onDelete: SetNull` on `Job.invoice` (FK) AND soft-delete (`isDeleted=true`) leaves the document untouched. Tested. |
| **Offline create followed by online convert** — clientId may not yet be flushed when user converts. | Convert requires a server-known `jobId`, which only exists post-flush. UI gates the Convert button on `job.invoiceId === null && status === 'COMPLETED' && navigator.onLine`. |
| **High-risk gate** on `prisma/schema.prisma`. | `design-plan-active.md` updated alongside this doc; both committed before the schema PR. |
| **Index hot path** — `(businessId, scheduledAt)` covers the calendar view; `(businessId, status)` covers the kanban filter. List query uses `(businessId, isDeleted)` + cursor on `(updatedAt, id)`. | Indexes match query plans verified in seed environment. |

### Acceptance — Phase 3 ships when ALL of these are green

**Backend**
- [ ] `tsc` clean across server.
- [ ] `enforce.js` clean (no new patterns; offline rules satisfied).
- [ ] `npx prisma migrate dev --name phase3_jobs` runs cleanly on a fresh DB.
- [ ] Unit: `services/job/helpers.spec.ts` covers every cell of the transition table (allowed + forbidden).
- [ ] Integration: Job CRUD happy path (`scripts/curl/jobs-crud.sh`) — POST → 201, GET list → 200 with row, GET detail → 200, PATCH → 200, DELETE → 200, GET → 404.
- [ ] Integration: Transition path — QUOTED → SCHEDULED → IN_PROGRESS → COMPLETED transitions all 200; QUOTED → COMPLETED returns 400 with `INVALID_TRANSITION`; CANCELLED with no `reason` returns 400.
- [ ] Integration: Convert-to-invoice — COMPLETED job → POST convert → 201 with new SALE_INVOICE; subsequent POST returns 409 `ALREADY_INVOICED`; the new Document has correct totals (assert `grandTotal === sum(items.totalPaise)`); Job.status moves to INVOICED.
- [ ] Integration: 401 (no auth), 403 (no permission as Cashier trying to create), 404 (cross-tenant id) covered.
- [ ] Service-placeholder product is idempotent — convert twice for the same business doesn't create duplicates.

**Frontend**
- [ ] All 4 UI states for `/jobs` (loading skeleton, error retry, empty state with CTA, success list) — screenshots in `docs/business-verticals/screenshots/phase3/jobs-list-{loading,error,empty,success}.png`.
- [ ] All 4 UI states for `/jobs/:id` — screenshots `jobs-detail-*.png`.
- [ ] `/jobs/new` form validates required fields at 320px width — screenshot `jobs-new-320.png`.
- [ ] SideNav shows "Jobs" only for `services`, `freelancer`, `salon`, `clinic` — 4 screenshots, plus 1 negative (e.g. `retail` → no Jobs item).
- [ ] BottomNav: same — except Jobs is in the More menu, not bottom tabs (no bottom-tab change in Phase 3).
- [ ] Convert button on a COMPLETED job navigates to the new invoice; offline disables it with tooltip.
- [ ] All API calls go through `api()` with `entityType: 'job'` and a meaningful `entityLabel` (job title). `scripts/enforce-offline.mjs` clean.

**Cross-cutting**
- [ ] Hindi translations present for every new key in the same commit.
- [ ] `verticals.config.spec.ts` updated with the `isNavVisible` cases above.
- [ ] No new file > 250 LOC. No `any` in new TS. No floating-point money.

---

## 10. Out of scope — Phase 3 (deferred)

Explicit non-goals for this phase:

- **Recurring jobs** (monthly maintenance contracts). Defer — would touch `RecurringInvoice` machinery; design separately.
- **Job templates** (saved title/description/items presets). Defer — needs a `JobTemplate` table; trivial to add later, no v0 user pull.
- **Parts vs labour split** on items. Today every `JobItem` is a flat row. Adding a `kind: 'PART'|'LABOUR'` enum is additive, defer until reports demand it.
- **Technician assignment** beyond a free-text field. No `assignedTo: User` FK in v0. Phase 5 (appointment scheduling) is the right home for this.
- **Calendar / kanban views.** v0 ships a list view with status filter pills. Calendar view earns its slot once we see usage.
- **Job-level attachments / photos.** Add later via a generic `Attachment` table reused by Document/Order/Job.
- **Vertical-specific terminology overrides** beyond what `useTerm()` already does (e.g. "Visit" for clinics, "Booking" for salons). Already supported by `VerticalProfile.invoiceTermKey`-style additions; a future `jobTermKey` belongs in Phase 5 polish, not v0.
