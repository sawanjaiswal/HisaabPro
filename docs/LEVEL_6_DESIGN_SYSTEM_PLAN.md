# Level 6 Design System Plan: Axiomatic Typography & Color Enforcement

## Executive Summary
This document defines the architectural specification and implementation roadmap for a **Level 6 Mechanical System (Axiomatic Elimination)** across HisaabPro. 

The objective is total elimination of arbitrary sizes, random font properties, hardcoded hex/RGB colors, and un-tokenized inline styles. Compliance is enforced mechanically at compile-time, lint-time, and pre-commit—making non-compliant styling physically impossible to commit or build.

---

## 1. System Architecture: The 4-Tier Mechanical Wall

```
┌──────────────────────────────────────────────────────────────────┐
│                   Level 6 Rejection Pipeline                     │
├───────────────────┬──────────────────────────────────────────────┤
│ Tier 1: Compiler  │ TypeScript strict literal union types        │
│                   │ (No `string` or `number` fallbacks)          │
├───────────────────┼──────────────────────────────────────────────┤
│ Tier 2: CSS / JIT │ Banned arbitrary utility syntax              │
│                   │ (Rejects `text-[...]`, `bg-[...]`, etc.)     │
├───────────────────┼──────────────────────────────────────────────┤
│ Tier 3: AST Lint  │ Custom AST linter rules                      │
│                   │ (Flags raw hex, raw <p>/<span>, inline style)│
├───────────────────┼──────────────────────────────────────────────┤
│ Tier 4: CI / Hook │ `scripts/enforce.js` pre-commit gate         │
│                   │ (Hard commit abort on any raw color/size)    │
└───────────────────┴──────────────────────────────────────────────┘
```

---

## 2. Core Specifications

### 2.1 SSOT Color Hierarchy (Single Source of Truth)
Raw hex values (`#026F39`, `#...`) exist **exclusively in the root token definition file**. Components and utilities reference only semantic token keys:

- **Surface Tokens:**
  - `surface-canvas` (Page background)
  - `surface-card` (Default elevated container)
  - `surface-subtle` (Muted / secondary container)
  - `surface-overlay` (Modals, sheets, tooltips)
  - `surface-brand` (Hero / emerald accent containers)
- **Text Tokens:**
  - `text-primary` (High contrast, headers, body)
  - `text-secondary` (Secondary labels, metadata)
  - `text-muted` (Placeholder, disabled, subtle captions)
  - `text-inverse` (Contrasting text on dark surfaces)
  - `text-brand` (Primary brand accent text)
- **Interactive & Brand Tokens:**
  - `brand-primary`, `brand-hover`, `brand-active`, `brand-focus`, `brand-surface`
- **Feedback & Status Tokens:**
  - `status-success`, `status-warning`, `status-danger`, `status-info` (each with `fg`, `bg`, and `border` variants)
- **Border & Divider Tokens:**
  - `border-subtle`, `border-strong`, `border-interactive`

---

### 2.2 Immutable Compound Typography Matrix
Decoupled font properties (`font-size` without locked `line-height`) are banned. Typography is consumed only via atomic presets:

| Preset Name | Size | Line Height | Weight Options | Letter Spacing | Use Case |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `display-lg` | 32px | 40px | Bold (700) | -0.02em | Hero headers, primary page titles |
| `display-sm` | 24px | 32px | Semibold (600) | -0.01em | Section display titles |
| `heading-lg` | 20px | 28px | Semibold (600) | -0.01em | Modal headers, card titles |
| `heading-md` | 18px | 26px | Semibold (600) | 0 | Group headings, list section titles |
| `body-lg`    | 16px | 24px | Regular (400) / Medium (500) | 0 | Primary readable body text |
| `body-md`    | 14px | 20px | Regular (400) / Medium (500) | 0 | Default UI text, table rows, inputs |
| `body-sm`    | 12px | 16px | Regular (400) / Medium (500) | 0 | Secondary metadata, badges, hints |
| `caption`    | 11px | 14px | Medium (500) | +0.03em | Micro-labels, timestamps, pill tags |

---

### 2.3 Component Primitives Layer
Direct, un-tokenized HTML elements (`<p>`, `<span>`, `<h1>`–`<h6>`) are forbidden outside the design primitive layer.

1. **`<Text>` & `<Heading>` Primitives:**
   - Props strictly typed to token keys:
     - `variant`: `"display-lg" | "display-sm" | "heading-lg" | "heading-md" | "body-lg" | "body-md" | "body-sm" | "caption"`
     - `color`: `"primary" | "secondary" | "muted" | "brand" | "inverse" | "success" | "danger" | "warning"`
     - `weight`: `"normal" | "medium" | "semibold" | "bold"`
     - `as`: Polymorphic HTML tag tag (`"p" | "span" | "div" | "label" | "h1" ...`)
2. **`<Surface>` & `<Card>` Primitives:**
   - Standardizes padding, elevation, radius, and border styling into predefined variants.

---

## 3. Implementation Roadmap

### Phase 0: Baseline Audit & Violation Inventory
- [ ] Run AST/regex scan across `src/` to catalog:
  - Total raw hex / color literals (`#...`, `rgba(...)`).
  - Total arbitrary Tailwind utilities (`text-[...]`, `bg-[...]`, etc.).
  - Total raw text tags (`<p>`, `<span>`, `<h1>`–`<h6>`) without design tokens.
- [ ] Output a baseline metrics report (`.audit-baseline.json`).

### Phase 1: SSOT Registry & Strict Theme Configuration
- [ ] Centralize all design tokens into `src/styles/tokens.ts` (or Tailwind theme config).
- [ ] Configure Tailwind / CSS engine to lock allowed font sizes, line heights, and colors to the SSOT matrix.
- [ ] Export strongly-typed TypeScript definitions for all token names.

### Phase 2: Design Primitive Layer
- [ ] Build `<Text>`, `<Heading>`, `<Surface>`, and `<Badge>` primitives.
- [ ] Create `useThemeTokens()` helper for chart/canvas rendering (ensuring zero raw hex in charts).

### Phase 3: Automated Codemod Migration
- [ ] Write AST migration script (`scripts/codemod-typography-colors.mjs`).
- [ ] Run codemod across `src/` to:
  - Convert arbitrary font sizes (`13px` → `body-md`, `15px` → `body-lg`).
  - Replace raw colors with corresponding semantic token classes.
  - Transform raw text tags to `<Text>` / `<Heading>`.
- [ ] Run visual diff regression suite across critical routes to verify UI integrity.

### Phase 4: Mechanical Wall & Hard Rejection Engine
- [ ] Add AST ESLint rules to fail on:
  - Inline style with raw numeric sizes or color literals.
  - Usage of prohibited raw HTML text elements in feature files.
- [ ] Add check in `scripts/enforce.js`:
  - Scan staged git diff for `#([0-9a-fA-F]{3,8})` and arbitrary utility syntax (`-[.*]`).
  - Abort commit with error details if any violation is found.
- [ ] Verify `npm run qa:full` fails if an un-tokenized size or color is introduced.

---

## 4. Maintenance & Zero-Drift Policy

1. **No Inline Escape Hatches:**
   - If a new size or color is needed, it cannot be written ad-hoc. It must be added to the SSOT registry via PR review.
2. **Zero-Tolerance Pre-Commit:**
   - `enforce.js` blocks any commit that contains raw hex or arbitrary styling.
3. **Automated CI Ship-Gate:**
   - CI build fails immediately if `scripts/enforce.js` detects design token violations.
