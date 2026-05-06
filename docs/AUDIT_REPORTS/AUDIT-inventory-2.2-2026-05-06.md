# QA AUDIT: Inventory Phase 2.2 (BAT-01..BAT-07)

**Date:** 2026-05-06  
**Scope:** Batch tracking, expiry alerts, FEFO claims, policy enforcement  
**Commits:** e67d47b..0bb1db3 (7 commits)

---

## Verdict

**REJECTED** — 3 BLOCKER violations (file size limits) + 0 CRITICAL + 0 MAJOR  
Cannot approve until files are split below 250 LOC.

---

## Phase 0 — Mechanical Sweeps

### File Length Check (≤ 250 LOC)

| File | Lines | Status | Notes |
|------|-------|--------|-------|
| `server/src/services/document/create.ts` | 266 | ❌ BLOCKER | +18 LOC (248→266 in BAT-03) |
| `src/features/invoices/useInvoiceForm.ts` | 261 | ❌ BLOCKER | +23 LOC (238→261 in BAT-05) |
| `src/features/settings/settings.constants.ts` | 257 | ❌ BLOCKER | +9 LOC (248→257 in BAT-07) |

**Root Cause:** Each task added feature logic without splitting files. BAT-03 added batch error handling to create.ts, BAT-05 added batch error state to useInvoiceForm, BAT-07 added settings constants.

### console.log Check
✓ **PASS** — No console.log found in feature code.

### `any` Type Check
✓ **PASS** — No `: any` found in new files.

### `/api/api/...` Path Check
✓ **PASS** — No double-path prefixes.

---

## Phase 2 — Manual Code Review

### F-01: API Path Correctness
✓ **PASS** — All paths use single `/api/` prefix.

### F-04: BE/FE Field-Name Parity

| Field | Backend | Frontend | Match |
|-------|---------|----------|-------|
| `batchId` | ✓ (batch.service.ts:211) | ✓ (batch.types.ts:8) | ✓ |
| `batchNumber` | ✓ (batch.service.ts:211) | ✓ (batch.types.ts:9) | ✓ |
| `expiryDate` | ✓ (batch.service.ts:211) | ✓ (batch.types.ts:11, ISO string) | ✓ |
| `currentStock` | ✓ (batch.service.ts:211) | ✓ (batch.types.ts:12) | ✓ |
| `costPriceAtClaim` | ✓ (batch.service.ts:218, Number()) | ✓ (batch.types.ts:14, number | null) | ✓ |
| `isExpired` | ✓ (batch.service.ts:219) | ✓ (batch.types.ts:15) | ✓ |
| `expiredBatchPolicy` | ✓ (business.schemas.ts:32) | ✓ (batch.types.ts:17) | ✓ |
| `expiryAlertDays` | ✓ (business.schemas.ts:31) | ✓ (useInventorySettings) | ✓ |

**Status:** ✓ All fields match exactly.

### F-05: Single Unwrap of `api()` Responses

Checked:
- `batch.service.ts:213-220` — unwraps, maps costPrice to Number(), isExpired checked ✓
- `invoice-crud.service.ts:95-141` — mutations all use `entityType` + `entityLabel` ✓
- `useBatchPicker.ts:22-27` — single unwrap, passes response.batches ✓

**Status:** ✓ All service functions unwrap once and propagate correctly.

### F-06: Per-Business / Per-Batch Transactions

**Cron (batch-expiry-alerts.service.ts:177-226):**
- Streams businesses in pages of 200
- Each business gets a separate `$transaction` (line 206)
- Transactions committed before next business
- ✓ No outer batch transaction wrapping multi-tenant loops

**Invoice Ops (invoice-ops.ts:39-154):**
- Each item claimed inside a **single outer `$transaction`** (document-create.ts)
- Batch claims use `claimBatchesFEFO(tx, ...)` (no nested tx)
- Per-batch movements created with backfill (lines 130-136)
- ✓ No per-item wrapping; correctly scoped to single document operation

**Status:** ✓ Transaction boundaries correct.

### HARD_BLOCK 409 Codes Surface to FE

Checked error handling chain:

**Backend (errors.ts:49-52, 163-172):**
- `EXPIRED_BATCH` (409) — expiredBatchError()
- `ALL_BATCHES_EXPIRED` (409) — allBatchesExpiredError()
- `INSUFFICIENT_BATCH_STOCK` (409) — insufficientBatchStockError()
- All return 409 status code ✓

**Frontend (useInvoiceForm.ts:189-195):**
```typescript
const batchCodes: BatchErrorCode[] = ['EXPIRED_BATCH', 'ALL_BATCHES_EXPIRED', 'INSUFFICIENT_BATCH_STOCK']
if (err instanceof ApiError && batchCodes.includes(err.code as BatchErrorCode)) {
  setBatchErrorCode(err.code as BatchErrorCode)
  setActiveSection('items')
  return
}
```
✓ All 409 codes caught, routed to UI state manager.

**Status:** ✓ Error codes propagate correctly.

### WARN_ONLY Warnings Propagate

**Backend (batch-claim.service.ts:228, invoice-ops.ts:153):**
- `claimBatchesFEFO()` returns `{ claims, warnings }` (line 68)
- Invoice-ops collects warnings into `allWarnings[]` (line 67)
- `deductForSaleInvoice()` returns `{ movements, warnings }` (line 153) ✓

**Frontend (useInvoiceForm.ts:164-167):**
```typescript
const raw = result as { mode: string; targetStatus: string; editId?: string; warnings?: { type: string }[] }
if (raw.warnings?.some((w) => w.type === 'EXPIRED_BATCH')) {
  toast.warning('Sale recorded with expired batch — review at /alerts')
}
```
✓ Warnings propagated via response body, handled in onSuccess.

**Status:** ✓ Warnings propagate and toast displays correctly.

### Cron Idempotency

**batch-expiry-alerts.service.ts:101-112:**
```typescript
const existing = await tx.stockAlert.findFirst({
  where: { businessId, batchId: c.id, alertType, status: 'ACTIVE' },
  select: { id: true },
})
if (existing) continue
```
✓ **Dedupe via findFirst** — prevents duplicate alerts on re-run same day.

**Status:** ✓ Idempotent via deduplication.

### Cursor Pagination Determinism

**value-report-queries.ts:110:**
```typescript
ORDER BY total_paise DESC, "productId" ASC, COALESCE("batchId", '') ASC
```
✓ Three-level sort ensures deterministic cursor:
1. totalPaise DESC (primary sort value)
2. productId ASC (tie-breaker for equal paise)
3. batchId ASC (tie-breaker for same product/value)

**Status:** ✓ Deterministic pagination.

### Zod `.strict()` on PATCH /api/business

**business.schemas.ts:21-33:**
```typescript
export const updateBusinessSchema = z.object({
  name: z.string()...optional(),
  ...
  expiredBatchPolicy: z.enum(['WARN_ONLY', 'HARD_BLOCK']).optional(),
}).strict()
```
✓ `.strict()` prevents extra fields.

**Status:** ✓ Validated.

### FE Mutations: `entityType` + `entityLabel`

**invoice-crud.service.ts:**
| Function | entityType | entityLabel | Offline Queue |
|----------|-----------|------------|---|
| `createDocument()` | docTypeToEntity(data.type) ✓ | `New ${type}` ✓ | ✓ |
| `updateDocument()` | data.type ? docTypeToEntity() : 'document' ✓ | `${type} update` ✓ | ✓ |
| `deleteDocument()` | 'document' ✓ | 'Delete document' ✓ | ✓ |
| `convertDocument()` | docTypeToEntity(targetType) ✓ | `Convert → ${type}` ✓ | ✓ |

**useBatchPicker.ts:**
- Read-only (no mutation), `cacheReads: false` ✓

**Status:** ✓ All mutations carry proper labels.

### 4 UI States Present

**BatchPicker (src/features/inventory/components/BatchPicker.tsx:186-232):**

1. **Loading** (line 186-191): Skeleton rows `aria-busy="true"` ✓
2. **Error** (line 195-200): Alert icon + message + retry button ✓
3. **Empty** (line 204-207): "None available" centered message ✓
4. **Success** (line 211-231): Batch rows with selection checkmarks ✓

All 4 states explicitly rendered with correct aria labels and a11y attributes.

**Status:** ✓ All 4 states present.

### localStorage Writes
✓ **PASS** — No localStorage writes in BAT feature code.

### File Size Compliance (≤ 250 LOC)

**BAT-specific files:**

| File | LOC | Status |
|------|-----|--------|
| `batch-claim.service.ts` | 230 | ✓ |
| `batch-claim.types.ts` | 27 | ✓ |
| `batch-expiry-alerts.service.ts` | 227 | ✓ |
| `expiry-policy.ts` | 146 | ✓ |
| `value-report-queries.ts` | 143 | ✓ |
| `value-report.service.ts` | 38 | ✓ |
| `invoice-ops.ts` | 250 | ✓ (at limit) |
| `invoice-ops-purchase.ts` | 130 | ✓ |
| `useBatchPicker.ts` | 75 | ✓ |
| `BatchPicker.tsx` | 237 | ✓ |
| `batch.types.ts` | 68 | ✓ |

**Pre-existing files crossed threshold during BAT work:**

| File | LOC | Commit | Violation |
|------|-----|--------|-----------|
| `server/src/services/document/create.ts` | 266 | BAT-03 | +18 LOC |
| `src/features/invoices/useInvoiceForm.ts` | 261 | BAT-05 | +23 LOC |
| `src/features/settings/settings.constants.ts` | 257 | BAT-07 | +9 LOC |

---

## Summary

| Category | Count | Details |
|----------|-------|---------|
| **BLOCKERs** | 3 | File size violations (266, 261, 257 LOC) |
| **CRITICALs** | 0 | |
| **MAJORs** | 0 | |
| **MINORs** | 0 | |

---

## Findings

### P0 / BLOCKER

1. **`server/src/services/document/create.ts` exceeds 250 LOC (266)**
   - **Added in:** BAT-03 commit df1b8d9
   - **Impact:** Enforcement blocker — file must be split
   - **Fix:** Extract batch error handling (checkClientBatchOwnership, validateBatchAvailability) to separate `document-batch.ts` or `batch-validation.ts`

2. **`src/features/invoices/useInvoiceForm.ts` exceeds 250 LOC (261)**
   - **Added in:** BAT-05 commit 5dca43e
   - **Impact:** Enforcement blocker — file must be split
   - **Fix:** Extract batch error state (batchErrorCode, batchErrorLineIndex, clearBatchError) and error handler into `useBatchErrorState.ts` hook

3. **`src/features/settings/settings.constants.ts` exceeds 250 LOC (257)**
   - **Added in:** BAT-07 commit 0bb1db3
   - **Impact:** Enforcement blocker — file must be split
   - **Fix:** Move inventory settings translations to `src/features/inventory/inventory-settings.constants.ts`

---

## Passing Checks

✓ No console.log  
✓ No `any` types  
✓ No `/api/api/` paths  
✓ All field names match FE ↔ BE  
✓ Single unwrap of api() responses  
✓ Correct transaction boundaries (per-business, per-item)  
✓ 409 error codes surface to FE  
✓ WARN_ONLY warnings propagate  
✓ Cron dedupe idempotent  
✓ Cursor pagination deterministic  
✓ Zod `.strict()` on PATCH  
✓ All mutations carry entityType + entityLabel  
✓ 4 UI states on BatchPicker  
✓ No localStorage writes in BAT features  

---

## Recommendation

**DO NOT SHIP** until the 3 file-size blockers are resolved.

**Next Steps:**
1. Split the 3 oversized files
2. Re-run audit to confirm zero violations
3. Re-submit for approval

**Estimated effort:** ~2 hours (refactoring + re-test)
