/**
 * Employee service types — Phase 6 PR6 (architecture §18.7 row 143).
 *
 * Pure service-facing types — mirror the schema-level Zod inputs but carry
 * normalised optional/null semantics (Zod outputs `string | undefined`, we
 * normalise to `string | null` once at the service boundary so downstream
 * Prisma calls don't need ternary unwraps).
 *
 * Architecture: ARCHITECTURE_PHASE6_STAFF_HR §4 + §8.5.
 */

import type { Party, Employee } from '@prisma/client'

/** Caller identity injected by the route handler — never trust req.body for these. */
export interface EmployeeActor {
  userId: string
  businessId: string
}

/** Create-employee input — all paise integers, no decimals, no floats. */
export interface CreateEmployeeInput {
  name: string
  phone?: string | null
  designation?: string | null
  /** Daily rate in PAISE (1 Rs = 100 paise). >= 0, <= 1_000_000. */
  dailyRatePaise: number
  /** Optional User id when the employee also logs into HisaabPro. */
  userId?: string | null
}

/** Partial-update — `partyId` is IMMUTABLE (architecture §8.5 invariant). */
export interface UpdateEmployeeInput {
  name?: string
  phone?: string | null
  designation?: string | null
  dailyRatePaise?: number
  userId?: string | null
  /** ISO string when employee left; null to clear. */
  leftAt?: string | null
}

/** List-employees query input. */
export interface ListEmployeesInput {
  /** Substring of name (case-insensitive). */
  q?: string
  /** Default false — soft-deleted rows hidden. */
  isDeleted?: boolean
  /** 1..100, default 20. */
  limit?: number
  /** Cursor (Employee.id) — keyset pagination. */
  cursor?: string
}

/** Service return shape — caller uses both Employee and paired Party. */
export interface EmployeeWithParty {
  employee: Employee
  party: Party
}

/** Paginated list response. */
export interface EmployeeListResult {
  rows: Employee[]
  nextCursor: string | null
}
