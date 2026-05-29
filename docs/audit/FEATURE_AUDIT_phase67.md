phase: 6+7 (features 135-150)

# Feature Audit — Phase 6 (Staff/HR/Multi-firm/Audit/PIN) + Phase 7 (AI & Differentiators)

Adversarial verification of `docs/HISAABPRO.md` lines 1064–1096. Each row's
claimed evidence was located, opened, and checked for real logic (not stub /
TODO / throw). Audit-only; no source modified.

| # | feature | verdict | evidence checked | notes |
|---|---------|---------|------------------|-------|
| 135 | Staff Attendance | VERIFIED | `server/src/routes/hr-attendance.routes.ts` (GET matrix + POST batch, gated by requireRecentPin) | real routes, employee×day batch endpoint present |
| 136 | Payroll | VERIFIED | `server/src/services/payroll/*` (compute, preview, run.service, run-reverse, snapshot) | reversal logic real, no stubs |
| 137 | Salary Slips | VERIFIED | payroll-snapshot.ts + PayslipSnapshot model + payroll service | snapshot/viewer/reverse present |
| 138 | Multi-firm — tenancy audit | VERIFIED | `docs/archive/TENANCY_AUDIT.md` (doc artifact) | doc-marked PR0 audit; artifact exists |
| 138 | Multi-firm — schema | VERIFIED | `server/prisma/schema.prisma` (Business/BusinessUser, version cols, suspendedAt) | schema tables + cols present |
| 138 | Multi-firm — requireActiveBusiness | VERIFIED | `server/src/middleware/require-active-business.ts` | **businessId server-derived from `req.user` JWT, never body**; filters by `req.user.userId` (A01.1 IDOR guard), 4 distinct 403 codes, firm+member suspend checks. Filename differs from doc (`require-active-business.ts` vs `requireActiveBusiness.ts`) — naming only |
| 138 | Multi-firm — suspend/reactivate UX | VERIFIED | `firm-suspended.test.ts` + `businesses-suspend.test.ts` + businesses.routes.ts | FIRM_SUSPENDED/MEMBER_SUSPENDED wired BE; FE chip/banner referenced |
| 139 | Advanced Audit Trail — search/diff/redaction/CSV | VERIFIED | `server/src/services/audit/audit-search.service.ts:137` + audit-redaction.service.ts | **uses `websearch_to_tsquery('english',$1)`, never bare `to_tsquery`** (A03.1); test asserts the predicate |
| 139 | Audit — 13 mutations + `--block` | VERIFIED | `scripts/enforce-audit-coverage.mjs` (supports `--block`) | enforcer present with block flag |
| 140 | Transaction PIN — requireRecentPin | VERIFIED | `server/src/middleware/require-recent-pin.ts` + `services/security-pin/*` (pin-grace-cookie, pin-hash, lockout, verify, reset) | real grace-cookie verify, route-class freshness windows, 403 PIN_REQUIRED (not 401 — avoids refresh loop). Filename differs from doc — naming only |
| 140 | PIN — PinGateProvider + interceptor | VERIFIED | `src/features/pin-gate/*` + 403 PIN_REQUIRED contract | FE pin-gate feature dir exists; 403 handler matches BE wire reason map |
| 141 | AI receipt categorize — Haiku OCR | VERIFIED | `server/src/services/expense/expense-ocr.service.ts` + `expense-ocr.client.ts` (Anthropic, max_tokens 256) | real OCR client |
| 141 | OCR — 5 MB cap + graceful | VERIFIED | `expense-ocr.route.ts` (8mb json + per-business rate limit) + service:71 `Image exceeds 5 MB size limit` | decoded-size guard real |
| 142 | Voice entry | VERIFIED | `src/features/voice/*` (voice.parser.ts 154L, components/hooks/page) + 22 parser tests | **22 tests confirmed**; parser pure, 0 TODO/throw-stub |
| 143 | WhatsApp bot billing | VERIFIED-as-absent | `webhooks/notifications-aisensy.routes.ts` + `marketing-aisensy.routes.ts` are STUB (501 NOT_IMPLEMENTED) / delivery+marketing only — NOT an inbound billing bot | correctly Not Started; no billing-draft webhook exists |
| 144 | Smart GST filing assistant | VERIFIED | `server/src/services/gst-validation/*` (gst-rules.ts 5 exported rules, service, types) + 18 tests | **18 tests confirmed**; reuses period.utils per doc |
| 145 | Verticals — 13 SSOT + nav | VERIFIED | `src/config/verticals.config.ts` (VERTICAL_PROFILES = 13 entries, picker order, JOBS/ORDERS visible sets) | exactly 13 verticals |
| 145 | Verticals — Jobs flow | VERIFIED | `server/src/services/job/*` + `routes/jobs.ts` | full CRUD+convert-to-invoice service |
| 145 | Verticals — Custom Orders | VERIFIED | `server/src/services/custom-order/*` + `routes/custom-orders.ts` | advance/convert/transition present |
| 146 | Predictive analytics | VERIFIED | `server/src/services/analytics/forecast.math.ts` + forecast.service + types + 23 tests | **23 tests confirmed**; OLS+velocity math is the SSOT (reused by #148) |
| 147 | Auto-reconciliation (absorbs #89) | VERIFIED | `server/src/services/bank-reconciliation/*` (parser, match-engine, match.service, import, repository) + `routes/bank-reconciliation.routes.ts` + FE feature | CSV→match→confirm/ignore/un-reconcile real; #89 cheque-match absorbed into match engine |
| 148 | Smart inventory reorder | VERIFIED | `server/src/services/inventory/reorder.math.ts` + reorder.service + 15 tests | **15 tests confirmed**; **reorder.service imports `dailyVelocity/daysToStockOut/addDaysIso` from `analytics/forecast.math.js` — #146 math reused, NOT duplicated** |
| 149 | Competitor importers (parties/products/invoices/payments + legacy retirement) | VERIFIED | `server/src/services/import/*` (parsers, commit-{parties,products,invoices,payments}, dedup, audit-emit) + `src/features/import/` | full import engine; legacy data-import retired (FE `import` is sole surface) |
| 150 | Real-time multi-user (LWW + optimistic lock + presence) | VERIFIED | `server/src/lib/optimistic-lock.ts` (`bumpVersionOrConflict`, `parseEntityVersion`) + `version Int @default(0)` on party/product/document/payment + `services/presence/*` + `routes/presence.routes.ts` | **atomic conditional `updateMany` inside the write txn (no TOCTOU), 409 CONFLICT + serverVersion, X-Entity-Version header**; tenant-scoped re-read avoids cross-tenant leak; in-memory presence store present |

**Verdict counts:** VERIFIED 22 · VERIFIED-as-absent 1 (#143, correctly Not Started) · PARTIAL 0 · MISSING 0 · DRIFT 0.

## SSOT violations

- none found. Specifically:
  - #148 reorder **reuses** #146 forecast math via `import { dailyVelocity, daysToStockOut, addDaysIso } from '../analytics/forecast.math.js'` (`server/src/services/inventory/reorder.service.ts:8`) — no duplicated forecast math.
  - #150 version logic centralised in one helper (`server/src/lib/optimistic-lock.ts`); the older middleware path is documented dormant (`server/src/middleware/conflict-detection.ts:1-22`) precisely because it had a TOCTOU gap — single live SSOT.
  - businessId consistently server-derived from `req.user`/`req.activeBusiness`, never from request body (grep for `req.body.businessId` in payroll/attendance routes = 0 hits).

## Non-standard code

- `server/src/lib/optimistic-lock.ts:55-56` — `(tx as any)[model]` for dynamic Prisma delegate selection. Eslint-disabled inline with justification; bounded by `LockModel` union, not a real type hole.
- No other `as any` / `@ts-ignore` in any Phase 6/7 scope service or middleware.
- No raw `fetch()` in scope FE features (voice/analytics/reorder/gst-validation/bank-reconciliation/pin-gate) — all `.refetch()` (TanStack Query).
- No scope file exceeds 250 lines (payroll, audit, bank-reconciliation, voice parser, optimistic-lock all under limit).
- Doc/code filename drift (cosmetic, not functional): doc cites `middleware/requireActiveBusiness.ts` and `middleware/requireRecentPin.ts`; actual files are kebab-case `require-active-business.ts` / `require-recent-pin.ts`. Behaviour matches the claim.
