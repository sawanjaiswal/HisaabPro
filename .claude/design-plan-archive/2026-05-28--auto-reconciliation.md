---
status: approved
feature: auto-reconciliation
created: 2026-05-28T09:05:55Z
approved_at: 2026-05-28T14:47:00Z
approver: Sawan
session: bare-143115
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/services/bank-reconciliation/bank-reconciliation.types.ts
  - server/src/services/bank-reconciliation/statement-parser.ts
  - server/src/services/bank-reconciliation/match-engine.ts
  - server/src/services/bank-reconciliation/bank-reconciliation.service.ts
  - server/src/services/bank-reconciliation/__tests__/match-engine.test.ts
  - server/src/services/bank-reconciliation/__tests__/statement-parser.test.ts
  - server/src/schemas/bank-reconciliation.schemas.ts
  - server/src/routes/bank-reconciliation.routes.ts
  - server/src/app.routes.ts
  - src/features/bank-reconciliation/bank-reconciliation.types.ts
  - src/features/bank-reconciliation/bank-reconciliation.constants.ts
  - src/features/bank-reconciliation/bank-reconciliation.service.ts
  - src/features/bank-reconciliation/hooks/useBankReconciliation.ts
  - src/features/bank-reconciliation/components/StatementUpload.tsx
  - src/features/bank-reconciliation/components/MatchRow.tsx
  - src/features/bank-reconciliation/components/ReconcileSummary.tsx
  - src/features/bank-reconciliation/BankReconciliationPage.tsx
  - src/features/bank-reconciliation/bank-reconciliation.css
  - src/config/routes.config.ts
  - src/app.routes.ts
  - src/App.tsx
  - src/config/verticals.config.ts
  - src/features/more/more.constants.ts
  - src/features/more/more.icons.ts
  - src/lib/translations.en.ext50.ts
  - src/lib/translations.hi.ext50.ts
  - src/lib/translations.ts
agents_invoked:
  - architecture-auditor (output: docs/EPIC_auto-reconciliation/architecture-critique.md, verdict: PASS)
  - security             (output: docs/EPIC_auto-reconciliation/security-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-28T09:17:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 3 MUST_FIX (namespace collision, unbounded candidate pool, non-deterministic tie-break)
  - ts: 2026-05-28T09:48:00Z
    critic: security
    verdict: REVISE
    revision: 1
    findings: 6 MUST_FIX (businessId fallback, TOCTOU re-scope, bankAccountId validation, idempotency-via-unique, strict Zod + field allowlist)
  - ts: 2026-05-28T14:39:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
  - ts: 2026-05-28T14:41:00Z
    critic: security
    verdict: PASS
    revision: 2
acceptance:
  backend:
    - tsc clean
    - curl 200 (suggest matches) / 401 (no auth) / 400 (bad CSV)
    - match-engine + statement-parser unit tests green
  frontend:
    - screenshots: loading · error · empty · success · 320px
    - console clean
---

# Auto-reconciliation (#147, absorbs #89 Bank Reconciliation) — Plan

## Scope

Let a PRO business upload a bank statement (CSV), auto-suggest which existing
**Payments** each bank line corresponds to (fuzzy match on amount + date +
reference/party tokens), and let the user confirm/reject each suggestion. A
confirmed match marks the line reconciled and records an audit row. Unmatched
lines can be ignored or turned into a new Payment (deferred — see FUTURE).

**In scope (MUST_SHIP):**
- CSV statement import → staged lines (no mutation of existing money rows).
- Deterministic fuzzy match engine (pure, fully unit-tested).
- Review UI: suggested / unmatched / matched tabs, confirm + reject + ignore.
- Reconciliation audit trail (who matched what, AUTO vs MANUAL, confidence).
- Strict per-tenant scoping (`businessId` from `req.user!.businessId` on every query).

**Out of scope (FUTURE_EPIC):**
- Bank-API/aggregator live feeds (only manual CSV upload now).
- "Create Payment from unmatched line" write-back (review-only v1; the line can
  be marked IGNORED). Promote to a follow-up once match UX is validated.
- Multi-currency, OD/CC interest lines, balance-assertion checks.
- Matching against Expenses (v1 matches Payments only).

## Schema — additive only (no existing column changed, no backfill)

Three new models. All FKs point INTO existing tables; existing tables gain only
back-relations (no column/constraint change → migration is create-table-only,
zero lock on hot tables, instantly reversible by dropping the new tables).

```prisma
model BankStatementImport {
  id            String   @id @default(cuid())
  businessId    String
  bankAccountId String
  fileName      String   @db.VarChar(255)
  rowCount      Int
  periodStart   DateTime?
  periodEnd     DateTime?
  importedBy    String
  createdAt     DateTime @default(now())
  business      Business     @relation(fields: [businessId], references: [id], onDelete: Cascade)
  bankAccount   BankAccount  @relation(fields: [bankAccountId], references: [id], onDelete: Restrict)
  importer      User         @relation("StatementImporter", fields: [importedBy], references: [id], onDelete: Restrict)
  lines         BankStatementLine[]
  @@index([businessId, createdAt])
  @@index([businessId, bankAccountId])
}

model BankStatementLine {
  id              String   @id @default(cuid())
  importId        String
  businessId      String
  bankAccountId   String
  txnDate         DateTime
  amount          Int      // paise, always positive
  direction       String   // CREDIT | DEBIT
  description     String?  @db.VarChar(500)
  referenceNumber String?  @db.VarChar(100)
  status          String   @default("UNMATCHED") // UNMATCHED | SUGGESTED | MATCHED | IGNORED
  createdAt       DateTime @default(now())
  import          BankStatementImport @relation(fields: [importId], references: [id], onDelete: Cascade)
  business        Business            @relation(fields: [businessId], references: [id], onDelete: Cascade)
  match           ReconciliationMatch?
  @@index([businessId, bankAccountId, status])
  @@index([importId])
}

model ReconciliationMatch {
  id            String   @id @default(cuid())
  businessId    String
  lineId        String   @unique          // 1:1 — a line reconciles to at most one payment
  paymentId     String
  method        String   // AUTO | MANUAL
  confidence    Int      // 0..100 (stored as int, not float — money-adjacent SSOT)
  matchedBy     String
  createdAt     DateTime @default(now())
  line          BankStatementLine @relation(fields: [lineId], references: [id], onDelete: Cascade)
  payment       Payment           @relation("PaymentReconciliation", fields: [paymentId], references: [id], onDelete: Restrict)
  business      Business          @relation(fields: [businessId], references: [id], onDelete: Cascade)
  matcher       User              @relation("ReconciliationMatcher", fields: [matchedBy], references: [id], onDelete: Restrict)
  @@index([businessId, paymentId])
}
```

Back-relations added to `Business`, `BankAccount`, `Payment`, `User` (additive
relation fields only — Prisma requires the inverse side; no DB column on the
existing tables changes). Migration via `npx prisma migrate dev --name
add_reconciliation` (NOT `db push` — blocked by gate).

**Note (`paymentId` not `@unique`):** a single Payment could plausibly appear as
two bank lines only in error; we keep payment side non-unique but enforce
line-side `@unique` so one bank line maps to one payment. Double-matching the
same payment to two lines is allowed at DB level but flagged in the UI
("already reconciled") — confirmed acceptable for v1.

## File plan

**A-M1 namespace fix:** `reconciliation` is already taken by the GSTR-1 tax-return
reconciliation service (`server/src/services/reconciliation/`,
`server/src/routes/reconciliation.ts`, `server/src/schemas/reconciliation.schemas.ts`,
FE `src/features/gst-reconciliation/`). This epic uses the **`bank-reconciliation`**
namespace everywhere to avoid clobbering it.

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/schema.prisma | edit | +70 | schema |
| server/prisma/migrations/** | create | — | migration |
| server/src/services/bank-reconciliation/bank-reconciliation.types.ts | create | ~70 | types |
| server/src/services/bank-reconciliation/statement-parser.ts | create | ~170 | utils (pure CSV) |
| server/src/services/bank-reconciliation/match-engine.ts | create | ~170 | utils (pure scoring) |
| server/src/services/bank-reconciliation/bank-reconciliation.service.ts | create | ~240 | service |
| server/src/services/bank-reconciliation/__tests__/match-engine.test.ts | create | ~150 | test |
| server/src/services/bank-reconciliation/__tests__/statement-parser.test.ts | create | ~110 | test |
| server/src/schemas/bank-reconciliation.schemas.ts | create | ~70 | zod |
| server/src/routes/bank-reconciliation.routes.ts | create | ~170 | route |
| server/src/app.routes.ts | edit | +2 | wiring |
| src/features/bank-reconciliation/bank-reconciliation.types.ts | create | ~60 | FE types |
| src/features/bank-reconciliation/bank-reconciliation.constants.ts | create | ~50 | FE constants |
| src/features/bank-reconciliation/bank-reconciliation.service.ts | create | ~90 | FE service |
| src/features/bank-reconciliation/hooks/useBankReconciliation.ts | create | ~110 | FE hook |
| src/features/bank-reconciliation/components/StatementUpload.tsx | create | ~140 | FE component (CSV parse) |
| src/features/bank-reconciliation/components/MatchRow.tsx | create | ~130 | FE component |
| src/features/bank-reconciliation/components/ReconcileSummary.tsx | create | ~80 | FE component |
| src/features/bank-reconciliation/BankReconciliationPage.tsx | create | ~190 | FE page |
| src/features/bank-reconciliation/bank-reconciliation.css | create | ~130 | FE css |
| (FE wiring: routes/app.routes/App/verticals/more×2/translations×3) | edit | ~30 | wiring |

All files ≤250 lines.

## API contracts

Base path **`/api/bank-reconciliation`**. `router.use(auth)` +
`router.use(requirePlan('PRO'))` + per-route `requirePermission('reports.view')`.

**S-M1 / S-M3 tenant guard (every handler, no exceptions):**
```ts
const businessId = req.user!.businessId
if (!businessId) throw new AppError('NO_BUSINESS', 401)   // auth mw defaults to '' — assert non-empty
```
`businessId` is ALWAYS stamped from the token, never read from `req.body`.
`bankAccountId` from the body is validated with a `findFirst({ where: { id, businessId } })`
before use; missing → 404.

**S-M2 TOCTOU:** every state-changing handler re-scopes in BOTH the lookup AND
the mutation `where` (mirrors `server/src/services/payment/update-delete.ts`):
`updateMany({ where: { id: lineId, businessId, status: <expected> }, data })` and
assert `count === 1`, rather than findFirst-then-update on a bare id.

**S-M5/M6 Zod:** all body schemas `.strict()`. The server NEVER spreads
`data: req.body`. Client may supply only the documented input fields — `status`,
`confidence`, `method`, `businessId` are server-derived and rejected if present.

- `POST /api/bank-reconciliation/imports` — body `{ bankAccountId, fileName, rows: CsvRow[] }`
  (FE parses CSV client-side; server takes a bounded JSON array — no multipart).
  Zod: `rows` `.max(2000)`, each row `txnDate` ISO, `amount` int >0 paise,
  `direction` enum CREDIT|DEBIT, `description`/`referenceNumber` length-capped
  (≤500/≤100), `.strict()`. Validates bankAccount ∈ business. Creates import +
  lines, runs match engine, returns `{ importId, lines: LineWithSuggestion[] }`.
  400 on empty/oversized/invalid, 404 bad bankAccount, 401 no-auth.
- `GET /api/bank-reconciliation/lines?status=&bankAccountId=&cursor=` — paginated.
- `POST /api/bank-reconciliation/lines/:lineId/match` — body `{ paymentId }`.
  Re-scopes lineId AND paymentId to businessId; writes MANUAL match. **S-M4
  idempotency:** dedup is enforced by `ReconciliationMatch.lineId @unique` — a
  duplicate insert throws Prisma P2002 which the service translates to
  `AppError(LINE_ALREADY_RECONCILED, 409)`. (The `X-Request-Nonce/Timestamp`
  headers are *replayProtection* middleware, NOT idempotency — corrected from rev 1.)
- `POST /api/bank-reconciliation/lines/:lineId/confirm` — confirms the AUTO suggestion
  (same P2002→409 guard).
- `POST /api/bank-reconciliation/lines/:lineId/ignore` — sets IGNORED via scoped updateMany.
- `DELETE /api/bank-reconciliation/matches/:lineId` — un-reconcile (scoped deleteMany).

## Match engine (pure, the testable core)

`scoreCandidate(line, payment) -> 0..100` (pure, integer-only — no float):
- amount exact (paise equal) → +60; off by ≤1% → +30; else disqualify (return 0).
- date within 0 days → +25; ≤3 days → +15; ≤7 days → +8; >14 days → +0.
- reference/party-name token overlap (normalized) → up to +15.
- direction sanity: CREDIT line ↔ PAYMENT_IN (+ PAYROLL_IN), DEBIT ↔ PAYMENT_OUT
  (+ PAYROLL_OUT); mismatch disqualifies (return 0).
Top candidate with score ≥ 70 → SUGGESTED (auto). 50–69 → weak suggestion (not
auto). <50 → UNMATCHED. Confidence stored as the integer score.

**A-M3 determinism (the testable contract):** the engine takes `(lines,
candidatePayments)` as plain arrays and returns suggestions — no DB, no clock,
no `Date.now()`. Ties (equal score — common for round UPI amounts) break
deterministically by: (1) smaller absolute date delta, then (2) `payment.id`
ascending. The service sorts the candidate pool by `id asc` before calling the
engine so Prisma's unstable `findMany` order cannot leak in. Unit tests assert a
fixed input → fixed output including the tie-break.

**A-M2 bounded candidate pool (the explicit single query, no N+1, no blowup):**
After staging the import, compute `minDate = min(line.txnDate) - 14d`,
`maxDate = max(line.txnDate) + 14d` across the batch, then ONE query:
```ts
prisma.payment.findMany({
  where: {
    businessId,                              // S-M2 tenant scope
    isDeleted: false,                         // A-SHOULD: never match soft-deleted
    date: { gte: minDate, lte: maxDate },
    id: { notIn: <already-reconciled paymentIds in window> },
  },
  orderBy: { id: 'asc' },
  take: 5000,                                 // A-M2 hard pool ceiling
})
```
Matching then runs in memory over this bounded pool. If the pool hits the 5000
ceiling the import still succeeds but returns a `poolTruncated: true` flag so the
UI can warn "narrow the date range for better matches". Per-line we filter the
in-memory pool by the ±14d window + direction before scoring — O(lines × pool)
bounded by 2000 × 5000 worst case, acceptable for a one-shot import action.

## Security cuts (precision-pinned after security critic rev 1)

- **CSV input (S-M5):** parsed on the client; server takes a bounded JSON array
  (≤2000 rows, `.strict()`, every field length/type/enum-validated via Zod). No
  multipart, no server-side file handling.
- **Formula injection (S-SHOULD):** stored cells are raw strings — safe at rest.
  The risk is the *future* CSV-export path; when that ships it MUST prefix any
  cell starting with `= + - @` with a `'`. Noted as a guard for the export epic;
  v1 has no export.
- **IDOR / TOCTOU (S-M1/M2/M3):** see API contracts — non-empty businessId
  asserted; tenant scope in both lookup AND mutation `where`; `bankAccountId` and
  `paymentId` validated against business before use; `businessId` never from body.
- **Idempotency (S-M4):** enforced by `ReconciliationMatch.lineId @unique` +
  P2002→409, not by the replay-nonce middleware.
- **Double-match (S-SHOULD):** the UI flags "already reconciled", but the server
  is the control — a second match on a reconciled line returns 409 (the `@unique`).
- **PII in logs (S-SHOULD):** bank `description`/`referenceNumber` may contain
  names/UPI handles — never logged; log only ids + counts.
- `confidence` is an Int (money-adjacent SSOT — no float).
- **No ledger mutation:** reconciliation only annotates via the new join table;
  a bad match cannot corrupt Payment/ledger rows. Un-reconcile is a row delete.

## Migration / rollout

1. `prisma migrate dev --name add_reconciliation` (create-table-only).
2. Deploy BE; feature dark behind PRO plan gate + new nav card.
3. No data backfill. Reversible: drop three tables + relation fields.

## Open questions

- Q1: Match Expenses too, or Payments only in v1? → **Payments only** (Expenses
  deferred to FUTURE to bound scope).
- Q2: Auto-apply high-confidence (≥90) matches without review? → **No** — always
  require a human confirm in v1 (money safety). Revisit after usage data.
- Q3: Should `paymentId` be globally `@unique`? → **No** (see schema note); line
  side is unique, UI flags double-matches.
- Q4 (A-SHOULD re-upload dedupe): re-uploading the same statement would create
  duplicate lines. v1 mitigation: each import is its own `BankStatementImport`
  batch shown separately, and the matcher excludes already-reconciled payments,
  so a re-upload's lines find no fresh matches and can be bulk-IGNORED. A content
  hash dedupe (skip identical txnDate+amount+ref already imported for the account)
  is a SHOULD — added to the service as a soft warning count, not a hard block, in v1.
