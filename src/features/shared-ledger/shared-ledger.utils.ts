/** Shared Ledger — Pure utility functions */

import type { LedgerShare } from './shared-ledger.types'

/** Build the full shareable URL for a ledger share */
export function buildShareUrl(shareToken: string): string {
  return `${window.location.origin}/public/ledger/${shareToken}`
}

/** Check if a share has expired */
export function isShareExpired(share: LedgerShare): boolean {
  if (!share.expiresAt) return false
  return new Date(share.expiresAt) < new Date()
}

/** Format expiry label */
export function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return 'Never'
  const date = new Date(expiresAt)
  const now = new Date()
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'Expired'
  if (diffDays === 0) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  return `Expires in ${diffDays} days`
}

/** Copy text to clipboard */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
