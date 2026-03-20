import { STATUS_COLORS } from './serial-number.constants'
import type { SerialStatus } from './serial-number.types'

/** Returns inline style for status badge */
export function getStatusBadgeStyle(status: SerialStatus): { background: string; color: string } {
  const colors = STATUS_COLORS[status]
  return { background: colors.bg, color: colors.text }
}

/** Format ISO date to human-readable (e.g. "15 Mar 2026") */
export function formatSerialDate(date: string | null): string {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Parse a text block into unique serial numbers (split by newline, comma, or semicolon) */
export function parseSerialNumbers(text: string): string[] {
  const parts = text.split(/[,;\n]+/)
  const trimmed = parts.map((s) => s.trim()).filter(Boolean)
  return [...new Set(trimmed)]
}
