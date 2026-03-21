# Test Specification: Navigation & State Management

## 1. Feature Summary

Navigation and state management tests verify that the app behaves correctly during routing, browser navigation (back/forward), deep linking, session management, and multi-tab usage. These tests apply across all Phase 4 features and catch regressions in URL state, history stack, auth redirects, and data persistence.

**Pages:** All pages — focus on Phase 4: `/pos`, `/godowns/*`, `/products/*/batches`, `/products/*/serials`, `/stock-verification/*`, `/serials/lookup`
**Priority:** P0 (blocks release)
**Depends on:** Router configuration, auth middleware, all Phase 4 features

---

## 2. Preconditions

| # | Condition | How to Set Up |
|---|-----------|---------------|
| 1 | User logged in | Valid session with active token |
| 2 | At least 1 godown, 1 batch, 1 serial, 1 verification exist | Data from other feature tests |
| 3 | Two browser tabs available | Test multi-tab scenarios |
| 4 | Browser supports bfcache | Chrome/Safari (Firefox varies) |
| 5 | Session expiry configurable | Access token TTL set to testable duration |
| 6 | Bottom navigation configured | All Phase 4 routes in nav config |

---

## 3. Test Scenarios

### 3a. Happy Path

| Step | Action | Expected Result | Verify Method |
|------|--------|-----------------|---------------|
| 1 | **Deep link — Godown detail**: Open `/godowns/:id` directly (paste URL) | Godown detail page loads with correct data | DOM: godown name, stock list visible |
| 2 | **Deep link — Batch detail**: Open `/batches/:id` directly | Batch detail loads, product context shown | DOM: batch info, movement history |
| 3 | **Deep link — Serial lookup with query**: Open `/serials/lookup?q=SN-003` | Lookup page opens with SN-003 pre-searched | DOM: serial info displayed |
| 4 | **Deep link — Stock verification**: Open `/stock-verification/:id` | Verification loads at correct status | DOM: verification details, correct state |
| 5 | **Back button — POS to receipt to POS**: Complete POS sale → view receipt → press Back | Returns to POS (empty cart, ready for new sale) | URL: /pos, cart empty |
| 6 | **Back button — Godown detail to list**: Open godown detail → press Back | Returns to godown list | URL: /godowns, list visible |
| 7 | **Forward button**: Press Back from godown detail → press Forward | Returns to godown detail | URL: /godowns/:id |
| 8 | **Back from create form (unsaved)**: Open "Add Godown" → fill fields → press Back | Confirmation: "You have unsaved changes. Leave?" | Visual: confirmation dialog |
| 9 | **Back from create form (confirm leave)**: Click "Leave" on confirmation | Returns to previous page, data discarded | URL: previous page |
| 10 | **Back from create form (cancel leave)**: Click "Stay" on confirmation | Remains on form, data preserved | DOM: form still filled |
| 11 | **Browser refresh on godown detail**: Press F5 on `/godowns/:id` | Page reloads with same godown data | DOM: identical content after reload |
| 12 | **Browser refresh on POS with cart**: Add items to POS cart → F5 | Cart restored from sessionStorage/IndexedDB | DOM: same items and quantities in cart |
| 13 | **Browser refresh on stock verification (in progress)**: F5 during counting | Count progress preserved, resume counting | DOM: previously entered counts still there |
| 14 | **Bottom nav highlighting**: Navigate to `/godowns` | "Inventory" nav item highlighted | DOM: active class on correct nav item |
| 15 | **Bottom nav — POS**: Navigate to `/pos` | "POS" nav item highlighted | DOM: active class on POS nav item |
| 16 | **Header title updates**: Navigate to godown detail | Header shows godown name | DOM: header title = godown name |
| 17 | **Header back button**: On godown detail, click header back arrow | Navigates to godown list | URL: /godowns |
| 18 | **Breadcrumbs**: On batch detail page | Breadcrumb: Products > Product Name > Batches > B001 | DOM: breadcrumb trail correct, each segment clickable |
| 19 | **Auth redirect after login**: Open `/godowns/:id` while logged out → login | After login, redirected to `/godowns/:id` (not dashboard) | URL: original deep link after auth |

### 3b. Error Cases

| # | Scenario | Input | Expected Error |
|---|----------|-------|----------------|
| 1 | Invalid godown ID in URL | `/godowns/nonexistent-uuid` | 404 page: "Godown not found" with "Go to Godowns" link |
| 2 | Invalid batch ID in URL | `/batches/invalid-id` | 404 page: "Batch not found" with "Go to Products" link |
| 3 | Malformed URL params | `/stock-verification/not-a-uuid` | 404 page, not a crash |
| 4 | Deleted resource deep link | URL to a deleted godown | 404 page: "This godown was deleted" |
| 5 | Unauthorized route | User without POS permission visits `/pos` | Redirect to dashboard with toast "You don't have access to POS" |
| 6 | Session expired during navigation | Token expires, click nav link | Redirect to login, return URL preserved |
| 7 | Broken hash/query params | `/serials/lookup?q=<script>alert(1)</script>` | Sanitized, no XSS, search runs with sanitized query |

### 3c. Edge Cases

| # | Scenario | Steps | Expected Behavior |
|---|----------|-------|-------------------|
| 1 | **bfcache**: Navigate away from godown list, press Back | Page restored from bfcache instantly (no API refetch) | Performance: instant restore, data may be stale — show refresh hint after 5min |
| 2 | **Multi-tab — same page**: Open `/godowns` in 2 tabs, create godown in tab 1 | Tab 2 shows stale list, refresh shows new godown | Tab 2 does not auto-update (acceptable), no crash |
| 3 | **Multi-tab — session**: Logout in tab 1 | Tab 2 detects logout on next interaction, redirects to login | No crash, clean redirect |
| 4 | **Multi-tab — POS**: Open POS in 2 tabs, sell same product | First sale succeeds, second gets stock conflict on checkout | Error message, not oversell |
| 5 | **Rapid navigation**: Click 5 different nav items in 2 seconds | Final page loads correctly, no race conditions | No flash of intermediate pages, abort pending requests |
| 6 | **URL state for filters**: Filter stock verification list by status "COMPLETED" | URL updates: `?status=COMPLETED` | Shareable URL, refresh preserves filter |
| 7 | **URL state for pagination**: Navigate to page 2 of godown stock | URL updates: `?cursor=xxx` or `?page=2` | Back button returns to page 1 |
| 8 | **Offline navigation**: Go offline, click nav to different page | If page data cached in IndexedDB, show cached data with offline banner. If not cached, show offline state | No crash, graceful degradation |
| 9 | **History stack depth**: Navigate through 20 pages, then press Back 20 times | Correct page at each step, no stack corruption | URL matches expected page at each Back press |
| 10 | **Programmatic navigation after action**: Complete stock adjustment → auto-navigate to report | URL changes to report page, Back goes to verification detail | Correct history entry |
| 11 | **Modal/sheet back behavior**: Open checkout sheet in POS, press hardware Back (mobile) | Sheet closes (not page navigation) | Sheet dismissed, POS page still showing |
| 12 | **Scroll position restoration**: Scroll down godown stock list → navigate to product → Back | Scroll position restored to where user was | Scroll position matches previous |

### 3d. State Transitions

| From | Action | To | Verify |
|------|--------|----|--------|
| Logged out | Deep link to `/godowns/:id` | Login page (returnUrl saved) | URL param: `?returnUrl=/godowns/:id` |
| Login page (with returnUrl) | Successful login | `/godowns/:id` (original deep link) | URL matches returnUrl |
| Any page | Session expires + interaction | Login page | Current URL saved as returnUrl |
| Any page | Click bottom nav "POS" | `/pos` | URL = /pos, nav highlighted |
| Godown list | Click godown card | `/godowns/:id` | URL = godown detail, Back → list |
| Form (unsaved changes) | Back/navigate away | Confirmation dialog | Dialog visible, navigation paused |
| Confirmation dialog | Confirm leave | Previous page | Data discarded, navigation completes |
| Confirmation dialog | Cancel | Form page | Data preserved, stay on form |
| Online | Network lost | Same page + offline banner | Banner shown, cached data visible |
| Offline + banner | Network restored | Same page, banner removed | Fresh data fetched silently |

---

## 4. API Contracts

No new APIs. Navigation tests verify correct API calls during routing:

| Navigation Action | Expected API Call | Verify |
|-------------------|------------------|--------|
| Open `/godowns/:id` | GET /api/godowns/:id | Correct ID, auth header present |
| Open `/batches/:id` | GET /api/batches/:id | Correct ID |
| Open `/stock-verification/:id` | GET /api/stock-verification/:id | Correct ID |
| Open `/serials/lookup?q=X` | GET /api/serial-numbers/lookup?q=X | Query param passed |
| bfcache restore | No API call (cached) | Network tab: no request |
| Refresh after bfcache (stale) | GET with fresh request | Network tab: fresh request |
| Session expired request | Any API → 401 | Interceptor catches, redirects to login |

---

## 5. Visual Checkpoints

| Page / State | Viewport | What to Check |
|-------------|----------|---------------|
| Bottom nav | 375x812 | 4-5 nav items, active item highlighted (fill or color change), labels visible |
| Bottom nav | 320x568 | Nav items fit, no overflow, icons + labels readable |
| Bottom nav | 768x1024 | May switch to sidebar nav on tablet |
| Bottom nav | 1280x720 | Sidebar nav or top nav (desktop layout) |
| Header — page title | 375x812 | Title matches page, back arrow visible on detail pages, no overflow |
| Header — breadcrumbs | 1280x720 | Full breadcrumb path, each segment clickable |
| 404 page | 375x812 | Illustration + "Not found" message + navigation CTA |
| Unsaved changes dialog | 375x812 | Clear warning text, "Stay" and "Leave" buttons, no data visible behind overlay |
| Offline banner | 375x812 | Full-width amber banner below header, "You're offline" text, does not overlap content |
| Loading state (route transition) | 375x812 | Skeleton or progress bar during page load, not blank white screen |
| Auth redirect (login page) | 375x812 | Login form, no flash of protected content before redirect |

---

## 6. Accessibility Requirements

| # | Requirement | Implementation |
|---|------------|----------------|
| 1 | Bottom nav landmarks | `<nav aria-label="Main navigation">` |
| 2 | Active nav item announced | `aria-current="page"` on active nav link |
| 3 | Page title updates on navigation | `document.title` updates to match page (for screen readers and tab label) |
| 4 | Route change announced | `aria-live="polite"` region or focus management on route change |
| 5 | Back button accessible | `aria-label="Go back"` on header back arrow |
| 6 | 404 page navigable | Focus moves to heading, "Go to..." link is keyboard accessible |
| 7 | Unsaved changes dialog | `role="alertdialog"`, focus trapped, Escape = Stay |
| 8 | Breadcrumbs | `<nav aria-label="Breadcrumb">` with `<ol>` and current item `aria-current="page"` |
| 9 | Skip to content link | Hidden link before nav, visible on focus, skips to `<main>` |
| 10 | Loading state announced | `aria-live="polite"` announces "Loading [page name]" |

---

## 7. Performance Budgets

| Metric | Budget | Measurement |
|--------|--------|-------------|
| Route transition (cached component) | < 100ms | Time from click to new page visible |
| Route transition (lazy load chunk) | < 500ms | Time from click to new page visible (includes chunk download) |
| bfcache restore | < 50ms | Instant from cache |
| Deep link cold load | < 2s (LCP) | Lighthouse |
| Auth redirect round-trip | < 3s | Login → redirect to original page |
| Scroll position restore | < 100ms | Time from Back press to scroll position restored |
| 404 page load | < 500ms | Should not make data API calls |
| Bottom nav interaction | < 50ms (INP) | Interaction to Next Paint |

---

## 8. Security Checks

| # | Check | Expected |
|---|-------|----------|
| 1 | Protected routes require auth | All `/godowns`, `/pos`, `/stock-verification` redirect to login if unauthenticated |
| 2 | returnUrl validated | returnUrl cannot be external URL (prevents open redirect) |
| 3 | returnUrl sanitized | No script injection via returnUrl param |
| 4 | Deep link query params sanitized | XSS in query params neutralized |
| 5 | Session expiry enforced | Expired token → 401 → redirect, not stale data |
| 6 | Multi-tab logout sync | Logout in one tab invalidates all tabs |
| 7 | No protected data flash | Protected page content not visible before auth redirect |
| 8 | URL enumeration safe | Sequential godown IDs not guessable (UUID) |

---

## 9. Pass/Fail Criteria

### Must Pass (P0 — blocks release)
- [ ] Deep links work for all Phase 4 pages (godown, batch, serial, verification)
- [ ] Back button works correctly from all detail pages
- [ ] Browser refresh preserves page state (especially POS cart and verification progress)
- [ ] Auth redirect preserves return URL and redirects after login
- [ ] Bottom nav correctly highlights active route
- [ ] Header title updates on every route change
- [ ] 404 page shown for invalid/deleted resource URLs
- [ ] Session expiry redirects to login cleanly
- [ ] No XSS via URL parameters
- [ ] Unsaved changes warning on form pages

### Should Pass (P1 — degrades experience)
- [ ] Breadcrumbs show correct hierarchy
- [ ] Scroll position restored on Back navigation
- [ ] URL reflects filter/pagination state (shareable)
- [ ] Multi-tab logout sync works
- [ ] bfcache works for list pages
- [ ] Rapid navigation doesn't cause race conditions

### Nice to Pass (P2 — polish)
- [ ] Route transition animations (fade/slide)
- [ ] Skeleton loading during route transitions
- [ ] Offline navigation with cached data
- [ ] History stack depth handling (20+ pages)
