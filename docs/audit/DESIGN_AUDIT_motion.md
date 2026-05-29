# DESIGN AUDIT — Motion / Animation Layer

> READ-ONLY audit. Goal: a **consistent, standard** motion layer across ALL
> pages (Cred / Jupiter / Linear tier), keeping the existing visual identity.
> Date: 2026-05-29. Scope: `src/features/` (72 areas) + `src/components/`.

---

## TL;DR

The app has **no app-level motion layer**. Framer Motion (`motion` v12) is
installed but used in **15 files — ALL of them marketing/landing components in
`src/components/ui/`**. **ZERO feature `.tsx` files import `motion`** (verified:
`grep -rl "from 'motion" src/features/` → 0). No route/page transitions, no
list enter/exit, no spring physics anywhere (`type:'spring'` → 0 hits). What
motion exists in the app is ~96 ad-hoc CSS `@keyframes` blocks, each
hand-rolled per feature, with 196 hardcoded ms durations and 41 `transition-all`
usages bypassing the token system. This is the definition of "sprinkled, not
standardized."

---

## 1. Coverage Map

| Category | Have | Should-have (target) | Coverage | Notes |
|----------|------|----------------------|----------|-------|
| (a) Page / route transitions | **0** | ~50 routes | **0%** | `App.tsx` `<Routes>` has NO `AnimatePresence`, no `useLocation` keying. `PageRoute` (`app.guards.tsx:18`) is a Suspense wrapper only — no animation. |
| (b) List stagger / item enter-exit | **0** feature files (1 unused CSS keyframe `list-item-enter`) | ~30 list pages | **~0%** | `staggerChildren` → 0 hits. `list-item-enter` keyframe defined but applied nowhere in features. |
| (c) Modal / drawer / sheet open-close | partial / inconsistent | all | mixed | `Modal.tsx` + `ConfirmDialog.tsx` = native `<dialog>` with NO animation. `Drawer.tsx` = CSS keyframes (`drawer-slide-up`, `drawer-backdrop-in`, `drawer-modal-enter`). Three different animation mechanisms for three overlay types. |
| (d) Micro-interactions (press/toggle/check) | ~3 files | all interactive | **~4%** | `whileTap` → 1 file, `whileHover` → 2 files (all landing). App buttons rely on CSS `:active` ad-hoc. No standard press-feedback. |
| (e) Skeleton → content morph | **0** (hard cut) | all loaders | **0%** | `Skeleton.tsx` exists (shimmer keyframe) but swaps to content with no cross-fade / layout morph. |
| (f) Animated numbers / counters | **0** in features | dashboard, reports, hero KPIs | **0%** | `magicui/number-ticker.tsx` exists but is **unused in features**. Dashboard amounts use one-shot CSS reveal (`amountReveal`/`dashAmountReveal`) — not a counting tween. |

**Motion-importing files (all 15, all marketing):**
`accordion-feature-section, before-after-section, cta-section, database-rest-api,
feature-bento-grid, feature-hover-effects, features-section-7,
invoice-templates-section(-modal), pricing-section, saa-s-template,
section-with-mockup, social-proof-bar, sticky-mobile-cta, testimonial-v2` —
all under `src/components/ui/`.

---

## 2. Route / Page Transitions

`src/App.tsx` renders a flat `<Routes>` (react-router-dom v6) wrapping each
page in `<PageRoute>` → `<ProtectedRoute>` → `<PlanGate>`. **No
`AnimatePresence` wrapping the `<Routes>`, no `location`/`key` plumbing, no
`<motion.div>` page wrapper.** Result: every navigation is an instant hard
cut. No shared-element transitions (e.g. list card → detail header) anywhere.
`AnimatePresence` total in repo = 3 files, all marketing
(`before-after-section`, `sticky-mobile-cta`, `invoice-templates-section`).

---

## 3. Spring vs Duration

- `type:'spring'` across `src/` → **0 occurrences.** No spring physics at all.
- `useSpring` / `useMotionValue` → 0 in features (1 in `social-proof-bar`).
- Everything is duration + cubic-bezier easing. Tokens exist
  (`--ease-spring: cubic-bezier(0.34,1.56,0.64,1)`, `--ease-premium`,
  `--ease-smooth` in `tokens-core.css:203-205`) but spring-curve is a bezier
  approximation, not real spring. **Premium feel target (Linear/Jupiter) wants
  real spring on overlays, list items, and press — currently 0%.**

---

## 4. Consistency / Deviation (violation counts)

| Violation | Count | Where |
|-----------|------:|-------|
| Ad-hoc CSS `@keyframes` blocks | **96** | Spread across ~50 feature CSS files. 7+ near-duplicate `spin`, 5+ `skeleton-pulse`, multiple `slide-up`/`slideUp`/`slide-down`/`drawer-slide-up` doing the same thing under different names. |
| Hardcoded ms durations in CSS (not `var(--duration-*)`) | **196** | feature + component CSS |
| `transition-all` (Tailwind, perf + non-tokenized) | **41** | mixed |
| Hardcoded `duration-NNN` Tailwind classes | **49** | mixed |
| Overlay animation mechanisms in use | **3 different** | native `<dialog>` (Modal, ConfirmDialog) = none; Drawer = CSS keyframes; landing sheets = Framer. No single source. |

Near-duplicate keyframe families that should collapse to ONE token-driven
primitive each: `spin*` (~8 variants), `slide-up/slideUp/slide-down/slideDown`
(~6), `skeleton-pulse/shimmer/skeleton-shimmer` (~12), `fadeIn/fadeUp/heroFadeUp`
(~4), `*-pulse` (~10), per-feature `*-spin` (gstin, export, share, coupon,
party-search, product-search, side-nav, tenant-chip…).

---

## 5. prefers-reduced-motion

- CSS files referencing `prefers-reduced-motion`: **52** (better than the
  "~3" assumption — most feature CSS guards its own keyframes).
- JS `useReducedMotion`: **10** (all in the 15 marketing motion files).
- **Gap:** the guards are per-file and inconsistent — there is no single
  global reduced-motion kill-switch, and any NEW shared motion primitive must
  bake it in once. The 196 hardcoded-duration / 41 `transition-all` usages are
  the ones most likely to slip the guard.

---

## 6. Recommendation — Motion Primitive Set + Standard Specs

Build these **once** (`src/components/motion/`) and adopt everywhere. All
read tokens from `tokens-core.css` / `timings.ts` and honor `useReducedMotion`
internally (single kill-switch).

| Primitive | Replaces | Standard spec |
|-----------|----------|---------------|
| `<PageTransition>` (wraps `<Routes>` w/ `AnimatePresence mode="popLayout"`, keyed on `location.pathname`) | hard-cut navigation | enter: opacity 0→1 + y 8→0; exit: opacity→0; spring `{stiffness:300,damping:30}`; reduced → opacity only. |
| `<AnimatedList>` / `<AnimatedItem>` (layout + `staggerChildren`) | unused `list-item-enter` keyframe | item enter y 12→0 + fade, stagger 0.03s, spring; exit fade+scale 0.98; `layout` for reorder. |
| `<Sheet>` / unified overlay (one `AnimatePresence` for Modal+Drawer+Confirm) | native `<dialog>` (no anim) + 3 separate CSS mechanisms | backdrop fade 200ms; panel: drawer slides y, modal scale 0.96→1, spring `{stiffness:400,damping:35}`. Retire native `<dialog>` animation gap. |
| `<Press>` (wraps Button/card/tap targets) | ad-hoc CSS `:active`, lone `whileTap` | `whileTap={{scale:0.97}}` spring; ≥44px tap target preserved. |
| `<AnimatedNumber>` (adopt existing `magicui/number-ticker`) | `amountReveal` one-shot CSS, unused ticker | spring count-up on KPI/dashboard/report amounts; `tabular-nums`; reduced → snap to value. |
| `<RevealOnMount>` / skeleton cross-fade | hard skeleton→content cut | content fades in over skeleton (200ms `--ease-premium`); optional `layoutId` morph card→detail. |

**Standard motion spec (each surface):**
- Durations ONLY from `--duration-fast|snappy|normal|slow`; easing ONLY from
  `--ease-premium|spring|smooth`. Ban new hardcoded ms + `transition-all`.
- Overlays + list items + press = **real spring** (`type:'spring'`), not bezier.
- Reduced-motion handled once inside primitives — delete per-file guards over time.

---

## Tiered Gap List

### MUST_FIX (blocks "premium consistent" goal)
1. **No route/page transitions** — wrap `<Routes>` in `<PageTransition>` (§2). 0 → all routes.
2. **No list enter/exit/stagger** — ship `<AnimatedList>`, adopt on the ~30 list pages (§1b).
3. **Three inconsistent overlay mechanisms** — unify Modal/ConfirmDialog/Drawer under one `<Sheet>`/`AnimatePresence`; native `<dialog>` currently animates nothing (§1c, §4).
4. **Zero spring physics** — adopt spring in the new primitives (§3).

### SHOULD_FIX
5. Standard `<Press>` micro-interaction on all buttons/cards (§1d).
6. Skeleton→content cross-fade instead of hard cut (§1e).
7. `<AnimatedNumber>` on dashboard/report KPIs (adopt existing unused ticker) (§1f).
8. Collapse 96 ad-hoc `@keyframes` (8 `spin`, 6 slide, 12 skeleton, etc.) into token-driven primitives; remove 196 hardcoded ms + 41 `transition-all` + 49 `duration-NNN` (§4).

### FUTURE
9. Shared-element / `layoutId` transitions (list card → detail header).
10. Single global reduced-motion kill-switch; retire 52 per-file guards.
11. enforce.js rule banning new `@keyframes`/hardcoded ms/`transition-all` in feature code (ratchet, like enforce-offline).
