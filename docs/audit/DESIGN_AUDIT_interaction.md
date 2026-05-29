# Design Audit — Interaction, Haptics, Gestures & Perceived Performance

> Read-only audit. HisaabPro (React 19 + TS + Tailwind 4 + Capacitor, mobile-first).
> Date: 2026-05-29. Scope: interaction-design standardization across 72 feature areas.

## TL;DR

The app's interaction layer is **functionally complete but interaction-poor and
inconsistent**. There is no shared haptics primitive, no gesture library in use
(`motion` v12 is installed but only powers the marketing landing page), no
draggable bottom sheets, no swipe-to-action rows, no real pull-to-refresh, and
no animated money/number transitions. Press feedback (CSS `:active`) and the
4-UI-states pattern are the two areas that ARE largely consistent. The biggest
wins are cheap: a single `useHaptics()` API + a tween'd `<AnimatedNumber>`.

---

## 1. Haptics coverage

### Current state — FRAGMENTED, no SSOT

There is **no shared haptics primitive**. Three competing ad-hoc implementations:

| Mechanism | File | API used | Notes |
|---|---|---|---|
| Capacitor `@capacitor/haptics` (lazy `Function('return import…')`) | `src/features/cash-register/useCashCalculator.ts:117` `triggerHaptic()` | `Haptics.impact({ Medium })` | The ONLY native-haptic path. Private to cash-register, fires on calc success only. |
| Raw Web Vibration API | `src/features/settings/calculator-settings.utils.ts:60` | `navigator.vibrate(10)` | Calculator key click. |
| Raw Web Vibration API | `src/features/business/BusinessAvatar.tsx:46` | `navigator.vibrate(12)` | Avatar tap. |
| Raw Web Vibration API | `src/features/pos/usePosCart.ts:78` | `navigator.vibrate(50)` | Add-to-cart. |
| Raw Web Vibration API | `src/features/pos/hooks/usePosPage.ts:45` | `navigator.vibrate(30)` | POS scan. |
| Raw Web Vibration API | `src/features/pos/hooks/usePosCheckout.ts:43`, `usePosCheckout.ts:55` | `navigator.vibrate([100,50,100])` | Checkout success pattern. |

Total: **~8 call sites across ~6 files**, none sharing code, mixing two APIs.
`navigator.vibrate` is a **no-op on iOS** and the Capacitor path is duplicated
nowhere else, so most of the app vibrates only on Android Chrome WebView.

### Where meaningful actions SHOULD fire haptics but DON'T

| Action class | Example sites | Haptic today? |
|---|---|---|
| Tab / bottom-nav switch | `BottomNav`, in-page segmented tabs | NO |
| Toggle / switch flip | every `<Switch>` / settings toggle | NO |
| Primary button press | global `<Button variant="primary">` | NO |
| Success — payment recorded | `payments/*`, POS non-checkout | partial (POS only) |
| Success — invoice saved / shared | `invoices/*`, `sales/*` | NO |
| Success — generic save (43 optimistic toasts) | all forms | NO |
| Error — validation fail | every form submit | NO |
| Long-press menu fires | `PaymentCard`, `ProductCard`, +10 cards | NO (only 2 of 12 vibrate) |
| Swipe action commit | — | N/A (no swipe exists) |

### Recommendation — standardized `useHaptics()`

Single primitive `src/lib/haptics.ts` exposing semantic intents (not raw ms):

```ts
const h = useHaptics()
h.selection()  // tab switch, toggle, segmented control  → ImpactStyle.Light / vibrate(8)
h.tap()        // button press, card open               → ImpactStyle.Light / vibrate(10)
h.impact()     // long-press fires, add-to-cart          → ImpactStyle.Medium / vibrate(20)
h.success()    // payment/invoice/save committed         → NotificationType.Success / vibrate([0,30,30,30])
h.warning()    // soft validation                        → NotificationType.Warning
h.error()      // validation fail, network reject        → NotificationType.Error / vibrate([0,60,40,60])
```

Internals: lazy-import Capacitor `Haptics` once, cache module, fall back to
`navigator.vibrate`, no-op on unsupported. Replaces all 6 ad-hoc files.
**Coverage policy:** wire `h.selection()` into the shared `<Switch>`,
`<BottomNav>`, segmented-tab primitives, and `h.success()/h.error()` into the
shared optimistic-toast helper (see §3) so 90% of coverage lands by editing
~5 primitives, not 200 call sites.

---

## 2. Gesture surfaces — NEARLY NONE

| Gesture | Present? | Evidence |
|---|---|---|
| Draggable bottom sheet | **NO** | `src/components/ui/Drawer.tsx` has a `.drawer-drag-handle` div that is purely cosmetic (`aria-hidden`); open/close is a CSS slide on `data-state` with a 200 ms timer. No `onTouchMove`, no velocity, no swipe-to-dismiss. |
| Swipe-to-delete / swipe-action rows | **NO** | No list row has touch-pan handlers. All row actions are long-press → action sheet or trailing buttons. |
| Pull-to-refresh | **NO** | The 3 "onRefresh" greps are false positives — `onRetry`/`refetch` buttons in error states, not gesture PTR. `overscroll-behavior:none` (PLATFORM_SHELL C11) intentionally disables native pull. |
| Long-press menu | **YES (ad-hoc)** | Real `setTimeout(LONG_PRESS_MS)` pattern duplicated in ~12 card components (`PaymentCard.tsx:57`, `ProductCard`, `InvoiceCard`, `DocumentListCard`, etc.). Each re-implements pointer-down/up/move-cancel. No haptic on fire. No shared hook. |
| Button tap micro-interaction | **YES (CSS)** | `:active { transform: scale(.93|.98) }` on `.fab`, `.card[role=button]`, `.txn-row`, `.header-*` in `components-overlay.css` / `components-layout.css`. Consistent and good. |
| `motion` (framer-motion v12) | installed, **0 feature use** | Only `src/components/ui/*` landing/marketing sections use it (`whileTap` etc.). Zero usage under `src/features/` except landing. |

### Recommendations

- **Draggable `<Sheet>`:** upgrade `Drawer.tsx` (mobile variant) to a velocity-
  aware draggable sheet using the already-installed `motion` (`drag="y"`,
  `dragConstraints`, dismiss on velocity/threshold). The cosmetic drag handle
  becomes functional. Keep desktop modal path unchanged. SSOT for all sheets.
- **`useLongPress()` hook** in `src/hooks/` — consolidate the 12 copies, fire
  `h.impact()` on trigger, handle move-cancel + scroll-cancel uniformly.
- **`<SwipeRow>` primitive** (FUTURE) — reveal edit/delete on horizontal pan for
  list cards (parties, invoices, payments). Use `motion` pan + snap.
- **Pull-to-refresh:** deliberately omitted by platform rule; keep the explicit
  retry buttons. Do NOT add native PTR (conflicts with `overscroll-behavior`).

---

## 3. Perceived performance / optimistic feedback

### Optimistic-toast — pattern exists, applied INCONSISTENTLY

The codebase has a good idiom: `toast.success(navigator.onLine ? tSaved :
tQueued)` (e.g. `commission/CommissionRuleForm.tsx:70`,
`loyalty/LoyaltyProgramForm.tsx:76`, `subscription/useManageActions.ts:31`).

- **~43** files use the online-aware queued/saved toast.
- **203** files call `toast.*` total.

→ Roughly **80% of mutating surfaces show a plain "Saved" toast** that does NOT
distinguish online-save from offline-queue, contradicting OFFLINE_RULES Rule 5
("Saved — will sync when online"). Inconsistent: a user offline on the parties
page sees "Saved" but on the commission page sees "Saved — will sync".

**Recommendation — `optimisticToast()` helper** in `src/lib/`:
```ts
optimisticToast.saved(t)   // online ? t.saved : t.savedWillSync  + h.success()
optimisticToast.deleted(t) // …                                   + h.success()
optimisticToast.error(msg) // …                                   + h.error()
```
Single helper that bundles the online-aware copy AND the haptic, used by every
service mutation success/error handler. Closes the §1 success/error haptic gap
and the optimistic-toast inconsistency simultaneously.

### Animated numbers — NONE

- **No `<AnimatedNumber>` / count-up / tween component exists** (`ls
  src/components/ui` → no match; no `CountUp`, no `useSpring` in features).
- Dashboard totals, party balances, aging buckets, POS cart total all **snap**
  to new values.
- `requestAnimationFrame` in features is only used for search-input debouncing
  (`ProductSearchInput`, `PartySearchInput`), not number tweening.

**Recommendation — `<AnimatedNumber value={paise} format={formatCurrency} />**
in `src/components/ui/`, ~120 ms ease-out tween, `prefers-reduced-motion`
respected, `tabular-nums`. Use on dashboard hero, balances, cart total. High
perceived-premium payoff for ~1 file.

---

## 4. Loading choreography — 4-UI-states LARGELY CONSISTENT (best area)

Coverage across `src/features/**` (excludes tests):

| State primitive | Files referencing |
|---|---|
| `Skeleton` / `ListSkeleton` | 145 |
| `ErrorState` | 126 |
| `EmptyState` | 70 |
| Total `*Page.tsx` | 182 |

Skeletons are used (not spinners) for list/detail loads — good, content
morphs in. **Gap:** `EmptyState` coverage (70) lags `Skeleton`/`ErrorState`
(126–145), so ~60–75 pages have loading+error+success but **no dedicated empty
state** (likely render a bare list or nothing on zero rows). Per
PAGE_AUDIT_CHECKLIST §G all four are mandatory.

**Recommendation:** reconcile the ~56-file gap between `Skeleton` and
`EmptyState` — list pages with a skeleton but no `<EmptyState>` are the targets
(grep `ListSkeleton` ∧ ¬`EmptyState`). Mechanical enforce.js check candidate.

---

## 5. Touch targets / ergonomics

- Press-scale and `:active` states exist on cards/rows/FAB — good thumb feedback.
- `min-h-[44px]` is mandated by PAGE_AUDIT_CHECKLIST §E and enforced; spot-check
  shows compliance in shared `<Button>`/`<Input>`. Not re-audited exhaustively
  here — covered by existing per-page checklist gate.
- Long-press as the primary row-action affordance is **undiscoverable** (no
  visual hint, no haptic). A `<SwipeRow>` or trailing kebab would be more
  thumb-reachable and discoverable than a hidden 500 ms long-press.

---

## Tiered gap list

### MUST_FIX (consistency-breaking, cheap, high impact)
1. **`useHaptics()` SSOT** — kill the 6 ad-hoc vibrate/Capacitor implementations; one semantic API.
2. **Wire haptics into shared primitives** — `<Button>` press, `<Switch>` toggle, `<BottomNav>` tab, optimistic-toast success/error. ~5 edits → ~90% coverage.
3. **`optimisticToast()` helper** — standardize online-aware "Saved / Saved — will sync" copy across the ~160 mutation sites that don't follow OFFLINE_RULES Rule 5.
4. **Long-press → `useLongPress()` hook** — consolidate 12 duplicated timer implementations; fire `h.impact()` on trigger.

### SHOULD_FIX (premium feel, moderate effort)
5. **`<AnimatedNumber>`** — tween money/totals on dashboard, balances, cart, aging.
6. **Draggable `<Sheet>`** — make `Drawer` mobile variant velocity-aware swipe-to-dismiss (cosmetic drag-handle becomes real) using installed `motion`.
7. **EmptyState reconciliation** — add `<EmptyState>` to the ~56 pages that have skeletons but no empty state; promote to an enforce.js check.

### FUTURE (delight, larger surface)
8. **`<SwipeRow>`** swipe-to-edit/delete on list cards (parties, invoices, payments) — replaces hidden long-press as primary affordance.
9. Shared-element / layout transitions between list → detail (use `motion` `layoutId`), now that the library is already a dependency.
10. Skeleton→content crossfade (currently a hard swap).

---

## Recommended standardized APIs (summary)

| API | Path | Replaces |
|---|---|---|
| `useHaptics()` / `haptics.{selection,tap,impact,success,warning,error}` | `src/lib/haptics.ts` | `triggerHaptic()` + 5 `navigator.vibrate` sites |
| `optimisticToast.{saved,deleted,error}` | `src/lib/optimistic-toast.ts` | ~160 inconsistent `toast.success('Saved')` calls |
| `useLongPress({ onLongPress })` | `src/hooks/useLongPress.ts` | 12 duplicated setTimeout pointer handlers |
| `<AnimatedNumber value format />` | `src/components/ui/AnimatedNumber.tsx` | snapping totals everywhere |
| Draggable `<Sheet>` (Drawer mobile variant) | `src/components/ui/Drawer.tsx` | CSS-only slide + cosmetic drag handle |
| `<SwipeRow>` (FUTURE) | `src/components/ui/SwipeRow.tsx` | hidden long-press row actions |
