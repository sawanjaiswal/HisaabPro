/**
 * Storefront slug validator — Epic C PR4 (#121).
 *
 * Single source-of-truth for slug rules (ARCHITECTURE §H):
 *   - ASCII only, 3–32 chars, lowercase alphanumeric + internal hyphens
 *   - No leading / trailing hyphen
 *   - Compared against RESERVED_SLUGS after lowercasing
 *
 * Used by: Zod validator, storefront service, (future) admin tools.
 */

import { RESERVED_SLUGS, SLUG_REGEX, isReservedSlug } from './reserved-slugs.js'

export { RESERVED_SLUGS, SLUG_REGEX, isReservedSlug }

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export type SlugValidationCode = 'INVALID_SLUG' | 'RESERVED_SLUG'

export type SlugValidationResult =
  | { ok: true }
  | { ok: false; code: SlugValidationCode }

// ---------------------------------------------------------------------------
// validateSlug
// ---------------------------------------------------------------------------

/**
 * Validates a slug string against the slug rules.
 * Input is NOT lowercased here — normalizeSlug() should be called first
 * if the value comes from user input.
 */
export function validateSlug(slug: string): SlugValidationResult {
  if (!SLUG_REGEX.test(slug)) {
    return { ok: false, code: 'INVALID_SLUG' }
  }
  if (isReservedSlug(slug)) {
    return { ok: false, code: 'RESERVED_SLUG' }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// normalizeSlug
// ---------------------------------------------------------------------------

/**
 * Trims and lowercases user input before validation and DB write.
 * Always call this before validateSlug() on user-supplied values.
 */
export function normalizeSlug(s: string): string {
  return s.trim().toLowerCase()
}
