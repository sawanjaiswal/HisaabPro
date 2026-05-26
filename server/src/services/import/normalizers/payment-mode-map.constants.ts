/**
 * Phase 7 · 7.1D — Payment mode lookup table (frozen Map SSOT).
 *
 * **M12 (SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md): MUST be a `Map`, NOT a plain
 *  object.** A plain object lookup (`MODE_DICT[normaliseKey(raw)]`) would let
 *  a crafted source value like `"__proto__"`, `"constructor"`, or
 *  `"toString"` resolve to truthy values inherited from
 *  `Object.prototype` — turning an unknown-mode into a silently-poisoned
 *  hit. `Map.get(key)` is prototype-clean.
 *
 * The CI lint rule in `scripts/enforce.js` (ARCH File Plan row 31) bans
 * `MODE_MAP\[`, `MODE_DICT\[` and `mode_map\.[a-z]` patterns across the
 * `commit-payments/` + `normalizers/` directories — any regression to
 * plain-object lookup fails the build.
 *
 * Seeded with EN aliases + Devanagari + casing/spacing variants. All keys
 * are post-`normaliseKey` (NFKC + lowercase + trim + whitespace collapse).
 *
 * Authority:
 *   - SECURITY_AUDIT_PHASE7_IMPORT_7_1D.md §1 M12 (this file is the fix)
 *   - ARCHITECTURE_PHASE7_IMPORT_7_1D.md §2.3 L114-120
 *   - SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md L156, L170, L406-408, L847
 */

export const PAYMENT_MODES = [
  'CASH',
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'NEFT_RTGS_IMPS',
  'CREDIT_CARD',
  'OTHER',
] as const

export type PaymentMode = (typeof PAYMENT_MODES)[number]

/**
 * Entries are `[normalisedKey, mode]`. Keys MUST be pre-normalised through
 * the same `normaliseKey` (NFKC + lc + trim + ws-collapse) that the lookup
 * path uses — otherwise the table won't match its own callers.
 */
const ENTRIES: ReadonlyArray<readonly [string, PaymentMode]> = Object.freeze([
  // ── CASH ──────────────────────────────────────────────────────────
  ['cash', 'CASH'],
  ['नकद', 'CASH'],
  ['नक़द', 'CASH'],
  ['नगद', 'CASH'],

  // ── UPI ───────────────────────────────────────────────────────────
  ['upi', 'UPI'],
  ['यूपीआई', 'UPI'],
  ['gpay', 'UPI'],
  ['google pay', 'UPI'],
  ['phonepe', 'UPI'],
  ['paytm', 'UPI'],
  ['paytm upi', 'UPI'],
  ['bhim', 'UPI'],
  ['bhim upi', 'UPI'],

  // ── BANK_TRANSFER ─────────────────────────────────────────────────
  ['bank', 'BANK_TRANSFER'],
  ['bank transfer', 'BANK_TRANSFER'],
  ['bank a/c', 'BANK_TRANSFER'],
  ['bank account', 'BANK_TRANSFER'],
  ['transfer', 'BANK_TRANSFER'],
  ['बैंक a/c', 'BANK_TRANSFER'],
  ['बैंक', 'BANK_TRANSFER'],
  ['बैंक ट्रांसफर', 'BANK_TRANSFER'],

  // ── CHEQUE ────────────────────────────────────────────────────────
  ['cheque', 'CHEQUE'],
  ['check', 'CHEQUE'],
  ['chq', 'CHEQUE'],
  ['चेक', 'CHEQUE'],
  ['चैक', 'CHEQUE'],

  // ── NEFT_RTGS_IMPS ────────────────────────────────────────────────
  ['neft', 'NEFT_RTGS_IMPS'],
  ['rtgs', 'NEFT_RTGS_IMPS'],
  ['imps', 'NEFT_RTGS_IMPS'],
  ['neft/rtgs', 'NEFT_RTGS_IMPS'],
  ['neft rtgs', 'NEFT_RTGS_IMPS'],
  ['neft/rtgs/imps', 'NEFT_RTGS_IMPS'],

  // ── CREDIT_CARD ───────────────────────────────────────────────────
  ['credit card', 'CREDIT_CARD'],
  ['creditcard', 'CREDIT_CARD'],
  ['card', 'CREDIT_CARD'],
  ['cc', 'CREDIT_CARD'],
  ['debit card', 'CREDIT_CARD'],
  ['debitcard', 'CREDIT_CARD'],
  ['क्रेडिट कार्ड', 'CREDIT_CARD'],

  // ── OTHER ─────────────────────────────────────────────────────────
  ['other', 'OTHER'],
  ['others', 'OTHER'],
  ['misc', 'OTHER'],
  ['miscellaneous', 'OTHER'],
  ['अन्य', 'OTHER'],
])

/**
 * Frozen Map — sealed at module-init. Consumers MUST use `.get(key)` and
 * an explicit `=== undefined` check. NO plain object, NO `dict[key]`, NO
 * `in` operator. See M12.
 */
export const PAYMENT_MODE_MAP: ReadonlyMap<string, PaymentMode> = Object.freeze(
  new Map<string, PaymentMode>(ENTRIES),
)
