/** Production Run — constants */

export const PR_PAGE_LIMIT = 20

// Status labels are i18n'd at call sites (t.prStatus*); only the badge class map
// stays here since CSS classes are not translatable.
export const PR_STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: 'badge badge--warning',
  COMPLETED: 'badge badge--success',
  CANCELLED: 'badge badge--error',
}
