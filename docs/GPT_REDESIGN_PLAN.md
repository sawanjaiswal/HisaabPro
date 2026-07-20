# GPT New-Design Redesign Plan

> Source mockups: `~/Downloads/Folders/Projects Images/HisaabPro app/GPT New design/untitled folder/` (9 contact sheets, screens **1–104**).
> Goal: bring every current HisaabPro page in line with the new GPT design language, one page at a time.
> Execution rule: **every page goes through the `/hp-design` skill** (RIGID workflow) and the `PAGE_AUDIT_CHECKLIST.md` gate before commit.

---

## 0. What the new design language is (extracted from the mockups)

Consistent across all 104 screens — this is the visual contract every page must hit:

- **Deep-emerald hero band** at the top of most screens (`--color-hero-surface`), white/light text on it, rounded bottom corners.
- **Back-chevron + centered title** header on all detail/sub pages; list roots keep the app `<Header>`.
- **Summary tiles row** — 2–4 stat tiles directly under the hero (Total Due / Paid / Sales style), soft cards, `tabular-nums`, colored value text (red = due/overdue, emerald = positive).
- **Segmented tab bar** under the summary (All / Overview / Invoices / Payments / Activity) — pill/underline style.
- **Transaction rows** — leading icon chip, two-line label (name + sub), right-aligned amount + status pill.
- **Bottom nav** — Home · Customers · center **＋ FAB** (emerald circle) · Reports · More — on every top-level screen.
- **Primary CTA** — full-width emerald button pinned bottom (via `<BottomActionBar>`/`<Drawer>` footer, never raw fixed).
- **Status pills** — Paid/Received (emerald), Overdue/Unpaid (red), Pending (amber), Draft/Sent (neutral).
- **Filter/sort** — right-side icon opens a bottom `<Drawer>` (design #70).
- All tokens per `hp-design`: cream bg, emerald brand, lime-yellow accent, Inter, 12px card radius, soft shadows. Dark-mode parity mandatory.

**Reusable primitives already built in commit `891528a`** (reuse, do NOT rebuild): `HeroPage`, `SummaryTiles`, `TransactionRow`, `PartyOutstandingCard`, per-feature `*FilterDrawer`. New shared primitives this epic will likely add: `SegmentedTabs`, `StatusPill` (if not present), `BottomActionBar` (Phase-3 primitive already planned).

---

## 1. Dedup — 104 mockups → unique screens → current route → status

Legend: **DONE** = shipped in `891528a` · **EXISTS** = current page to restyle · **NEW** = no current page / new feature · **STATE** = shared UI-state pattern.

### Already DONE (commit 891528a) — verify only
| # (mockup) | Screen | Route |
|---|---|---|
| 60 | Dashboard (demo) | `/dashboard` |
| 4, 39 | Customer/Party list + empty | `/parties` |
| 5, 47, 102 | Customer ledger / detail | `/parties/:id` |
| 8 | Product list | `/products` |
| 54 | Product details | `/products/:id` |
| 9 | Add/Edit product | `/products/:id/edit`, `/products/new` |
| 103 | Invoice details | `/invoices/:id` |
| 70 | Filter & sort drawer | (drawer primitive) |

### WAVE 1 — Core sales & money flow (highest traffic)
| # | Screen | Route | Status |
|---|---|---|---|
| 1 | Sales / Invoice list | `/invoices` | EXISTS |
| 2 | Create Invoice | `/invoices/new` | EXISTS |
| 3 | Invoice Preview (PDF) | (in create/detail) | EXISTS |
| 6 | Add Customer | `/parties/new` | EXISTS |
| 7 | Receive Payment | `/payments/new` | EXISTS |
| 41 | Payment History / list | `/payments` | EXISTS |
| 42, 104 | Payment Details | `/payments/:id` | EXISTS |
| 17 | Receivables / Outstanding | `/outstanding` | EXISTS |

### WAVE 2 — Inventory & catalog
| # | Screen | Route | Status |
|---|---|---|---|
| 8→ | (done) | | |
| 53 | Category list | (products filter/category drawer) | EXISTS/partial |
| 49, 101 | Low stock / Stock alert | `/inventory/reorder-suggestions` or StockAlerts | EXISTS |
| 48 | Stock adjustment | inventory adjust | EXISTS/NEW |
| 67 | Stock history | (product detail tab) | EXISTS |
| 55 | Price list | `/price-lists` (PriceListsPage) | EXISTS |
| 50 | Expense categories | `/expenses` categories | EXISTS |

### WAVE 3 — Purchases & suppliers
| # | Screen | Route | Status |
|---|---|---|---|
| 11 | Purchase list | `/purchases` | EXISTS |
| 12 | Add purchase | `/purchases/new` | EXISTS |
| 44 | Sales return | sales returns / credit note | EXISTS/NEW |
| 51 | Purchase return | purchase returns / debit note | EXISTS/NEW |
| 52 | Supplier ledger | `/parties/:id` (supplier) | DONE-ish |

### WAVE 4 — Expenses, estimates, documents
| # | Screen | Route | Status |
|---|---|---|---|
| 10 | Expense list | `/expenses` | EXISTS |
| 13 | Expense details | expense detail | EXISTS/NEW |
| 45 | Estimate list | `/sales` estimates (EstimatesPage) | EXISTS |
| 46 | Estimate details | EstimateDetailPage | EXISTS |
| 43 | Draft invoices | invoices?status=draft | EXISTS |
| 47 | Customer statement | `/reports/party-statement/:id` | EXISTS |

### WAVE 5 — Reports
| # | Screen | Route | Status |
|---|---|---|---|
| 14 | Reports home | `/reports` | EXISTS |
| 15, 68 | Sales report / P&L | `/reports/sales`, `/reports/profit-loss` | EXISTS |
| 16 | Profit & Loss | `/reports/profit-loss` | EXISTS |
| 69 | Cash flow | `/reports/cash-flow` | EXISTS |
| 31 | GST report | `/reports/gst-returns` | EXISTS |
| 66 | Customer balance summary | `/reports/aging` or receivables | EXISTS |

### WAVE 6 — People, HR, collections
| # | Screen | Route | Status |
|---|---|---|---|
| 21, 71 | Employee list | `/hr/employees` (EmployeeListPage) | EXISTS |
| 27 | Employee details | EmployeeDetailPage | EXISTS |
| 28 | Attendance | AttendancePage | EXISTS |
| 22, 29 | Daily collections | collections | EXISTS |
| 26 | Delivery / route | — | **NEW** (not built) |
| 72 | Permissions / roles | `/settings/roles`, `/settings/permissions` | EXISTS |

### WAVE 7 — Tasks, reminders, notifications, search
| # | Screen | Route | Status |
|---|---|---|---|
| 18, 62 | Notifications | `/notifications` | EXISTS |
| 23 | Add task / reminder | crm reminder form | EXISTS |
| 30, 63 | Reminders | `/marketing/reminders`, `/crm/follow-ups` | EXISTS |
| 64 | Today's tasks | — | **NEW** |
| 65 | Calendar view | `/appointments` (calendar) | EXISTS/partial |
| 24, 61 | Universal search | global search overlay | EXISTS/partial |

### WAVE 8 — Settings, business, account
| # | Screen | Route | Status |
|---|---|---|---|
| 19, 74 | Settings | `/settings` | EXISTS |
| 20, 76 | Business profile | business settings | EXISTS |
| 98 | Manage business | business settings | EXISTS |
| 99 | Multiple businesses (switch) | business switcher | EXISTS |
| 100 | Branch / location | godowns/branches | EXISTS |
| 97 | Account & security | `/settings/security` | EXISTS |
| 96 | Theme | `/settings/theme` | EXISTS |
| 35, 77, 95 | Language | language settings | EXISTS |
| 34, 75, 86 | WhatsApp integration / preview | settings | EXISTS |
| 33, 73, 84 | Subscription plan | `/settings/subscription` | EXISTS |
| 32, 81 | Backup & restore | `/settings/backup` | EXISTS |
| 93 | Quick actions | FAB/quick-actions sheet | EXISTS/partial |
| 94 | Data sync | sync status | EXISTS/partial |
| 25 | More menu | `/more` | EXISTS |
| 36 | Help & support | — | **NEW** |
| 37, 83 | About HisaabPro | — | **NEW** |

### WAVE 9 — Accounts, onboarding, import
| # | Screen | Route | Status |
|---|---|---|---|
| 56 | Cash accounts | accounting/cash | EXISTS/NEW |
| 57 | Bank accounts | `/bank-accounts` | EXISTS |
| 58 | Opening balance | onboarding step | EXISTS/NEW |
| 38, 78 | Business setup / first-time | `/onboarding`, CreateBusiness | EXISTS |
| 59, 79 | Data import | `/settings/import`, `/imports` | EXISTS |

### WAVE 10 — Shared UI states & primitives (do EARLY, blocks others)
| # | Pattern | Where | Status |
|---|---|---|---|
| 89 | Success screen | success state primitive | STATE |
| 90 | Error state | `<ErrorState>` | STATE (align) |
| 87 | Permission denied | plan-gate / access-denied | STATE |
| 88, 40, 80 | Offline banner / mode | `<OfflineBanner>` | STATE (align) |
| 91 | Confirm delete | `<ConfirmDialog>` | STATE (align) |
| 92 | Date-range picker | date-range drawer | EXISTS/NEW |
| 85 | Payment reminder (to customer) | reminder send sheet | EXISTS |
| 70 | Filter & sort | `<Drawer>` filter | DONE pattern |

---

## 2. Sequencing rationale

1. **Wave 10 (shared states/primitives) first** — Success/Error/Empty/Offline/Confirm and `SegmentedTabs`/`StatusPill` are consumed by every other wave. Locking them prevents rework.
2. **Wave 1 (sales & money)** next — highest user traffic, most visible ROI.
3. Waves 2–5 — the operational core (inventory, purchases, expenses, reports).
4. Waves 6–9 — people/settings/accounts, lower traffic.
5. **NEW screens** (Delivery/Route #26, Today's Tasks #64, Help #36, About #37) are scoped as **separate feature builds**, not restyles — flagged for `/f`, not this restyle sweep.

## 3. Per-page workflow (every page, no exceptions)

1. Open the mockup + the live page side by side (Chrome, real record).
2. `/hp-design` skill → map deltas to tokens/components.
3. 6-layer split if the page grows past 250L (types→constants→utils→hooks→components→page).
4. Reuse `HeroPage` / `SummaryTiles` / `TransactionRow` / `*FilterDrawer` — never rebuild.
5. All 4 UI states + 320/375/768/1024/1280 responsive.
6. `PAGE_AUDIT_CHECKLIST.md` A→N gate.
7. `node scripts/enforce.js` + `tsc -b --noEmit` clean.
8. Commit one page (or one tight page-group) at a time.

## 4. Decisions (locked 2026-07-20)

- **D1 — Start point:** Wave 10 (shared states & primitives) FIRST, then Wave 1.
- **D2 — 4 NEW screens** (Delivery/Route #26, Today's Tasks #64, Help #36, About #37):
  **DEFERRED.** Before building, **compare with competitor apps** (Vyapar, myBillBook,
  Khatabook, OkCredit) to define scope — remind Sawan. NOT part of the restyle sweep.
- **D3 — Commit granularity:** ONE commit per page.
- **D4 — Duplicated mockups:** highest-numbered mockup = latest/authoritative design.

## 5. Progress tracker (update as pages land)

- [x] Wave 10 — shared states & primitives — **already satisfied** by `FeedbackState`
      + presets (EmptyState/ErrorState/NetworkError/NotFoundPage), `Badge`, `Tabs`,
      `ConfirmDialog`, `OfflineBanner`. No `SegmentedTabs`/`StatusPill` fork needed.
      Only open gap: a unified `DateRangePicker` (#92), currently ad-hoc across ~8
      report/filter pages — deferred, not blocking.
- [x] Wave 1 — sales & money (8 screens) — **DONE**
  - [x] #1 Sales / Invoice list — `9c31564`
  - [x] #2 Create Invoice (+ Edit Invoice, same form engine) — `592a3bb`
  - [x] #3 Invoice Preview — `082b0f0`
  - [x] #6 Add Customer — `21cc4db`
  - [x] #7 Receive Payment — `7168be9`
  - [x] #41 Payment History — `ded15c8`
  - [x] #42/104 Payment Details — `4601188`
  - [x] #17 Receivables — `c7b8a26`
- [x] Wave 2 — inventory (6)
  - [x] #8 Product list — landed with Wave 1 sweep
  - [x] #53 Category list — `2617795`
  - [x] #49/101 Low stock / Stock alerts — `c3eaddc`
  - [x] #48 Stock adjustment log — `630679c`
  - [x] #55 Price list — `62a974e`
  - [x] #50 Expense categories — `61d0626`
  - [x] #67 Stock history — `c446f48`
- [x] Wave 3 — purchases (5)
  - [x] #11 Purchase list — `128d58c`
  - [x] #12 Add purchase — `9e9cd6a`
  - [x] #44 Sales return — `82cb1a7`
  - [x] #51 Purchase return — `82cb1a7`
  - [x] #52 Supplier ledger — `fb9b4cc` (direction-aware tiles)
- [x] Wave 4 — expenses/estimates/docs (6)
  - [x] #10 Expense list — `1eacee3`
  - [x] #13 Expense details — `f8cff00`
  - [x] #45 Estimate list — `efc7727`
  - [x] #46 Estimate details — `6b4af64`
  - [x] #43 Draft invoices — `1fea3d5`
  - [x] #47 Customer statement — `fe048f4`
- [ ] Wave 5 — reports (6) — **3/6 done**
  - [x] #14 Reports home — `e6a9f42` (+ favourites, `src/lib/prefs-store.ts`)
  - [x] #15/#68 Sales + Purchase report — `91257b0` (+ real trend aggregate, `DonutChart`)
  - [x] #16 Profit & Loss — `81e0c1a` (+ real trend aggregate, fixed a load crash
        from a fictional client type — `.claude/fix-trace-pl-contract.md`)
  - [ ] #69 Cash flow — `src/features/reports/CashFlowPage.tsx`
  - [ ] #31 GST report — `src/features/reports/GstReturnsPage.tsx`
  - [ ] #66 Customer balance summary — `src/features/reports/AgingReportPage.tsx`
- [ ] Wave 6 — people/HR (6) — **0/6**
  - [ ] #21/71 Employee list — `src/features/hr/EmployeeListPage.tsx`
  - [ ] #27 Employee details — `src/features/hr/EmployeeDetailPage.tsx`
  - [ ] #28 Attendance — `src/features/hr/AttendancePage.tsx`
  - [ ] #22/29 Daily collections — `src/features/collections/pages/AgingDashboard.tsx`
        + `AgingBucketList.tsx` *(correction: these exist but are not named `*Page.tsx`)*
  - [ ] #72 Permissions / roles — `src/features/settings/RolesPage.tsx`,
        `StaffPermissionsPage.tsx`, `RoleBuilderPage.tsx`
  - [ ] #26 Delivery / route — **NEW build, deferred** (see D2)
- [ ] Wave 7 — tasks/reminders/search (6) — **0/6**
  - [ ] #18/62 Notifications — `src/features/notifications/pages/NotificationsPage.tsx`
        (+ `NotificationPreferencesPage.tsx`)
  - [ ] #23 Add task / reminder — `src/features/marketing/pages/ReminderRuleFormPage.tsx`
  - [ ] #30/63 Reminders — `src/features/marketing/pages/ReminderRuleListPage.tsx`,
        `src/features/crm/pages/FollowUpsPage.tsx`
  - [ ] #65 Calendar view — `src/features/appointments/pages/AppointmentsPage.tsx`
  - [ ] #64 Today's tasks — **NEW build, deferred** (see D2)
  - [ ] #24/61 Universal search — **NEW build, NOT a restyle.** *(correction: the
        plan said "EXISTS/partial" — verified 2026-07-21 that no global-search
        component, hook, or `/api/search` endpoint exists anywhere. Full-stack build.)*
- [ ] Wave 8 — settings/business/account (18) — **0/18**
      16 `*Page.tsx` under `src/features/settings/` + business profile / switcher /
      godowns / subscription / backup / more. Largest wave; split into 8a (core
      settings), 8b (business & branches), 8c (subscription/backup/integrations).
- [ ] Wave 9 — accounts/onboarding/import (5) — **0/5**
  - [ ] #56 Cash accounts — `src/features/accounting/ChartOfAccountsPage.tsx` / cash-register
  - [ ] #57 Bank accounts — `src/features/bank-accounts/BankAccountsPage.tsx`
  - [ ] #58 Opening balance — onboarding step
  - [ ] #38/78 Business setup — `src/features/onboarding/OnboardingPage.tsx`,
        `src/features/business/CreateBusinessPage.tsx`
  - [ ] #59/79 Data import — `src/features/import/pages/ImportJobPage.tsx`,
        `src/features/bulk-import/BulkImportPage.tsx`
- [ ] NEW feature builds (**5**, was 4) — Delivery/Route #26, Today's Tasks #64,
      Universal Search #24/61, Help #36, About #37

---

## 6. Audit — 2026-07-21 (100% sweep, all 190 page files)

Method: `tsc`, both test suites, `enforce.js`, `enforce-offline.mjs`, `npm run ssot`,
plus an import-following design-token/UI-state sweep over every `*Page.tsx` and its
feature-local dependency tree. Numbers are measured, not estimated.

### What the sweep found GREEN

| Check | Result |
|---|---|
| Typecheck (root + server) | ✅ clean |
| Client tests | ✅ 136 files · 1409 pass |
| Server tests | ✅ 149 files · 1269 pass · 7 todo |
| SSOT gate | ✅ pass (45 legacy grandfathered) |
| Offline discipline | ✅ rawFetch 0/0 · localStorage 0/0 · mutationNoEntityType **1/6** |
| Raw hex in feature code | ✅ 20 total — 18 legitimate (React-PDF, thermal receipt, Razorpay SDK theme), 2 are local token defs |
| `window.confirm` / `alert()` | ✅ 0 in feature pages |
| `dark:` Tailwind classes | ✅ 0 (CSS-var theme swap intact) |
| `env(safe-area-inset-*)` | ✅ 0 (C5 holds) |
| Page files > 250 lines | ✅ 0 |

The design-token layer is effectively clean. The redesign sweep has not introduced
drift — the remaining work is *coverage*, not *repair*.

### What the sweep found RED

**`enforce.js` — 6 blocking (all oversized, all pre-existing):**

```
server/src/lib/env.ts                                293L
server/src/services/marketing/reminder-trigger.service.ts  286L
src/lib/api.ts                                       279L
src/components/layout/SideNav.tsx                    272L
server/src/services/party/ledger.service.ts          260L
server/src/services/hr/employee.service.ts           259L
```

**Platform-shell debt grew 5 → 13 warnings** (8 fixed-bottom Phase-3, 5 fixed-top
Phase-4). New entries since the last audit: `business.css:107`,
`payment-form-actions.css:67`, `pos-billing.css:388/593`, `pos.css:364`,
`recurring-detail.css:286`, `role-builder.css:157`. The ratchet is warn-only, so
these accumulated silently.

### UI-state coverage across all 190 pages

81 / 190 pages (43%) are fully clean. Gaps:

| Missing | Pages |
|---|---|
| Error state | 37 |
| Empty state | 32 |
| `PageContainer` / layout primitive | 32 |
| `useLanguage` (i18n) | 17 |
| Loading state | 17 |

Concentrated in: auth (`Login`/`Register`/`VerifyOtp`/`ForgotPassword`), BOM +
production-runs (no i18n at all), marketing pages (no `PageContainer`), POS, and
the `sales/create/*` thin wrappers. **Auth and onboarding are the highest-value
fixes** — they are every user's first screen and currently miss all four states.

### Plan corrections made from this audit

1. **#24/61 Universal search does not exist** — reclassified EXISTS/partial → NEW
   full-stack build. NEW-screen count 4 → 5.
2. **#22/29 Daily collections exists** as `collections/pages/AgingDashboard.tsx` +
   `AgingBucketList.tsx` (not `*Page.tsx`, which is why route sweeps miss them).
3. **Wave 8 is 18 screens** — too large for one wave; split 8a / 8b / 8c.
4. Remaining restyle work: **24 screens** across Waves 5–9, plus 5 NEW builds.
