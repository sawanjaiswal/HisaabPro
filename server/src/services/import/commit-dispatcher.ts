/**
 * Phase 7 — Import Engine · Commit dispatcher (Slice 7.1B PR1)
 *
 * Resolves `ImportJob.entity` to the correct chunk-commit function.
 * `commit.service.ts` is the public entrypoint and orchestrates the
 * advisory lock + M3 bind ASSERT + state-machine transitions; THIS file
 * owns ONLY the entity → handler mapping so the dispatch table is
 * trivially readable in isolation.
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1B.md §8 (split refactor)
 *   - SCOPE_PHASE7_IMPORT_7_1B_PRODUCTS.md L578 (commit.service.ts split)
 */

import { AppError, ErrorCode } from '../../lib/errors.js'
import { commitChunkParties } from './commit-parties.service.js'
import { commitChunkProducts } from './commit-products.service.js'
import type { ChunkResult, Tx } from './commit.helpers.js'

export type ImportEntity = 'parties' | 'product' | 'invoice'

export interface CommitChunkArgs {
  jobId: string
  businessId: string
  userId: string
}

export type CommitChunkFn = (tx: Tx, args: CommitChunkArgs) => Promise<ChunkResult>

/**
 * Look up the chunk-commit function for an `ImportJob.entity` value.
 *
 * Throws `IMPORT_JOB_NOT_COMMITTABLE` (409) for unknown entities — a
 * defence-in-depth check that mirrors the Zod `entity` enum on the
 * upload route. A row with a garbage entity reaching here means the
 * route's enum was bypassed; refusing to dispatch protects every
 * downstream invariant.
 */
async function commitChunkInvoicesStub(): Promise<ChunkResult> {
  // 7.1C PR-C1 placeholder — real `commitChunkInvoices` arrives in PR-C3.
  // Returning a 409 (not 501) keeps the route's existing error envelope —
  // the route's `entity='invoice'` Zod branch doesn't open until PR-C4.
  throw new AppError(
    ErrorCode.IMPORT_JOB_NOT_COMMITTABLE,
    409,
    "Invoice commit is not yet enabled (7.1C PR-C1 scaffold).",
  )
}

export function pickCommitChunk(entity: string): CommitChunkFn {
  switch (entity) {
    case 'parties':
      return commitChunkParties
    case 'product':
      return commitChunkProducts
    case 'invoice':
      // 7.1C PR-C1 — branch reserved; real implementation lands in PR-C3
      // (`commit-invoices.service.ts`). Throwing NOT_IMPLEMENTED keeps the
      // route-layer enum + dispatcher in lockstep without exposing a
      // half-built commit path to /api/imports/:id/commit.
      return commitChunkInvoicesStub
    default:
      throw new AppError(
        ErrorCode.IMPORT_JOB_NOT_COMMITTABLE,
        409,
        `Unsupported ImportJob.entity='${entity}'`,
      )
  }
}
