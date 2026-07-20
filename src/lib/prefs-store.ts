/**
 * Local UI preference store — Dexie-backed key/value
 *
 * For small, non-entity UI preferences that must survive an app restart:
 * favourite reports, collapsed sections, last-used filter tab. NOT for entity
 * data (that lives in the offline cache) and NOT for credentials.
 *
 * Why not localStorage: `.claude/rules/OFFLINE_RULES.md` Rule 4 — synchronous,
 * 5 MB capped, and `scripts/enforce-offline.mjs` ratchets feature-code writes
 * to zero. IndexedDB is the sanctioned store, so preferences get one module
 * instead of a per-feature scattering of ad-hoc keys.
 *
 * Values are JSON-serialised. Every operation is failure-tolerant: private
 * browsing or a quota error degrades to the caller-supplied fallback rather
 * than throwing into a render path.
 */

import Dexie from 'dexie'

const DB_NAME = 'hisaabpro-prefs'
const DB_VERSION = 1

interface PrefRow {
  /** Namespaced key, e.g. "reports:favourites" — primary key */
  key: string
  /** Stringified JSON value */
  value: string
  updatedAt: number
}

class PrefsDB extends Dexie {
  prefs!: Dexie.Table<PrefRow, string>

  constructor() {
    super(DB_NAME)
    this.version(DB_VERSION).stores({ prefs: 'key, updatedAt' })
  }
}

const db = new PrefsDB()

/** Read a preference; returns `fallback` when unset or unreadable. */
export async function getPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.prefs.get(key)
    if (!row) return fallback
    return JSON.parse(row.value) as T
  } catch {
    return fallback
  }
}

/** Write a preference. Silently no-ops when storage is unavailable. */
export async function setPref<T>(key: string, value: T): Promise<void> {
  try {
    await db.prefs.put({ key, value: JSON.stringify(value), updatedAt: Date.now() })
  } catch {
    // Quota / private browsing — preferences are best-effort
  }
}

/** Remove a single preference. */
export async function removePref(key: string): Promise<void> {
  try {
    await db.prefs.delete(key)
  } catch {
    // Best-effort
  }
}

/** Drop every stored preference — called on logout alongside the API cache. */
export async function clearPrefs(): Promise<void> {
  try {
    await db.prefs.clear()
  } catch {
    // Best-effort
  }
}
