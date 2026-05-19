/**
 * Phase 7 — Import Engine · PRODUCTS commit branch (Slice 7.1B PR1 stub)
 *
 * Owns the STAGED-row pass for `ImportJob.entity = 'product'`. This file
 * is a stub in PR1 / API.B1 — it asserts the OPENING_BALANCE precondition
 * (M9) and short-circuits with 503 IMPORT_PRECONDITION_MISSING. PR API.B3
 * replaces the throw with the real per-row INSERT Product → ON CONFLICT
 * StockMovement → UPDATE ImportJobRow ladder defined in
 * ARCHITECTURE_PHASE7_IMPORT_7_1B.md §8.1.
 *
 * Why a stub today:
 *   - The dispatcher (commit-dispatcher.ts) must route by `entity` from
 *     PR1 onwards so the parties branch can be extracted cleanly.
 *   - The 503 surface is a stable error code that the FE can render as
 *     "Products import not yet enabled on this server" until B3 ships.
 *   - M9 runs even from the stub so misconfigured servers fail loudly
 *     instead of silently dispatching to a no-op.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1B.md §8.1 (statement order — TODO B3)
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1B.md M9 (enum precondition)
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import {
  assertOpeningBalanceEnum,
  type ChunkResult,
  type Tx,
} from './commit.helpers.js'

/**
 * STAGED-row pass for products. Stub: asserts M9 then throws 503 with
 * IMPORT_PRECONDITION_MISSING. The full ladder lands in API.B3.
 */
export async function commitChunkProducts(
  _tx: Tx,
  _args: { jobId: string; businessId: string; userId: string },
): Promise<ChunkResult> {
  // M9 precondition first — run BEFORE the throw so misconfigured envs
  // get the canonical enum error instead of "not implemented".
  await assertOpeningBalanceEnum()
  throw new AppError(
    ErrorCode.IMPORT_PRECONDITION_MISSING,
    503,
    'Products commit not yet enabled on this server (Phase 7 · 7.1B API.B3 pending)',
  )
}
