/** Marketing Communications — utilities */

import type { SegmentFilter, MarketingChannel } from './marketing.types'
import { COST_PER_WA_PAISE, COST_PER_SMS_PAISE } from './marketing.constants'

// ─── Segment label formatter ──────────────────────────────────────────────────

export function formatSegmentLabel(filter: SegmentFilter): string {
  const parts: string[] = []

  if (filter.partyType && filter.partyType !== 'BOTH') {
    parts.push(filter.partyType === 'CUSTOMER' ? 'Customers' : 'Suppliers')
  } else {
    parts.push('All contacts')
  }

  if (filter.tags && filter.tags.length > 0) {
    parts.push(`tagged: ${filter.tags.join(', ')}`)
  }

  if (filter.cityContains) {
    parts.push(`city: ${filter.cityContains}`)
  }

  if (filter.inactiveDays != null) {
    parts.push(`inactive ${filter.inactiveDays}+ days`)
  }

  if (filter.outstandingGtePaise != null) {
    const rupees = Math.floor(filter.outstandingGtePaise / 100)
    parts.push(`outstanding > Rs ${rupees.toLocaleString('en-IN')}`)
  }

  if (filter.birthdayThisWeek) {
    parts.push('birthday this week')
  }

  return parts.join(' | ')
}

// ─── Currency formatters ──────────────────────────────────────────────────────

export function formatPaiseAsRupees(paise: number): string {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function formatCostEstimate(channel: MarketingChannel, count: number): string {
  const perMsg = channel === 'WHATSAPP' ? COST_PER_WA_PAISE : COST_PER_SMS_PAISE
  return formatPaiseAsRupees(perMsg * count)
}

// ─── Date / schedule formatters ───────────────────────────────────────────────

export function formatScheduledAt(iso: string | null): string {
  if (!iso) return 'Send immediately'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Template variable substitution (preview only) ───────────────────────────

export function substituteVars(
  body: string,
  vars: Record<string, string>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

// ─── Segment too large guard ──────────────────────────────────────────────────

export const MAX_RECIPIENTS = 10_000
export const SENTINEL_TOO_LARGE = 10_001

export function isTooLarge(count: number): boolean {
  return count >= SENTINEL_TOO_LARGE
}

// ─── idempotency key generator ────────────────────────────────────────────────

export function generateIdempotencyKey(): string {
  return `mk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
