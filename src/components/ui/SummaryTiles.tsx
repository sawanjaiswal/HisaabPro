/** SummaryTiles — light bordered stat-tile row for detail pages.
 *
 * Matches the GPT "new design" detail-page pattern: a horizontal row of
 * bordered tiles, each a small muted label above a single toned value.
 * Reused across Customer / Invoice / Payment detail pages. Pure display —
 * the parent owns loading/error/empty. Amounts are pre-formatted strings so
 * this stays domain-agnostic (paise formatting happens at the call site).
 */

import React from 'react'
import './summary-tiles.css'

export type SummaryTileTone = 'neutral' | 'due' | 'paid' | 'sales' | 'info'

export interface SummaryTile {
  /** Stable key for React + aria wiring. */
  id: string
  /** Already-translated label (e.g. t.totalDue). */
  label: string
  /** Already-formatted value (e.g. formatAmount(paise)). */
  value: string
  /** Colours the value: due=red, sales=green, paid=green, info=blue, neutral=primary text. */
  tone?: SummaryTileTone
  /** Optional subtitle under the value (e.g. "12 Invoices", "Overdue"). */
  hint?: string
  /** When set, colours the hint with this tone (default: muted). */
  hintTone?: SummaryTileTone
  /** Optional leading icon rendered in a tinted circle (lucide node). */
  icon?: React.ReactNode
  /** Tints the icon circle; defaults to the tile `tone`. */
  iconTone?: SummaryTileTone
}

/**
 * `tile` — bordered cards, one per stat (the original detail-page look).
 * `divided` — a single flush strip split by hairline rules, no card borders and
 * no icon circles. This is the entity-detail header treatment: it reads as one
 * band of numbers rather than three competing cards, which is what lets four
 * stats fit where three cards used to.
 */
export type SummaryTilesVariant = 'tile' | 'divided'

interface SummaryTilesProps {
  tiles: SummaryTile[]
  variant?: SummaryTilesVariant
  className?: string
  'aria-label'?: string
}

export const SummaryTiles: React.FC<SummaryTilesProps> = ({
  tiles,
  variant = 'tile',
  className = '',
  'aria-label': ariaLabel,
}) => {
  if (tiles.length === 0) return null

  // The divided strip is deliberately icon-free — a tinted circle per column
  // reintroduces the visual weight the variant exists to remove.
  const showIcons = variant !== 'divided'

  return (
    <div
      className={`summary-tiles summary-tiles--${variant} ${className}`.trim()}
      role="list"
      aria-label={ariaLabel}
    >
      {tiles.map((tile) => (
        <div key={tile.id} className={`summary-tile summary-tile--${tile.tone ?? 'neutral'}${tile.icon && showIcons ? ' summary-tile--has-icon' : ''}`} role="listitem">
          {tile.icon && showIcons && (
            <span
              className={`summary-tile__icon summary-tile__icon--${tile.iconTone ?? tile.tone ?? 'neutral'}`}
              aria-hidden="true"
            >
              {tile.icon}
            </span>
          )}
          <span className="summary-tile__body">
            <span className="summary-tile__label">{tile.label}</span>
            <span className={`summary-tile__value summary-tile__value--${tile.tone ?? 'neutral'}`}>
              {tile.value}
            </span>
            {tile.hint && (
              <span className={`summary-tile__hint${tile.hintTone ? ` summary-tile__hint--${tile.hintTone}` : ''}`}>
                {tile.hint}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}
