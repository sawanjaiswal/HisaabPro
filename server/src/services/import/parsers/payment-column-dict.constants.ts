/**
 * Phase 7 · 7.1D PR-D2b — Payment column header-alias dictionary.
 *
 * Frozen-Map SSOT for mapping competitor headers (Vyapar / Busy /
 * Generic) onto our canonical RawPaymentRow keys. EN + Devanagari
 * aliases supported (Vyapar's "bilingual" mode emits Hindi headers
 * on phones set to hi-IN).
 *
 * **M12 defence (prototype pollution):** lookups are `Map.get(key)`
 * — never `dict[key]` — so a malicious header like `"__proto__"`
 * cannot resolve to an inherited truthy value. Same pattern as
 * `payment-mode-map.constants.ts`.
 *
 * Canonical keys emitted into `RawPaymentRow.raw`:
 *   date · partyName · partyPhone · amount · mode · referenceNumber
 *   · invoiceNumber · notes
 *
 * Authority: SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md §8 (L416-461),
 * ARCHITECTURE_PHASE7_IMPORT_7_1D.md §4 row "vyapar-csv.parser.ts".
 */

export type PaymentCanonicalKey =
  | 'date'
  | 'partyName'
  | 'partyPhone'
  | 'amount'
  | 'mode'
  | 'referenceNumber'
  | 'invoiceNumber'
  | 'notes'

export const PAYMENT_CANONICAL_KEYS: ReadonlyArray<PaymentCanonicalKey> = [
  'date',
  'partyName',
  'partyPhone',
  'amount',
  'mode',
  'referenceNumber',
  'invoiceNumber',
  'notes',
]

/**
 * Same normaliser used by `payment-mode-map.ts#normaliseKey`. Inlined
 * here to keep this file pure (no cross-module dep on normalizers/).
 */
export function normaliseHeaderKey(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const k = raw.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
  return k.length === 0 ? null : k
}

// Entries pre-normalised through `normaliseHeaderKey`. Order does not
// matter — the resolver picks the first matching canonical key.
const ENTRIES: ReadonlyArray<readonly [string, PaymentCanonicalKey]> =
  Object.freeze([
    // ── date ──────────────────────────────────────────────────────
    ['date', 'date'],
    ['payment date', 'date'],
    ['receipt date', 'date'],
    ['txn date', 'date'],
    ['तारीख', 'date'],
    ['दिनांक', 'date'],

    // ── partyName ─────────────────────────────────────────────────
    ['party name', 'partyName'],
    ['party', 'partyName'],
    ['customer', 'partyName'],
    ['customer name', 'partyName'],
    ['supplier', 'partyName'],
    ['supplier name', 'partyName'],
    ['पार्टी', 'partyName'],
    ['ग्राहक', 'partyName'],

    // ── partyPhone ────────────────────────────────────────────────
    ['phone', 'partyPhone'],
    ['phone number', 'partyPhone'],
    ['mobile', 'partyPhone'],
    ['mobile number', 'partyPhone'],
    ['फ़ोन', 'partyPhone'],
    ['मोबाइल', 'partyPhone'],

    // ── amount ────────────────────────────────────────────────────
    ['amount', 'amount'],
    ['received', 'amount'],
    ['receipt amount', 'amount'],
    ['received amount', 'amount'],
    ['paid amount', 'amount'],
    ['राशि', 'amount'],
    ['रकम', 'amount'],

    // ── mode ──────────────────────────────────────────────────────
    ['payment mode', 'mode'],
    ['mode', 'mode'],
    ['type', 'mode'],
    ['payment type', 'mode'],
    ['भुगतान प्रकार', 'mode'],

    // ── referenceNumber ───────────────────────────────────────────
    ['reference no', 'referenceNumber'],
    ['reference', 'referenceNumber'],
    ['reference number', 'referenceNumber'],
    ['ref no', 'referenceNumber'],
    ['ref', 'referenceNumber'],
    ['cheque no', 'referenceNumber'],
    ['cheque number', 'referenceNumber'],
    ['upi ref', 'referenceNumber'],
    ['utr', 'referenceNumber'],
    ['utr no', 'referenceNumber'],

    // ── invoiceNumber ─────────────────────────────────────────────
    ['invoice no', 'invoiceNumber'],
    ['invoice', 'invoiceNumber'],
    ['invoice number', 'invoiceNumber'],
    ['bill no', 'invoiceNumber'],
    ['bill number', 'invoiceNumber'],
    ['बिल नंबर', 'invoiceNumber'],

    // ── notes ─────────────────────────────────────────────────────
    ['notes', 'notes'],
    ['note', 'notes'],
    ['description', 'notes'],
    ['remarks', 'notes'],
    ['narration', 'notes'],
    ['विवरण', 'notes'],
  ])

/**
 * Frozen Map — sealed at module init. M12-clean lookup: `.get(key)`
 * returns `undefined` for absent keys AND for `__proto__` /
 * `constructor` / `toString`.
 */
export const PAYMENT_HEADER_ALIAS: ReadonlyMap<string, PaymentCanonicalKey> =
  Object.freeze(new Map<string, PaymentCanonicalKey>(ENTRIES))

/**
 * Look up a single source header against the alias map.
 * Returns `null` for unknown / unmappable headers.
 */
export function resolveHeader(rawHeader: string): PaymentCanonicalKey | null {
  const key = normaliseHeaderKey(rawHeader)
  if (key === null) return null
  return PAYMENT_HEADER_ALIAS.get(key) ?? null
}
