# Security Audit — Phase 7 #149 Slice 7.1C (Invoices Import)

**Auditor:** security agent · **Date:** 2026-05-19 · **Verdict:** `SHIP_WITH_CONDITIONS`

**Inputs reviewed:**
- ARCH v2: `docs/ARCHITECTURE_PHASE7_IMPORT_7_1C.md` (PASS_v2)
- SCOPE: `docs/SCOPE_PHASE7_IMPORT_7_1C_INVOICES.md`
- 7.1A audit (M1–M4 inherited)
- 7.1B audit (M5–M9 inherited)

**Inherited verbatim, not re-litigated:** XXE pre-scan, zip-bomb yauzl enumerate, CSV-formula prefix-quote, M1 (req.user.userId), M2 (filename sanitisation), M3 (commitToken binding), M4 (error-CSV via auth route), M5 (BigInt JSON), M6 (sanitizeControlChars/NFKC), M7 (charset-restricted), M8 (schema-introspection), M9 (pg_enum precondition).

---

## Verdict — SHIP_WITH_CONDITIONS

2 MUST_FIX (M10–M11) before PR-C3 merge, 4 SHOULD_FIX (S5–S8), 2 FUTURE_EPIC (F10–F11).

## MUST_FIX

### M10 — Advisory-lock key separator collision (ARCH §6 step 1a L590-594; §2.6 L277-280)

`hashtextextended(businessId || '|' || lower(name) || '|' || (phone ?? ''), 0)` — pipe is legal in names. Triples `(biz, "ab|c traders", "9999")` and `(biz, "ab", "c traders|9999")` collide.

**Fix:** length-prefix each component: `${businessId.length}:${businessId}|${name.length}:${lower(name)}|${(phone??'').length}:${phone??''}`. Apply in §6 step 1a AND §2.6 fly-create call site.

### M11 — Audit payload PII + DPDP erasure (ARCH §6.4 L651-664)

`invoices.imported_batch.payload` carries `documentNumbers[]`, `grandTotals[]`, `actorUserId`. AuditLog is immutable but `actorUserId` is direct PII linkage to an erased principal.

**Fix:** (a) on `data_principal.erased`, UPDATE `AuditLog` rows where `actorUserId = $erased` → NULL (history preserved, identity scrubbed); (b) document retention horizon for `invoices.imported_batch`; (c) integration #14 asserts AuditLog actor-scrub on erasure.

## SHOULD_FIX

- **S5 — PRODUCT_NOT_FOUND echo (§2.7 L322):** cleared as not a cross-tenant leak (resolver scoped by businessId), but log SKU sample at DEBUG only, never INFO. PII rule applies.
- **S6 — CommitBlockedBanner deep-link IDOR (§9 L887, FE #56):** `?resumeImportJobId=` requires server-side `GET /api/imports/<id>` to enforce `WHERE businessId = req.activeBusiness.id`. Test: foreign jobId → 404 (not 403, avoid existence disclosure).
- **S7 — Aggregator memory exhaustion (§2.2):** 100k-row CSV all sharing `(invoiceNumber, date)` collapses to one group, then `createMany` hits Postgres parameter limit / OOM. Cap lines-per-aggregated-invoice at 1000 → `LINES_PER_INVOICE_EXCEEDED` ERROR. Add to `InvoiceIssueCode` union.
- **S8 — TOCTOU product-delete during commit (§6 step 3, §7 row 7):** wrap `documentLineItem.createMany` try/catch on `P2003` → `AppError('PRODUCT_DELETED_DURING_COMMIT', 409, ...)`. Roll back chunk via throw (chunk-tx).

## FUTURE_EPIC

- **F10 — Document.type → pg_enum hardening:** ARCH §4 L495 accepts no-op; literal-only in code. Track for post-7.1D.
- **F11 — Per-chunk DoS amplifier:** 200-row rollback per failure; replay loop unbounded. Add Sentry alert `import_commit.chunk_retries{jobId} > 5` + job-level cap (10 retries → FAILED).

## Cleared (not findings)

- Date parser: no eval/Function/Date.parse/Intl; bounded anchored regex; 32-char cap; ReDoS-safe ✓
- Tax basis-points: Int paise, no division by user input, no divide-by-zero ✓
- Document.type injection: literal-only in code ✓
- NULL documentNumber re-upload: Idempotency-Key + commitToken tie-break + INTRA_FILE_DUPLICATE ✓
- DPDP fly-created Party preservation (FK Restrict + integration #12) ✓
- `req.user.userId` not `req.user.id` ✓

## Sign-off

**Cleared to build** with M10-M11 folded into ARCH §6 step 1a + §6.4 as pre-build amendments. S5-S8 must land in PR-C3 or PR-C5 per scope. F10-F11 file as 7.1D backlog.
