import { AVATAR_COLORS } from './business.constants'

/** Get initials from business name. First letter of the first two words when
 * multi-word ("Jaiswal Trading" → "JT"); first two chars when single-word
 * ("Amazon" → "AM"); first char only when the name is one character. */
export function getBusinessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase()
  }
  const first = words[0]
  if (!first) return '?'
  return first.slice(0, 2).toUpperCase()
}

/** Deterministic color from businessId for avatar background */
export function getBusinessColor(businessId: string): string {
  let hash = 0
  for (let i = 0; i < businessId.length; i++) {
    hash = businessId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
