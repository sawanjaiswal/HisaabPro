// ─── Slug client-side validation rules ───────────────────────────────────────
// Backend is authoritative; these mirror server-side rules for instant feedback.

/** Slug must be 3-60 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens */
export const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$|^[a-z0-9]{1,60}$/

/** Reserved slugs — mirrors server-side list */
export const RESERVED_SLUGS = new Set([
  'api', 'admin', 'app', 'auth', 'billing', 'dashboard', 'demo',
  'docs', 'health', 'help', 'invoice', 'login', 'logout', 'me',
  'onboarding', 'p', 'pay', 'pricing', 'privacy', 'public', 'register',
  'reports', 'settings', 'store', 'support', 'terms', 'webhook', 'www',
])

export function validateSlugLocal(slug: string): 'INVALID_SLUG' | 'RESERVED_SLUG' | null {
  if (!SLUG_REGEX.test(slug)) return 'INVALID_SLUG'
  if (RESERVED_SLUGS.has(slug)) return 'RESERVED_SLUG'
  return null
}
