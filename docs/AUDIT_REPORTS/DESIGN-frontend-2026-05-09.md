# DESIGN-FRONTEND AUDIT — 2026-05-09

**Scope:** all `src/features/**/*.tsx` + `src/components/**/*.tsx` (608 files)
**Reference:** `.claude/skills/hp-design/SKILL.md`
**Verdict:** BLOCKED — professionalism issues despite clean mechanical compliance

---

## Mechanical compliance (CLEAN)

| Check | Result |
|-------|--------|
| Raw `<button>` / `<input>` / `<select>` / `<textarea>` | 0 |
| Tailwind color classes (`text-red-500`, etc.) | 0 |
| Hardcoded z-indexes | 0 |
| `window.confirm` / `alert()` | 0 |
| `console.log` in `src/features` | 0 |
| Raw `fetch()` outside allowed files | 0 |

Design system components widely used (538+ PageContainer instances, 674
references to `EmptyState` / `ErrorState` / `Skeleton`).

---

## Top 5 systemic issues

### 1. Hardcoded hex colors in feature CSS — CRITICAL
362 hex literals across 13 feature CSS files bypass `var(--color-*)` tokens.

| File | Hex count |
|------|-----------|
| `src/features/pos/pos-billing.css` | 162 |
| `src/features/landing/landing.css` | 105 |
| `src/features/expenses/expenses-upgrade.css` | 27 |
| (+10 more files) | ~68 |

Impact: dark mode broken, brand drift, no A/B token swap.

### 2. CSS fragmentation — ARCHITECTURE
123 separate CSS files scattered through `src/features/**`. Hard to enforce
tokens. Increases bundle. No single design entrypoint.

### 3. Inconsistent section spacing — HIGH
Pages use `space-y-3` / `-4` / `-2` instead of the standard `space-y-6`
(24px). Visual rhythm breaks; pages feel cramped.

Sample violations:
- `src/features/products/StockAlertsPage.tsx` — `space-y-4`
- `src/features/expenses/pages/PendingExpensesPage.tsx` — `space-y-3`
- `src/features/settings/DocumentSettingsPage.tsx` — `space-y-4`

### 4. Missing 4 UI states — HIGH
~24% of sampled pages have **0** Skeleton / ErrorState / EmptyState refs.

Worst:
- `src/features/pos/PosPage.tsx` — no error fallback
- `src/features/bulk-import/BulkImportPage.tsx`
- `src/features/gst-returns/Gstr1Page.tsx`
- `src/features/smart-greetings/SmartGreetingsPage.tsx`
- `src/features/templates/TemplateEditorPage.tsx`

### 5. Inline-style token/raw mixing — MEDIUM
`style={{ marginTop: 'var(--space-3)', height: 120 }}` — tokens mixed with
raw px in same object.

Files: `RecurringDetailPage.tsx`, `StockAlertsPage.tsx`,
`InvoiceDetailPage.tsx`.

---

## Worst 5 offending files

| File | Lines | Primary issue | Priority |
|------|-------|---------------|----------|
| `src/features/pos/pos-billing.css` | 1266 | 162 hex colors | CRITICAL |
| `src/features/landing/landing.css` | 431 | 105 hex colors | HIGH (marketing — isolate) |
| `src/features/expenses/expenses-upgrade.css` | 690 | 27 hex colors + size | HIGH |
| `src/features/products/StockAlertsPage.tsx` | 246 | spacing + UI states | HIGH |
| `src/features/pos/PosPage.tsx` | 76 | no error UI | HIGH |

---

## Fixes applied this session (2026-05-09 11:30)

| # | File / Pattern | Action | Result |
|---|----------------|--------|--------|
| 1 | `pos-billing.css` | 162 Tailwind hex → HP tokens (gray, primary teal, error, success, info, whatsapp) | 0 hex |
| 2 | `expenses-upgrade.css` | 27 hex → tokens (teal → primary, amber → warning) | 0 hex |
| 3 | `landing.css` | False positive — all hex are inside `--lp-*` token definitions (proper SSOT) | no fix |
| 4 | `StockAlertsPage.tsx` | `space-y-4` → `space-y-6` on PageContainer + token renames | clean |
| 5 | `PosPage.tsx` | Errors already use `toast.error` (audit false negative) | no fix |
| 6 | **Project-wide:** broken `var(--text-X)` font tokens (109 refs in 12 files) | Renamed → `var(--fs-X)` | 0 broken |
| 7 | **Project-wide:** broken `var(--color-danger)` (16 refs) | Renamed → `var(--color-error-500)` | 0 broken |

`tsc --noEmit` clean after all changes.

## Audit accuracy notes

The Explore-agent grep had false negatives:
- Claimed 0 raw `<button>` — actual count: **387** in features (e.g. `PosPage.tsx:46`, `StockAlertsPage.tsx:179, 228`). These should migrate to `<Button>` / `<IconButton>`.
- Claimed `landing.css` had 105 violations — actual: 0 (SSOT pattern).
- Missed broken token references entirely (`--text-*`, `--color-danger`).

## Remaining work (next session)

1. **387 raw `<button>` migration** — biggest visible polish issue. Batch by feature.
2. **Section spacing enforcement** — `space-y-6` on section-group parents. Add to `enforce.js` patterns.
3. **CSS consolidation** — 123 fragmented files. Move to feature-scoped CSS modules.
4. **Other CSS files with hex** — 10 more files still have hardcoded colors (smaller counts).
5. **Missing UI states sweep** — re-run with proper grep that detects toast-based error UI as valid.
