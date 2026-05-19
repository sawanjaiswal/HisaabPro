/**
 * Phase 7 — Import Engine Zod schemas
 *
 * Validates payloads on the four import routes. Multer parses the
 * multipart body before these schemas run; `uploadBodySchema` therefore
 * only covers the non-file form fields. All schemas are `.strict()` so
 * unknown keys are rejected (the offline-correct path).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 3
 */

import { z } from 'zod'
import {
  IMPORT_FORMATS,
  MAX_DEDUP_RESOLUTIONS,
} from '../constants/import.constants.js'

// ── Dedup resolution (API.8) ─────────────────────────────────────────
/**
 * Per-row decision the user makes on duplicate matches in the preview UI.
 *   SKIP        — no-op (row remains DUPLICATE_* and is excluded from commit).
 *   OVERWRITE   — update the matched party in place from row's normalized data.
 *   CREATE_NEW  — flip to STAGED, null out matchedPartyId; treat as a new party.
 */
export const DEDUP_RESOLUTION_DECISIONS = ['SKIP', 'OVERWRITE', 'CREATE_NEW'] as const

export const dedupResolutionSchema = z
  .object({
    rowId: z.string().min(1).max(64),
    decision: z.enum(DEDUP_RESOLUTION_DECISIONS),
  })
  .strict()

// ── POST /import/jobs (upload) ───────────────────────────────────────
/**
 * Non-file fields on the multipart upload. The actual file lands on
 * `req.file` via multer's memory storage (see middleware setup). Only
 * `parties` is accepted as the entity in 7.1A — invoices and products
 * come in later slices.
 */
export const uploadBodySchema = z
  .object({
    format: z.enum(IMPORT_FORMATS),
    /**
     * Phase 7 · 7.1B — extended to accept `'product'` alongside `'parties'`.
     * Default is `'parties'` so legacy clients (no `entity` field) still
     * dispatch to the parties branch unchanged.
     */
    entity: z.enum(['parties', 'product']).default('parties'),
  })
  .strict()

export type UploadBody = z.infer<typeof uploadBodySchema>

// ── POST /import/jobs/:id/commit ─────────────────────────────────────
/**
 * commitToken is issued at PREVIEWED. Length range matches the token
 * generator (crypto-random base64url ~ 22 chars; bounded 20-40 for
 * future flexibility without unbounded payloads).
 */
export const commitBodySchema = z
  .object({
    commitToken: z.string().min(20).max(40),
    /**
     * API.8 — optional per-row resolutions for DUPLICATE_EXACT/DUPLICATE_NEAR
     * rows surfaced at preview. Absent = legacy behaviour (DUP rows skipped).
     * Bounded by MAX_DEDUP_RESOLUTIONS so a malicious payload cannot OOM.
     */
    dedupResolutions: z
      .array(dedupResolutionSchema)
      .max(MAX_DEDUP_RESOLUTIONS)
      .optional(),
  })
  .strict()

export type CommitBody = z.infer<typeof commitBodySchema>
export type DedupResolutionInput = z.infer<typeof dedupResolutionSchema>

// ── POST /import/jobs/:id/cancel ─────────────────────────────────────
/** Empty body — cancellation is idempotent and carries no payload. */
export const cancelBodySchema = z.object({}).strict()

export type CancelBody = z.infer<typeof cancelBodySchema>

// ── GET /import/jobs/:id/preview ─────────────────────────────────────
/**
 * Query params for the paginated preview. `rowStatus` filters to one
 * subset (STAGED is the default UI view; ERROR surfaces issues; SKIPPED
 * surfaces dedup-skips). `limit` is capped at 200 to bound response
 * payload size (each row carries normalized fields + issues[]).
 */
export const previewQuerySchema = z
  .object({
    rowStatus: z.enum(['STAGED', 'ERROR', 'SKIPPED']).optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()

export type PreviewQuery = z.infer<typeof previewQuerySchema>
