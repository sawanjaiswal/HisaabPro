/**
 * Zod validators for document share-link CRUD endpoints.
 * PR3 — #130 public invoice share links backend.
 */

import { z } from 'zod'

/**
 * POST /api/documents/:documentId/share-links
 * ttlDays: 7 | 30 | 90 | null (null = no expiry)
 */
export const issueShareLinkBodySchema = z
  .object({
    ttlDays: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]).optional(),
  })
  .strict()

export type IssueShareLinkBody = z.infer<typeof issueShareLinkBodySchema>

/**
 * PATCH /api/documents/:documentId/share-links/:linkId
 * Only { revoked: true } is accepted — no other mutations on a link.
 */
export const revokeShareLinkBodySchema = z
  .object({
    revoked: z.literal(true),
  })
  .strict()

export type RevokeShareLinkBody = z.infer<typeof revokeShareLinkBodySchema>
