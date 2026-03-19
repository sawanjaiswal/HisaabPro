import { AVATAR_COLORS } from './business.constants'

/** Get 2-letter initials from business name */
export function getBusinessInitials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/** Deterministic color from businessId for avatar background */
export function getBusinessColor(businessId: string): string {
  let hash = 0
  for (let i = 0; i < businessId.length; i++) {
    hash = businessId.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
