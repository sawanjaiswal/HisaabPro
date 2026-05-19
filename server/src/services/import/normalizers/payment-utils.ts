/**
 * Phase 7 · 7.1D — Payment normalizer utility helpers (pure).
 *
 * Holds:
 *   - `truncateReference(raw)` — tail-100 truncation SSOT. ARCH §2.4 +
 *     SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md cleared S3. WHY tail-not-head:
 *     Razorpay/RBI references carry the unique discriminator in the
 *     LAST segment; truncating from the head loses uniqueness, truncating
 *     from the tail loses the prefix (recoverable from context).
 *     **Collision blind spot:** two refs sharing trailing 100 chars but
 *     differing in the 101st+ ARE permitted to coexist by design (see
 *     `Payment.referenceNumber @db.VarChar(100)` schema line 1279) — DO
 *     NOT add `@@unique([businessId, referenceNumber])` (would 500-error
 *     legitimate distinct truncated refs). Dedup key excludes reference.
 *
 *   - `tallyPreformatDate(raw)` — M13 fix from
 *     SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1. Tally exports `<DATE>`
 *     as `YYYYMMDD` (8 ASCII digits). Pre-format to `YYYY-MM-DD` BEFORE
 *     handing off to the shared `parseInvoiceDate`, WITH explicit
 *     calendar round-trip validation. Returns `null` for invalid
 *     calendars so the caller emits `INVALID_DATE`. Defence-in-depth
 *     even though `parseInvoiceDate` ALSO calls `valid()` — protects
 *     against future refactors of the shared parser.
 *
 * Authority:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M13 + §2 cleared S3
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §2.4 L150-153, §7 row 8
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md L412-414, L587, L807
 */

export const REFERENCE_TRUNCATE_FROM: 'tail' = 'tail'
export const REFERENCE_MAX_LEN = 100

export interface TruncatedReference {
  value: string
  truncated: boolean
}

export function truncateReference(raw: string | null | undefined): TruncatedReference | null {
  if (raw === null || raw === undefined) return null
  const trimmed = String(raw).normalize('NFKC').trim()
  if (trimmed.length === 0) return null
  if (trimmed.length <= REFERENCE_MAX_LEN) {
    return { value: trimmed, truncated: false }
  }
  return { value: trimmed.slice(-REFERENCE_MAX_LEN), truncated: true }
}

/**
 * Pre-format Tally `YYYYMMDD` to `YYYY-MM-DD` WITH calendar validation.
 *
 * Behaviour:
 *   - Not 8-digit → return input unchanged so the shared parser can try
 *     its other formats (Tally occasionally emits ISO too).
 *   - 8-digit but invalid calendar (month > 12, day > daysInMonth,
 *     year out of range) → return `null`. Caller raises `INVALID_DATE`.
 *   - 8-digit valid calendar → return `"YYYY-MM-DD"` for handoff.
 */
export function tallyPreformatDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const folded = raw.normalize('NFKC').trim()
  if (!/^\d{8}$/.test(folded)) return folded // pass-through to shared parser
  const y = Number(folded.slice(0, 4))
  const m = Number(folded.slice(4, 6))
  const d = Number(folded.slice(6, 8))
  if (y < 1900 || y > 2999) return null
  if (m < 1 || m > 12) return null
  if (d < 1 || d > 31) return null
  // Calendar round-trip — UTC-anchored so DST does not roll the day.
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null
  }
  const mm = m < 10 ? `0${m}` : String(m)
  const dd = d < 10 ? `0${d}` : String(d)
  return `${y}-${mm}-${dd}`
}
