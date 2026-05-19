/**
 * Phase 7 Slice 7.1A FE.3 — Filter chips above the preview table.
 *
 * Renders as a horizontally-scrollable row of pill buttons; the active
 * chip is filled, others are outlined. Each chip shows a count derived
 * client-side from the loaded rows (so the badge reflects what is
 * actually paginated in — not just the server `counts`, which represent
 * the *full* job).
 */

import type { PreviewFilterKey } from '../utils/preview-filters'

interface PreviewFiltersProps {
  active: PreviewFilterKey
  onChange: (key: PreviewFilterKey) => void
  countTotal: number
  countValid: number
  countErrors: number
  countDuplicates: number
  t: Record<string, string>
}

interface Chip {
  key: PreviewFilterKey
  labelKey: string
  fallback: string
  count: number
}

export function PreviewFilters({
  active,
  onChange,
  countTotal,
  countValid,
  countErrors,
  countDuplicates,
  t,
}: PreviewFiltersProps) {
  const chips: Chip[] = [
    { key: 'all', labelKey: 'importPreviewFilterAll', fallback: 'All', count: countTotal },
    { key: 'valid', labelKey: 'importPreviewFilterValid', fallback: 'Valid', count: countValid },
    { key: 'errors', labelKey: 'importPreviewFilterErrors', fallback: 'Errors', count: countErrors },
    {
      key: 'duplicates',
      labelKey: 'importPreviewFilterDuplicates',
      fallback: 'Duplicates',
      count: countDuplicates,
    },
  ]

  return (
    <div
      role="tablist"
      aria-label={t.importPreviewFiltersAriaLabel ?? 'Filter preview rows'}
      className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1"
    >
      {chips.map((chip) => {
        const isActive = chip.key === active
        return (
          <button
            key={chip.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(chip.key)}
            className="inline-flex items-center gap-2 rounded-[var(--radius-full)] px-3 min-h-[44px] shrink-0 font-medium transition-colors"
            style={{
              fontSize: 'var(--fs-sm)',
              backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-gray-0)',
              color: isActive ? 'var(--color-on-primary, var(--color-gray-0))' : 'var(--color-text-primary)',
              border: `1px solid ${isActive ? 'var(--color-primary)' : 'var(--color-gray-100)'}`,
            }}
          >
            <span>{t[chip.labelKey] ?? chip.fallback}</span>
            <span
              className="tabular-nums rounded-[var(--radius-full)] px-2"
              style={{
                fontSize: 'var(--fs-xs)',
                backgroundColor: isActive
                  ? 'var(--color-on-primary-soft, rgba(255,255,255,0.2))'
                  : 'var(--color-gray-50)',
                color: 'inherit',
              }}
            >
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
