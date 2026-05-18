/**
 * Phase 7 — Import Engine · Party normalizer
 *
 * Pure function: `RawPartyRow` (from any parser) + `ColumnMapping` →
 * `NormalizedPartyRow` with canonical HP representations:
 *   - phone: E.164 (`+91XXXXXXXXXX`)
 *   - gstin: uppercase, regex-validated
 *   - openingBalance: paise integer (Cr suffix = negative for Busy)
 *   - name / address: trimmed, whitespace-collapsed, length-capped
 *
 * Validation produces `issues[]` entries; **rows are never dropped
 * here** — even fully malformed rows pass through STAGED so the
 * preview UI can show inline error chips (SCOPE §preview).
 *
 * Cross-references:
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1A.md File Plan row 9
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1A.md S9 (no PII in logs)
 */

import type {
  NormalizedPartyRow,
  RawPartyRow,
  RowIssue,
} from '../../../types/import.types.js'
import type { ColumnMapping } from './normalize-mappings.js'

const MAX_NAME_LEN = 200
const MAX_ADDRESS_LEN = 500
const DEFAULT_COUNTRY = '+91'
const PHONE_MIN_DIGITS = 10
const PHONE_MAX_DIGITS = 13
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9A-Z]$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Helpers ──────────────────────────────────────────────────────────

/** Case-insensitive header lookup against the raw record. */
function lookup(
  raw: Record<string, string>,
  header: string | undefined,
): string | undefined {
  if (!header) return undefined
  const direct = raw[header]
  if (direct !== undefined) return direct
  const lc = header.toLowerCase()
  for (const k of Object.keys(raw)) {
    if (k.toLowerCase() === lc) return raw[k]
  }
  return undefined
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function issue(field: string, code: string, message: string): RowIssue {
  return { field, code, message }
}

// ── Field normalisers ────────────────────────────────────────────────

export function normaliseName(
  v: string | undefined,
  issues: RowIssue[],
): string {
  const trimmed = collapseWs(v ?? '')
  if (!trimmed) {
    issues.push(issue('name', 'MISSING_NAME', 'Name is required'))
    return ''
  }
  if (trimmed.length > MAX_NAME_LEN) {
    issues.push(
      issue('name', 'NAME_TOO_LONG', `Name exceeds ${MAX_NAME_LEN} chars`),
    )
    return trimmed.slice(0, MAX_NAME_LEN)
  }
  return trimmed
}

export function normalisePhone(
  v: string | undefined,
  issues: RowIssue[],
): string | undefined {
  if (!v) return undefined
  const trimmed = v.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    issues.push(
      issue('phone', 'INVALID_PHONE', `Phone has ${digits.length} digits`),
    )
    return undefined
  }
  // 10 digits → assume +91; 11-13 digits → assume already country-coded
  if (digits.length === PHONE_MIN_DIGITS) return `${DEFAULT_COUNTRY}${digits}`
  return `+${digits}`
}

export function normaliseEmail(
  v: string | undefined,
  issues: RowIssue[],
): string | undefined {
  if (!v) return undefined
  const lc = v.trim().toLowerCase()
  if (!lc) return undefined
  if (!EMAIL_RE.test(lc)) {
    issues.push(issue('email', 'INVALID_EMAIL', 'Email is malformed'))
    return undefined
  }
  return lc
}

export function normaliseGstin(
  v: string | undefined,
  issues: RowIssue[],
): string | undefined {
  if (!v) return undefined
  const up = v.trim().toUpperCase()
  if (!up) return undefined
  if (!GSTIN_RE.test(up)) {
    issues.push(issue('gstin', 'INVALID_GSTIN', 'GSTIN format invalid'))
    return undefined
  }
  return up
}

export function normaliseAddress(
  v: string | undefined,
  issues: RowIssue[],
): string | undefined {
  if (!v) return undefined
  const t = collapseWs(v)
  if (!t) return undefined
  if (t.length > MAX_ADDRESS_LEN) {
    issues.push(
      issue('address', 'ADDRESS_TOO_LONG', `Address exceeds ${MAX_ADDRESS_LEN}`),
    )
    return t.slice(0, MAX_ADDRESS_LEN)
  }
  return t
}

/**
 * Opening balance → paise integer.
 * Accepts plain numbers, comma-grouped Indian style ("1,00,000"), and
 * Busy's `Dr` / `Cr` suffix (Cr = negative, party owes us).
 */
export function normaliseOpeningBalance(
  v: string | undefined,
  issues: RowIssue[],
): number | undefined {
  if (!v) return undefined
  const raw = v.trim()
  if (!raw) return undefined
  let sign = 1
  let body = raw.replace(/,/g, '')
  const m = body.match(/^(.*?)\s*(Dr|Cr)\.?\s*$/i)
  if (m) {
    sign = m[2]!.toLowerCase() === 'cr' ? -1 : 1
    body = m[1]!.trim()
  }
  if (!body) return undefined
  const n = Number(body)
  if (!Number.isFinite(n)) {
    issues.push(
      issue('openingBalance', 'INVALID_AMOUNT', 'Opening balance not numeric'),
    )
    return undefined
  }
  return Math.round(n * 100) * sign
}

// ── Public entry point ───────────────────────────────────────────────

export function normalizePartyRow(
  row: RawPartyRow,
  mapping: ColumnMapping,
): NormalizedPartyRow {
  const issues: RowIssue[] = []
  const name = normaliseName(lookup(row.raw, mapping.name), issues)
  const phoneE164 = normalisePhone(lookup(row.raw, mapping.phone), issues)
  const email = normaliseEmail(lookup(row.raw, mapping.email), issues)
  const gstin = normaliseGstin(lookup(row.raw, mapping.gstin), issues)
  const address = normaliseAddress(lookup(row.raw, mapping.address), issues)
  const openingBalancePaise = normaliseOpeningBalance(
    lookup(row.raw, mapping.openingBalance),
    issues,
  )
  return {
    name,
    phoneE164,
    email,
    gstin,
    address,
    openingBalancePaise,
    issues,
  }
}
