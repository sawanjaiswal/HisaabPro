/** PartyAvatar — Single source of truth for all name-based avatars
 *
 * Used for parties, customers, suppliers, staff, products — anywhere
 * we show a colored circle with an initial letter.
 *
 * Sizes: sm (32px), md (44px), lg (56px)
 * Color: stable pastel per name (same name = same color, always)
 */

import React from 'react'
import './party-avatar.css'

// ─── Premium pastel palette ─────────────────────────────────────────────────

const PASTEL_PALETTE = [
  '#D4C5F9', // wisteria
  '#F9D1D1', // rose quartz
  '#C8E6DC', // celadon
  '#F5DEB3', // champagne
  '#D0E1F9', // powder blue
  '#E8D5E0', // dusty rose
  '#CBE4DE', // sage
  '#F0D9C4', // bisque
  '#D5D0EF', // soft iris
  '#DDE5B6', // pistachio
  '#F2C9CF', // blush
  '#C4DAD2', // eucalyptus
] as const

/** Stable color from name — same name always gets same color */
export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PASTEL_PALETTE[Math.abs(hash) % PASTEL_PALETTE.length]
}

/** First letter of name, uppercase. Fallback: "U" */
export function getInitial(name?: string | null): string {
  if (!name) return 'U'
  return name.trim()[0]?.toUpperCase() ?? 'U'
}

// ─── Component ──────────────────────────────────────────────────────────────

interface PartyAvatarProps {
  name: string
  /** sm = 32px, md = 44px (default), lg = 56px */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export const PartyAvatar: React.FC<PartyAvatarProps> = ({
  name,
  size = 'md',
  className = '',
}) => (
  <div
    className={`party-avatar party-avatar--${size} ${className}`}
    style={{ background: getAvatarColor(name) }}
    aria-hidden="true"
  >
    {getInitial(name)}
  </div>
)
