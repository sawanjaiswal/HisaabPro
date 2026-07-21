/**
 * Reminder Trigger Service — candidate queries per trigger type (PR5)
 * Returns { partyId, fireDate } tuples for next 24h window.
 * No req.* references — pure service.
 *
 * Date-window and dedup helpers live in `reminder-trigger.utils.ts`.
 */

import { prisma } from '../../lib/prisma.js'
import type { ReminderRule } from '@prisma/client'
import {
  CONTACTABLE_PARTY,
  DAY_MS,
  dayWindow,
  dedupeByParty,
  normaliseToUtcMidnight,
  shiftDays,
} from './reminder-trigger.utils.js'
import type { Candidate } from './reminder-trigger.utils.js'

// Re-exported so existing callers (reminder-cron.service, tests) keep one import surface.
export { normaliseToUtcMidnight }
export type { Candidate }

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
  const targetDate = shiftDays(now, offsetDays)
  const targetMm = String(targetDate.getMonth() + 1).padStart(2, '0')
  const targetDd = String(targetDate.getDate()).padStart(2, '0')

  // Month/day matching can't be expressed in a Prisma where — the year differs
  // on every stored birthday — so eligible parties are filtered in JS.
  const parties = await prisma.party.findMany({
    where: { businessId, ...CONTACTABLE_PARTY, birthday: { not: null } },
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
  const targetDate = shiftDays(now, offsetDays)
  const { startOfDay, endOfDay } = dayWindow(targetDate)

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

  return dedupeByParty(docs, targetDate)
}

// ---------------------------------------------------------------------------
// PAYMENT_OVERDUE — fires offsetDays after due date (overdue)
// ---------------------------------------------------------------------------

async function paymentOverdueCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const targetDate = shiftDays(now, -offsetDays)
  const { startOfDay, endOfDay } = dayWindow(targetDate)

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

  // Fires on `now`, not the (past) due date — the reminder is about today.
  return dedupeByParty(docs, now)
}

// ---------------------------------------------------------------------------
// FOLLOWUP — fires offsetDays after last transaction
// ---------------------------------------------------------------------------

async function followupCandidates(
  businessId: string,
  offsetDays: number,
  now: Date,
): Promise<Candidate[]> {
  const { startOfDay, endOfDay } = dayWindow(shiftDays(now, -offsetDays))

  const parties = await prisma.party.findMany({
    where: {
      businessId,
      ...CONTACTABLE_PARTY,
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
  // Bucket the fireDate to a floor(now / offsetDays) boundary so repeated ticks
  // inside one window produce the same key and the ReminderInstance unique
  // constraint dedupes them.
  const daysSinceEpoch = Math.floor(now.getTime() / (offsetDays * DAY_MS))
  const stableFireDate = new Date(daysSinceEpoch * offsetDays * DAY_MS)
  const cutoff = shiftDays(now, -offsetDays)

  const parties = await prisma.party.findMany({
    where: { businessId, ...CONTACTABLE_PARTY, lastTransactionAt: { lt: cutoff } },
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
  const targetDate = shiftDays(now, offsetDays)
  const { startOfDay, endOfDay } = dayWindow(targetDate)

  const orders = await prisma.customOrder.findMany({
    where: {
      businessId,
      isDeleted: false,
      status: { in: ['RECEIVED', 'IN_PRODUCTION', 'READY'] },
      deliveryAt: { gte: startOfDay, lt: endOfDay },
    },
    select: { partyId: true },
  })

  return dedupeByParty(orders, targetDate)
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
  const targetDate = shiftDays(now, offsetDays)
  const { startOfDay, endOfDay } = dayWindow(targetDate)

  const appointments = await prisma.appointment.findMany({
    where: {
      businessId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startAt: { gte: startOfDay, lt: endOfDay },
      partyId: { not: null },
    },
    select: { partyId: true },
  })

  return dedupeByParty(appointments, targetDate)
}
