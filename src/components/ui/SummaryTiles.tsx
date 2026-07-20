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

interface SummaryTilesProps {
  tiles: SummaryTile[]
  className?: string
  'aria-label'?: string
}

export const SummaryTiles: React.FC<SummaryTilesProps> = ({
  tiles,
  className = '',
  'aria-label': ariaLabel,
}) => {
  if (tiles.length === 0) return null

  return (
    <div
      className={`summary-tiles ${className}`.trim()}
      role="list"
      aria-label={ariaLabel}
    >
      {tiles.map((tile) => (
        <div key={tile.id} className={`summary-tile summary-tile--${tile.tone ?? 'neutral'}${tile.icon ? ' summary-tile--has-icon' : ''}`} role="listitem">
          {tile.icon && (
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
