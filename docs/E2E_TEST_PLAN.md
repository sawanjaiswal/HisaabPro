# HisaabPro — Gold-Standard E2E Test Plan (Pre-Production)

> Purpose: prove the app works end-to-end **as a real user experiences it** —
> from downloading the app to running a GST invoice business — before the
> production flip.
> Status: **v2 — test cases only.** Execution happens one suite at a time
> against a real backend + real Postgres, driven by Playwright (Chromium,
> 375px primary).
>
> **Part I (§1–19)** = the core money path — the flip-blocking spine.
> **Part II (§20–36)** = the remaining 40+ feature modules + the universal
> edge-case matrix that deepens every CRUD suite in Part I.
> Part I alone is **not** full coverage: the app has 72 feature modules and
> ~200 routes. Read §1.5 for the honest coverage ledger.

---

## 0. Ground rules

| Rule | Value |
|---|---|
| Primary viewport | 375 × 812 (mobile-first). Secondary: 320, 768, 1280 |
| Browser | Chromium (matches Android WebView / Capacitor 8) |
| Backend | **Real** Express + real Postgres. No `page.route` mocking. |
| Data | Fresh tenant per run (`+91 9<random>`), torn down after |
| Money | Verified in paise on the wire, `₹1,00,000` in the UI |
| Pass bar | Golden path + ≥1 edge case per suite, 0 console errors, no horizontal scroll |
| Priority | **P0** = blocks production · **P1** = blocks GA · **P2** = polish |

### Case ID scheme

`TC-<AREA>-<nn>` — e.g. `TC-REG-03`. Each case is atomic: one precondition,
one action set, one assertion cluster. Cases never depend on a *previous
case's UI state* — only on named fixtures (`FIX-*`).

### Fixtures

| ID | Description |
|---|---|
| `FIX-NEW` | Unregistered phone, no user, no business |
| `FIX-ONBOARDED` | Verified user, 1 business, onboarding complete, zero data |
| `FIX-SEEDED` | `FIX-ONBOARDED` + 10 parties, 15 products, 5 invoices, 3 payments |
| `FIX-GST` | `FIX-SEEDED` + GSTIN set, tax rates configured, place-of-supply set |
| `FIX-STAFF` | `FIX-SEEDED` + 1 staff user with a limited role |

---

## 1.5 Coverage ledger (read this before trusting the plan)

| | Count |
|---|---|
| Feature modules in `src/features/` | **72** |
| Route entries in `routes.config.ts` | **~200** |
| Modules covered by **Part I** | 17 (the money path) |
| Modules covered by **Part II** | 43 |
| Deliberately **out of scope** | 12 (listed in §36) |

**Part I is the production-flip gate.** Part II is GA-completeness. If you flip
to production on Part I alone, you are shipping ~55 feature modules that have
never been walked end-to-end — several of which (POS, purchases, expenses,
recurring, e-invoice) write to the same ledger the money path reads from, so a
bug there corrupts numbers Part I already certified.

---

## 1. BLOCKERS — ✅ ALL FIXED (2026-07-26)

These were harness defects found while surveying the repo. Each one made the
then-current e2e output **non-evidence**. All four are now closed and verified.

| ID | Blocker | Fix shipped | Proof |
|---|---|---|---|
| `BLK-01` | `playwright.config.ts` used `baseURL: localhost:5173` / `webServer.port: 5173`, but Vite is pinned to **5002** with `strictPort: true` — the config could never reach the app | Rewritten: `baseURL: 5002`, `browserName: chromium`, and **two** `webServer` entries (`dev:api` on 5001 with `E2E_TEST_HOOKS=1`, `dev:web` on 5002) because the SPA proxies `/api` to a separate process. `workers: 1` + `fullyParallel: false` — a shared DB cannot take parallel tenants | `playwright.config.ts` |
| `BLK-02` | Every spec authenticated by stubbing `/api/auth/me` + writing `sessionStorage.cachedUser` (`e2e/helpers.ts:5`) | 26 specs + 3 mock helpers moved to `e2e/legacy-mocked/` and excluded via `testIgnore`. Quarantined, not deleted — their selector knowledge gets ported into `e2e/gold/` suite by suite | `e2e/README.md` |
| `BLK-03` | No automation path to an OTP — `sendOTP()` only `logger.debug`s it in dev, and the DB stores a bcrypt hash | `server/src/lib/test-hooks.ts` (in-memory, 50-entry, 5-min buffer) + `GET /api/__test__/last-otp`. Double-guarded: `NODE_ENV!=='production' && E2E_TEST_HOOKS==='1'`, checked at mount **and** per request. OTP hashing is unchanged | **Round trip verified:** `POST /api/auth/register` → `last-otp` returned `110148` → `POST /api/auth/verify-registration` returned `isNewUser:true`. Without the flag: 404 on every `__test__` path while `/api/health` still 200s |
| `BLK-04` | No reset/seed command for a clean tenant | `npm run e2e:reset` truncates **all 150 tables** (derived from `pg_tables`, not a hand-list — the integration suite's 27-table array leaves ~120 dirty). `npm run e2e:seed [-- --gst] [-- --seeded]` builds FIX-ONBOARDED / FIX-GST / FIX-SEEDED, reusing the real `seedDefaultAccounts()` so the GL chart is identical to a production signup's | **Guards verified:** refuses `hisaabpro_dev` (name must end `_test`/`_e2e`), refuses `NODE_ENV=production`, truncated 150 tables in `hisaabpro_test`. Seed run twice → 2 parties / 2 products / 19 GL accounts (idempotent) |

**Gates green after the fixes:** `scripts/enforce.js` ✅ · `enforce-offline.mjs` ✅
(1886 files, 0 violations) · `npm run ssot` ✅ · `tsc --noEmit` ✅ both projects ·
`e2e:coverage` ✅ 402/402 modules mapped.

> `BLK-02` is only structurally closed — the mocked specs no longer count as
> evidence. Real coverage arrives as each suite below is written into
> `e2e/gold/`. That work has not started.

---

## 2. Suite A — First launch & app shell (P0)

Covers what happens between "user downloads the app" and "user sees a screen".

| ID | Case | Steps | Expected |
|---|---|---|---|
| `TC-SHELL-01` | Cold boot, unauthenticated | Clear storage → open `/` | Landing page renders; no redirect loop; no console error |
| `TC-SHELL-02` | Deep-link while logged out | Open `/invoices` directly | Redirect to `/login`, intended path preserved for post-login return |
| `TC-SHELL-03` | Splash → first paint budget | Cold boot on throttled 3G | First contentful paint < 3s; skeletons, never a blank screen |
| `TC-SHELL-04` | APK install shell (Capacitor) | Launch signed build on device/emulator | Status bar + gesture nav do not overlap content (PLATFORM_SHELL C1–C11) |
| `TC-SHELL-05` | Language toggle | Switch to Hindi on the login screen | Every visible string switches; no raw `t.key` leaks; persists across reload |
| `TC-SHELL-06` | Offline cold boot | Kill network → open app | Offline banner shows; cached shell renders; no white screen |
| `TC-SHELL-07` | Stale service worker | Boot with an old SW registered | New SW takes over; update prompt appears; no cached blank tab |
| `TC-SHELL-08` | Bottom nav integrity | Any authenticated page | 5 nav entries, active state = brand emerald, targets ≥ 40px |

---

## 3. Suite B — Registration + OTP (P0)

Real API. Depends on `BLK-03`.

| ID | Case | Steps | Expected |
|---|---|---|---|
| `TC-REG-01` | Golden path | `/register` → name + new phone + password → Continue → enter OTP | Lands on `/onboarding`; auth cookies set; `/api/auth/me` returns the user |
| `TC-REG-02` | Invalid phone | Enter 9 digits | Inline validation; Continue disabled; no API call |
| `TC-REG-03` | Weak password | Enter `12345` | Strength/validation error; submit blocked |
| `TC-REG-04` | Duplicate phone | Register an already-verified phone | Clear "account exists — log in" error, not a 500 |
| `TC-REG-05` | Wrong OTP | Enter `000000` | Shake + "invalid OTP" + attempts-remaining message |
| `TC-REG-06` | OTP attempt lockout | 5 wrong OTPs | Locked with a clear message; 6th attempt rejected server-side |
| `TC-REG-07` | OTP expiry | Wait past TTL (5 min, or force-expire the row) | "OTP expired"; resend offered |
| `TC-REG-08` | Resend cooldown | Tap Resend immediately | Disabled with a visible countdown (30s); enabled after |
| `TC-REG-09` | OTP autofocus/paste | Paste a 6-digit code into box 1 | Digits distribute across all 6 boxes; auto-submits |
| `TC-REG-10` | Direct `/verify-otp` | Navigate with no phone in router state | Redirect to `/register` (no crash) |
| `TC-REG-11` | Rate limit | 10 rapid register calls | 429 with a human message, not a stack trace |
| `TC-REG-12` | Back-button safety | Browser back from OTP screen | Returns to register with fields intact; no ghost session |

---

## 4. Suite C — Login, session, password (P0)

| ID | Case | Steps | Expected |
|---|---|---|---|
| `TC-AUTH-01` | Password login | `/login` → phone + password | Dashboard; cookies set; CSRF token bootstrapped |
| `TC-AUTH-02` | Wrong password | Bad password ×1 | Generic "invalid credentials" (no user-enumeration hint) |
| `TC-AUTH-03` | Brute-force guard | 5 wrong passwords | Rate limit / captcha guard fires |
| `TC-AUTH-04` | Forgot password | `/forgot-password` → OTP → new password → login | Old password rejected, new one works |
| `TC-AUTH-05` | Token refresh | Force access-token expiry mid-session | Silent refresh; user never sees a logout |
| `TC-AUTH-06` | Logout | Settings → Logout | Cookies cleared, IDB/session caches cleared, `/dashboard` redirects to `/login` |
| `TC-AUTH-07` | Session list & revoke | `/settings/sessions` → revoke another device | Revoked device's next call 401s |
| `TC-AUTH-08` | PIN gate | Set app PIN → background → resume | PIN prompt before content; wrong PIN blocks |
| `TC-AUTH-09` | Biometric/WebAuthn | Where supported | Enrol + unlock; graceful fallback where unsupported |
| `TC-AUTH-10` | Login while offline | Offline → attempt login | Clear offline message; no silent hang |

---

## 5. Suite D — Onboarding wizard (P0)

Steps per `onboarding.constants.ts`: welcome → businessDetails → businessType
→ dataSource → startPath → ready.

| ID | Case | Steps | Expected |
|---|---|---|---|
| `TC-ONB-01` | Full golden path | Complete all 6 steps, path = "Start fresh" | Lands on `/dashboard`; business persisted; onboarding never shown again |
| `TC-ONB-02` | Business details validation | Blank business name → Next | Blocked with inline error |
| `TC-ONB-03` | All 8 business types | Select each of general/retail/wholesale/manufacturing/services/restaurant/pharmacy/other | Selection persists; type-specific defaults applied where they exist |
| `TC-ONB-04` | Data-source capture | Pick each of notebook/excel/tally/otherApp/other | Recorded on the business; drives the import step |
| `TC-ONB-05` | Start path = Import | Choose "Import" (recommended) | Routes into the import flow, not the empty dashboard |
| `TC-ONB-06` | Back navigation | Step 4 → back → back | Prior answers retained |
| `TC-ONB-07` | Resume after abandon | Kill app mid-wizard → reopen | Resumes at the same step, not from scratch |
| `TC-ONB-08` | Skip path | Where a skip exists | Dashboard renders correct **empty** states, not errors |
| `TC-ONB-09` | GSTIN at onboarding | Enter a valid GSTIN | Validated (format + checksum); invalid one rejected |
| `TC-ONB-10` | 320px | Whole wizard at 320px | No horizontal scroll, no clipped CTA |

---

## 6. Suite E — Business & multi-business (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-BIZ-01` | Create a second business (`/business/create`) | Appears in the switcher |
| `TC-BIZ-02` | Switch business | All lists re-scope; no leakage of business A data into B |
| `TC-BIZ-03` | Join business via invite (`/join`) | Invite OTP claim works; role applied |
| `TC-BIZ-04` | Staff invite + limited role | Staff sees only permitted nav entries; blocked routes 403 |
| `TC-BIZ-05` | **Tenant isolation probe** (P0) | Direct API call for another business's invoice ID → 403/404, never data |

---

## 7. Suite F — Data import (P0)

Entry points: `/settings/import` (jobs), `/imports`, `/parties/import` (bulk),
formats from `import.constants.ts`: `tally_xml`, `vyapar_csv`, `busy_xls`,
`generic_csv`.

| ID | Case | Expected |
|---|---|---|
| `TC-IMP-01` | Generic CSV — parties, happy path | Upload → column mapping → preview → commit; N parties created, counts match |
| `TC-IMP-02` | Excel (.xlsx) products import | Parsed; units/HSN/price mapped; stock opening balances correct |
| `TC-IMP-03` | Vyapar CSV | Vyapar's column names auto-mapped without manual intervention |
| `TC-IMP-04` | Tally XML | Ledgers → parties, stock items → products |
| `TC-IMP-05` | Busy XLS | Parsed or a clean "unsupported layout" error — never a silent partial |
| `TC-IMP-06` | Column mapping UI | Remap a mis-detected column | Preview updates before commit |
| `TC-IMP-07` | Validation errors | File with bad phone/negative price rows | Per-row errors listed; good rows still importable |
| `TC-IMP-08` | Duplicate detection | Re-import the same file | Dedup path taken; no double parties |
| `TC-IMP-09` | Oversize file | 11 MB upload (cap = 10 MB) | Rejected client-side with a clear message |
| `TC-IMP-10` | Wrong extension | `.pdf` into a CSV slot | Rejected by the accept filter + server validation |
| `TC-IMP-11` | Large file | 5,000-row CSV | Job completes; progress visible; UI stays responsive |
| `TC-IMP-12` | Job detail page | `/imports/:jobId` | Status, counts, error list, downloadable error report |
| `TC-IMP-13` | Import while offline | Attempt upload offline | Blocked with a clear message (uploads are not queueable) |
| `TC-IMP-14` | Rollback / partial failure | Force a mid-job failure | No half-imported ledger; job marked failed |
| `TC-IMP-15` | Money precision | Import `₹1,234.56` | Stored as `123456` paise; displays `₹1,234.56` |

---

## 8. Suite G — Dashboard (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-DASH-01` | Empty state (`FIX-ONBOARDED`) | Friendly empty dashboard with next-step CTAs, not zeros-everywhere |
| `TC-DASH-02` | Populated (`FIX-SEEDED`) | Today's sales, receivables, payables match the seeded data exactly |
| `TC-DASH-03` | Loading state | Skeletons, no layout shift |
| `TC-DASH-04` | Error state | Kill API → error state with a working Retry |
| `TC-DASH-05` | Quick actions | Each tile routes to the right create screen |
| `TC-DASH-06` | Currency formatting | `₹1,00,000` Indian grouping, `tabular-nums` |
| `TC-DASH-07` | Offline | Cached summary + stale indicator |
| `TC-DASH-08` | Responsive | 320/375/768/1280 — no overflow |

---

## 9. Suite H — Parties (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-PTY-01` | Create customer | Appears in list; opening balance correct |
| `TC-PTY-02` | Create supplier | Type respected; shows under payables |
| `TC-PTY-03` | Validation | Blank name / bad phone / duplicate phone all blocked with inline errors |
| `TC-PTY-04` | Edit | Changes persist after reload |
| `TC-PTY-05` | Delete | Confirm dialog (`<ConfirmDialog>`, never `window.confirm`); blocked if txns exist |
| `TC-PTY-06` | Search & filter | Partial name / phone search returns matches |
| `TC-PTY-07` | Pagination | 100+ parties: cursor pagination, no unbounded list |
| `TC-PTY-08` | Party detail | Ledger, balance, transaction history all reconcile |
| `TC-PTY-09` | Party statement report | Opening + txns − payments = closing |
| `TC-PTY-10` | GSTIN on party | Valid GSTIN accepted, invalid rejected; drives B2B invoice classification |
| `TC-PTY-11` | Offline create | Queued with `entityType: 'party'` + label; syncs on reconnect |
| `TC-PTY-12` | 4 UI states | Loading / error / empty / success at 320px |

---

## 10. Suite I — Products & inventory (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-PRD-01` | Create product (non-GST) | Name, unit, sale/purchase price, opening stock |
| `TC-PRD-02` | Create product with HSN + tax % | HSN validated; tax rate attaches to invoice lines |
| `TC-PRD-03` | Validation | Negative price / negative stock blocked |
| `TC-PRD-04` | Edit / delete | Persist; delete blocked when used on invoices |
| `TC-PRD-05` | Categories | Create, assign, filter by category |
| `TC-PRD-06` | Stock adjustment | Adjustment changes stock; ledger entry written |
| `TC-PRD-07` | Low-stock alert | Below reorder point → alert on `/inventory/alerts` |
| `TC-PRD-08` | Stock after invoice | Sale decrements; sales-return increments |
| `TC-PRD-09` | Barcode scan | Scanner opens; scanned code resolves to a product |
| `TC-PRD-10` | Search + pagination | Works with 200+ products |
| `TC-PRD-11` | Stock summary report | Totals match per-product ledger |

---

## 11. Suite J — Invoices, core (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-INV-01` | Create simple invoice | Party + 1 line → save → appears in list with correct total |
| `TC-INV-02` | Multi-line + discount | Line totals, discount, grand total all arithmetically correct |
| `TC-INV-03` | Line-level edit | Change qty/rate → totals recompute live |
| `TC-INV-04` | Invoice numbering | Sequential, no gaps, no duplicates under rapid creation |
| `TC-INV-05` | Save as draft | `/invoices/drafts` holds it; not counted in sales |
| `TC-INV-06` | Edit an existing invoice | Totals, stock, and party ledger all re-reconcile |
| `TC-INV-07` | Delete / cancel | Stock and ledger reversed; audit entry written |
| `TC-INV-08` | Payment on invoice | Full and partial; status → Paid / Partial |
| `TC-INV-09` | PDF generation | React-PDF renders; business name, GSTIN, line items, totals in words |
| `TC-INV-10` | Share via WhatsApp | Share sheet opens with the right payload |
| `TC-INV-11` | Thermal print | 58mm and 80mm layouts render without clipping |
| `TC-INV-12` | Template switching | `/settings/templates` change reflects in the PDF |
| `TC-INV-13` | Offline create | Queued, labelled with the invoice number, syncs on reconnect |
| `TC-INV-14` | Rounding | ₹0.005-class cases round consistently; no floating-point drift |
| `TC-INV-15` | Validation | No party / no lines / zero qty blocked |
| `TC-INV-16` | Keyboard flow | Tab order and Enter-to-add-line work on desktop |
| `TC-INV-17` | 4 UI states + 320px | All four states clean at 320px |

---

## 12. Suite K — GST invoicing (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-GST-01` | Enable GST | `/settings/gst`: GSTIN + place of supply saved and validated |
| `TC-GST-02` | Tax rates | `/settings/tax-rates`: create 0/5/12/18/28%; assign to products |
| `TC-GST-03` | Intra-state invoice | Same state → **CGST + SGST** split, each half the rate |
| `TC-GST-04` | Inter-state invoice | Different state → **IGST** at the full rate |
| `TC-GST-05` | Mixed-rate invoice | Per-line rates; GST summary groups correctly by rate |
| `TC-GST-06` | B2B vs B2C | Party with GSTIN → B2B classification; without → B2C |
| `TC-GST-07` | HSN on lines | HSN prints on the PDF; required where mandated |
| `TC-GST-08` | Reverse charge | Flagged invoice computes and labels RCM correctly |
| `TC-GST-09` | Tax-inclusive pricing | Inclusive mode back-computes taxable value correctly |
| `TC-GST-10` | GSTR-1 export | `/gst/returns/gstr1` totals match the invoice set |
| `TC-GST-11` | GSTR-3B summary | `/gst/returns/gstr3b` outward-supply totals reconcile |
| `TC-GST-12` | Tax summary report | `/reports/tax-summary` matches GSTR-1 |
| `TC-GST-13` | GST backfill wizard | `/gst/backfill` applies GST to pre-GST invoices without corrupting totals |
| `TC-GST-14` | Filing readiness | `/gst/filing-readiness` flags missing GSTIN / HSN / place-of-supply |
| `TC-GST-15` | Non-GST business | GST off → no GST fields anywhere; PDF has no tax block |
| `TC-GST-16` | Credit note / sales return | Reverses tax correctly and appears in returns |
| `TC-GST-17` | Composition + tax category | Composition dealer charging GST is refused (400) |
| `TC-GST-18` | Composition inter-state | Composition dealer selling inter-state is refused (400) |
| `TC-GST-19` | Bill of Supply | Composition sale saves with zero tax on every head |

> Implementation split: `TC-GST-01..08`, `17..19` live in
> `e2e/gold/gst-invoicing.spec.ts`. The return-side cases (`TC-GST-10..14`)
> live in `e2e/gold/gst-returns.spec.ts` under their own `TC-GSTR-01..12`
> numbering — same suite, separate file. Suite L is Payments.

---

## 13. Suite L — Payments, outstanding, collections (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-PAY-01` | Record receipt against invoice | Invoice status + party balance update |
| `TC-PAY-02` | Advance payment (no invoice) | Sits as an on-account credit; adjustable later |
| `TC-PAY-03` | Payment modes | Cash / UPI / bank / cheque each persist and report correctly |
| `TC-PAY-04` | Edit / delete payment | Ledger reverses cleanly |
| `TC-PAY-05` | Outstanding page | Receivables total = sum of unpaid invoices |
| `TC-PAY-06` | Aging report | Buckets (0-30/31-60/61-90/90+) correct |
| `TC-PAY-07` | Collections buckets | `/collections/bucket/:bucket` matches aging |
| `TC-PAY-08` | Reminder send | WhatsApp/SMS reminder composes with correct amount + party |
| `TC-PAY-09` | Cheque lifecycle | `/cheques`: pending → cleared → bounced states |
| `TC-PAY-10` | Cash register | `/cash-register` opening + receipts − payouts = closing |

---

## 14. Suite M — Reports (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-RPT-01` | Sales report | Totals equal the sum of invoices in range |
| `TC-RPT-02` | Purchase report | Same for purchases |
| `TC-RPT-03` | Day book | Every txn for a date, nothing missing |
| `TC-RPT-04` | Profit & loss | Revenue − COGS − expenses = net; ties to trial balance |
| `TC-RPT-05` | Balance sheet | Assets = Liabilities + Equity (exact) |
| `TC-RPT-06` | Trial balance | Debits = Credits |
| `TC-RPT-07` | Cash flow | Ties to cash register + bank |
| `TC-RPT-08` | Date-range filters | Custom range, FY, month presets all correct |
| `TC-RPT-09` | Export | PDF + Excel export open and contain the on-screen data |
| `TC-RPT-10` | Empty range | Clean empty state, not `NaN` / `₹NaN` |

---

## 15. Suite N — Settings (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-SET-01` | Business profile | Name, address, logo, GSTIN persist and reach the PDF |
| `TC-SET-02` | Invoice/document settings | Prefix, starting number, terms apply to new invoices |
| `TC-SET-03` | Theme + dark mode | Toggle works; parity across every screen (no `dark:` classes) |
| `TC-SET-04` | Language | Full app in Hindi; no missing keys |
| `TC-SET-05` | Units | Custom unit created and selectable on products |
| `TC-SET-06` | Roles & permissions | Role edits take effect immediately for the staff user |
| `TC-SET-07` | Backup & restore | Export produces a restorable file; restore reproduces the data |
| `TC-SET-08` | Audit log | Create/edit/delete each write an audit row with the right actor |
| `TC-SET-09` | Subscription | `/settings/subscription`: plan shown; Razorpay checkout reaches the gateway (test mode) |
| `TC-SET-10` | Paid-feature gating | A gated feature on the free plan shows the upgrade path, and the API 402s |

---

## 16. Suite O — Offline & sync (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-OFF-01` | Go offline mid-session | Offline banner appears within 5s |
| `TC-OFF-02` | Queue a mutation | Party/invoice/payment created offline shows in the queue with a human label |
| `TC-OFF-03` | Reconnect sync | Queue drains in order; server state matches |
| `TC-OFF-04` | Conflict | Same record edited on two devices → resolution is deterministic and surfaced |
| `TC-OFF-05` | Queue survives restart | Kill and relaunch the app offline → queue intact |
| `TC-OFF-06` | Idempotency | Replayed POST does not double-create |
| `TC-OFF-07` | Optimistic `{}` return | No handler dereferences `created.id` (no crash offline) |
| `TC-OFF-08` | Cache PII discipline | `/auth/*`, `/me` never land in the read cache; caches cleared on logout |

---

## 17. Suite P — Responsive, a11y, performance (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-UI-01` | 320px sweep | Every route: no horizontal scroll |
| `TC-UI-02` | 375 / 768 / 1280 sweep | Layouts adapt; SideNav rail doesn't overlap at 1024-1279 |
| `TC-UI-03` | Touch targets | ≥ 40px on every interactive element |
| `TC-UI-04` | Font floor | Nothing below 9px (`--fs-3xs`) |
| `TC-UI-05` | Contrast | ≥ 4.5:1 body text, light **and** dark |
| `TC-UI-06` | Axe sweep | 0 serious/critical violations on the top 15 routes |
| `TC-UI-07` | Keyboard nav | Every flow completable by keyboard; focus rings visible |
| `TC-UI-08` | Lighthouse | Perf ≥ 80, A11y ≥ 90 on dashboard + invoice create |
| `TC-UI-09` | Slow 3G | Golden path usable on throttled 3G |
| `TC-UI-10` | Console clean | 0 errors across the full happy-path walk |

---

## 18. Suite Q — Security (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-SEC-01` | Cross-tenant read | Business B's IDs on every list/detail endpoint → 403/404 |
| `TC-SEC-02` | Cross-tenant write | Update/delete another tenant's record → denied |
| `TC-SEC-03` | Unauthenticated API | Every `/api/*` without cookies → 401 |
| `TC-SEC-04` | CSRF | State-changing call without the CSRF token → rejected |
| `TC-SEC-05` | Role escalation | Staff hitting an admin route → 403 |
| `TC-SEC-06` | Input validation | XSS payload in party name → escaped everywhere, incl. PDF |
| `TC-SEC-07` | Rate limits | Auth + OTP + expensive reports all limited |
| `TC-SEC-08` | PII in logs | No phone/GSTIN/token in client console or server logs |
| `TC-SEC-09` | Test hooks are not a production surface | `/api/__test__/*` returns 404 when `E2E_TEST_HOOKS` is unset, and is never mounted when `NODE_ENV=production` even if the flag IS set. **Verified 2026-07-26**: with the flag → `{"testHooks":true}`; without it → 404 on every path while `/api/health` still 200s |

---

## 19. Execution order & exit criteria

Run in this order — each depends on the previous producing real data:

```
BLK-01/03/04 fixes
  → A (shell)  → B (register/OTP)  → C (auth)  → D (onboarding)
  → E (business) → F (import) → G (dashboard)
  → H (parties) → I (products) → J (invoices) → K (GST)
  → L (payments) → M (reports) → N (settings)
  → O (offline) → P (responsive/a11y) → Q (security)
```

**Production-flip exit criteria**

1. 100% of **P0** cases pass, with a screenshot or API-response artefact each.
2. 0 console errors on the full golden-path walk.
3. Trial balance, P&L, and balance sheet reconcile on `FIX-SEEDED`.
4. Cross-tenant probes (`TC-SEC-01/02`) all deny.
5. `npm run qa:full` green (`typecheck` + `enforce.js` + `build`).
6. `npm run ssot` exit 0.
7. Every P1 failure has a written accept/defer decision.

Results land in `docs/E2E_RESULTS.md` — one row per case: `id · status ·
artefact · defect ref`.

---
---

# PART II — Full coverage & edge-case depth

Part I certifies the money path. Part II is what makes this a *gold standard*:
the universal edge-case matrix (§20) plus the 43 feature modules Part I
doesn't touch (§21–35).

---

## 20. Universal edge-case matrix (P0 — the real edge coverage)

Enumerating 15 edge cases × 40 entities by hand produces an unmaintainable
document. Instead: **every create/edit form and every list in the app is tested
against this matrix.** A case ID is formed as `EDGE-<dimension>@<entity>` —
e.g. `EDGE-D07@invoice`.

### 20.1 Input & data dimensions (apply to every form)

| Dim | Dimension | Expected |
|---|---|---|
| `D01` | Empty required field | Inline error, submit blocked, **no API call** |
| `D02` | Whitespace-only input | Treated as empty, trimmed before save |
| `D03` | Max-length string (255 / 1000 chars) | Accepted to the cap, rejected past it, never truncated silently |
| `D04` | Unicode: Hindi, Tamil, emoji, RTL | Stored, redisplayed, and **rendered in the PDF** without mojibake |
| `D05` | Injection payloads (`<script>`, `'; DROP`, `{{7*7}}`) | Escaped in list, detail, PDF, WhatsApp share, and CSV export |
| `D06` | Negative number where invalid (qty, price, stock) | Rejected with a clear message |
| `D07` | Zero (qty 0, rate 0, amount 0) | Explicitly allowed **or** explicitly rejected — never a silent no-op |
| `D08` | Very large number (₹99,99,99,999) | No overflow, correct Indian grouping, correct paise |
| `D09` | Decimal precision (3-decimal qty, ₹0.005) | Consistent rounding rule; total ≠ sum-of-lines never happens |
| `D10` | Leading zeros / `+91` / spaces in phone | Normalised to one canonical form before dedup |
| `D11` | Paste a formatted number (`1,00,000`) | Parsed, not rejected |
| `D12` | `e` / `E` / `+` / `-` typed in a number input | Blocked on `onKeyDown` |
| `D13` | Future date / date before business start / 29-Feb | Validated per field intent, not crashed |
| `D14` | FY boundary (31-Mar 23:59 → 01-Apr 00:00) | Lands in the correct financial year in every report |
| `D15` | Timezone (device set to UTC / US) | Dates stay IST-correct — no off-by-one-day rows |

### 20.2 Behavioural dimensions (apply to every mutation)

| Dim | Dimension | Expected |
|---|---|---|
| `B01` | Double-submit (rapid double tap) | One record created — idempotency holds |
| `B02` | Two tabs, same record, concurrent edit | Deterministic resolution; loser is told |
| `B03` | Refresh mid-form | Draft preserved **or** an explicit discard warning |
| `B04` | Browser back mid-form | Unsaved-changes guard fires |
| `B05` | Parent deleted while child form open | Clean error, not a 500 |
| `B06` | Network drops mid-submit | Queued offline with a human label; no duplicate on retry |
| `B07` | Server 500 | Error state with Retry; form data not lost |
| `B08` | Server 401 mid-action | Silent refresh, action resumes — user is not dumped to login |
| `B09` | Server 402 (paid gate) | Upgrade sheet, not a raw error |
| `B10` | Server 403 (role) | "No permission" state, action hidden going forward |
| `B11` | Rate-limited (429) | Human message with retry-after |
| `B12` | Slow response (5s+) | Button disabled + spinner; no double-fire |

### 20.3 List dimensions (apply to every list page)

| Dim | Dimension | Expected |
|---|---|---|
| `L01` | 0 items | Empty state with a create CTA |
| `L02` | 1 item | No pagination chrome |
| `L03` | Exactly page-size items | No phantom "next page" |
| `L04` | 1000+ items | Cursor pagination; scroll stays smooth; no unbounded fetch |
| `L05` | Search with 0 matches | "No results" ≠ "no data yet" (different copy) |
| `L06` | Search with special chars / Hindi | Matches correctly |
| `L07` | Filter + search + sort combined | Compose correctly; clearing one keeps the others |
| `L08` | Filter state after back-navigation | Preserved |
| `L09` | Item deleted in another tab | List reconciles on refetch, no ghost row |
| `L10` | Long names / long numbers | Truncate with ellipsis, no layout break at 320px |

### 20.4 Entities the matrix runs against

`party` · `product` · `product-category` · `invoice` · `invoice-line` ·
`payment` · `expense` · `other-income` · `purchase` · `purchase-return` ·
`sales-return` · `estimate` · `sale-order` · `delivery-challan` ·
`recurring-invoice` · `pos-sale` · `job` · `custom-order` · `godown` ·
`batch` · `serial` · `stock-adjustment` · `stock-verification` · `bom` ·
`production-run` · `bank-account` · `cheque` · `loan` · `journal-entry` ·
`account` · `employee` · `attendance` · `payroll-run` · `tax-rate` ·
`price-list` · `unit` · `role` · `staff` · `campaign` · `marketing-template` ·
`reminder` · `appointment` · `coupon`

> **Execution note:** the matrix is table-driven — one Playwright spec loops
> the dimensions over an entity descriptor. P0 entities (`party`, `product`,
> `invoice`, `payment`, `purchase`, `expense`, `pos-sale`) get the full
> matrix; the rest get D01/D05/D06/B01/B06/L01/L04 as a smoke subset.

---

## 21. Suite R — POS / quick sale (P0)

POS writes to stock + the ledger, so a bug here corrupts Part I's numbers.

| ID | Case | Expected |
|---|---|---|
| `TC-POS-01` | Quick sale, cash | Sale saved, stock decremented, cash register updated |
| `TC-POS-02` | Barcode-driven cart | Scan adds line; scanning twice increments qty |
| `TC-POS-03` | Unknown barcode | Clear "not found" + create-product shortcut |
| `TC-POS-04` | Split payment (cash + UPI) | Both tenders recorded; totals reconcile |
| `TC-POS-05` | Discount at cart level | Applied after line totals; GST recomputes on the discounted value |
| `TC-POS-06` | Held / parked sale | Resumable; not counted until completed |
| `TC-POS-07` | Sale with a walk-in (no party) | Allowed; reported under cash sales |
| `TC-POS-08` | Out-of-stock item | Blocked or explicitly allowed as negative stock per settings |
| `TC-POS-09` | Receipt print (58mm) | Prints without clipping |
| `TC-POS-10` | Offline POS sale | Queued, syncs, no duplicate |
| `TC-POS-11` | POS history + detail | `/pos/history` matches sales; detail reconciles |
| `TC-POS-12` | POS sale → GST | Tax computed identically to an invoice with the same lines |

---

## 22. Suite S — Purchases & purchase returns (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-PUR-01` | Create purchase bill | Supplier ledger credited, stock incremented |
| `TC-PUR-02` | Purchase with GST | ITC captured; reflects in GSTR-3B |
| `TC-PUR-03` | Edit purchase | Stock + ledger re-reconcile |
| `TC-PUR-04` | Delete purchase | Full reversal; blocked if stock already sold |
| `TC-PUR-05` | Payment against purchase | Payable reduces |
| `TC-PUR-06` | Purchase return | Stock decrements, ITC reverses, debit note generated |
| `TC-PUR-07` | Purchase price updates cost | Product cost basis updates per the configured method |
| `TC-PUR-08` | Purchase → stock value report | Valuation matches |

---

## 23. Suite T — Sales returns & credit notes (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-RET-01` | Full sales return | Stock in, ledger reversed, credit note issued |
| `TC-RET-02` | Partial return | Only returned lines reverse |
| `TC-RET-03` | Return on a paid invoice | Refund or credit balance handled explicitly |
| `TC-RET-04` | Return tax reversal | GSTR-1 credit-note section correct |
| `TC-RET-05` | Return beyond invoice qty | Blocked |

---

## 24. Suite U — Sales pipeline: estimates, orders, challans (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-EST-01` | Create estimate/quotation | Saved; no stock or ledger impact |
| `TC-EST-02` | Estimate → invoice conversion | Lines and totals carry over exactly; estimate marked converted |
| `TC-EST-03` | Estimate expiry | Expired state shown; conversion warns |
| `TC-SO-01` | Sale order create | No stock impact; commits reserved qty if enabled |
| `TC-SO-02` | Sale order → challan → invoice chain | Each step links; no double stock deduction |
| `TC-SO-03` | Partial fulfilment | Remaining qty tracked correctly |
| `TC-DC-01` | Delivery challan create + print | Prints without prices where configured |
| `TC-DC-02` | Challan → invoice | Stock deducts exactly once across the chain |

---

## 25. Suite V — Recurring invoices, jobs, custom orders (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-REC-01` | Create recurring profile | Schedule stored; next-run date correct |
| `TC-REC-02` | Auto-generation fires | Invoice created on schedule with the right number |
| `TC-REC-03` | Pause / resume / end-date | Honoured; no generation while paused |
| `TC-REC-04` | Month-end edge (31st in a 30-day month) | Generates on a defined day, never skipped |
| `TC-JOB-01` | Create job (services vertical) | Status lifecycle works |
| `TC-JOB-02` | Job → invoice | Labour + parts carry over |
| `TC-ORD-01` | Custom order (bakery/tailor) | Delivery date, advance, status transitions |
| `TC-ORD-02` | Order → invoice on delivery | Advance adjusts against the invoice |

---

## 26. Suite W — Expenses & other income (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-EXP-01` | Record expense | P&L reflects it; category assigned |
| `TC-EXP-02` | Expense categories CRUD | Create, rename, delete-with-guard |
| `TC-EXP-03` | Expense with GST/ITC | ITC captured where eligible |
| `TC-EXP-04` | Receipt OCR (`expense-ocr`) | Extracted amount/date/vendor are editable before save |
| `TC-EXP-05` | Recurring expense template | Generates correctly |
| `TC-EXP-06` | Budget vs actual | Overspend flagged |
| `TC-EXP-07` | Expense trend | Chart matches raw rows |
| `TC-INC-01` | Other income entry | Appears in P&L, not in sales reports |

---

## 27. Suite X — Banking: accounts, reconciliation, loans (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-BNK-01` | Create bank account | Opening balance correct |
| `TC-BNK-02` | Bank reconciliation | Matched/unmatched split correct; closing ties to the statement |
| `TC-BNK-03` | Statement import | Rows parsed; duplicates detected |
| `TC-BNK-04` | Auto-match suggestions | Suggested matches are correct; manual override works |
| `TC-LON-01` | Create loan | Principal, rate, tenure stored |
| `TC-LON-02` | EMI schedule | Interest/principal split arithmetically correct |
| `TC-LON-03` | Loan payment | Outstanding reduces; P&L takes the interest |

---

## 28. Suite Y — Accounting core (P0 — reconciliation truth)

| ID | Case | Expected |
|---|---|---|
| `TC-ACC-01` | Chart of accounts | Default GL seeded; custom accounts creatable |
| `TC-ACC-02` | Manual journal entry | Debits = credits enforced; unbalanced entry rejected |
| `TC-ACC-03` | Every transaction posts a GL entry | Invoice, payment, purchase, expense, POS each write the right pair |
| `TC-ACC-04` | Trial balance after a mixed workload | Debits = Credits exactly |
| `TC-ACC-05` | FY closure | Balances roll forward; closed period locked against edits |
| `TC-ACC-06` | Edit inside a closed period | Blocked with a clear message |
| `TC-ACC-07` | Tally export | File imports into Tally without errors |
| `TC-ACC-08` | Audit trail on GL | Every posting traceable to its source document |

---

## 29. Suite Z — Advanced inventory (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-GDN-01` | Create godown; stock per godown | Per-location stock correct |
| `TC-GDN-02` | Godown transfer | Source decrements, destination increments, total unchanged |
| `TC-GDN-03` | Invoice from a specific godown | Deducts from the right location |
| `TC-BAT-01` | Batch create with expiry | Batch stock tracked |
| `TC-BAT-02` | FEFO/FIFO selection on sale | Correct batch auto-picked |
| `TC-BAT-03` | Expired batch | Blocked or warned on sale |
| `TC-SER-01` | Serial numbers: add, bulk add | Uniqueness enforced |
| `TC-SER-02` | Serial on sale | Marked sold; re-sale blocked |
| `TC-SER-03` | Serial lookup | Returns full history |
| `TC-SV-01` | Stock verification run | Physical vs system variance computed; adjustment posted |
| `TC-SV-02` | Mobile verify flow (`/inventory/verify`) | Scan-driven count works offline |
| `TC-ROR-01` | Reorder suggestions | Based on real velocity + lead time |
| `TC-STV-01` | Stock value report | Matches valuation method and the balance sheet |

---

## 30. Suite AA — Manufacturing: BOM & production (P2)

| ID | Case | Expected |
|---|---|---|
| `TC-BOM-01` | Create BOM | Components + qty stored |
| `TC-BOM-02` | Recipe cost | Cost = Σ(component cost × qty); updates when inputs change |
| `TC-BOM-03` | Production run | Components consumed, finished goods added, both in one atomic step |
| `TC-BOM-04` | Insufficient components | Run blocked with a shortfall list |
| `TC-BOM-05` | Nested BOM | Resolves recursively without a cycle hang |

---

## 31. Suite AB — HR: attendance, employees, payroll (P2)

| ID | Case | Expected |
|---|---|---|
| `TC-HR-01` | Add employee | Salary structure stored |
| `TC-HR-02` | Mark attendance | Present/absent/half-day; month view correct |
| `TC-HR-03` | Payroll run | Gross − deductions = net; matches attendance |
| `TC-HR-04` | Payslip PDF | Renders with correct figures |
| `TC-HR-05` | Payroll → expense/GL | Posts to the right accounts |

---

## 32. Suite AC — Marketing, CRM, loyalty, commission (P2)

| ID | Case | Expected |
|---|---|---|
| `TC-MKT-01` | Marketing template CRUD | Variables (`{{party}}`, `{{amount}}`) resolve in preview |
| `TC-MKT-02` | Campaign send | Targets the right segment; per-recipient status tracked |
| `TC-MKT-03` | Opt-out honoured | Opted-out parties excluded from every send — **compliance-critical** |
| `TC-MKT-04` | Payment reminders | Correct amount, correct party, correct link |
| `TC-MKT-05` | Smart greetings | Fires on the right dates |
| `TC-CRM-01` | Follow-up queue | Due follow-ups listed; completing one removes it |
| `TC-APT-01` | Appointment book + convert | Converts to a job/invoice cleanly |
| `TC-LOY-01` | Loyalty points earn/redeem | Points math correct; redemption reduces the invoice |
| `TC-COM-01` | Commission rules | Ledger accrues per rule; leaderboard matches the ledger |
| `TC-PRL-01` | Price lists | Party-specific pricing overrides the default on invoices |

---

## 33. Suite AD — Statutory: e-invoice & e-way bill (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-EIN-01` | e-Invoice IRN generation | IRN + signed QR returned (sandbox); stored on the invoice |
| `TC-EIN-02` | IRN on PDF | QR + IRN printed |
| `TC-EIN-03` | e-Invoice cancel | Within the 24h window; blocked after |
| `TC-EWB-01` | e-Way bill generate | Above the threshold; distance/vehicle captured |
| `TC-EWB-02` | Portal error | Human-readable message, invoice not corrupted |
| `TC-EIN-04` | Below-threshold / exempt | Not offered; no false requirement |

---

## 34. Suite AE — Capture & intelligence (P2)

| ID | Case | Expected |
|---|---|---|
| `TC-VCE-01` | Voice entry (Hindi + English) | Transcribed intent editable before commit |
| `TC-VCE-02` | Voice misrecognition | Never auto-commits a wrong amount |
| `TC-SCN-01` | Bill scan OCR | Fields extracted, editable, then saved |
| `TC-SCN-02` | Blurry/rotated image | Graceful failure with a manual-entry fallback |
| `TC-INS-01` | Insights page | Every stated insight is reproducible from raw data |
| `TC-NOT-01` | Notifications | Delivered per preferences; preferences respected on opt-out |

---

## 35. Suite AF — Public surfaces (P1)

Unauthenticated pages carry the highest leak risk.

| ID | Case | Expected |
|---|---|---|
| `TC-PUB-01` | Landing page | Renders at 320–1536; CTAs route correctly |
| `TC-PUB-02` | Pricing page | Plans + prices match the billing config |
| `TC-PUB-03` | Public ledger link (`/public/ledger/:token`) | Shows only that party's ledger; **no other tenant data** |
| `TC-PUB-04` | Tampered / expired token | 404, never partial data |
| `TC-PUB-05` | Document share link | Same isolation guarantees; revocation works |
| `TC-PUB-06` | Storefront | Only published products; prices correct; no cost/margin leak |
| `TC-PUB-07` | Public pages are noindex where required | Ledger/share links not indexable |

---

## 36. Out of scope (explicit, v2)

Not tested pre-flip — deliberately, with the reason:

| Area | Reason |
|---|---|
| Admin coupons (`/admin/coupons`) | Internal tooling, not customer-facing |
| Feedback widget | Non-blocking, no ledger impact |
| Keyboard shortcuts settings | Convenience layer |
| Currency settings (multi-currency) | Single-currency (INR) at launch |
| Storefront checkout | Not launching with the storefront |
| Collaboration / shared-ledger beta | Flagged off in production |
| iOS build | Android-only launch |
| Tally *import* round-trip fidelity | Best-effort; documented as such |
| Load / stress testing | Separate exercise, not functional E2E |
| Penetration testing | Separate engagement; §18 is the functional slice |
| Multi-language beyond en/hi | Only two languages ship |
| Print hardware matrix | Verified on 2 reference printers only |

---

## 37. Revised exit criteria (supersedes §19)

**Production flip requires:**

1. 100% of **P0** cases in Part I **and** Part II pass, each with an artefact.
2. The universal matrix (§20) passes in full for the 7 P0 entities, and the
   smoke subset for every remaining entity.
3. Ledger identity holds after a mixed workload spanning invoices, POS,
   purchases, expenses, returns, and payroll: **Trial balance balances**, and
   P&L + balance sheet tie to it.
4. Cross-tenant probes (§18) and public-surface probes (§35) all deny.
5. 0 console errors on the full golden-path walk; axe: 0 serious/critical.
6. `npm run qa:full` green and `npm run ssot` exit 0.
7. Every P1 failure carries a written accept/defer decision; **no P0 defers.**

---
---

# PART III — Total surface closure (mechanically verified)

Parts I and II were written by hand, so they could still miss things. Part III
closes that hole **mechanically**:

```bash
node scripts/e2e-coverage.mjs           # gate — exit 1 if any module is unmapped
node scripts/e2e-coverage.mjs --matrix  # regenerate docs/E2E_COVERAGE_MATRIX.md
```

The script derives the full surface from code — every FE route in
`routes.config.ts` and **every Express endpoint** under `server/src/routes/**`
(it resolves non-`router`-named Router bindings too) — groups it into modules,
and fails if any module is not claimed by a suite that actually exists in this
document. `e2e/coverage-map.json` is the claim file;
`docs/E2E_COVERAGE_MATRIX.md` is the generated route-by-route ledger.

**Current surface: 213 modules — 202 FE routes + 586 API endpoints — 100%
claimed, 0 unmapped.** Coverage can no longer silently drift: adding a route or
endpoint without a suite fails the gate.

The suites below close the modules Parts I–II left unclaimed.

---

## 38. Suite AG — Settings, roles & permissions (P0)

`/settings` root, `roles`, `staff`, `permissions`, `transaction-controls`,
`theme`, `shortcuts`, plus `api:settings`.

| ID | Case | Expected |
|---|---|---|
| `TC-STG-01` | Settings hub | Every tile routes to a live page; no dead links |
| `TC-STG-02` | Business profile CRUD | Name, address, logo, phone, GSTIN persist → appear on the invoice PDF |
| `TC-STG-03` | Logo upload | Size/type validated; renders in the PDF at the right aspect ratio |
| `TC-STG-04` | Role create | Granular permissions saved |
| `TC-STG-05` | Role edit takes effect live | Staff user's nav + API perms change without re-login |
| `TC-STG-06` | Role delete | Blocked while assigned to a user |
| `TC-STG-07` | Staff invite → accept | Invite OTP claim; staff lands scoped to the right business |
| `TC-STG-08` | Staff remove / deactivate | Sessions revoked; API 401s |
| `TC-STG-09` | Permissions matrix | Each toggle enforced **server-side**, not just hidden in the UI |
| `TC-STG-10` | Transaction controls | Backdating limits, edit-after-N-days, delete lock all enforced |
| `TC-STG-11` | Theme | Light/dark/system persist across reload and app restart |
| `TC-STG-12` | Keyboard shortcuts | Configured shortcut fires; conflicts detected |
| `TC-STG-13` | Settings offline | Reads from cache; writes queue with labels |

---

## 39. Suite AH — Documents: templates, custom fields, share links (P1)

`settings/documents`, `settings/templates`, `settings/document-custom-fields`,
plus `api:document-settings`, `api:invoice-settings`, `api:invoice-templates`,
`api:custom-fields`.

| ID | Case | Expected |
|---|---|---|
| `TC-DOC-01` | Numbering settings | Prefix, suffix, starting number, per-FY reset all applied |
| `TC-DOC-02` | Number collision | Two rapid invoices never share a number |
| `TC-DOC-03` | Template gallery | Every template previews and renders a real PDF |
| `TC-DOC-04` | Template edit | Colour/logo/field toggles reflected in the PDF |
| `TC-DOC-05` | Custom fields | Create text/number/date field → appears on the form and the PDF |
| `TC-DOC-06` | Custom field validation | Required custom field blocks submit |
| `TC-DOC-07` | Terms & conditions / signature | Rendered in the document footer |
| `TC-DOC-08` | Document lineage | Estimate → order → challan → invoice chain visible and correct |
| `TC-DOC-09` | Convert / restore | Conversion is idempotent; restore from recycle bin rebuilds links |

---

## 40. Suite AI — Masters: units, currency, inventory settings (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-MSTR-01` | Unit CRUD | Create, edit, delete-with-guard; selectable on products |
| `TC-MSTR-02` | Conversion units | Box↔piece conversion math correct on invoices and stock |
| `TC-MSTR-03` | Currency settings | Symbol/format applied everywhere; INR remains the default |
| `TC-MSTR-04` | Inventory settings | Negative-stock allow/block, valuation method, low-stock defaults all honoured |
| `TC-MSTR-05` | Valuation method change | Recomputes stock value consistently; no silent mid-history mix |
| `TC-MSTR-06` | Tax categories master | CRUD; assignment flows into GST computation |

---

## 41. Suite AJ — Cash register (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-CASH-01` | Open register with an opening float | Recorded with actor + timestamp |
| `TC-CASH-02` | Cash in / cash out entries | Reflected in the running balance |
| `TC-CASH-03` | Close register | Counted vs expected variance computed and posted |
| `TC-CASH-04` | POS + invoice cash flows in | Register balance reconciles to the day book |
| `TC-CASH-05` | Register across a day boundary | Yesterday's close = today's open |

---

## 42. Suite AK — Collections (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-COLL-01` | Collections hub | Bucket totals = aging report totals |
| `TC-COLL-02` | Bucket drill-down | `/collections/bucket/:bucket` lists exactly that bucket's parties |
| `TC-COLL-03` | Promise-to-pay (PTP) | Recorded with a date; overdue PTP re-surfaces |
| `TC-COLL-04` | Party statement from collections | Matches `/reports/party-statement` exactly |
| `TC-COLL-05` | Bulk reminder from a bucket | Sends to all in the bucket minus opt-outs |

---

## 43. Suite AL — Data lifecycle: backup, export, audit, recycle bin (P0)

| ID | Case | Expected |
|---|---|---|
| `TC-DATA-01` | Full backup export | File downloads; contains every entity type |
| `TC-DATA-02` | Restore from backup | Reproduces the dataset exactly (counts + totals) |
| `TC-DATA-03` | Restore into a non-empty business | Explicit merge/replace choice, never a silent overwrite |
| `TC-DATA-04` | Data export (Excel/CSV) | Opens in Excel; Indian number format intact; no PII of other tenants |
| `TC-DATA-05` | Audit log completeness | Every create/edit/delete across all modules writes a row with actor + before/after |
| `TC-DATA-06` | Audit log immutability | No UI or API path edits or deletes an audit row |
| `TC-DATA-07` | Recycle bin | Deleted record recoverable; restore rebuilds ledger links |
| `TC-DATA-08` | Permanent delete | Purges fully; audit row survives |
| `TC-DATA-09` | Backup while offline | Blocked with a clear message |

---

## 44. Suite AM — Billing: subscription, gateway, coupons, referral (P0)

Money in. Razorpay runs in **test mode** for all cases.

| ID | Case | Expected |
|---|---|---|
| `TC-BIL-01` | Plan list + current plan | Matches server entitlements |
| `TC-BIL-02` | Checkout happy path | Razorpay test payment → plan upgraded → entitlements refresh without re-login |
| `TC-BIL-03` | Payment failure | Plan unchanged; clear retry path; no partial grant |
| `TC-BIL-04` | Webhook is authoritative | Client-side "success" without a webhook does **not** grant the plan |
| `TC-BIL-05` | Webhook signature verification | Forged webhook rejected |
| `TC-BIL-06` | Duplicate webhook | Idempotent — no double grant, no double charge |
| `TC-BIL-07` | Coupon apply | Valid coupon discounts correctly; expired/invalid rejected |
| `TC-BIL-08` | Coupon abuse | Same coupon can't be redeemed twice by one account |
| `TC-BIL-09` | Plan downgrade / expiry | Gated features lock; **data is never deleted** |
| `TC-BIL-10` | Paid gating | Gated route shows the upgrade sheet and the API returns 402 |
| `TC-BIL-11` | Entitlement signature | Tampered client-side entitlement is rejected by the server |
| `TC-BIL-12` | Referral | Referral credit applied once, to the right account |

---

## 45. Suite AN — Platform admin console (P1)

`api:admin` — admin auth, businesses, users, dashboard, settings, broadcast,
coupons, subscriptions, scoped-shadow.

| ID | Case | Expected |
|---|---|---|
| `TC-ADM-01` | Admin auth | Non-admin gets 403 on every admin route |
| `TC-ADM-02` | Super-admin-only routes | Plain admin blocked |
| `TC-ADM-03` | Business list / detail | Read-only unless explicitly permitted |
| `TC-ADM-04` | Impersonation (if enabled) | Every impersonated action audited with both identities |
| `TC-ADM-05` | Coupon admin CRUD | Created coupon is redeemable end-to-end |
| `TC-ADM-06` | Broadcast notification | Reaches targeted users only |
| `TC-ADM-07` | Subscription admin override | Grant/revoke audited |
| `TC-ADM-08` | Scoped-shadow diagnostics | Reports scoping mismatches; exposes no tenant data |

---

## 46. Suite AO — Collaboration: presence, live events, feedback (P2)

| ID | Case | Expected |
|---|---|---|
| `TC-COLLAB-01` | Presence | Two staff on the same record → both see the indicator |
| `TC-COLLAB-02` | Live events / SSE | Invoice created on device A appears on device B without a manual refresh |
| `TC-COLLAB-03` | Event stream reconnect | Auto-reconnects after a network drop; no duplicate events |
| `TC-COLLAB-04` | Feedback widget | Submits; no PII leaked in the payload |

---

## 47. Suite AP — Navigation & global surfaces (P1)

| ID | Case | Expected |
|---|---|---|
| `TC-NAV-01` | `/more` hub | Every entry routes to a live page — **no 404, no blank screen** |
| `TC-NAV-02` | Feature-flagged entries | Hidden when the flag is off, and the route 404s directly too |
| `TC-NAV-03` | Role-filtered nav | Staff sees only permitted entries |
| `TC-NAV-04` | Global search / serial lookup | Returns cross-entity matches scoped to the tenant |
| `TC-NAV-05` | Deep link to every route | Direct navigation to all 202 routes renders a real screen (automated sweep) |
| `TC-NAV-06` | Unknown route | Friendly 404 with a way home |
| `TC-NAV-07` | Back-button integrity | Back from any depth never lands on a blank or logged-out screen |

> `TC-NAV-05` is the **catch-all**: it is table-driven from
> `routes.config.ts`, so every route — including any added after this plan was
> written — gets at least a render + console-clean assertion.

---

## 48. Coverage guarantee

| Layer | Mechanism |
|---|---|
| Breadth | `scripts/e2e-coverage.mjs` — every FE route + API endpoint claimed by a suite, or the gate fails |
| Depth | §20 universal matrix — 37 dimensions × 43 entities |
| Catch-all | `TC-NAV-05` renders all 202 routes in `routes.config.ts`, table-driven |
| Drift | New route/endpoint without a suite → gate exit 1 (wire into `.githooks/pre-commit` alongside `npm run ssot`) |

Nothing is left implicit: if it isn't claimed, the gate says so by name.

---
---

# PART IV — Surfaces the HTTP gate cannot see

Part III closed routes + endpoints. But a route/endpoint gate is blind to code
that runs **without an HTTP request**, and to UI that isn't behind a URL. An
audit of those blind spots found five real ones, now folded into the gate
(`job:*`, `mw:*`, `model:*`) or covered by the suites below.

**Surface after Part IV: 401 modules** — 202 FE routes · 586 API endpoints ·
**8 cron jobs** · **30 middleware** · **150 Prisma models**. All 401 claimed.

---

## 49. Suite AQ — Background jobs & cron (P0)

Eight workers mutate tenant data with **no user request behind them**, so
nothing in Parts I–III would ever have exercised them. `TC-REC-02` in Part II
even *assumes* the recurring generator fires — this suite is what proves it.

| ID | Case | Expected |
|---|---|---|
| `TC-CRON-01` | Recurring generator (`run-recurring-generator`) | Generates due invoices only; correct numbering; **idempotent** — a second run in the same window creates nothing |
| `TC-CRON-02` | Generator with a mid-run failure | Partial batch does not double-generate on retry |
| `TC-CRON-03` | Generator tenant scoping | Business A's schedule never writes into business B |
| `TC-CRON-04` | PTP evaluator (`run-ptp-evaluator`) | Overdue promises re-surface; kept promises close |
| `TC-CRON-05` | Batch expiry alerts (`run-batch-expiry-alerts`) | Fires at the configured lead time, once per batch, not daily-repeating |
| `TC-CRON-06` | PIN GC (`pin-gc.job`) | Expired reset tokens purged; live tokens untouched |
| `TC-CRON-07` | Import retention (`import-retention.cron`) | Purges past the retention window; keeps in-window jobs |
| `TC-CRON-08` | Shadow canary / watchdog / retention | Report scoping divergence; expose no tenant data; alert on divergence |
| `TC-CRON-09` | Job observability | Every run logs start/finish/row-counts; a failed run is visible, never silent |
| `TC-CRON-10` | Timezone | Jobs fire on IST boundaries, not UTC — no "runs a day early" |

---

## 50. Suite AR — Middleware spine (P0)

Thirty middleware files carry the security and correctness guarantees every
other suite assumes. Tested **directly**, not incidentally.

| ID | Case | Expected |
|---|---|---|
| `TC-MW-01` | `auth` / `admin-auth` | No token → 401; wrong role → 403; `req.user.userId` populated (never `req.user.id`) |
| `TC-MW-02` | `scoped-context` / `resolve-scoped` | Tenant injected on every scoped model; a missing businessId **fails closed**, never queries unscoped |
| `TC-MW-03` | `permission` | Each granular permission enforced server-side |
| `TC-MW-04` | `csrf` | State-changing call without a token rejected |
| `TC-MW-05` | `replay-protection` | Replayed signed request rejected |
| `TC-MW-06` | `idempotency` / `requireIdempotencyKey` | Same key → one write, cached response; missing key on a required route → 400 |
| `TC-MW-07` | `conflict-detection` | Stale-version write rejected with a usable conflict payload |
| `TC-MW-08` | `rate-limit` / `nic-rate-limit` | Buckets enforced per-IP and per-tenant; 429 carries retry-after |
| `TC-MW-09` | `captcha` | Triggers after the failure threshold |
| `TC-MW-10` | `sanitize-input` | Script/HTML payloads neutralised before persistence |
| `TC-MW-11` | `field-filter` | Response never leaks fields the role can't see |
| `TC-MW-12` | `require-feature` / `subscription-gate` | Ungated plan → 402 with an upgrade payload |
| `TC-MW-13` | `require-recent-pin` | Sensitive action forces a fresh PIN |
| `TC-MW-14` | `require-active-business` | No active business → clean redirect, not a 500 |
| `TC-MW-15` | `require-min-client-version` | Stale app build gets a forced-update response |
| `TC-MW-16` | `resolve-public-token` | Invalid/expired public token → 404, never partial data |
| `TC-MW-17` | `require-no-active-job` | Conflicting concurrent job blocked |
| `TC-MW-18` | `errorHandler` | No stack traces, SQL, or PII in any production error body |
| `TC-MW-19` | `validate` (Zod) | Malformed body → 400 with field errors, never a 500 |
| `TC-MW-20` | `sse-emit` / `presence` | Events fan out only to the owning tenant |

---

## 51. Suite AS — Data model integrity (P0)

Runs across all **150 Prisma models**. Every model is claimed by a feature
suite above; this suite covers what no single feature suite can see.

| ID | Case | Expected |
|---|---|---|
| `TC-DM-01` | Tenant scoping sweep | Every tenant-scoped model rejects a cross-business read **and** write (table-driven over the model list) |
| `TC-DM-02` | Backup/restore completeness | Every model with tenant data round-trips through backup → restore |
| `TC-DM-03` | Cascade integrity | Deleting a parent leaves no orphans and no dangling FK |
| `TC-DM-04` | Money columns | Every amount column is an integer paise field — no float anywhere in the schema |
| `TC-DM-05` | Soft-delete consistency | Soft-deleted rows are excluded from every list, report, and total |
| `TC-DM-06` | Migration safety | `prisma migrate` applies cleanly on a copy of prod; no destructive step |
| `TC-DM-07` | Unique constraints | Invoice number, phone, GSTIN, serial number, coupon code all enforced at the DB level, not just the app |

---

## 52. Suite AT — Native device layer (P0, manual/device)

Playwright/Chromium **cannot test these** — they need a real Android device or
emulator. Five Capacitor plugins ship in the APK.

| ID | Case | Expected |
|---|---|---|
| `TC-DEV-01` | Barcode scanner (`@capacitor-mlkit/barcode-scanning`) | Camera permission prompt, scan resolves, permission-denied path is graceful |
| `TC-DEV-02` | Keyboard (`@capacitor/keyboard`) | `resize: native`; form fields stay visible above the keyboard on every form |
| `TC-DEV-03` | Razorpay native (`capacitor-razorpay`) | Checkout opens natively; success + cancel + failure all return correctly |
| `TC-DEV-04` | Thermal printing | 58mm and 80mm over Bluetooth on the two reference printers |
| `TC-DEV-05` | WhatsApp / share intent | Share sheet opens with the PDF attached |
| `TC-DEV-06` | Edge-to-edge shell | PLATFORM_SHELL C1–C11 on a gesture-nav and a 3-button device |
| `TC-DEV-07` | App backgrounding | Resume restores state; PIN gate fires |
| `TC-DEV-08` | Low-end device | Usable on a Rs 8-15K Android phone (target persona hardware) |
| `TC-DEV-09` | APK install / update | Fresh install and in-place upgrade both preserve data |

---

## 53. Suite AU — i18n (P1)

Current mechanical state: **1,682 keys in `en`, 1,682 in `hi`, 0 missing on
either side, 7 identical values** (verified — the 7 are brand/format strings,
not untranslated copy).

| ID | Case | Expected |
|---|---|---|
| `TC-I18N-01` | Key parity | `en` and `hi` key sets identical (script-enforced) |
| `TC-I18N-02` | No hardcoded strings | No English literal in JSX outside `t.*` |
| `TC-I18N-03` | Hindi layout | Longer Devanagari strings don't break buttons/cards at 320px |
| `TC-I18N-04` | Hindi in documents | Invoice PDF and thermal print render Devanagari correctly |
| `TC-I18N-05` | Numbers stay Latin | `₹1,00,000` not rendered in Devanagari digits |
| `TC-I18N-06` | Language persists | Survives reload, app restart, and re-login |

---

## 54. Suite AV — Modal, drawer & sub-flow surfaces (P1)

**92 feature files** render a `<Modal>`, `<Drawer>`, or `<ConfirmDialog>`.
None have a URL, so `TC-NAV-05`'s route sweep never opens them — this is the
largest remaining blind spot in a route-driven plan.

| ID | Case | Expected |
|---|---|---|
| `TC-MODAL-01` | Open/close every modal | Table-driven from the 92 files — each opens, renders, and closes cleanly |
| `TC-MODAL-02` | Backdrop + Esc + back-button close | All three dismiss; Android hardware back closes the modal, not the page |
| `TC-MODAL-03` | Focus trap | Focus stays inside while open; returns to the trigger on close |
| `TC-MODAL-04` | Scroll lock | Background doesn't scroll; the modal body does |
| `TC-MODAL-05` | Nested modal / drawer-in-drawer | Stacking uses `Z.*` tokens; no z-index war |
| `TC-MODAL-06` | Form modal at 320px | No clipped submit button; keyboard doesn't cover the CTA |
| `TC-MODAL-07` | Unsaved-changes guard | Closing a dirty form modal warns |
| `TC-MODAL-08` | `<ConfirmDialog>` everywhere | No `window.confirm` / `alert()` anywhere in the app (grep-enforced) |

---

## 55. Honest residual limits

What this plan still does **not** guarantee, stated plainly:

| Limit | Why | Mitigation |
|---|---|---|
| Modal inventory is file-derived, not render-derived | A modal built inline without the primitives isn't in the 92 | `TC-MODAL-08`'s grep + design-system enforcement |
| Native suite (§52) is manual | No device farm | Fixed device checklist, run once per release |
| Cron suites need time manipulation | Real schedules take days | Invoke job entrypoints directly with injected clocks |
| Third-party sandboxes (Razorpay, NIC e-invoice, MSG91) | Sandbox ≠ production behaviour | Smoke-test each in prod once, with a rollback |
| Performance under real concurrency | Functional plan, not a load test | Separate load exercise before scale-up |
| Visual regression | No snapshot baseline yet | Screenshot artefacts per P0 case give a manual baseline |

If a claim isn't in a suite above, it isn't tested — and the gate now names
anything unclaimed.
