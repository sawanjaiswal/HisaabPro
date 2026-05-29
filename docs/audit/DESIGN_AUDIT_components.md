# DESIGN AUDIT — Component Primitive Layer

> Read-only audit. Scope: `src/components/ui|feedback|layout|magicui` + deviation
> sweep across 72 feature areas in `src/features/`. Goal: standardize core
> primitives onto Radix + shadcn-style (cva + `cn()`) **while keeping the
> existing visual identity** (Poppins, glow, dark-mode, CSS-var tokens).
> Date: 2026-05-29.

---

## 0. Foundation state (the good news)

- `cn()` already exists and is correct — `src/lib/utils.ts` (`twMerge(clsx(...))`).
- `components.json` configured (style new-york, `aliases.utils = @/lib/utils`).
- The **umbrella `radix-ui@1.4.3` package is installed** — it bundles the FULL
  primitive suite already on disk: `react-dialog`, `react-dropdown-menu`,
  `react-popover`, `react-tooltip`, `react-tabs`(menu/menubar/navigation),
  `react-select`, `react-checkbox`, `react-radio-group`, `react-switch`(slider),
  `react-label`, `react-slot`, `react-alert-dialog`, `react-scroll-area`, etc.
  **Migrating to any of these needs ZERO new installs.**
- 3 components already follow the target pattern (Radix + `cn()`):
  `accordion.tsx`, `avatar.tsx`, `separator.tsx`.

### Two gaps in the foundation
1. **`class-variance-authority` (cva) is NOT installed** — needed for the
   shadcn variant pattern. One `npm i class-variance-authority` unblocks it.
2. **No mechanical enforcement of primitive usage.** `scripts/enforce.js` has
   17 checks (file-length, platform-shell, SSOT, security) but **none** ban
   raw `<button>`/`<input>`/`window.confirm`. The "no raw HTML" rule lives ONLY
   in the `hp-designbook` skill as a manual grep checklist (C2) — advisory, not
   blocking. This is why ~375 deviations accumulated unchecked.

---

## 1. Component inventory

### `src/components/ui/` — CORE PRIMITIVES (the bespoke problem)

| Component | Impl | cva | cn() | Radix | Variants / props | Verdict |
|-----------|------|-----|------|-------|------------------|---------|
| **Button.tsx** | bespoke `<button>` + `btn btn-${variant}` strings | ❌ | ❌ | ❌ | variant(primary/secondary/accent/destructive/ghost), size(sm/md/lg), loading | MIGRATE — add Radix `Slot` (`asChild`) + cva |
| **Card.tsx** | bespoke div + manual class array | ❌ | ❌ | ❌ | variant(default/accent/primary), elevated, compact | cva refactor (no Radix needed) |
| **Input.tsx** | bespoke, forwardRef, label/error/icon | ❌ | ❌ | ❌ | label, error, icon | cn() refactor; optional Radix `Label` |
| **Badge.tsx** | bespoke span | ❌ | ❌ | ❌ | variant(paid/pending/overdue/draft/info) | cva refactor. NOTE variants mismatch PAGE_AUDIT (success/error/warning/info/default) — divergent contract |
| **Modal.tsx** | native `<dialog>` + manual ESC | ❌ | ❌ | ❌ | open, onClose, title | MIGRATE → Radix Dialog (focus trap, scroll-lock, portal free) |
| **Drawer.tsx** | bespoke + hand-rolled focus trap (225 LOC) | ❌ | ❌ | ❌ | size, showClose, persistent, footer | MIGRATE → Radix Dialog/`Sheet`; deletes ~120 LOC of trap/scroll code |
| **ConfirmDialog.tsx** | native `<dialog>` role=alertdialog | ❌ | ❌ | ❌ | title, description, confirm/cancel, isDanger, isLoading | MIGRATE → Radix AlertDialog |
| accordion.tsx | **Radix** | ❌ | ✅ | ✅ | shadcn 4-part | KEEP (reference impl) |
| avatar.tsx | **Radix** | ❌ | ✅ | ✅ | size + Group/Badge/Count | KEEP (reference impl) |
| separator.tsx | **Radix** | ❌ | ✅ | ✅ | orientation | KEEP (reference impl) |
| PartyAvatar.tsx | bespoke (domain) | ❌ | ❌ | ❌ | initials/color | KEEP (domain wrapper) |
| BarcodeScanner / BulkActionBar / Turnstile / PartySearch | bespoke (domain/integration) | — | — | — | — | KEEP |
| *_section / mockup / bento / hero / pricing / testimonial* (~30 files) | landing/marketing | — | — | — | — | KEEP (marketing, not app chrome) |

### `src/components/feedback/`

| Component | Impl | cn/cva | Verdict |
|-----------|------|--------|---------|
| ToastContainer, Spinner, Skeleton, EmptyState, ErrorState, NetworkError, NotFoundPage, OfflineBanner, SyncQueueDrawer, FeedbackWidget, SWUpdatePrompt, ErrorBoundary | all **bespoke** (string className + .css) | ❌ | KEEP visuals; SyncQueueDrawer should consume migrated Drawer; Toast is fine bespoke (could move to Radix Toast FUTURE) |

### `src/components/layout/` — all bespoke (AppShell, Header, BottomNav, SideNav(Rail), PageContainer, ListDetailLayout, ResponsiveTable, PublicShell, PageTransition, SEO)
KEEP — these are platform-shell primitives governed by PLATFORM_SHELL.md; not visual UI primitives.

### `src/components/magicui/` — all use `cn()`, decorative (animated-shiny-text, blur-fade, dot-pattern, marquee, number-ticker, shimmer-button)
KEEP — animation/landing decorations.

### MISSING primitives (no shared component exists — every feature hand-rolls)
**Dropdown/Menu, Popover, Tooltip, Tabs, Select, Switch/Toggle, Checkbox, Radio.**
All Radix sources are already installed. These absences directly cause the raw-HTML
deviations below (53 raw `<select>` files, 22 ad-hoc ActionMenu/dropdown impls).

---

## 2. Consistency / deviation analysis (MOST IMPORTANT)

Sweep across 734 feature `.tsx` files (72 areas). Landing/marketing/public/
storefront/pricing excluded from "must-fix" (legit raw HTML for marketing).

| Deviation | Files | Occurrences | Notes |
|-----------|------:|------------:|-------|
| Raw `<button>` (lowercase) | 398 | 858 | ~375 files are core app (23 are landing). Should be `<Button>` |
| Raw `<input>` | 150 | 306 | Should be `<Input>` (number-with-rupee field-template exception aside) |
| Raw `<select>` | 53 | — | **No Select primitive exists** → every dropdown bespoke + inconsistent |
| Raw `<textarea>` | 32 | — | No Textarea primitive |
| Raw `<dialog>` / ad-hoc modal | 5 | — | `cash-register/VoidConfirmDialog`, `e-invoice/EInvoiceCancelDialog`, `business/ReactivationModal` — **competing modal impls** that bypass Modal/ConfirmDialog |
| `window.confirm` | 2 | — | `commission/CommissionRuleList.tsx`, `recurring/RecurringActionMenu.tsx` — must use `<ConfirmDialog>` |
| Ad-hoc dropdown/ActionMenu impls | 22 | — | No shared Dropdown → duplicated menu logic |
| Icon/onClick `<button>` w/o `aria-label` (same-line heuristic) | — | ~100 | a11y gap; lower bound |

**Adoption (for context):** `<Button>` imported in 67 files vs 398 with raw
`<button>` → **~14% adoption**. `useToast` used in 245 files (healthy).
`ConfirmDialog` in 32 files. Drawer (39) is the dominant modal (Modal only 2) —
so **Drawer is the highest-leverage modal to migrate**.

**Total deviations to address: ~640 files** (858 raw buttons + 306 inputs +
selects/textareas/modals/confirms, de-duped) — the single biggest consistency
debt in the app.

Worst offenders (raw `<button>` files): settings(32), invoices(28), pos(24),
reports(20), products(17), parties(13), collections(13), recurring(12),
payments(12), expenses(11).

---

## 3. Accessibility gaps in hand-rolled primitives

| Component | Gap | Radix would give free |
|-----------|-----|----------------------|
| **Modal** | No focus trap (only ESC handler); relies on native `<dialog>` modal semantics but no Tab containment, no `aria-modal` enforcement, no inert background | Dialog: focus trap, scroll-lock, `aria-modal`, restore-focus, portal |
| **Drawer** | Hand-rolled focus trap (225 LOC, `querySelectorAll` re-scan on every Tab — misses dynamically added nodes, no `inert` on background, `setTimeout(50)` focus race) | Sheet/Dialog: robust trap, `inert`, no timing hacks |
| **ConfirmDialog** | OK-ish (role=alertdialog, focuses confirm) but no Tab trap | AlertDialog: trap + correct default-focus semantics |
| **Button (raw `<button>` usage)** | ~100 icon-only buttons missing `aria-label`; shared Button auto-labels only when child is a string | Shared Button + lint rule closes this |
| **Select (raw `<select>`)** | 53 native selects — inconsistent styling, can't match design tokens, no typeahead control | Radix Select: styled, keyboard nav, token-able |
| **Dropdowns (22 ad-hoc)** | No roving focus, no ESC/outside-click consistency | DropdownMenu: roving tabindex, ESC, collision-aware |

---

## 4. Recommended Radix migration order (highest leverage first)

Pattern for each: keep CSS-var tokens / Poppins / glow; wrap Radix primitive,
expose variants via **cva**, merge classes via **cn()**, support `asChild`
(Slot) where relevant. Visual identity unchanged.

**Phase 0 — unblock (½ day)**
- `npm i class-variance-authority`.
- Add `enforce.js` Check 18: ban raw `<button>`/`<input>`/`<select>`/`<dialog>`/
  `window.confirm`/`alert(` in `src/features/**` (ratcheted baseline like Check 6,
  allowlist landing/*). This stops the bleed while migration proceeds.

**Phase 1 — Button (cva + Slot)** — touches the most files (858), unblocks the
ratchet, lowest risk (visual parity trivial). Codemod `<button className="btn…">` → `<Button>`.

**Phase 2 — Dialog family**: Modal → Radix Dialog, ConfirmDialog → Radix
AlertDialog, then **Drawer → Radix Dialog/Sheet** (deletes ~120 LOC of trap
code; 39 consumers). Biggest a11y win. Fold the 5 ad-hoc `<dialog>` modals +
2 `window.confirm` into these.

**Phase 3 — NEW primitives that don't exist yet** (eliminate ad-hoc impls):
1. **DropdownMenu** (Radix) → replaces 22 ActionMenu impls
2. **Select** (Radix) → replaces 53 raw `<select>`
3. **Tooltip** (Radix) → icon-button labels + help affordances
4. **Tabs** (Radix) → report/settings tab strips
5. **Popover** (Radix) → filter/date pickers
6. **Switch / Checkbox / Radio** (Radix) → settings toggles

**Phase 4 — cva-ify the rest** (no Radix, just standardize): Card, Badge
(reconcile variant contract with PAGE_AUDIT success/error/warning/info/default),
Input (+ Radix Label), Textarea (new).

**KEEP bespoke (do NOT migrate):** layout/platform-shell primitives, magicui
decorations, feedback states (Spinner/Skeleton/EmptyState/ErrorState/Toast —
visuals are fine; Toast → Radix Toast is FUTURE-only), domain wrappers
(PartyAvatar, BarcodeScanner, BulkActionBar, Turnstile, PartySearch),
all landing/marketing `*_section`/mockup files.

---

## 5. Tiered fix list

### MUST_FIX
- `window.confirm` in `commission/CommissionRuleList.tsx` + `recurring/RecurringActionMenu.tsx` → `<ConfirmDialog>`.
- 5 ad-hoc `<dialog>` modals → migrated Dialog/AlertDialog (cash-register/VoidConfirmDialog, e-invoice/EInvoiceCancelDialog, business/ReactivationModal).
- Add enforce.js Check 18 (raw-HTML ban, ratcheted) — without it, debt re-accrues.
- ~100 icon-only raw buttons missing `aria-label` (a11y).

### SHOULD_FIX
- ~375 core-app raw `<button>` → `<Button>` (Phase 1 codemod).
- 150 raw `<input>` → `<Input>`.
- 53 raw `<select>` → new Radix Select.
- 22 ad-hoc dropdowns → new Radix DropdownMenu.
- Migrate Button/Card/Badge/Input to cva+cn; reconcile Badge variant contract.

### FUTURE
- 32 raw `<textarea>` → new Textarea primitive.
- Toast → Radix Toast; Tabs/Tooltip/Popover/Switch primitives for remaining ad-hoc UI.
- Code Connect / Storybook for the standardized primitive set.

---

## 6. One-line summary

Foundation is 80% there (`cn()`, components.json, full Radix suite installed,
3 reference components) but the 7 CORE primitives are bespoke with no cva/Slot,
6 common primitives (Dropdown/Select/Tooltip/Tabs/Popover/Switch) don't exist,
and **nothing mechanically enforces primitive usage** — yielding ~640 deviation
files. Install cva, add an enforce.js ratchet, then migrate Button → Dialog
family → new Radix primitives → cva-ify the rest, all without touching the
visual identity.
