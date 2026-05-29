# Design & Execution Quality Audit — Master Summary

> Run 2026-05-29 by 4 parallel auditors against actual code. Goal: make HisaabPro
> feel "super professionally designed and executed," with **everything super
> standard and consistent across all 72 feature areas**. Visual identity
> (Poppins, glow, dark-mode, CSS-var tokens) is intentional and STAYS — this is
> about execution consistency + a motion/interaction layer, not a re-skin.
>
> Per-dimension detail: `DESIGN_AUDIT_components.md`, `DESIGN_AUDIT_motion.md`,
> `DESIGN_AUDIT_interaction.md`, `DESIGN_AUDIT_visual.md`.

## The one-line diagnosis

**The foundation exists; consistency and enforcement do not.** Every dimension
independently found the same root cause: the right pieces are present (design
tokens, Framer Motion v12, Radix on disk, a `cn()` helper, a haptic primitive,
shared 4-state components) but they are applied to ~15-25% of surfaces and
**nothing mechanically enforces their use**, so each new page reinvents or skips
them. That unevenness — not any single ugly screen — is what reads as "not
top-notch."

## Convergent findings (all 4 audits agree)

1. **Build-once-reuse-everywhere is the lever.** Three primitive sets, built once,
   make every screen inherit polish: **component primitives** (Radix+cva),
   **motion primitives** (6), **interaction primitives** (haptics/optimistic/long-press/animated-number).
2. **The overlay family is the highest-leverage convergence.** Components wants
   Modal→Dialog + Drawer→Sheet (a11y/focus-trap); motion wants the 3 competing
   overlay mechanisms unified + spring-animated; interaction wants the Drawer to
   actually drag. → ONE unified Radix `<Sheet>`/`<Dialog>` (focus-trapped +
   spring + draggable + haptic) closes all three.
3. **Enforcement is the durability mechanism.** `enforce.js` has 17 checks but
   **none ban raw HTML primitives and none token-check `.tsx`** — that's why ~640
   files of deviation accrued. Ratcheted grep gates make standardization
   permanent.

## Dimension scorecards

### Components (`DESIGN_AUDIT_components.md`)
- Foundation ~80% ready: `cn()` exists, `components.json` set, `radix-ui@1.4.3`
  umbrella **already bundles the full primitive suite — zero new installs**.
  Only gap: **cva not installed** (1 `npm i`).
- 7 core primitives bespoke (no cva/Slot); 6 missing (Dropdown, Select, Tooltip,
  Tabs, Popover, Switch).
- **~640 deviation files:** 858 raw `<button>` (~375 in core app), 306 `<input>`,
  53 `<select>`, 32 `<textarea>`, 5 ad-hoc `<dialog>`, 22 ad-hoc dropdowns, 2
  `window.confirm`. `<Button>` adoption only ~14%.
- a11y: Modal has no focus trap; Drawer hand-rolls a 225-LOC trap with a
  setTimeout race; ~100 icon-only buttons lack `aria-label`.

### Motion (`DESIGN_AUDIT_motion.md`)
- **No motion layer.** Framer v12 used in 15 files — **all marketing/landing;
  ZERO feature `.tsx`.**
- Page/route transitions **0%** (hard cuts), list stagger **0%**, micro-interactions
  **~4%**, skeleton→content morph **0%**, animated numbers **0%**.
- **Spring physics: 0 occurrences repo-wide** — all motion is duration+bezier.
- Debt: 96 ad-hoc `@keyframes` (many dup), 196 hardcoded ms, 41 `transition-all`,
  49 hardcoded `duration-NNN`. reduced-motion in 52 css files but inconsistent.

### Interaction (`DESIGN_AUDIT_interaction.md`)
- Haptics: no SSOT, ~8 sites / 2 incompatible APIs (5 raw `navigator.vibrate` =
  no-op on iOS). Tabs/toggles/presses/save/error fire nothing.
- Gestures ~none: Drawer drag-handle is cosmetic (pure CSS slide); no swipe-rows.
- Optimistic feedback inconsistent: good `onLine ? saved : queued` idiom in ~43
  files but ~80% of 203 toast sites show plain "Saved" (violates OFFLINE Rule 5).
  No animated numbers — totals/balances snap.
- EmptyState gap: Skeleton 145 / ErrorState 126 / **EmptyState 70** → ~56 pages
  missing the empty state.

### Visual (`DESIGN_AUDIT_visual.md`)
- **More consistent than raw grep implies** — big counts are marketing/PDF/template
  files (enforce.js `MARKETING_UI`-exempt). Real in-app feature UI: **0** palette
  classes, **0** non-lucide icons, **0** ad-hoc empty states.
- Real violations: **12 naked-hex in 4 files** (eway/einvoice dialogs — genuine
  dark-mode parity bugs), 2 `dark:` files, 1 `window.confirm`, 1 `z-[]`.
- Biggest gap = **no `.tsx` token enforcement** in enforce.js → color/scale/spacing
  violations slip the gate.
- 4 UI states partial: ~12 data-list areas lack EmptyState/ErrorState.

## Proposed epic — "Premium Standardization" (phased)

| Phase | Scope | Why first |
|-------|-------|-----------|
| **P0 — Foundation + enforcement** | Install `cva`; build cva/`cn()` base; add ratcheted enforce.js gates (ban raw `<button>/<input>/<select>` + `window.confirm`/`alert` in feature code; token-check `.tsx`; motion-token check). Grandfather existing debt, block NEW. | Stops the bleed before we fix; makes every later phase permanent. |
| **P1 — Core primitives (Radix+cva)** | Button (codemod 858 sites) → **unified Dialog family** (Modal→Dialog, ConfirmDialog→AlertDialog, Drawer→draggable spring **Sheet**) → new Radix primitives (Dropdown/Select/Tooltip/Tabs/Popover/Switch) → cva-ify Card/Badge/Input. | The overlay convergence + a11y wins; substrate for motion/haptics. |
| **P2 — Motion layer** | 6 primitives in `src/components/motion/`: PageTransition (wired into `App.tsx`), AnimatedList, AnimatedNumber, Press, skeleton cross-fade, (Sheet motion from P1). All **spring**, token-driven, reduced-motion baked in. | 60% of "premium feel"; inherited by P1 primitives. |
| **P3 — Interaction layer** | `useHaptics()` SSOT wired into Button/Toggle/Tab/Sheet; `optimisticToast()` across 203 sites; `useLongPress()` consolidation; AnimatedNumber on dashboard/balances. | Native-feel; consistent offline feedback. |
| **P4 — Consistency sweep (72 surfaces)** | Adopt primitives everywhere; fill ~56 EmptyStates + ~12 ErrorStates; fix 12 naked-hex dark bugs; remove `window.confirm`/`z-[]`/`dark:`. | Mechanical once P0-P3 exist; enforce.js keeps it green. |
| **P5 — Flagship + A/B/C** | Apply all layers to one flagship flow (invoice creation / dashboard) as the visible bar; then build A (GSTIN autofill), B (onboarding sample data), C (bill-scan→purchase loop) on the standardized foundation. | A/B/C inherit polish instead of needing rework. |

Identity untouched throughout — Radix primitives are unstyled and re-skinned with
existing CSS variables, so nothing renders as "default shadcn."
