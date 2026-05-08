/** Production Run — utilities */

import { formatPaise } from '@/lib/format'
import type { BomDetailDTO, BomComponentDTO } from '../bom/bom.types'
import type { ComponentAvailability } from './production-run.types'

/** Format ₹ from paise (BigInt serialised as number) */
export function formatCostPaise(paise: number): string {
  return formatPaise(paise)
}

/** Classify component availability based on required vs current stock */
export function classifyAvailability(
  component: BomComponentDTO,
  quantityProduced: number,
): ComponentAvailability {
  const required = parseFloat((component.quantity * quantityProduced).toFixed(3))
  let status: 'ok' | 'low' | 'insufficient'
  if (component.currentStock >= required) status = 'ok'
  else if (component.currentStock > 0) status = 'low'
  else status = 'insufficient'

  return {
    componentProductId: component.componentProductId,
    componentProductName: component.componentProductName,
    required,
    currentStock: component.currentStock,
    unitName: component.unitName,
    status,
  }
}

/** Check if all components have sufficient stock (no HARD_BLOCK) */
export function hasInsufficientStock(avail: ComponentAvailability[]): boolean {
  return avail.some((a) => a.status === 'insufficient')
}

/** Check if any components have low stock (WARN_ONLY) */
export function hasLowStock(avail: ComponentAvailability[]): boolean {
  return avail.some((a) => a.status === 'low')
}

/** Build component availabilities from BOM + quantityProduced */
export function buildAvailabilities(
  bom: BomDetailDTO,
  quantityProduced: number,
): ComponentAvailability[] {
  return bom.components.map((c) => classifyAvailability(c, quantityProduced))
}

/** Format run date for display */
export function formatRunDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Generate a UUID v4 for idempotency key */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID()
}

/** Get today's ISO date string (YYYY-MM-DD) for default run date */
export function todayISODate(): string {
  return new Date().toISOString().slice(0, 10)
}
