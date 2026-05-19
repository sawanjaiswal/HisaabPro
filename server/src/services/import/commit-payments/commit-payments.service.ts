/**
 * Phase 7 · 7.1D PR-D1 — Payment chunk commit (stub).
 *
 * Real per-row Σ-guard + INSERT Payment + INSERT PaymentAllocation ladder
 * lands in PR-D3 (`allocate-one.ts` + this orchestrator's filled body).
 *
 * The dispatcher wiring (`commit-dispatcher.ts case 'payments'`) requires
 * this export at PR-D1 type-check time; the body throws so any premature
 * commit attempt fails loudly rather than silently no-op'ing.
 *
 * Authority: ARCHITECTURE_PHASE7_IMPORT_7_1D.md §6, File Plan row 22.
 */

import { AppError, ErrorCode } from '../../../lib/errors.js'
import type { ChunkResult, Tx } from '../commit.helpers.js'
import type { CommitChunkArgs } from '../commit-dispatcher.js'

export async function commitChunkPayments(
  _tx: Tx,
  _args: CommitChunkArgs,
): Promise<ChunkResult> {
  throw new AppError(
    ErrorCode.IMPORT_JOB_NOT_COMMITTABLE,
    501,
    "Payment import commit not yet implemented (PR-D3 lands the real ladder).",
  )
}
