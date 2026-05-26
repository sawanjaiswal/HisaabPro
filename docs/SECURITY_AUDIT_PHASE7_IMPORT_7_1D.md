# SECURITY AUDIT — Phase 7 #149 · Slice 7.1D — Payments Import

**Auditor:** security agent · **Date:** 2026-05-19 · **Verdict:** `SHIP_WITH_CONDITIONS`

> Scope: `SCOPE_PHASE7_IMPORT_7_1D_PAYMENTS.md` (v2 PASS) +
> `ARCHITECTURE_PHASE7_IMPORT_7_1D.md` (v2 PASS_v2). Probe set: 14 areas
> specific to Payments (mode-dict injection, Σ-allocation race blast-radius,
> P2002 dual-shape discriminator, tail-100 collisions, strictMode amplification,
> Tally 8-digit DATE ReDoS, Busy XLSX CVE surface, DPDP cascade, type literal,
> batched parallel arrays, idempotency tie-break, code distinctness,
> cross-tenant invoice resolution, paise Int overflow).
>
> Verdict rationale: zero CRITICAL/BLOCKER. Findings are **two MUST_FIX**
> (M12, M13) that close trivially during build (≤30 LOC each) and one
> SHOULD_FIX (S9). Inherited M1-M11 verified intact. Cleared section at
> bottom records every probe that passed.

---

## §0 Inherited verbatim (NOT re-litigated)

These findings remain authoritative under their original audits. 7.1D
inherits the implementation contract; the security agent verified each is
preserved by the architecture, not silently dropped.

| Code | Source | One-liner |
|---|---|---|
| **M1** | 7.1A | `req.user.userId` not `.id` on all import routes (drop-undefined IDOR) |
| **M2** | 7.1A | Filename sanitisation in `Content-Disposition` (CRLF, traversal) |
| **M3** | 7.1A | `commitToken` bound to `{businessId, userId, jobId, ip}` |
| **M4** | 7.1A | Error-CSV download routed through auth + CSV-injection prefix |
| **M5** | 7.1B | BigInt JSON — no global `BigInt.prototype.toJSON`; per-emit cast |
| **M6** | 7.1B | `sanitizeControlChars` + NFKC on every parsed string |
| **M7** | 7.1B | `charset` Content-Type regex — strict, no greedy parser |
| **M8** | 7.1B | Schema-introspection probe rejected — no `information_schema` lookup |
| **M9** | 7.1B | `pg_enum` precondition asserted at boot (noted no-op for 7.1D — see Cleared #9) |
| **M10** | 7.1B | Length-prefix advisory-lock key (collision-resistant) |
| **M11** | 7.1C | `AuditLog.actorUserId` scrubbed on DPDP erasure; payload retained |

Inherited security envelope ALSO preserved verbatim: XXE prescan
(libxmljs2 `NOENT=off`), zip-bomb yauzl enumerate, CSV-formula prefix-quote
(`'\t'` on `=/+/-/@`), 10 MB file cap, 10k row cap, multipart MIME allowlist,
rate-limit (5/hr, 20/day per business + 3-failed-parse 1h cooldown),
active-job gate (1/business across entities), `Idempotency-Key` 24h cache,
24h DPDP purge of `ImportJobRow.raw`/`.normalized`.

---

## §1 MUST_FIX (new in 7.1D)

### M12 — `payment-mode-map.constants.ts` must use a `Map`, not a plain object — prototype-pollution defence at the lookup boundary

**Probe:** Mode-dictionary injection / prototype pollution on lookup (probe #1).

**Finding.** ARCH §2.3 L114-120 specifies a `Map<string, PaymentMode>`. SCOPE
L156, L170, L406-408, L847 say "dictionary" / "frozen Map" but several
places ALSO call it a "dictionary" loosely (L19, L156). File Plan row 7
(`payment-mode-map.constants.ts`) is the SSOT; ARCH §2.3 codifies `Map`
but the build agent is free to interpret. A plain object lookup
(`MODE_DICT[normaliseKey(raw)]`) would let a crafted source value like
`"__proto__"`, `"constructor"`, or `"toString"` resolve to truthy values
inherited from `Object.prototype` — turning an unknown-mode into a
silently-poisoned hit. With strictMode=false this commits a Payment with
`mode === Object.prototype.constructor.name` (i.e. `"Object"`), which
would then fail later enum normalisation OR — worse — match an existing
schema-valid mode by string coincidence.

The normaliser `NFKC(s).toLowerCase().trim().replace(/\s+/g, ' ')` does
**not** strip `__proto__` or `constructor` — those strings survive
normalisation unchanged.

**Fix (MUST):**
1. Implementation in row 7 MUST be `new Map<string, PaymentMode>([...])` and
   `Object.freeze` the import. Lookup in row 8 (`payment-mode-map.ts`)
   MUST use `map.get(key)` and explicit `=== undefined` check. NO plain
   object, NO `dict[key]`, NO `in` operator on a plain object.
2. Add a unit test in `tests/unit/import/payment-mode-map.test.ts` (File
   Plan row 37) asserting:
   ```ts
   expect(resolveMode('__proto__', false)).toEqual({ mode: 'OTHER', defaulted: true })
   expect(resolveMode('constructor', false)).toEqual({ mode: 'OTHER', defaulted: true })
   expect(resolveMode('toString', false)).toEqual({ mode: 'OTHER', defaulted: true })
   ```
3. Mechanical enforce: add a grep rule to `scripts/enforce.js` (File Plan
   row 31 also gets this line) banning `MODE_MAP\[` / `MODE_DICT\[` /
   `mode_map\.[a-z]` patterns under `commit-payments/` + `normalizers/`
   directories — surfaces any future regression to plain-object lookup.

**Why MUST.** Same class of bug as `mongoSanitize` Postgres footgun in
`security_defaults.md`: a closed-enum table that LOOKS safe but its
implementation choice (Map vs Object) decides whether arbitrary user
strings can poison the resolution. The mitigation cost is ~20 LOC
distributed across rows 7 + 8 + 31 + 37; the post-ship cost of finding
a `__proto__`-poisoned Payment row in production is unbounded.

---

### M13 — Tally 8-digit DATE pre-format regex MUST anchor BOTH ends AND validate calendar before handoff to `date-parser.util.ts`

**Probe:** Tally 8-digit DATE pre-format DoS / ReDoS-safe regex (probe #6).

**Finding.** ARCH §2.1 row 1 + §7 row 9 + SCOPE L412-414, L587 specify
the Tally adapter pre-formats `/^\d{8}$/` to `YYYY-MM-DD` before the
shared date util. Two sub-issues:

(a) **Regex shape.** `/^\d{8}$/` is anchored and not catastrophic — `\d`
is constant-time. **PASS.** Confirmed not ReDoS-vulnerable.

(b) **Calendar validation missing.** The pre-format step extracts
`YYYY=slice(0,4) + MM=slice(4,6) + DD=slice(6,8)` and concatenates with
hyphens. A source string `"20259999"` passes the regex, becomes
`"2025-99-99"`, then the shared `date-parser.util.ts` (which already has
NFKC + ASCII-only + 32-char length cap + 4-format state machine) attempts
to parse. The 7.1C date util's state machine accepts the `YYYY-MM-DD`
shape — if it constructs the Date via `new Date('2025-99-99')` and only
checks `!isNaN()`, JS coerces `99-99` to month=99 → rolls forward (Date
behaviour). Result: a Payment row with `date = 2033-03-09`
(approximately) — invalid Tally data silently lands as a far-future
Payment.

I do not have the 7.1C `date-parser.util.ts` body in this audit context.
SCOPE/ARCH 7.1C M3 documented "ASCII-only + length cap" but did not
codify a "Date round-trip" calendar check.

**Fix (MUST — defence-in-depth):** add explicit calendar check inside
the Tally adapter's 8-digit pre-format step, BEFORE handing off:

```ts
function tallyPreformatDate(raw: string): string | null {
  if (!/^\d{8}$/.test(raw)) return raw  // pass-through to shared parser
  const y = Number(raw.slice(0,4)), m = Number(raw.slice(4,6)), d = Number(raw.slice(6,8))
  if (m < 1 || m > 12 || d < 1 || d > 31) return null  // ERROR INVALID_DATE
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}`
}
```

Return `null` → caller emits `INVALID_DATE` ERROR (existing code,
PaymentIssueCode L471). Unit test in `parsers-payments.test.ts` (row 41)
asserts `"20251332"`, `"20250230"`, `"00000000"` all → `INVALID_DATE`.

**Why MUST.** Future-dated Payment rows pollute the cross-job dedup key
`(businessId, partyId, date, amount, mode)` and the dashboard's date
filters; once committed, they are indistinguishable from genuine
post-dated cheque receipts. Catch at parse, not at audit.

---

## §2 SHOULD_FIX (new in 7.1D)

### S9 — Batched audit parallel-array equal-length invariant should also assert per-element type homogeneity

**Probe:** Audit batched parallel arrays — length-equality invariant + PII scope (probe #10).

**Finding.** ARCH §6 step 6 + §2.8 + SCOPE L166 codify the runtime
length-equality assert across `paymentIds[]`, `amounts[]`, `partyIds[]`,
`allocatedDocumentIds[]`, `modes[]`, `sourceIndices[]`. **Length-equality
PASS.**

What is NOT asserted: per-index type homogeneity. A bug in the per-row
result struct (e.g. `allocatedDocumentIds` getting `undefined` instead of
the documented `null` for unallocated rows) silently lands in
`AuditLog.payload`. Audit row is the compliance source of truth — corrupt
payloads here defeat the M11 actor-scrub guarantee because the auditor
can no longer prove which payment was allocated to which invoice at
import time.

**Fix (SHOULD — 1 LOC):** in `audit-emit.ts` (row 25), the
`assertEqualLengths` helper additionally enforces:
- `paymentIds[i]` and `partyIds[i]` are non-empty strings
- `amounts[i]` is a finite positive integer
- `allocatedDocumentIds[i]` is `null` or a non-empty string (NOT `undefined`)
- `modes[i]` is one of the 7 closed PaymentMode values

Throws `AppError('AUDIT_PAYLOAD_CORRUPT', 500)` on violation — caller
already rolls back the chunk tx.

**Why SHOULD not MUST.** Length-equality already gives the invariant 90%
coverage; type-homogeneity tightens the residual 10% and the cost is one
unit test plus 8 lines.

---

## §3 FUTURE_EPIC (new in 7.1D)

### F12 — Mode dictionary extension via Settings UI

Currently code-only (SCOPE §12 / Resolved Decision #19). Per-business
dictionary extension in a Settings UI is a known FUTURE_EPIC; before
implementing, security review MUST add: (a) DB-side check constraint that
the mode value still resolves to the closed enum at commit, (b) cross-
tenant isolation on the dictionary table, (c) audit row on every
dictionary mutation. Logged here so the future-epic ticket inherits the
guard list.

---

## §4 CLEARED (probes that PASSED)

| # | Probe | Verdict | Evidence |
|---|---|---|---|
| 1 | Mode-dict injection — base case (non-prototype) | **CLEAR** | Closed enum at app layer; normaliser deterministic. Prototype edge case handled by M12. |
| 2 | Σ-allocation overflow blast radius — chunk-rollback vs row-local continue | **CLEAR** | ARCH v2 §6 step 3c moved Σ-check BEFORE Payment INSERT with explicit `markRowError + continue`; NO `throw` inside per-row work; chunk tx unaffected by per-row OVER_ALLOCATION. SCOPE acceptance #4 + #5 codify the COMMITTED/ERROR split. AUDIT M1+M2 closed in v2. |
| 3 | P2002 dual-shape discriminator robustness | **CLEAR** | ARCH §2.6 + §6 step 3e implements both `Array.isArray(t)` AND `String(t)` branches; key constraint name `PaymentAllocation_paymentId_invoiceId_key` OR substring fallback `paymentId`+`invoiceId`. New unit test row 42b (`allocate-one-p2002.test.ts`) covers both shapes. Schema verified: `Payment.offlineId @unique` (1272) AND `Payment.reversesPaymentId @unique` (1296) both written as `null` by import → field-level P2002 cannot fire via import; allocation-unique is the only expected path. ALLOCATION_INTERNAL_CONFLICT (5xx) vs OVER_ALLOCATION (4xx) NOT collapsed. AUDIT S2 closed. |
| 4 | Tail-100 truncation collision | **CLEAR** | ARCH §2.4 + §13 Deviation #3 explicitly forbid adding `@@unique([businessId, referenceNumber])` — would 500-error legitimate distinct truncated refs. Dedup key (date, party, amount, mode) excludes reference. Two refs sharing last 100 chars but differing in the 101st+ are deliberately allowed to coexist; reference is an audit signal NOT a uniqueness signal. SCOPE acceptance L607-613 + ARCH §7 row 8 codify the regression test. |
| 5 | strictMode opt-in DoS / chunk-retry amplification | **CLEAR** | strictMode is upload-time `?strictMode=true`; affects per-row classification only — unknown mode → ERROR `MODE_UNKNOWN_STRICT` at NORMALIZE time, before chunk tx. Strict rows never reach commit chunk. Retry on strict-rejected row is impossible (row never STAGED). No amplification path. |
| 6 | Tally 8-digit DATE regex | **CLEAR (regex)** | `/^\d{8}$/` is anchored, constant-time, not ReDoS. Calendar validation gap handled by M13. |
| 7 | Busy XLSX `cellDates:true` trust boundary | **CLEAR** | xlsx library CVE history mitigated by: (a) zip-bomb yauzl prescan from 7.1A intercepts crafted XLSX, (b) `cellDates:true, dateNF:'yyyy-mm-dd'` produces ISO strings — downstream date-util receives string, no prototype reachable. xlsx prototype-pollution CVEs (e.g. CVE-2024-22363) target the parser internals on crafted formulas; 10 MB cap + zip-bomb prescan + read-only `sheet_to_json` pathway with explicit options keep the surface bounded. Recommend (S-tier, not blocking): pin `xlsx >= 0.20.2` in `npm-audit-check.js` baseline. |
| 8 | DPDP cascade — `PaymentAllocation` FK Cascade-on-paymentId / Restrict-on-invoiceId | **CLEAR** | Schema verified (lines 1328-1329). Soft-delete-by-`importJobId` (bulk-delete escape hatch) does NOT cascade (cascade only on hard delete). Allocation history preserved across DPDP uploader-erasure: `Payment.importedBy SetNull`, `Payment.partyId Restrict`, `PaymentAllocation` rows untouched. M11 actor-scrub on `AuditLog` honoured by reused 7.1C pipeline. SCOPE acceptance L667-668 codifies. |
| 9 | `Payment.type='PAYMENT_IN'` literal-only assertion | **CLEAR** | ARCH §4 row 3 codifies — `Payment.type` is freeform `String` (schema line 1274), not pg_enum. Boot-time `assertEnumValue` is a documented no-op for 7.1D (mirror 7.1C Document.type precondition). Code comment in `enum-guard.ts` (File Plan row 26) instructs future migration to add the assert BEFORE pg_enum conversion ships. M8 inheritance preserved. |
| 10 | Batched parallel arrays — length-equality + PII scope | **CLEAR (length)** | ARCH §2.8 + §6 step 6 + SCOPE L166 enforce runtime length-equality assert (`assertEqualLengths`). PII scope: arrays carry IDs only (paymentIds, partyIds, allocatedDocumentIds) — no name/phone/email leak into AuditLog. `amounts[]` is paise integers (not derivable PII). `modes[]` is closed enum. Type-homogeneity tightening tracked as S9. |
| 11 | Idempotency: commitToken + Idempotency-Key + `Payment.offlineId` tie-break | **CLEAR** | Three-layer envelope: (a) `commitToken` 4h TTL bound to 4-field tuple from 7.1A M3, (b) `Idempotency-Key` 24h response cache, (c) `ImportJobRow.createdEntityId IS NULL` per-row retry guard (ARCH §6 step 5). `Payment.offlineId` always written as `null` by import (ARCH §4 row 18) — does not collide with Phase-5 offline-create marker. Double-POST acceptance test L661-662. |
| 12 | ALLOCATION_INTERNAL_CONFLICT vs OVER_ALLOCATION distinction (5xx vs 4xx, row-local both) | **CLEAR** | ARCH §2.6 + §5 + SCOPE Resolved Decision #27 forbid collapsing. Σ-guard is PRE-INSERT gate with `continue` — row-local. P2002 path THROWS `AppError('ALLOCATION_INTERNAL_CONFLICT', 500)` — chunk-rolling, Sentry-tagged system bug. Two distinct PaymentIssueCode values. SCOPE acceptance L637-642 codifies discriminating test. |
| 13 | Cross-tenant: resolved invoiceIds scoped by `businessId` before INSERT | **CLEAR** | ARCH §2.5 invoice-resolver SQL contains `WHERE "businessId" = $1` (explicit). §6 step 3a Document-lock SQL ALSO contains `AND "businessId" = ${businessId}` belt-and-braces (defence even if resolver leaked). Party-resolver inherited from 7.1C also scoped. Dedup cross-job query (`payment-dedup.ts`) scoped. Σ-query joins through Payment which is `WHERE p."isDeleted" = false` — note: does NOT redundantly assert businessId on Payment because the docLock + invoiceId chain already establishes business tenancy via the FK direction. Integration test L658-660 + ARCH §Security #1 codify. |
| 14 | Negative amount + paise Int overflow (Rs 2.14 cr cap) | **CLEAR** | Three layers: (a) `narrowPaiseToInt(toPaiseBigInt(amt))` boundary narrow (7.1B M5), (b) explicit `amount === 0 → AMOUNT_NEGATIVE` extra guard at normalize (ARCH §2.2 + SCOPE Resolved Decision #7), (c) BigInt-string pipeline keeps source-side parse free from float drift. ZIP-bomb XLSX cap + 10k row cap bound total throughput; `AMOUNT_OUT_OF_RANGE` blocks individual oversized rows. SCOPE acceptance L596-597. |
| 15 | Cross-tenant invoice existence-leak | **CLEAR** | SCOPE L808-809 + ARCH §Security #1 codify: same-string-different-business returns `INVOICE_NOT_FOUND`, NOT a different code that would leak existence. Verified across resolver (WHERE businessId) + docLock (WHERE businessId) + dedup (WHERE businessId). |
| 16 | Mode-enum poisoning via SQL-shaped string `"DROP TABLE Payment"` | **CLEAR** | ARCH §Security #5 + SCOPE L849-851 codify: normaliser folds to lowercase/NFKC; dictionary lookup is in-memory string equality (post-M12 Map.get); SQL is parameterised via Prisma — no string substitution. Integration test asserts row commits as `OTHER` (or rejects in strict). |
| 17 | Sequential `for…of` enforcement (Promise.all ban) | **CLEAR** | File Plan row 31 codifies CI lint banning `Promise.all` across **entire** `src/services/import/commit-payments/**/*.ts` glob (v2 broadened from single-file in AUDIT S1). Mechanical. SCOPE L26-39 + Resolved Decision #26 codify. |
| 18 | XXE + zip-bomb prescan inheritance | **CLEAR** | Inherited verbatim from 7.1A. Tally XML parser still routes through `xxe-prescan.ts`; Busy XLSX + Vyapar zipped CSV (if any) still route through `zip-bomb-prescan.ts`. No 7.1D file modifies the prescan layer. |
| 19 | CSV-injection prefix on Vyapar / Generic CSV / error-CSV | **CLEAR** | Inherited verbatim (M4 + 7.1A envelope). Error-CSV download for 7.1D ERROR/WARNING rows routes through the same authed endpoint with the same `'\t'` prefix on `=/+/-/@`. |
| 20 | DPDP cascade — `ImportJobRow.raw`/`.normalized` purge at 24h | **CLEAR** | Inherited from 7.1A cleanup cron. Payment ledger rows are business-owned, permanent — out of cleanup scope. SCOPE §3 #3 + §11 acceptance L667-668. |

---

## §5 Verdict reasoning

- 0 BLOCKER / CRITICAL findings.
- 2 MUST_FIX (M12 prototype-pollution defence on mode lookup; M13 Tally
  calendar-validation gap) — both ≤30 LOC, both gated by existing test
  files in the File Plan (rows 37 + 41).
- 1 SHOULD_FIX (S9 type-homogeneity in audit-emit) — 1 LOC + test.
- 1 FUTURE_EPIC (F12 settings-UI mode dictionary) — out of scope.
- Inherited M1-M11 verified intact across ARCH §1 inheritance table +
  §4 schema preconditions.
- Race surfaces (intra-chunk Σ-overflow, cross-import Σ-overflow, fly-
  create party advisory lock, P2002 dual-shape) all CLEAR under v2 of
  the ARCH (§6 statement order rewrite + §2.6 P2002 robust catch).

**Conditions to clear before code-merge gate:**

1. M12 — `payment-mode-map.constants.ts` exports `Map`, `payment-mode-map.ts`
   uses `.get(key)` + undefined-check, scripts/enforce.js bans plain-object
   subscript pattern, unit test asserts `__proto__`/`constructor`/`toString`
   route to OTHER+defaulted.
2. M13 — Tally adapter calendar-validates 8-digit DATE before handoff;
   `INVALID_DATE` on `20251332`/`20250230`/`00000000` covered by unit
   test in `parsers-payments.test.ts`.
3. S9 — `assertEqualLengths` (audit-emit) tightened to per-element type
   homogeneity; 1 test added.

When all 3 land in the build PR, this audit auto-promotes to `CLEAR`.

---

## §6 Out of audit scope (delegated)

- Frontend XSS in `<PaymentRowCard>` deep-link rendering — delegated to
  PAGE_AUDIT_CHECKLIST + the existing 7.1B/C frontend audit pipeline; no
  raw-HTML rendering in the spec.
- Translation copy injection — delegated to existing `t.*` interpolation
  rules; payment issue codes follow the same `t.import.payment.issues.<code>`
  pattern as 7.1A/B/C.
- Sentry alert noise budget for ALLOCATION_INTERNAL_CONFLICT — observability
  concern, tracked in §Observability.
