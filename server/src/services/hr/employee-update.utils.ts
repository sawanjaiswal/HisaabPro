/**
 * Employee update — pure patch/diff builders (architecture §8.5).
 *
 * Split out of `employee.service.ts` so the service file holds transaction
 * orchestration only. Nothing here touches Prisma or the network — every
 * function is a pure transform over plain objects, which is what makes the
 * update path unit-testable without a database.
 *
 * Semantics shared by both builders: a key is only considered when it is
 * `!== undefined` (absent = "don't touch"); an explicit `null` means
 * "clear the field".
 */

import type { UpdateEmployeeInput } from './employee.types.js'

/** The subset of an Employee row the update path reads before patching. */
export interface ExistingEmployeeSnapshot {
  name: string
  phone: string | null
  designation: string | null
  dailyRate: number
  userId: string | null
  leftAt: Date | null
}

/** Prisma `data` payload for the Employee row. */
export function buildEmployeePatch(input: UpdateEmployeeInput): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.phone !== undefined) data.phone = input.phone
  if (input.designation !== undefined) data.designation = input.designation
  if (input.dailyRatePaise !== undefined) data.dailyRate = input.dailyRatePaise
  if (input.userId !== undefined) data.userId = input.userId
  if (input.leftAt !== undefined) {
    data.leftAt = input.leftAt === null ? null : new Date(input.leftAt)
  }
  return data
}

/**
 * Prisma `data` payload for the paired STAFF Party row.
 *
 * Only name/phone mirror across — the party-ledger view surfaces those two,
 * and letting them drift would show stale names against real transactions.
 * Returns an empty object when nothing mirrors, so callers can skip the write.
 */
export function buildPairedPartyPatch(input: UpdateEmployeeInput): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) patch.name = input.name
  if (input.phone !== undefined) patch.phone = input.phone
  return patch
}

/**
 * Audit diff — changed fields only, as `{ old, new }` pairs.
 *
 * A field present in `input` but equal to the stored value is omitted, so the
 * audit log records real changes rather than every key the client happened to
 * send. `leftAt` is the exception: it is always recorded when present, because
 * the Date-vs-ISO-string comparison is not reliable enough to skip on.
 */
export function buildEmployeeAuditDiff(
  input: UpdateEmployeeInput,
  existing: ExistingEmployeeSnapshot,
): Record<string, { old: unknown; new: unknown }> {
  const diff: Record<string, { old: unknown; new: unknown }> = {}
  if (input.name !== undefined && input.name !== existing.name) {
    diff.name = { old: existing.name, new: input.name }
  }
  if (input.phone !== undefined && input.phone !== existing.phone) {
    diff.phone = { old: existing.phone, new: input.phone }
  }
  if (input.designation !== undefined && input.designation !== existing.designation) {
    diff.designation = { old: existing.designation, new: input.designation }
  }
  if (input.dailyRatePaise !== undefined && input.dailyRatePaise !== existing.dailyRate) {
    diff.dailyRate = { old: existing.dailyRate, new: input.dailyRatePaise }
  }
  if (input.userId !== undefined && input.userId !== existing.userId) {
    diff.userId = { old: existing.userId, new: input.userId }
  }
  if (input.leftAt !== undefined) {
    diff.leftAt = { old: existing.leftAt, new: input.leftAt }
  }
  return diff
}
