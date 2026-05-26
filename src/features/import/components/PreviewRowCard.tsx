/**
 * Phase 7 Slice 7.1A FE.3 — Row status badge.
 *
 * The shared `<Badge>` primitive only ships invoice-flavoured variants
 * (paid/pending/overdue/draft/info) — the import preview needs a
 * different colour map (valid → success, error → danger, duplicate →
 * warning, etc.). Rather than bloat the global Badge enum for a single
 * surface we render the chip inline here using design tokens only.
 *
 * Naming: lives at `PreviewRowCard.tsx` per the file plan, but the
 * concern is "row status chip" — the responsive table primitive owns
 * the row card shell. Exporting both the status chip and a tiny
 * mobile-detail helper keeps every consumer in one file.
 */

import type { ImportPreviewRow } from '../types/import.types'

interface StatusVisual {
  bg: string
  fg: string
  border: string
}

function statusVisual(status: ImportPreviewRow['status']): StatusVisual {
  switch (status) {
    case 'STAGED':
    case 'WARNING':
      return {
        bg: 'var(--color-success-soft, var(--color-gray-50))',
        fg: 'var(--color-success, var(--color-text-primary))',
        border: 'var(--color-success, var(--color-gray-100))',
      }
    case 'ERROR':
      return {
        bg: 'var(--color-danger-soft, var(--color-gray-50))',
        fg: 'var(--color-danger, var(--color-text-primary))',
        border: 'var(--color-danger, var(--color-gray-100))',
      }
    case 'DUPLICATE_EXACT':
    case 'DUPLICATE_NEAR':
      return {
        bg: 'var(--color-warning-soft, var(--color-gray-50))',
        fg: 'var(--color-warning, var(--color-text-primary))',
        border: 'var(--color-warning, var(--color-gray-100))',
      }
    case 'COMMITTED':
      return {
        bg: 'var(--color-info-soft, var(--color-gray-50))',
        fg: 'var(--color-info, var(--color-text-primary))',
        border: 'var(--color-info, var(--color-gray-100))',
      }
    case 'SKIPPED':
    default:
      return {
        bg: 'var(--color-gray-50)',
        fg: 'var(--color-text-secondary)',
        border: 'var(--color-gray-100)',
      }
  }
}

interface PreviewStatusBadgeProps {
  status: ImportPreviewRow['status']
  t: Record<string, string>
}

export function PreviewStatusBadge({ status, t }: PreviewStatusBadgeProps) {
  const v = statusVisual(status)
  const labelKey = `importPreviewStatus_${status}`
  const fallback: Record<typeof status, string> = {
    STAGED: 'Valid',
    WARNING: 'Warning',
    ERROR: 'Error',
    DUPLICATE_EXACT: 'Duplicate',
    DUPLICATE_NEAR: 'Near duplicate',
    COMMITTED: 'Committed',
    SKIPPED: 'Skipped',
  }

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 font-medium"
      style={{
        fontSize: 'var(--fs-xs)',
        backgroundColor: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {t[labelKey] ?? fallback[status]}
    </span>
  )
}
