/** Party Management — Pure utility functions */

import { AVATAR_COLORS } from './party.constants'

/** Convert paise to rupees display: 500000 → "5,00,000" (Indian numbering) */
export function paisaToRupees(paise: number): string {
  const rupees = Math.abs(paise) / 100
  return rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

/** Format as Rs display: 500000 → "Rs 5,000" */
export function formatAmount(paise: number): string {
  return `Rs ${paisaToRupees(paise)}`
}

/** Format outstanding with sign: positive = receivable, negative = payable */
export function formatOutstanding(paise: number): { text: string; isReceivable: boolean } {
  if (paise === 0) return { text: 'Rs 0', isReceivable: true }
  return {
    text: `Rs ${paisaToRupees(paise)}`,
    isReceivable: paise > 0,
  }
}

/** Get initials from name: "Rahul Traders" → "RT", "Priya" → "PR" */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

/** Deterministic color from name for avatar */
export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Extract PAN from GSTIN (chars 3-12) */
export function extractPanFromGstin(gstin: string): string {
  if (gstin.length === 15) {
    return gstin.slice(2, 12)
  }
  return ''
}

/** Rupees to paise for storage: 500.50 → 50050 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Paise to rupees number: 50050 → 500.50 */
export function paiseToRupeesNum(paise: number): number {
  return paise / 100
}

/** Phone display: "9876543210" → "+91 98765 43210" */
export function formatPhone(phone: string): string {
  if (phone.length === 10) {
    return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`
  }
  return phone
}

/** Relative time: "2 days ago", "Just now" */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffDay > 30) return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHr > 0) return `${diffHr}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'Just now'
}
