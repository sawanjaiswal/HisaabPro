import type { ShortcutConfig } from './settings.types'

// ─── Transaction Lock Formatting ─────────────────────────────────────────────

/**
 * Returns a human-readable string for a lock period value.
 * null means the feature is disabled ("Never").
 */
export function formatLockPeriod(days: number | null): string {
  if (days === null) return 'Never'
  if (days === 1) return '1 day'
  return `${days} days`
}

// ─── Time Ago ─────────────────────────────────────────────────────────────────

/**
 * Returns a short, human-friendly relative time string.
 * All comparisons are done in UTC using Date.parse so there is no dependency
 * on external libraries.
 */
export function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const then = Date.parse(iso)

  if (Number.isNaN(then)) return '\u2014'

  const diffMs = now - then

  if (diffMs < 0) return 'Just now'               // clock skew guard
  if (diffMs < 60_000) return 'Just now'           // < 1 min
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000)
    return `${mins}m ago`
  }
  if (diffMs < 86_400_000) {
    const hrs = Math.floor(diffMs / 3_600_000)
    return `${hrs}h ago`
  }
  const days = Math.floor(diffMs / 86_400_000)
  if (days < 30) return `${days}d ago`
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months}mo ago`
  }
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

// ─── Keyboard Shortcut Formatting ────────────────────────────────────────────

/**
 * Returns a display string for a shortcut config.
 * e.g. { key: 'n', ctrl: true } → "Ctrl + N"
 */
export function formatShortcutKey(config: ShortcutConfig): string {
  const parts: string[] = []

  if (config.ctrl)  parts.push('Ctrl')
  if (config.alt)   parts.push('Alt')
  if (config.shift) parts.push('Shift')

  // Special key display names
  const KEY_DISPLAY: Record<string, string> = {
    Enter:  'Enter',
    Escape: 'Esc',
    Tab:    'Tab',
    ' ':    'Space',
  }

  const keyLabel = KEY_DISPLAY[config.key] ?? config.key.toUpperCase()
  parts.push(keyLabel)

  return parts.join(' + ')
}
