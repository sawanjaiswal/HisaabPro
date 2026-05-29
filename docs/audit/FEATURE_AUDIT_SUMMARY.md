# Feature Status Matrix — Line-by-Line Code Audit

> Adversarial verification of every row in `docs/HISAABPRO.md` §24 against actual
> code. Run 2026-05-29 by 6 parallel auditors (one per phase). Each row classified
> VERIFIED / PARTIAL / MISSING / DRIFT. Per-phase detail in
> `FEATURE_AUDIT_phase{1,2,3,4,5,67}.md`.

## Roll-up

| Phase | Rows | VERIFIED | PARTIAL | MISSING | DRIFT |
|-------|------|----------|---------|---------|-------|
| 1A–1H (1–62)        | 66 | 60 | 2 | 1 | 3 |
| 2 GST (63–82)       | 20 | 18 | 1 | 0 | 1 |
| 3 Accounting (83–104)| 22 | 17 | 1 | 0 | 4 |
| 4 Inventory/POS (105–120)| 16 | 15 | 1 | 0 | 0 |
| 5 Sales/Mktg (121–134)| 18 | 17 | 0 | 0 | 1 |
| 6+7 (135–150)       | 23 | 23 | 0 | 0 | 0 |
| **Total**           | **165** | **150** | **5** | **1** | **9** |

~91% of rows verify exactly as the doc claims. The deltas below are the actionable list.

## Tier S — real bugs / integration gaps (NOT just doc drift)

- **S1 — GL journal is not fed by transactions.** FIXED 2026-05-29. Documents,
  payments, AND expenses now auto-post to the GL through the single-writer
  posting layer (`accounting/posting/`). `postDocument`/`postPayment`/`postExpense`
  build one balanced POSTED `JournalEntry` + lines and route every balance write
  through `postLedgerDeltas` (the SSOT writer guarded by enforce.js Check 13b).
  Idempotency is enforced by a partial unique index on
  `(businessId, sourceType, sourceId) WHERE status='POSTED'`
  (migration `20260529062430_gl_source_idempotency_unique`). Edits/deletes call
  `reverseSourceEntry` (VOIDs the POSTED JE in place + reverses balances; no-op
  when nothing is posted) and re-post fresh values. Closed gap this session was
  expense lifecycle — manual `createExpense`/`updateExpense`/`deleteExpense` only
  the recurring-confirm path posted before; now all three wire through
  `expense/expense-gl.ts`. So #93 P&L, #94 Balance Sheet, #95 Cash Flow,
  #96 Trial Balance, #97 Day Book now populate from normal app usage. The SALE
  posting map also emits the #104 COGS leg (`5050` = `totalCost`), so gross
  margin is journal-backed too.
- **N4 — FY-closure always throws on a seeded business.** ALREADY FIXED (verified
  2026-05-29). `fy-closure/close.ts:104` now resolves Retained Earnings by the
  stable seeded code `3100` (`type:'EQUITY' AND code:'3100'`); the old
  `subType:'CAPITAL'` filter (which never matched the seed's `subType: null`) is
  gone. `chart-of-accounts.ts:31` seeds `3100 Retained Earnings`. #99 FY-closure
  succeeds out of the box. See `.claude/fix-trace-fy-closure-re.md`.

## Tier A — DRIFT (feature real, doc claim wrong)

| # | Feature | Reality |
|---|---------|---------|
| 5  | Email export | `export.service.generateFullExport` is a CSV download, emails nothing |
| 8  | Theme variants + ThemePicker | `ThemeContext` is only `light|dark`; no variants, no picker |
| 58 | Transaction PIN | stored as `User.pinHash`, no `PinCredential` model (works) |
| 62 | Calculator FAB | exists as `CalculatorOverlay` launched from SideNav, not a FAB |
| 76 | HSN auto-fill | FIXED 2026-05-29 — curated subset seeded (`prisma/data/hsn-curated.ts` 126 codes, `prisma/seed.hsn.ts` idempotent upsert, `npm run db:seed:hsn`); B-tree `@@index([description])` replaced by pg_trgm GIN `hsn_description_trgm` (migration `20260529163000_hsn_description_trgm`, raw SQL create-then-drop). EXPLAIN confirms `ILIKE '%q%'` rides the GIN. Search route unchanged (`code startsWith` then `description contains`). FUTURE: full ~12K master load (needs authoritative dataset) |
| 90 | Receipt vouchers | FIXED 2026-05-29 — client-side React-PDF voucher (`features/payments/voucher/`), download+print on PaymentDetailPage. No endpoint by design (PDF is 100% client-side here) |
| 91 | Payment vouchers | FIXED 2026-05-29 — same component, PAYMENT template for *_OUT types |
| 100| Tally export | real, but at `reports/tally-export.ts` not cited `routes/export.ts` |
| 104| COGS/WAC journal | FIXED 2026-05-29 — SALE posting map now emits a COGS leg (`posting.maps.ts:76` pushes `5050` Cost of goods sold = `d.totalCost`); WAC stays in inventory/bom and feeds `totalCost` into the document posting |
| 130| Web invoice links | opaque 32-byte token + `sha256` tokenHash, not "HMAC-signed" (secure either way) |
| 127| CRM | at `routes/parties/crm.routes.ts`, not `routes/collections/` (path-only) |
| 133| BOGO | in `document/` services + `middleware/permission.ts`, not `pricing-resolver.ts` (path-only) |

## Tier B — PARTIAL (incomplete vs claim)

| # | Feature | Gap |
|---|---------|-----|
| 32 | Email invoice PDF | FIXED 2026-05-29 — null-stub `pdf.service` deleted; invoice PDF now rendered client-side (React-PDF) and uploaded as base64 to `:id/share/email`, which attaches it via Resend (needs Resend creds to deliver) |
| 61 | Keyboard shortcuts | FIXED 2026-05-29 — `useKeyboardShortcuts` global keydown listener added (mounted via PersistentNav, auth-gated); wires alt+1..5 navigation, ctrl+n new invoice, ctrl+. calculator toggle. Bare-key/form-native shortcuts (Tab/Enter/Esc/save/print) stay form-local by design; ctrl+k search awaits a command palette |
| 78 | GSTIN external verify | FIXED 2026-05-29 — hardcoded `verified:true` mock removed; `gstin-verify.service` now calls a real GSP registry (env `GSTIN_VERIFY_API_URL/KEY`, same opt-in pattern as Resend/Aisensy). `verified` reflects an actual active-registration confirmation; when unconfigured returns `verified:false, providerConfigured:false` (never fabricates a pass). Cred-blocked on GSP key |
| 92 | Cheque register | FIXED 2026-05-29 — guard now keys on `status !== 'PENDING'` (covers BOUNCED + all terminal states) |
| 114| Reorder points | logic real but schema field is `reorderQty` (schema:809); doc names nonexistent `reorderPoint` |

## Tier C — MISSING

| # | Feature | Reality |
|---|---------|---------|
| 5  | Google Drive backup | `backup.service.ts` has no Drive/googleapis/oauth/upload; local backup only |

## #143 — correctly Not Started
WhatsApp inbound billing-bot genuinely absent (the two aisensy files are 501 delivery/marketing stubs). Matrix claim accurate.

## SSOT violations surfaced (input to the "each data SSOT" task)

- ~~**formatCurrency duplicated**~~ — FIXED 2026-05-29. Deprecated `formatCurrency` deleted; all 20 call sites migrated to canonical `formatPaise` (`CURRENCY` config == hardcoded en-IN/INR/2, so output is byte-identical). `formatCurrencyFromString` (BigInt-safe import variant) already wraps `formatPaise` — not a duplicate.
- ~~**Account balance stored AND derived**~~ — FIXED 2026-05-29 (epic `ssot-stored-vs-derived`, gold-standard /start-epic, architect PASS rev3). `LedgerAccount.balance` is now a *verified cache* of `SUM(POSTED JournalLine via balanceDelta)`, written through ONE function (`postLedgerDeltas`/`repairLedgerBalance` in `accounting/posting/ledger-deltas.ts`). The 5 ad-hoc writers (posting/index, journal-entries post+void, reverse-entry, fy-close, fy-reopen) all route through it with the single `balanceDelta` sign convention. fy-close now emits a per-account closing line for EVERY non-zero income/expense account regardless of sign (contra-income/expense-refund no longer stranded), so the blanket `set balance:0` is gone — balance stays a pure function of the journal lines. New `POST /api/accounting/reconcile-balances` (owner + recent-PIN, serializable, tenant-scoped) detects/repairs drift toward the journal truth. `enforce.js` Check 13b fails the build on any new balance writer outside the single-writer file. Tests assert `stored == derived` after post/reverse/close/reopen incl. a wrong-sign net-loss close→reopen cycle.
- **Aging logic** — ASSESSED 2026-05-29, NOT a dedup (intentional divergence). #101 AR report (`services/reports/aging.ts`) uses 6 buckets (splits 90+ into days91to120/over120), `dueDate ?? documentDate` fallback, `status != DELETED`, covers RECEIVABLE *and* PAYABLE, TS loop. #41 collections (`services/collections/aging-query.ts`) uses 4 buckets (90+ lumped), `dueDate ?? documentDate+30d` fallback, `status IN (SAVED,SHARED)`, RECEIVABLE only, raw SQL. Only the 30/60/90 edges coincide; merging would change one report's output — left as-is per "no premature abstraction."
- ~~**Trigger label/badge maps triplicated**~~ — FIXED 2026-05-29. Dead hardcoded-English `TRIGGER_LABEL` deleted; trigger→i18n-key map hoisted to a single `TRIGGER_LABEL_KEYS` (+ `TriggerLabelKey` type) in marketing.constants; ReminderRuleListPage and ReminderTriggerPicker now import it. `TRIGGER_BADGE` was already single-source. Adding a trigger now edits one map.
- **currentStock** — stored on Product AND derivable from StockMovement sum (phase 4). Currently atomic/acceptable but is a stored-vs-derived pair to watch.
- **UPI link builder** — intentional FE+BE dual-impl (documented, low risk).

Non-standard code is minimal: 2 raw `fetch()` + 1 `window.confirm` + 1 >250L file (phase 1); 1 justified `(tx as any)` in optimistic-lock (phase 6/7). No `@ts-ignore` anywhere in scope.

## Audit findings (test-contract drift, surfaced 2026-05-29 during S1)

- **Route-test arg-drift (PUT handlers) — FIXED 2026-05-29.** The
  documents / parties / payments / products update handlers each pass a trailing
  optimistic-lock version arg (`parseEntityVersion(...)`, `undefined` when no
  version header) — and documents/parties/payments also pass the audit-actor
  `userId` — but their route-level `toHaveBeenCalledWith` assertions hadn't been
  updated for the extra arg(s). All 4 PUT tests now assert the full signature
  (trailing `undefined` for the version). Root cause was assertion drift, not a
  product bug — the handlers were correct. 48/48 green across the 4 route test
  files.
