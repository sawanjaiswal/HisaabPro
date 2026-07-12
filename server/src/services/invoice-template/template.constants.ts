/**
 * Invoice Template — constants (limits, base-template allowlist, error factories).
 *
 * baseTemplate is a String validated against BASE_TEMPLATE_ALLOWLIST — NOT a
 * Prisma enum (R1). The allowlist mirrors the FE `BaseTemplate` union in
 * `src/features/templates/template-layout.types.ts`; kept in the BE (not
 * shared/enums.ts) so a render-only union does not couple to the shared layer.
 */

import { AppError, ErrorCode } from '../../lib/errors.js'

/** Max non-deleted templates per business (enforced in a $transaction). */
export const MAX_TEMPLATES = 20

/** Max serialized size of config / printSettings JSON blobs (10KB). */
export const MAX_CONFIG_BYTES = 10 * 1024

/**
 * Allowed `baseTemplate` values — mirror of the FE `BaseTemplate` union.
 * Adding a preset here is additive; an old server never rejects a config
 * authored by a newer client for an unknown base value (version-lag safety).
 */
export const BASE_TEMPLATE_ALLOWLIST = [
  'THERMAL_58MM',
  'THERMAL_80MM',
  'A4_CLASSIC',
  'A4_MODERN',
  'A5_COMPACT',
  'A4_DETAILED',
  // Modern collection
  'A4_ELEGANT',
  'A4_MINIMAL',
  'A4_BOLD',
  'A4_CORPORATE',
  'A4_PROFESSIONAL',
  'A4_CREATIVE',
  // Indian business collection
  'A4_GST_STANDARD',
  'A4_GST_DETAILED',
  'A4_RETAIL',
  'A4_WHOLESALE',
  'A4_KIRANA',
  'A4_MANUFACTURING',
  // Industry templates
  'A4_SERVICES',
  'A4_FREELANCER',
  'A4_MEDICAL',
  'A4_RESTAURANT',
  'A4_TRANSPORT',
  'A4_CONSTRUCTION',
  // Compact & receipt
  'A5_RECEIPT',
  'A5_PROFESSIONAL',
  'A4_LETTERHEAD',
  'A4_TWO_COLUMN',
  'A4_COLORFUL',
  'A4_DARK',
] as const

export type BaseTemplateValue = (typeof BASE_TEMPLATE_ALLOWLIST)[number]

// ─── Error factories (exact codes/messages — ARCHITECTURE §7) ─────────────────

/** 404 — target not owned / missing / soft-deleted (no cross-tenant oracle). */
export function templateNotFoundError(): AppError {
  return new AppError(ErrorCode.TEMPLATE_NOT_FOUND, 404, 'Template not found.')
}

/** 400 — the 21st template create. */
export function templateLimitReachedError(): AppError {
  return new AppError(
    ErrorCode.TEMPLATE_LIMIT_REACHED,
    400,
    `You can create up to ${MAX_TEMPLATES} templates. Delete one to add another.`,
  )
}

/** 400 — deleting a template that is a default for ≥1 document type. */
export function templateIsDefaultError(): AppError {
  return new AppError(
    ErrorCode.TEMPLATE_IS_DEFAULT,
    400,
    'This template is the default for one or more document types. Set another default first.',
  )
}
