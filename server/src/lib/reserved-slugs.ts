/**
 * Reserved slugs — cannot be used as storefront slugs (Epic C, PR4).
 * This list is the SSOT; the Zod validator and DB write path both call isReservedSlug().
 */
export const RESERVED_SLUGS: readonly string[] = [
  'admin',
  'api',
  'p',
  'public',
  'www',
  'app',
  'login',
  'signup',
  'signin',
  'logout',
  'billing',
  'settings',
  'dashboard',
  'account',
  'user',
  'users',
  'party',
  'parties',
  'invoice',
  'invoices',
  'product',
  'products',
  'payment',
  'payments',
  'report',
  'reports',
  'support',
  'help',
  'terms',
  'privacy',
  'about',
  'contact',
] as const;

/**
 * Valid storefront slug: 2–32 chars, lowercase alphanumeric + hyphens,
 * must start and end with an alphanumeric character.
 *
 * Examples: "raju-traders", "r1", "abc"
 * Invalid:  "-start", "end-", "A", "a--b" (double hyphen allowed by regex, reject via UX if desired)
 */
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/**
 * Returns true if the slug is on the reserved list.
 * Input is lowercased before comparison so callers don't need to pre-normalize.
 */
export function isReservedSlug(s: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(s.toLowerCase());
}
