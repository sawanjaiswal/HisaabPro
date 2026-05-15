/**
 * entitlement-idb — Dexie-backed cache for the offline entitlement JWT.
 *
 * Stores a single row in IDB (NEVER localStorage — see OFFLINE_RULES.md §4).
 * Includes a clock-rewind monotonic baseline so a user rewinding the device
 * clock can't extend offline grace.
 */

import Dexie, { type Table } from 'dexie'
import type { EntitlementCacheRow } from './subscription.types'
import { CLOCK_REWIND_TOLERANCE_MS } from './subscription.constants'

const DB_NAME = 'hp-entitlement-v1'
const SINGLETON_ID = 'current'

interface EntitlementRow extends EntitlementCacheRow {
  id: string
}

class EntitlementDB extends Dexie {
  rows!: Table<EntitlementRow, string>

  constructor() {
    super(DB_NAME)
    this.version(1).stores({ rows: 'id' })
  }
}

let _db: EntitlementDB | null = null
function db(): EntitlementDB {
  if (!_db) _db = new EntitlementDB()
  return _db
}

export async function getCachedEntitlement(): Promise<EntitlementCacheRow | null> {
  try {
    const row = await db().rows.get(SINGLETON_ID)
    if (!row) return null
    if (row.exp * 1000 < Date.now()) return null
    return row
  } catch {
    return null
  }
}

export async function setCachedEntitlement(input: {
  token: string
  exp: number
  trustedTime: string
}): Promise<void> {
  const trustedMs = Date.parse(input.trustedTime)
  if (Number.isNaN(trustedMs)) return
  const now = Date.now()
  const row: EntitlementRow = {
    id: SINGLETON_ID,
    token: input.token,
    exp: input.exp,
    trustedTime: trustedMs,
    clockSkew: now - trustedMs,
    storedAt: now,
  }
  try {
    await db().rows.put(row)
  } catch {
    /* IDB unavailable — silently degrade to online-only */
  }
}

export async function clearCachedEntitlement(): Promise<void> {
  try {
    await db().rows.clear()
  } catch {
    /* ignore */
  }
}

/**
 * Returns true if the local clock has been rewound beyond tolerance vs the
 * stored trustedTime baseline. Used to refuse a cached JWT and force the
 * user online so the server can re-issue trust.
 */
export function isClockRewound(row: EntitlementCacheRow): boolean {
  const expectedNow = row.storedAt + (Date.now() - row.storedAt)
  // If device clock < stored baseline (minus tolerance), rewind detected.
  return Date.now() + row.clockSkew < row.trustedTime - CLOCK_REWIND_TOLERANCE_MS
    || expectedNow < row.storedAt - CLOCK_REWIND_TOLERANCE_MS
}
