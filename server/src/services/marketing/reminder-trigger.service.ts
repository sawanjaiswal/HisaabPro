/**
 * Reminder Trigger Service — candidate queries per trigger type (PR5)
 * Returns { partyId, fireDate } tuples for next 24h window.
 * No req.* references — pure service.
 */

import { prisma } from '../../lib/prisma.js'
import type { ReminderRule } from '@prisma/client'

export interface Candidate {
  partyId: string
  fireDate: Date
}

/** Normalise a date to UTC midnight (for idempotency key comparison) */
export function normaliseToUtcMidnight(d: Date): Date {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  return out
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function candidatesFor(rule: ReminderRule, now: Date): Promise<Candidate[]> {
  switch (rule.trigger) {
    case 'BIRTHDAY':
      return birthdayCandidates(rule.businessId, rule.offsetDays, now)
    case 'PAYMENT_DUE':
      return paymentDueCandidates(rule.businessId, rule.offsetDays, now)
    case 'PAYMENT_OVERDUE':
      return paymentOverdueCandidates(rule.businessId, rule.offsetDays, now)
    case 'FOLLOWUP':
      return followupCandidates(rule.businessId, rule.offsetDays, now)
    case 'INACTIVE':
      return inactiveCandidates(rule.businessId, rule.offsetDays, now)
    case 'ORDER_DELIVERY':
      return orderDeliveryCandidates(rule.businessId, rule.offsetDays, now)
    case 'APPOINTMENT_UPCOMING':
      return appointmentUpcomingCandidates(rule.businessId, rule.offsetDays, now)
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// BIRTHDAY — fires offsetDays before party's birthday
// ---------------------------------------------------------------------------

async function birthdayCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() + offsetDays * 86_400_000)
  const targetMm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const targetDd = String(targetDate.getDate()).padStart(2, '0')

  const parties = await prisma.party.findMany({
    where: {
      businessId,
      isDeleted: false,
      isActive: true,
      marketingOptOut: false,
      phone: { not: null },
      birthday: { not: null },
    },
    select: { id: true, birthday: true },
  })

  return parties
    .filter((p) => {
      if (!p.birthday) return false
      const mm = String(p.birthday.getMonth() + 1).padStart(2, '0')
      const dd = String(p.birthday.getDate()).padStart(2, '0')
      return mm === targetMm && dd === targetDd
    })
    .map((p) => ({ partyId: p.id, fireDate: normaliseToUtcMidnight(targetDate) }))
}

// ---------------------------------------------------------------------------
// PAYMENT_DUE — fires offsetDays before invoice due date
// ---------------------------------------------------------------------------

async function paymentDueCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() + offsetDays * 86_400_000)
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: { in: ['SALE_INVOICE', 'PURCHASE_ORDER'] },
      isDeleted: false,
      dueDate: { gte: startOfDay, lt: endOfDay },
      balanceDue: { gt: 0 },
      partyId: { not: undefined },
    },
    select: { partyId: true, dueDate: true },
  })

  const seen = new Set<string>()
  const results: Candidate[] = []
  for (const d of docs) {
    if (!d.partyId || seen.has(d.partyId)) continue
    seen.add(d.partyId)
    results.push({ partyId: d.partyId, fireDate: normaliseToUtcMidnight(targetDate) })
  }
  return results
}

// ---------------------------------------------------------------------------
// PAYMENT_OVERDUE — fires offsetDays after due date (overdue)
// ---------------------------------------------------------------------------

async function paymentOverdueCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() - offsetDays * 86_400_000)
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const docs = await prisma.document.findMany({
    where: {
      businessId,
      type: { in: ['SALE_INVOICE'] },
      isDeleted: false,
      dueDate: { gte: startOfDay, lt: endOfDay },
      balanceDue: { gt: 0 },
      partyId: { not: undefined },
    },
    select: { partyId: true },
  })

  const seen = new Set<string>()
  const results: Candidate[] = []
  for (const d of docs) {
    if (!d.partyId || seen.has(d.partyId)) continue
    seen.add(d.partyId)
    results.push({ partyId: d.partyId, fireDate: normaliseToUtcMidnight(now) })
  }
  return results
}

// ---------------------------------------------------------------------------
// FOLLOWUP — fires offsetDays after last transaction
// ---------------------------------------------------------------------------

async function followupCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() - offsetDays * 86_400_000)
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const parties = await prisma.party.findMany({
    where: {
      businessId,
      isDeleted: false,
      isActive: true,
      marketingOptOut: false,
      phone: { not: null },
      lastTransactionAt: { gte: startOfDay, lt: endOfDay },
    },
    select: { id: true },
  })

  return parties.map((p) => ({ partyId: p.id, fireDate: normaliseToUtcMidnight(now) }))
}

// ---------------------------------------------------------------------------
// INACTIVE — parties with no transaction since offsetDays ago
// ---------------------------------------------------------------------------

async function inactiveCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  // Use floor(today/offsetDays)*offsetDays as fireDate for stable deduplication
  const daysSinceEpoch = Math.floor(now.getTime() / (offsetDays * 86_400_000))
  const stableFireDate = new Date(daysSinceEpoch * offsetDays * 86_400_000)

  const cutoff = new Date(now.getTime() - offsetDays * 86_400_000)

  const parties = await prisma.party.findMany({
    where: {
      businessId,
      isDeleted: false,
      isActive: true,
      marketingOptOut: false,
      phone: { not: null },
      lastTransactionAt: { lt: cutoff },
    },
    select: { id: true },
  })

  return parties.map((p) => ({ partyId: p.id, fireDate: normaliseToUtcMidnight(stableFireDate) }))
}

// ---------------------------------------------------------------------------
// ORDER_DELIVERY — fires offsetDays before a CustomOrder's deliveryAt date.
// Day-granular (mirrors PAYMENT_DUE); hour-precision is a future epic.
// ---------------------------------------------------------------------------

async function orderDeliveryCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() + offsetDays * 86_400_000)
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const orders = await prisma.customOrder.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: { in: ['RECEIVED', 'IN_PRODUCTION', 'READY'] },
      deliveryAt: { gte: startOfDay, lt: endOfDay },
    },
    select: { partyId: true },
  })

  const seen = new Set<string>()
  const results: Candidate[] = []
  for (const o of orders) {
    if (seen.has(o.partyId)) continue
    seen.add(o.partyId)
    results.push({ partyId: o.partyId, fireDate: normaliseToUtcMidnight(targetDate) })
  }
  return results
}

// ---------------------------------------------------------------------------
// APPOINTMENT_UPCOMING — fires offsetDays before an Appointment.startAt.
// Day-granular (mirrors ORDER_DELIVERY); hour-precision deferred to a future epic.
// Only SCHEDULED + CONFIRMED appointments are eligible; partyId-null rows are
// excluded so the dispatcher always has a recipient. Dedup by partyId is handled
// here; cross-tick dedup is handled by ReminderInstance unique (ruleId, partyId,
// fireDate).
// ---------------------------------------------------------------------------

async function appointmentUpcomingCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = new Date(now.getTime() + offsetDays * 86_400_000)
  const startOfDay = new Date(targetDate)
  startOfDay.setUTCHours(0, 0, 0, 0)
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000)

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startAt: { gte: startOfDay, lt: endOfDay },
      partyId: { not: null },
    },
    select: { partyId: true },
  })

  const seen = new Set<string>()
  const results: Candidate[] = []
  for (const a of appointments) {
    if (!a.partyId || seen.has(a.partyId)) continue
    seen.add(a.partyId)
    results.push({ partyId: a.partyId, fireDate: normaliseToUtcMidnight(targetDate) })
  }
  return results
}
