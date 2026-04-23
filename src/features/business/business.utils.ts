import { AVATAR_COLORS } from './business.constants'

/** Get initials from business name. Two letters when the name has multiple
 * words ("Jaiswal Trading" → "JT"); single letter when it's one word
 * ("Sugar" → "S") so we don't surface random character pairs like "SU". */
export function getBusinessInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase()
  }
  return (words[0]?.[0] ?? '?').toUpperCase()
}

/** Deterministic color from businessId for avatar background */
export function getBusinessColor(businessId: string): string {
  let hash = 0
  for (let i = 0; i < businessId.length; i++) {
    hash = businessId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
