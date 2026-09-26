---
status: pending_approval
task: Global 24px Form Spacing & 4-Tier Visual Rhythm Architecture
createdAt: 2026-09-26T20:27:00+05:30
---

# Design & Implementation Plan: Global 24px Spacing System (Level 6 Architecture)

## 1. Goal & Architectural Overview

Eliminate the vertically dense and crowded feeling across all forms and edit pages in HisaabPro by establishing a **4-Tier Semantic Spacing Scale (SSOT)** centered around a **24px field-to-field vertical gap**.

---

## 2. The 4-Tier Spacing Hierarchy

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Macro Section Gap — 32px (--gap-section)       │
│  (e.g., Space below Line Tabs, between major cards)    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Tier 2: Field-to-Field Gap — 24px (--gap-field) │  │
│  │  (e.g., Name ↔ SKU ↔ Category ↔ Unit ↔ Price)    │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  Tier 3: Sub-Control Gap — 8px             │  │  │
│  │  │  (e.g., SKU Toggle ↔ Manual SKU Input)     │  │  │
│  │  │                                            │  │  │
│  │  │  ┌──────────────────────────────────────┐  │  │  │
│  │  │  │  Tier 4: Label-to-Input Gap — 6px    │  │  │  │
│  │  │  └──────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Scope & Target Files

### Layer 1: Core Design Tokens (SSOT)
* `src/styles/tokens-core.css`
  * Update `--gap-field` from `var(--space-4)` (16px) $\rightarrow$ `var(--space-6)` (24px).
  * Update `--gap-section` from `var(--space-6)` (24px) $\rightarrow$ `var(--space-8)` (32px).
  * Verify `--gap-inline` remains `var(--space-2)` (8px).

### Layer 2: Global UI & Layout Rules
* `src/styles/components-ui.css` & `src/styles/utilities.css`
  * `.input-group`: ensure clean vertical stacking with `gap: var(--space-1-5)` (6px) between label and control.
  * `.form-section`: standardise `gap: var(--gap-field)` (24px).
* `src/components/ui/tabs.css`
  * `.ui-tabs-content`: update `margin-top` from `var(--space-4)` (16px) $\rightarrow$ `var(--gap-field)` (24px).

### Layer 3: Feature Form Containers
* `src/features/products/create-product.css`
  * `.create-product-section`: standardize on `gap: var(--gap-field)` (24px).
* `src/features/parties/create-party.css`
  * `.create-party-section`: standardize on `gap: var(--gap-field)` (24px).
* `src/features/products/components/ProductFormBasic.tsx`
  * Standardize wrapper class to `.create-product-section` (or shared `.create-party-section`).
  * Ensure SKU toggle to manual input retains `gap-2` (8px) for sub-control proximity.

### Layer 4: Data Grids & Compact Density Protection
* Audit and verify that table rows, transaction rows, list views, and dropdown option items **do not inherit** `--gap-field` and retain their compact density tokens (`8px`/`12px`).

---

## 4. Step-by-Step Implementation Strategy

1. **Token Level (SSOT)**: Modify `--gap-field` and `--gap-section` in `tokens-core.css`.
2. **Form Styles**: Update CSS rules for `.create-product-section`, `.create-party-section`, and `.form-section` to cleanly bind to the updated tokens.
3. **Tabs Spacing**: Ensure `.ui-tabs-content` has `24px` breathing room below the tab bar.
4. **Mechanical Verification Gate**:
   * Run `node scripts/enforce.js`
   * Run `npx tsc -b --noEmit`
   * Verify on screens at 375px (mobile) and 1024px+ (desktop).

---

## 5. Acceptance Criteria

- [ ] All form fields have 24px vertical separation.
- [ ] Label-to-input gap remains 6px (preserving cognitive grouping).
- [ ] SKU toggle and manual input have 8px gap (preserving parent-child relation).
- [ ] Line tabs have 24px breathing space before the first field.
- [ ] Compact components (data grids, dropdown items, summary cards) remain dense and unaffected.
- [ ] Zero TypeScript or linter errors.
