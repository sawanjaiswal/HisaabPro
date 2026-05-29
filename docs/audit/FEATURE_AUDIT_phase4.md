phase: 4 Inventory/POS (features 105-120)

# Phase 4 — Advanced Inventory & POS — Adversarial Feature Audit

Audited 2026-05-29. Each "Done" row checked against real implementing code
(services, routes, schema models, FE features). Stock-correctness paths
(append-only StockMovement, atomic BOM runs, FEFO, POS void/restore) inspected
in depth.

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 105 | Barcode generation (per-product) | VERIFIED | `Product.barcode`/`barcodeFormat` (schema 800-801); `src/features/products/label-print/*` | Barcode value + format stored; label-print renders barcode. |
| 106 | Barcode scan (ML Kit + zxing) | VERIFIED | `src/components/ui/BarcodeScanner.tsx`, `barcode-scanner.utils.ts` | Component exists; Capacitor BarcodeScanning + zxing fallback path present. |
| 107 | Batch tracking + FEFO | VERIFIED | `services/stock/batch-claim.service.ts`, `Batch` model (2750), `src/features/batches/*` | Real FEFO: `ORDER BY expiryDate ASC NULLS LAST` + `FOR UPDATE SKIP LOCKED` + per-row TOCTOU guard + HARD_BLOCK expiry exclusion. |
| 108 | Serial numbers | VERIFIED | `services/serial-number.service.ts` (244L), `SerialNumber` model (2718), `src/features/serial-numbers/*` | Service + model + FE all present, real logic. |
| 109 | Multi-godown + transfers | VERIFIED | `godown.service.ts` (181L), `godown-transfer.service.ts` (175L), `Godown`/`GodownStock`/`GodownTransfer` models, `src/features/godowns/*` | All present. |
| 110 | Stock adjustment (reason codes) | VERIFIED | `services/stock/core.ts` `adjustStock()` | FOR UPDATE row lock, reason/customReason fields, ADJUSTMENT_IN/OUT, validation-mode resolution. |
| 111 | Label printing (THERMAL/A4/A5) | VERIFIED | `src/features/products/label-print/label-layout.ts` | `SheetFormat = 'THERMAL_40x30' \| 'A4_3x8' \| 'A5_2x5'` exactly matches claim. |
| 112 | Bulk import/export (CSV) | VERIFIED | `services/product-bulk.service.ts` (214L), `src/features/bulk-import/*` | Service + FE page + hooks + utils present. |
| 113 | Expiry cron + alerts (daily) | VERIFIED | `jobs/run-batch-expiry-alerts.ts`, `lib/cron-scheduler.ts`, `services/stock/batch-expiry-alerts.service.ts` | Scheduled job exists; FEFO drain auto-resolves alerts inline. |
| 114 | Reorder points | PARTIAL | `Product.reorderQty` (schema 809), `stock-alert.service.ts:46-55` | Logic real (reorderBreached, threshold). DRIFT: matrix says `Product.reorderPoint`; actual field is `reorderQty`. No `reorderPoint` column exists. |
| 115 | BOM + ProductionRun (atomic+WAC+reverse) | VERIFIED | `services/bom/production-run-execute.service.ts`, `production-run-cancel.service.ts`, `Bom`/`BomComponent`/`ProductionRun` models | Fully atomic: single $tx, sorted FOR UPDATE, idempotency persisted inside tx, WAC via shared `computeWeightedAvg`, overflow guards, cancel/reverse service present. |
| 116 | Item images (multi-image) | VERIFIED | `routes/products/images.ts`, `Product.imageUrl` + `images String[]` (schema 804-805) | Route exists; up-to-5 images array per schema. |
| 117 | MOQ enforcement | VERIFIED | `services/document/moq.guard.ts`, wired in `document/create.ts`, `update.ts`, `pos-checkout.service.ts`; `Product.moq` (807) | Real guard: `qty < moq` → BELOW_MOQ warning across invoice + POS. |
| 118 | POS billing + void/restore | VERIFIED | `services/pos/pos-void.service.ts`, `pos-checkout.*`, `PosSale`/`PosSaleItem`/`PosSaleEvent` models, `src/features/pos/*` | void/restore in Serializable $tx; reverses stock + batch + cash + loyalty + commission atomically; void/restore windows enforced. |
| 119 | Stock verification (atomic batch adj) | VERIFIED | `stock-verification.service.ts` (235L), `services/stock/verification-finalize.service.ts`, `StockVerification`/`StockVerificationItem` models | Finalize is atomic: FOR UPDATE lock, idempotent, routes every discrepancy through canonical `adjustStock` (HARD_BLOCK overridden — correct, this is the truthing event). |
| 120 | Party ledger (DR/CR + running bal + PDF) | VERIFIED | `routes/collections/statement.route.ts` → `services/collections/statement.service.ts`, `src/features/collections/StatementPDFTemplate.tsx`, `src/features/parties/ledger/PartyLedgerPDF.tsx` | Real DR/CR fold (`running = running + debit - credit`), opening-balance helper, PDF templates present. Matrix cites `shared-ledger` feature (public-link variant) which also exists. |

## SSOT violations

- **`Product.currentStock` (stored) vs `StockMovement` sum (derivable)** — `server/prisma/schema.prisma:793` + `884`. `currentStock` is the running authority; `StockMovement.balanceAfter` is a per-write snapshot. NOT independent dual-writes: every mutation flows through `adjustStock()` / BOM-execute / POS-void, all of which update `currentStock` AND append the movement inside the SAME row-locked transaction. Authoritative source = `currentStock`. Acceptable, but no runtime invariant test asserts `sum(StockMovement.quantity) == currentStock` outside `__tests__/stock-integrity.test.ts`. Low risk.
- **`balanceAfter` placeholder in POS void/restore** — `services/pos/pos-void.service.ts:61,83`. SALE_REVERSAL / SALE movements are written with `balanceAfter: 0` rather than the true post-mutation running balance. Snapshot-accuracy gap only (currentStock still correct via increment/decrement); ledger reconstruction from `balanceAfter` would be wrong for these rows. Not a stock-correctness break. Flag for cleanup.
- **WAC compute** — single SSOT confirmed: `computeWeightedAvg` defined once at `services/stock/invoice-ops-purchase.ts:17`, called only from purchase (`:72`) and BOM production (`production-run-execute.service.ts:135`). No duplicated formula. Clean.

## Non-standard code

- No raw `fetch()` in Phase 4 feature code (all via `api()`; grep hits were `refetch`).
- No `as any` / `@ts-ignore` / `@ts-nocheck` in Phase 4 feature code (only match was a code comment in `bom.utils.ts:104`).
- No source files >250 lines in Phase 4 services/FE (only files over limit are test files under `services/stock/__tests__/`, which are exempt).
- `StockMovement` confirmed append-only: schema comment "Immutable — no updatedAt" (line 917), no `updatedAt` column, no `.update()`/`.delete()` on `stockMovement` found in services (reversals are new appended rows, not mutations). Correct.
