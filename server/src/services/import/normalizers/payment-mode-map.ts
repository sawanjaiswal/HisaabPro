/**
 * Phase 7 · 7.1D — Payment mode resolver.
 *
 * Two pure functions:
 *   - `normaliseKey(raw)`: NFKC + lowercase + trim + whitespace collapse.
 *     Returns `null` if the post-normalise string is empty.
 *   - `resolveMode(raw, strictMode)`: looks the key up in
 *     `PAYMENT_MODE_MAP` via `.get()` (M12 prototype-pollution defence)
 *     and returns one of:
 *       { mode: <hit>, defaulted: false, unknown: false }
 *       { mode: 'OTHER', defaulted: true,  unknown: true  }  (strictMode=false)
 *       { mode: null,   defaulted: false, unknown: true  }  (strictMode=true)
 *
 * The caller distinguishes the third shape from the second to raise
 * `MODE_UNKNOWN_STRICT` vs `MODE_UNKNOWN_DEFAULTED` (PaymentIssueCode).
 *
 * Authority:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M12
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §2.3
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md L156, L170, L406-408, L847
 */

import {
  PAYMENT_MODE_MAP,
  type PaymentMode,
} from './payment-mode-map.constants.js'

/**
 * Pure normaliser — used by BOTH the seeding step in the constants file
 * (transitively, via human-typed lowercase entries) AND every lookup. If
 * this fn ever changes, the table keys must change to match.
 */
export function normaliseKey(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  return trimmed.length === 0 ? null : trimmed
}

export interface ResolvedMode {
  mode: PaymentMode | null
  defaulted: boolean // true when fallback to OTHER fired (strictMode=false)
  unknown: boolean // true when the raw value was not in the dictionary
}

/**
 * Resolve a source `mode` string to one of the seven closed
 * `PaymentMode` values.
 *
 * Empty / null / whitespace-only input is treated identically to an
 * unknown value (defensible default for parsers that pass `''` for
 * missing columns — we never want to throw on a benign blank).
 */
export function resolveMode(raw: string | null | undefined, strictMode: boolean): ResolvedMode {
  if (raw === null || raw === undefined) {
    return strictMode
      ? { mode: null, defaulted: false, unknown: true }
      : { mode: 'OTHER', defaulted: true, unknown: true }
  }
  const key = normaliseKey(raw)
  if (key === null) {
    return strictMode
      ? { mode: null, defaulted: false, unknown: true }
      : { mode: 'OTHER', defaulted: true, unknown: true }
  }
  // M12: prototype-clean lookup. `.get()` returns `undefined` for absent
  // keys AND for any of `__proto__` / `constructor` / `toString` — there
  // is no `Object.prototype` fallthrough.
  const hit = PAYMENT_MODE_MAP.get(key)
  if (hit === undefined) {
    return strictMode
      ? { mode: null, defaulted: false, unknown: true }
      : { mode: 'OTHER', defaulted: true, unknown: true }
  }
  return { mode: hit, defaulted: false, unknown: false }
}
