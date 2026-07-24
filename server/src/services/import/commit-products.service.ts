/**
 * Phase 7 · 7.1B — PRODUCTS commit branch
 *
 * Real ladder (replaces the API.B1 stub) per ARCHITECTURE_PHASE7_IMPORT
 * _7_1B.md §8.1:
 *
 *   For each STAGED row (chunk of ≤ CHUNK_SIZE):
 *     1. INSERT Product RETURNING id
 *     2. INSERT StockMovement (OPENING_BALANCE, type=OPENING, qty=openingStock)
 *        ON CONFLICT (importJobRowId) DO NOTHING   [partial UNIQUE via Migration B2]
 *     3. UPDATE ImportJobRow SET status='COMMITTED', createdEntityId=$id
 *        WHERE id=$row AND status='STAGED' AND createdEntityId IS NULL
 *
 * Per-chunk: ONE batched `products.imported_batch` audit row (S6).
 *
 * PII: NEVER includes raw cell content — only jobId, productIds,
 *       sourceIndices, count (S9).
 *
 * Test hook: if env IMPORT_CRASH_AFTER_ROW is set (NODE_ENV=test only),
 * throw mid-chunk so the integration test can prove idempotent retry.
 */

import logger from '../../lib/logger.js'
import { AppError, ErrorCode } from '../../lib/errors.js'
import { CHUNK_SIZE } from '../../constants/import.constants.js'
import {
  assertOpeningBalanceEnum,
  hasCreatedEntityIdColumn,
  type ChunkResult,
  type StagedRowMin,
  type Tx,
} from './commit.helpers.js'
import { createAuditEntry } from '../settings/audit.js'

interface ProductNormalized {
  name: string
  sku?: string
  hsnCode?: string | null
  // Prices on the wire are strings (M5 serialised). Inside Tx they are
  // either string or bigint depending on how the row was hydrated; we
  // accept both and coerce to Int paise (Product.salePrice is Int).
  salePrice?: string | number | bigint
  purchasePrice?: string | number | bigint
  mrp?: string | number | bigint
  unit?: string
  unitSourceText?: string
  openingStock?: string
  description?: string
}

function toIntPaise(
  v: string | number | bigint | undefined,
): number | undefined {
  if (v === undefined || v === null) return undefined
  if (typeof v === 'bigint') {
    if (v < BigInt(0) || v > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
    return Number(v)
  }
  const s = String(v).trim()
  if (!s) return undefined
  if (!/^\d+$/.test(s)) return undefined
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : undefined
}

function toFloatQty(v: string | undefined): number {
  if (!v) return 0
  const n = Number(String(v))
  return Number.isFinite(n) ? n : 0
}

async function resolveUnitId(
  tx: Tx,
  businessId: string,
  unitName: string | undefined,
): Promise<string | null> {
  if (!unitName) return null
  // Match on (businessId, name) — case-insensitive contains is too loose
  // for tenant-safety; symbol is also a unique alt-key.
  const byName = await tx.unit.findFirst({
    where: { businessId, isDeleted: false, name: unitName },
    select: { id: true },
  })
  if (byName) return byName.id
  const bySymbol = await tx.unit.findFirst({
    where: { businessId, isDeleted: false, symbol: unitName },
    select: { id: true },
  })
  return bySymbol?.id ?? null
}

async function commitOneProductRow(
  tx: Tx,
  args: {
    row: StagedRowMin
    businessId: string
    userId: string
    jobId: string
    dualWrite: boolean
  },
): Promise<string | null> {
  const { row, businessId, userId, jobId, dualWrite } = args
  const n = row.normalized as ProductNormalized
  if (!n.name) return null

  const unitId = await resolveUnitId(tx, businessId, n.unit)
  if (!unitId) {
    // Cannot create Product without unitId — Unit.unitId is required.
    logger.warn('import.commit.product_unit_missing', {
      jobId,
      sourceIndex: row.sourceIndex,
    })
    return null
  }

  const salePrice = toIntPaise(n.salePrice) ?? 0
  const purchasePrice = toIntPaise(n.purchasePrice)
  const mrp = toIntPaise(n.mrp)
  const opening = toFloatQty(n.openingStock)

  // 1) INSERT Product RETURNING id
  const product = await tx.product.create({
    data: {
      businessId,
      name: n.name,
      sku: n.sku ?? null,
      unitId,
      salePrice,
      purchasePrice: purchasePrice ?? null,
      currentStock: opening,
      hsnCode: n.hsnCode ?? null,
      description: n.description ?? null,
      // mrp is not a Product column today; weighted avg or price-list owns
      // long-term. Carry on description-side? No — drop silently (matches
      // SCOPE: import never invents schema). Future migration may add it.
    },
    select: { id: true },
  })
  void mrp // intentionally unused — schema has no MRP column today

  // ── Test-only crash hook (ARCH §8.1) ─────────────────────────────
  if (
    process.env.NODE_ENV === 'test' &&
    process.env.IMPORT_CRASH_AFTER_ROW === row.id
  ) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      500,
      'IMPORT_CRASH_AFTER_ROW: deliberate test crash',
    )
  }

  // 2) INSERT StockMovement (OPENING) — ON CONFLICT DO NOTHING via
  //    partial UNIQUE on importJobRowId (Migration B2). Idempotent.
  if (opening !== 0) {
    await tx.$executeRaw`
      INSERT INTO "StockMovement"
        (id, "businessId", "productId", type, quantity, "balanceAfter",
         "createdBy", "importJobRowId", "movementDate", "createdAt")
      VALUES
        (
          'sm_' || substr(md5(random()::text), 1, 24),
          ${businessId}, ${product.id}, 'OPENING',
          ${opening}, ${opening}, ${userId}, ${row.id},
          NOW(), NOW()
        )
      ON CONFLICT ("importJobRowId") DO NOTHING
    `
  }

  // 3) UPDATE ImportJobRow guard — bind only if still STAGED.
  const claimed = await tx.importJobRow.updateMany({
    where: { id: row.id, status: 'STAGED', createdEntityId: null },
    data: dualWrite
      ? { status: 'COMMITTED', createdEntityId: product.id }
      : { status: 'COMMITTED', createdEntityId: product.id },
  })
  if (claimed.count !== 1) {
    logger.warn('import.commit.row_race', { rowId: row.id, jobId })
    return null
  }
  return product.id
}

/**
 * Commit one chunk of ≤CHUNK_SIZE product rows. One batched
 * `products.imported_batch` audit row per chunk (S6).
 */
export async function commitChunkProducts(
  tx: Tx,
  args: { jobId: string; businessId: string; userId: string },
): Promise<ChunkResult> {
  await assertOpeningBalanceEnum()
  const dualWrite = await hasCreatedEntityIdColumn(tx)
  const candidates = await tx.$queryRaw<StagedRowMin[]>`
    SELECT id, "sourceIndex", normalized, "matchedPartyId"
    FROM "ImportJobRow"
    WHERE "jobId" = ${args.jobId}
      AND status = 'STAGED'
      AND "createdEntityId" IS NULL
    ORDER BY "sourceIndex" ASC
    LIMIT ${CHUNK_SIZE}
    FOR UPDATE
  `
  if (candidates.length === 0) {
    return { createdPartyIds: [], sourceIndices: [], done: true }
  }
  const productIds: string[] = []
  const sourceIndices: number[] = []
  for (const row of candidates) {
    const id = await commitOneProductRow(tx, {
      row,
      businessId: args.businessId,
      userId: args.userId,
      jobId: args.jobId,
      dualWrite,
    })
    if (id) {
      productIds.push(id)
      sourceIndices.push(row.sourceIndex)
    }
  }
  await createAuditEntry({
    businessId: args.businessId,
    entityType: 'ImportJob',
    entityId: args.jobId,
    userId: args.userId,
    action: 'CREATE',
    changes: {
      event: 'products.imported_batch',
      productIds,
      sourceIndices,
    },
  }, tx)
  return {
    // Field name stays `createdPartyIds` for ChunkResult shape compat;
    // it is the product-id list when entity='product'.
    createdPartyIds: productIds,
    sourceIndices,
    done: candidates.length < CHUNK_SIZE,
  }
}
