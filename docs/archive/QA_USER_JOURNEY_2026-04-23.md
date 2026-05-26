# QA User-Journey Report — 2026-04-23

**Tester:** Senior UI QA pass via instrumented Playwright walkthrough
**Persona:** Priya — growing wholesaler (1-2 staff, ₹5-25L/month)
**Device:** iPhone 13 viewport (390 × 844), light mode
**Build:** branch `hisaabpro` @ commit `ba6f57c`
**Script:** `scripts/qa-user-journey.mjs` (re-runnable)
**Artifacts:** `/tmp/qa-journey/01..20-*.png` + `REPORT.json`

---

## Status (post-fix pass)

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| 1 | P0 | `/payments/outstanding` route trap | **FIXED** — literal redirect added |
| 2 | P1 | FAB overhang clips bottom of every page | **FIXED** — page-container bottom padding |
| 3 | P1 | Bottom nav missing Products | **FIXED** — Products tab added; Settings moved to dashboard header gear |
| 4 | P1 | `/settings/profile` 404 | **SKIPPED** — no UI links to it; tester-fault URL |
| 5 | P1 | Dashboard cold-paint spinner | **FIXED** — Suspense fallback now renders DashboardSkeleton inside AppShell |
| 6 | P1 | Three competing FABs | **FIXED** — Calculator + Feedback now show only on dashboard |
| 7 | P2 | Filter chip rows truncate silently | **FIXED** — right-edge fade-mask on `.pill-tabs` |
| 8 | P2 | Two stacked filter rows on Invoices | **DEFERRED** — needs UX redesign |
| 9 | P2 | Orphan chevron in Record Payment | **FIXED** — shared CSS now imported by shared component |
| 10 | P2 | Staff initials show "U" fallback | **FIXED** — `getInitial` accepts phone fallback |
| 11 | P2 | Business avatar shows random "CT" | **FIXED** — single-letter when business name is one word |
| 12 | P2 | `/api/auth/dev-login` exhausts at 20/min | **FIXED** — separate limiter @ 120/min |

---

## Journey walked

```
Login → Dashboard → Parties list → Add party → submit
      → Products list → Add product → submit
      → Invoices list → New invoice
      → Payments list → Record payment → Outstanding
      → Reports → Settings → Staff → Profile
      → POS (paywall) → back to Dashboard
```

20 steps. After URL fix (see Issue #1), all 20 passed with **0 console errors**, **0 page errors**, **0 network 4xx/5xx**. Functional happy path is clean. The issues below are **UX / IA / visual** — the kind that don't fail a smoke test but degrade real-world usage.

---

## Severity legend

- 🔴 **P0** — User can lose data, crash, or be permanently blocked
- 🟠 **P1** — Confusing or visibly broken; ships will get bug reports
- 🟡 **P2** — Polish / perception; degrades the "premium" feel
- 🟢 **P3** — Minor / nice-to-have

---

## 🔴 P0 — Routing trap eats the Outstanding deep-link

**Where:** any user who types or shares `/payments/outstanding` (the obvious URL for a payments-related concept).

**What happens:** React Router matches the path against `PAYMENT_DETAIL = '/payments/:id'` first, treating `"outstanding"` as a payment ID. The page renders `PaymentDetail` skeletons, fires `GET /api/payments/outstanding`, server returns 404 (`"Payment not found"`), and the skeletons **never resolve** — no error UI, no toast, no fallback. User is stuck on a perpetually-loading page.

**Root cause:**
- `src/config/routes.config.ts:25-29` — `OUTSTANDING = '/outstanding'` is a top-level route, not under `/payments/*`. URL is unintuitive.
- `src/features/payments/PaymentDetailPage.tsx` — no error/not-found state when the API returns 404.

**Fix (pick one or both):**
1. Add `/payments/outstanding` route alias that redirects to `/outstanding`.
2. PaymentDetail must render a not-found state (with a "Back to Payments" CTA) when the API 404s, instead of looping skeletons.

**Repro:** Visit http://localhost:5002/payments/outstanding → forever-loading skeleton page. Screenshot: `/tmp/qa-journey/14-14-outstanding.png` (from first run).

---

## 🟠 P1 — Floating "+" FAB collides with content on every screen

The center yellow "+" FAB sits inside the bottom-nav cradle but extends ~30px above it. On every page tested, it overlaps the lowest line of content:

| Screen | Overlap |
|---|---|
| Invoices empty state | Hides "No invo[+]ces yet" caption |
| Payments empty state | Hides "No payment[+] recorded yet" |
| Reports grid | Sits over the bottom row of report cards |
| Staff list | Sits over the "Add Staff" inline action |
| Outstanding empty | Sits below the empty illustration but covers the "All clear" sub-line |
| POS paywall | Sits in the middle of an otherwise-empty paywall card area |

**Fix:** PageContainer needs a bottom-padding equal to `--bnav-height + fab-overhang + safe-area`. Currently the padding only accounts for the nav itself, not the protruding FAB.

Screenshots: `10-invoices-list.png`, `12-payments-list.png`, `15-reports.png`, `17-staff.png`, `19-pricing-gated.png`.

---

## 🟠 P1 — Bottom nav has no Products tab

Tabs: **Home · Invoices · [+] · Parties · Settings**.

A wholesaler/retailer's day is *Products → Invoice → Party*. Forcing them through Settings or the Dashboard quick actions to reach Products is a major IA gap. Products is arguably more frequently visited than Settings.

**Recommended fix:** swap Settings → bottom-of-Home menu (or a Profile pill), promote Products to the nav.

Screenshot: `06-products-list.png` (note bottom nav — no Products entry).

---

## 🟠 P1 — Three competing FABs

Bottom of every page shows:
- Calculator FAB (bottom-left, teal)
- Center "+" FAB (giant yellow)
- Feedback "+" FAB (bottom-right, dark gray)

Three floating buttons with overlapping plus-icon affordances confuse the eye and steal vertical space. The calculator and feedback FABs also overlap the BottomNav's labels (e.g. on POS screen the calculator nudges into "Home" label space).

**Fix:** consolidate. Calculator can move into a Tools menu under "+". Feedback can be in Settings/Help. Keep only the primary "+" FAB for context-aware quick action.

Screenshot: `19-pricing-gated.png`.

---

## 🟠 P1 — `/settings/profile` is a 404

Step 18 navigated to `/settings/profile` and got the global 404 page ("Page not found"). Either:
- The route exists at a different path (and Settings doesn't link to it correctly), or
- The route was removed but a button somewhere still points to it, or
- It was never built.

**Action:** audit Settings → Profile entry point and either implement the page or correct the link.

Screenshot: `18-18-profile.png`.

---

## 🟠 P1 — Dashboard first-paint is a bare spinner

On the first visit (cold cache, freshly authed), `/` shows only a centered spinner on a near-empty cream background for ~1.5–2 seconds before any chrome appears. No header, no skeleton cards, no nav — just spinner. On a 2G/3G phone (target persona devices) this will feel much longer.

For comparison, returning to dashboard later (step 20) shows the proper layout immediately because data is cached.

**Fix:** dashboard route should render `AppShell + Header + DashboardSkeleton` synchronously while data fetches. The Suspense fallback used now is just a spinner; the skeleton component already exists (`DashboardSkeleton.tsx` referenced at `src/features/dashboard/components/DashboardSkeleton.tsx`).

Screenshots: `01-1-dashboard.png` (cold) vs `20-20-back-to-dashboard.png` (warm).

---

## 🟡 P2 — Filter chip rows truncate at viewport edge

**Invoices filter row:** `All · Sale Invoice · Purchase Invoice · Est…` — "Estimate/Quotation" cut. A second row below shows `All · Saved · Shared · Draft · Conver…` — "Converted" cut.

**Record Payment / Payment Mode chips:** `Cash · UPI · Bank Transfer · Chequ…` — "Cheque" cut. Below: `NEFT/RTGS/IMPS · Credit Card · Other` (wraps awkwardly).

There's no visual cue (gradient fade, scroll arrow, or chevron) that more chips exist beyond the edge. Users will miss options.

**Fix:** add right-edge fade-mask + check `scrollWidth > clientWidth` and show a subtle ▸ indicator. Alternatively, drop into a 2-row wrap on narrow viewports.

Screenshots: `10-invoices-list.png`, `13-record-payment-form.png`.

---

## 🟡 P2 — Two stacked filter rows on Invoices is busy

The Invoices list shows **two** horizontal pill rows:
- Type: All / Sale / Purchase / Estimate
- Status: All / Saved / Shared / Draft / Converted

Combined with the search bar above and the title bar, ~40% of vertical space is filters before any invoice appears. On mobile, this is too much.

**Recommended fix:** collapse to a single chip row with a "Filter" button that opens a sheet for cross-axis combinations. Or default to "All / All" and only show row 2 after row 1 is changed.

Screenshot: `10-invoices-list.png`.

---

## 🟡 P2 — Orphan chevron in Record Payment form

Below the party search field on `/payments/new`, an unattached `▾` chevron renders on its own line with no surrounding control. Looks like a label or wrapper from a previously-removed dropdown that wasn't cleaned up.

**File to inspect:** `src/features/payments/RecordPaymentPage.tsx` or its party-search subcomponent. Likely a stale `<span>` or icon from a refactor.

Screenshot: `13-13-record-payment-form.png` (left edge, around y=765).

---

## 🟡 P2 — Staff initials show "U" fallback

Two staff records on the Staff page render with a "U" avatar (the fallback-for-undefined-name). Means staff records are missing display names.

**Where:** `src/components/ui/PartyAvatar.tsx` falls back to "U" when `name` is null/undefined (correct defensive behavior, fixed earlier this session). But **the fact that staff have no name is upstream** — either:
- Staff invite flow allows blank names, or
- API returns staff without populating the name, or
- Demo data is incomplete.

**Action:** make staff `name` required at the invite/create boundary. If it's already required, fall back to phone-initial instead of "U".

Screenshot: `17-17-staff.png`.

---

## 🟡 P2 — Business avatar shows random "CT" initials

Top-left avatar in the header reads "CT" because the active business is `CURL Test Biz` (test data). Two issues:
1. Active-business switching defaulted to a junk test business, not "Jaiswal Trading Co." (the real first business in the dev account).
2. The avatar uses raw character pairs from the business name. "CT" looks like an org chart artifact, not a brand.

**Fix:**
- Sort businesses by `lastActiveAt` and prefer real ones over test fixtures (or surface a business switcher prominently).
- For the avatar, use the first letter only (matching the PartyAvatar pattern). Two-char initials only when the name has multiple words.

Screenshot: `01-1-dashboard.png`, `06-products-list.png`, etc.

---

## 🟡 P2 — Dev-login endpoint exhausts in normal use

`/api/auth/dev-login` is hard-capped at **20 requests/minute per IP**. During QA/dev work (and possibly during onboarding from shared NAT or coffee-shop wifi), this is easy to exhaust. Production users may also share IPs.

The pre-existing limiter is correct for `/login` (anti-bruteforce), but `dev-login` should probably either:
- Be higher (60-120/min), since it's only used in dev anyway, or
- Be IP-exempt for `127.0.0.1`.

**File:** `server/src/middleware/rate-limit.ts` (auth limiter section).

---

## 🟢 P3 — Misc polish

- **Reports** "14 Reports" badge on the hero claims 14 but only 4 cards are visible above the fold and ~6 total in the page — count seems off or includes hidden/coming-soon items.
- **Outstanding hero** shows three cards (Receivable / Payable / NET) but the third is cropped at the right edge. Should fit 3 chips on 390px wide or paginate.
- **Toast** for "Test Wholesaler 17769… added successfully" — the timestamp suffix in the name is ugly. The toast just shows what the user typed, so this is a test-data side-effect, not a bug. Worth noting that very long party names will overflow the toast.
- **POS paywall card** — large empty white space below the upgrade card. Fix in `UpgradePrompt` could add an illustration or supporting marketing copy ("3-tap checkout · Cash drawer · Receipt printer") to fill space and motivate upgrade.

---

## What's working well (worth keeping)

- **Toasts** — great visual style, dismiss button, accessible. Big improvement from prior session.
- **PlanGate fallback** — POS paywall renders inside proper page chrome (Header + back arrow + AppShell). Looks like a real product page, not a broken state.
- **Empty states** — all major lists (Invoices, Payments, Outstanding) have illustrated empty states with clear copy and primary CTAs.
- **Pill tabs** in forms (Basic Info / Business / Credit on parties; Items / Details / Charges on invoices) — good information hierarchy on small screens.
- **Form layout** — generous spacing, clear labels above inputs, proper error association via aria.
- **Indian-first defaults** — ₹ prefix in money inputs, DD/MM/YYYY date format, UPI as a first-class payment mode, Hindi-ready strings throughout.

---

## Recommended next pass

In priority order:

1. Fix the routing trap (P0).
2. Add bottom padding for FAB overhang on PageContainer (P1, one-line CSS fix, big visual win).
3. Add Products tab to BottomNav (P1, IA fix).
4. Resolve `/settings/profile` 404 (P1).
5. Replace dashboard cold-load spinner with proper skeleton (P1).
6. Filter row truncation + chevron cleanup (P2).
7. Consolidate the FAB stack from 3 buttons → 1 (P2, big perceived-quality win).

Estimated effort: ~4-6 hours total. Items 1-5 are all single-file fixes.

---

## Reproducing

```bash
# Start backend + frontend
cd server && npm run dev &     # → :4000
npm run dev &                  # → :5002

# Run the journey (regenerates /tmp/qa-journey/)
node scripts/qa-user-journey.mjs

# Inspect specific step
open /tmp/qa-journey/10-10-invoices-list.png
cat /tmp/qa-journey/REPORT.json | jq .
```

The script logs in via `/api/auth/dev-login` (admin/admin123), walks 20 routes, captures screenshots + console errors + network 4xx/5xx, and writes `REPORT.json`. Re-runnable; idempotent (creates timestamped party + product so no clashes).
