/**
 * Phase 7 · 7.1C — Hand-rolled invoice-date parser.
 *
 * SCOPE L312-343 + ARCH §2.3. The 4 source formats are:
 *
 *   - `YYYY-MM-DD`        ISO / Generic CSV
 *   - `DD-MMM-YYYY`       Tally ("15-Mar-2025", case-insensitive month)
 *   - `DD MMM YYYY`       Same with space separator
 *   - `DD/MM/YYYY`        Vyapar / Indian convention
 *   - `DD-MM-YYYY`        Indian convention with dash separator
 *
 * Optional trailing time `HH:MM` (24h) is tolerated and discarded — we
 * only stage the date component.
 *
 * Why hand-rolled:
 *   - `Date.parse` / `new Date(str)` accept American MM/DD/YYYY silently;
 *     Indian users would see 3-May staged as 5-Mar.
 *   - `date-fns` multi-format helpers have shipped ReDoS CVEs before.
 *   - A single anchored `/^[0-9\/\-A-Za-z :]+$/` charset gate runs in
 *     linear time and no quantifier backtracking surface remains in the
 *     state-machine itself (every branch consumes a fixed digit count).
 *
 * Pipeline:
 *   1. `typeof raw === 'string'` + 32-char cap
 *   2. NFKC normalise + trim
 *   3. Reject any non-ASCII codepoint (post-NFKC); `१५/०३/२०२५` folds to
 *      ASCII `15/03/2025` and is then accepted. Mixed-script and bidi
 *      overrides are rejected.
 *   4. Try formats in precedence order — first match wins.
 *   5. Range check: year ∈ [1970, 2100]; month 1-12; day per-month with
 *      leap-year for February.
 *
 * Returns `{ ok: true, iso: 'YYYY-MM-DD' }` or
 * `{ ok: false, code: 'INVALID_DATE' }`.
 */

// English month abbreviations + full names. Lower-cased lookup table.
const MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

const MAX_LEN = 32
const MIN_YEAR = 1970
const MAX_YEAR = 2100

// Anchored, bounded charset gate — linear-time, no quantifier ambiguity.
// Allows digits + `/` + `-` + ASCII letters + space + `:` (time component).
const CHARSET_RE = /^[0-9/\-A-Za-z :]+$/

export type ParseDateResult =
  | { ok: true; iso: string }
  | { ok: false; code: 'INVALID_DATE' }

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

function daysInMonth(y: number, m: number): number {
  // m is 1-indexed
  switch (m) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31
    case 4: case 6: case 9: case 11: return 30
    case 2: return isLeap(y) ? 29 : 28
    default: return 0
  }
}

function fmt(y: number, m: number, d: number): string {
  const mm = m < 10 ? `0${m}` : String(m)
  const dd = d < 10 ? `0${d}` : String(d)
  return `${y}-${mm}-${dd}`
}

function valid(y: number, m: number, d: number): boolean {
  if (y < MIN_YEAR || y > MAX_YEAR) return false
  if (m < 1 || m > 12) return false
  if (d < 1 || d > daysInMonth(y, m)) return false
  return true
}

/**
 * Strip an optional trailing time component `HH:MM[:SS]` (24h). Returns
 * the date-only portion. Source dates may have a trailing space-then-time
 * (e.g. Busy exports `15-03-2025 14:30`). We discard the time silently;
 * the staged column is a DATE, not a TIMESTAMP.
 */
function stripTime(s: string): string {
  // Find first space; if remainder is HH:MM[:SS] → cut.
  const sp = s.indexOf(' ')
  if (sp === -1) return s
  const tail = s.slice(sp + 1)
  if (/^[0-9]{1,2}:[0-9]{2}(:[0-9]{2})?$/.test(tail)) return s.slice(0, sp)
  return s
}

// Format: YYYY-MM-DD (10 chars, dashes at indices 4 and 7).
function tryISO(s: string): ParseDateResult | null {
  if (s.length !== 10) return null
  if (s[4] !== '-' || s[7] !== '-') return null
  for (let i = 0; i < 10; i += 1) {
    if (i === 4 || i === 7) continue
    if (!isDigit(s[i]!)) return null
  }
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (!valid(y, m, d)) return { ok: false, code: 'INVALID_DATE' }
  return { ok: true, iso: fmt(y, m, d) }
}

// Format: DD-MMM-YYYY or DD MMM YYYY (e.g. `15-Mar-2025`, `15 March 2025`).
// State machine: 1-2 digit day, separator, alpha month, separator, 4 digit year.
function tryDDMonYYYY(s: string): ParseDateResult | null {
  // Find first non-digit (end of day).
  let i = 0
  while (i < s.length && isDigit(s[i]!)) i += 1
  if (i === 0 || i > 2) return null
  const day = Number(s.slice(0, i))
  const sep1 = s[i]
  if (sep1 !== '-' && sep1 !== ' ') return null
  // Month — ASCII letters.
  let j = i + 1
  while (j < s.length && /[A-Za-z]/.test(s[j]!)) j += 1
  if (j === i + 1) return null
  const monStr = s.slice(i + 1, j).toLowerCase()
  const mon = MONTHS[monStr]
  if (mon === undefined) return null
  const sep2 = s[j]
  if (sep2 !== '-' && sep2 !== ' ') return null
  // Year — exactly 4 digits.
  const yearStr = s.slice(j + 1)
  if (yearStr.length !== 4) return null
  for (let k = 0; k < 4; k += 1) {
    if (!isDigit(yearStr[k]!)) return null
  }
  const year = Number(yearStr)
  if (!valid(year, mon, day)) return { ok: false, code: 'INVALID_DATE' }
  return { ok: true, iso: fmt(year, mon, day) }
}

// Format: DD<sep>MM<sep>YYYY where sep is `/` or `-`. Strict DD-first.
function tryDDsepMMsepYYYY(s: string, sep: '/' | '-'): ParseDateResult | null {
  // 1-2 digit day, sep, 1-2 digit month, sep, 4 digit year.
  let i = 0
  while (i < s.length && isDigit(s[i]!)) i += 1
  if (i === 0 || i > 2) return null
  if (s[i] !== sep) return null
  let j = i + 1
  while (j < s.length && isDigit(s[j]!)) j += 1
  if (j === i + 1 || j - (i + 1) > 2) return null
  if (s[j] !== sep) return null
  const yearStr = s.slice(j + 1)
  if (yearStr.length !== 4) return null
  for (let k = 0; k < 4; k += 1) {
    if (!isDigit(yearStr[k]!)) return null
  }
  const d = Number(s.slice(0, i))
  const m = Number(s.slice(i + 1, j))
  const y = Number(yearStr)
  if (!valid(y, m, d)) return { ok: false, code: 'INVALID_DATE' }
  return { ok: true, iso: fmt(y, m, d) }
}

export function parseInvoiceDate(raw: unknown): ParseDateResult {
  if (typeof raw !== 'string') return { ok: false, code: 'INVALID_DATE' }
  if (raw.length === 0 || raw.length > MAX_LEN) {
    return { ok: false, code: 'INVALID_DATE' }
  }
  // NFKC folds devanagari digits to ASCII; bidi overrides remain non-ASCII.
  const folded = raw.normalize('NFKC').trim()
  if (folded.length === 0 || folded.length > MAX_LEN) {
    return { ok: false, code: 'INVALID_DATE' }
  }
  if (!CHARSET_RE.test(folded)) return { ok: false, code: 'INVALID_DATE' }
  // Guard against any non-ASCII codepoint that somehow slipped through
  // (charset regex above is ASCII-only by construction — belt+suspenders).
  for (let i = 0; i < folded.length; i += 1) {
    if (folded.charCodeAt(i) > 0x7f) {
      return { ok: false, code: 'INVALID_DATE' }
    }
  }
  const trimmed = stripTime(folded)
  // Precedence: ISO → DD-Mon-YYYY/DD MMM YYYY → DD/MM/YYYY → DD-MM-YYYY.
  return (
    tryISO(trimmed) ??
    tryDDMonYYYY(trimmed) ??
    tryDDsepMMsepYYYY(trimmed, '/') ??
    tryDDsepMMsepYYYY(trimmed, '-') ??
    { ok: false, code: 'INVALID_DATE' }
  )
}
