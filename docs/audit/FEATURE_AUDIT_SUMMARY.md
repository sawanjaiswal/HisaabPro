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

- **S1 — GL journal is not fed by transactions.** Only manual JEs, FY-closure,
  and party-ledger touch `JournalEntry`. No invoice/payment/sales/expense service
  auto-posts. So #93 P&L, #94 Balance Sheet, #95 Cash Flow, #96 Trial Balance,
  #97 Day Book report on a book that normal app usage never populates. #102
  Profitability is unaffected (reads `Document` rows). Either auto-posting is
  missing, or the matrix overclaims GL integration. Decide which.
- **N4 — FY-closure always throws on a seeded business.** `fy-closure/close.ts:100`
  finds Retained Earnings by `type:'EQUITY' AND subType:'CAPITAL' AND name~'Retained
  Earnings'`, but `chart-of-accounts.ts:29` seeds it with `subType: null`. Query
  never matches → `validationError('Retained Earnings account not found')`. #99
  FY-closure cannot succeed out of the box. Fix: seed subType `RETAINED_EARNINGS`
  (or relax the lookup to not require subType).

## Tier A — DRIFT (feature real, doc claim wrong)

| # | Feature | Reality |
|---|---------|---------|
| 5  | Email export | `export.service.generateFullExport` is a CSV download, emails nothing |
| 8  | Theme variants + ThemePicker | `ThemeContext` is only `light|dark`; no variants, no picker |
| 58 | Transaction PIN | stored as `User.pinHash`, no `PinCredential` model (works) |
| 62 | Calculator FAB | exists as `CalculatorOverlay` launched from SideNav, not a FAB |
| 76 | HSN auto-fill | no 12K seed (zero create/upsert), no trgm GIN index; plain `startsWith`/`contains` |
| 90 | Receipt vouchers | FIXED 2026-05-29 — client-side React-PDF voucher (`features/payments/voucher/`), download+print on PaymentDetailPage. No endpoint by design (PDF is 100% client-side here) |
| 91 | Payment vouchers | FIXED 2026-05-29 — same component, PAYMENT template for *_OUT types |
| 100| Tally export | real, but at `reports/tally-export.ts` not cited `routes/export.ts` |
| 104| COGS/WAC journal | WAC real in inventory/bom; no COGS journal-posting branch in accounting |
| 130| Web invoice links | opaque 32-byte token + `sha256` tokenHash, not "HMAC-signed" (secure either way) |
| 127| CRM | at `routes/parties/crm.routes.ts`, not `routes/collections/` (path-only) |
| 133| BOGO | in `document/` services + `middleware/permission.ts`, not `pricing-resolver.ts` (path-only) |

## Tier B — PARTIAL (incomplete vs claim)

| # | Feature | Gap |
|---|---------|-----|
| 32 | Email invoice PDF | `pdf.service.generateInvoicePdf` is a stub: logs + returns `null` (TODO) |
| 61 | Keyboard shortcuts | no `useKeyboardShortcuts` hook / global listener; ShortcutsPage is display-only |
| 78 | GSTIN external verify | local Mod-36 checksum real; external API is a hardcoded mock (`verified:true`) |
| 92 | Cheque register | FIXED 2026-05-29 — guard now keys on `status !== 'PENDING'` (covers BOUNCED + all terminal states) |
| 114| Reorder points | logic real but schema field is `reorderQty` (schema:809); doc names nonexistent `reorderPoint` |

## Tier C — MISSING

| # | Feature | Reality |
|---|---------|---------|
| 5  | Google Drive backup | `backup.service.ts` has no Drive/googleapis/oauth/upload; local backup only |

## #143 — correctly Not Started
WhatsApp inbound billing-bot genuinely absent (the two aisensy files are 501 delivery/marketing stubs). Matrix claim accurate.

## SSOT violations surfaced (input to the "each data SSOT" task)

- **formatCurrency duplicated** — two implementations (phase 1). Money formatting must be one helper.
- **Account balance stored AND derived** — `LedgerAccount.balance` persisted while also derivable from journal lines (phase 3 S2). Two writers can diverge.
- **Aging logic duplicated** — #41 (party aging) vs #101 (AR aging) reimplement the same buckets (phase 3 S3).
- **Trigger label/badge maps triplicated** — `TRIGGER_LABEL`/`TRIGGER_LABEL_KEYS`/`TRIGGER_BADGE` exhaustive Records in marketing.constants + ReminderTriggerPicker + ReminderRuleListPage (found during V5; adding a trigger requires editing 3 maps).
- **currentStock** — stored on Product AND derivable from StockMovement sum (phase 4). Currently atomic/acceptable but is a stored-vs-derived pair to watch.
- **UPI link builder** — intentional FE+BE dual-impl (documented, low risk).

Non-standard code is minimal: 2 raw `fetch()` + 1 `window.confirm` + 1 >250L file (phase 1); 1 justified `(tx as any)` in optimistic-lock (phase 6/7). No `@ts-ignore` anywhere in scope.
