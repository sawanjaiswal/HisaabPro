---
name: hp-designbook
description: Design compliance checker — scans frontend files against /hp-design system. Catches hex colors, raw HTML, missing UI states, wrong templates. Outputs design audit report.
user_invocable: true
---

# /hp-designbook — Design System Compliance Checker

Scans frontend files against the HisaabPro design system (`/hp-design`). Catches design violations before they reach code audit.

## Usage
```
/hp-designbook                          # scan all src/**/*.tsx files
/hp-designbook party-management         # scan only features/party-management/**
/hp-designbook src/features/invoices    # scan specific path
```

## When It Runs
- **In `/ship` pipeline**: Step 3, after `/f` builds the feature
- **Standalone**: anytime to audit existing pages for design drift
- **After refactors**: when components/tokens change

## Scan Process

### Step 1 — Inventory
```
Glob: src/features/<feature>/**/*.tsx + src/components/**/*.tsx (if no feature specified, scan all)
```
List all .tsx files with line counts. This is the coverage checklist.

### Step 2 — Per-File Design Audit

For EACH .tsx file, check these 16 criteria:

#### CRITICAL (must fix — blocks ship)
| # | Check | Grep/Method | Fix |
|---|-------|-------------|-----|
| C1 | **No hex colors** | `grep -n "#[0-9a-fA-F]\{3,8\}" file.tsx` | Replace with `var(--color-*)` |
| C2 | **No raw HTML elements** | `grep -n "<button\|<input\|<select\|<textarea" file.tsx` (lowercase, not components) | Use `<Button>`, `<Input>` etc. |
| C3 | **4 UI states present** | Check for Skeleton/loading, ErrorState, EmptyState, success render | Add missing states |
| C4 | **No Tailwind color classes** | `grep -n "text-blue\|bg-red\|text-green\|bg-gray-[2-9]\|text-gray-[2-9]" file.tsx` | Use CSS variable via `style={}` |
| C5 | **No hardcoded English** | `grep -n ">[A-Z][a-z]" file.tsx` excluding imports/comments | Use `t.keyName` |

#### HIGH (fix before merge)
| # | Check | Grep/Method | Fix |
|---|-------|-------------|-----|
| H1 | **Correct page template** | Compare structure to Form/List/Detail/Settings/Dashboard templates from `/hp-design` | Restructure to match template |
| H2 | **Border radius tokens** | `grep -n "rounded-lg\|rounded-md\|rounded-sm" file.tsx` (Tailwind defaults, not CSS vars) | Use `rounded-[var(--radius-*)]` |
| H3 | **Font size tokens** | `grep -n "text-xs\|text-sm\|text-base\|text-lg\|text-xl\|text-2xl" file.tsx` | Use `text-[var(--fs-*)]` |
| H4 | **Icons from lucide-react** | Check icon imports are from `lucide-react`, not other packages | Switch to lucide-react |
| H5 | **Touch targets >= 44px** | Check buttons/interactive elements for `min-h-[44px]` or equivalent | Add `min-h-[44px]` |

#### WARNING (track, non-blocking)
| # | Check | Method | Note |
|---|-------|--------|------|
| W1 | **Bottom nav clearance** | Check page has `pb-[calc(var(--bottom-nav-height)+2rem)]` | Add padding |
| W2 | **Shadow tokens** | `grep -n "shadow-" file.tsx` — should use `var(--shadow-*)` | Use design tokens |
| W3 | **Spacing consistency** | Check `px-4` for page padding, `space-y-4` for form gaps | Align to spec |
| W4 | **Number format** | `grep -n "toLocaleString\|toFixed" file.tsx` — should use `formatCurrency` with `en-IN` | Use shared formatter |
| W5 | **Tabular nums on amounts** | Amount displays should have `tabular-nums` class | Add class |
| W6 | **Warm cream background** | Page should use `var(--color-gray-50)` background | Add bg style |

### Step 3 — Component Usage Audit

Cross-reference with `/hp-design` component lookup table:

```
For each file:
  - Count <button> (lowercase) → should be 0 (use <Button>)
  - Count <input> (lowercase) → should be 0 (use <Input>)
  - Count <div> with bg/border styling → should use <Card>
  - Count custom modals → should use <Modal> or <Drawer>
  - Count custom loading states → should use <Skeleton>
```

### Step 4 — Token Coverage Score

Calculate per file:
```
Token coverage = (CSS var references) / (CSS var references + hardcoded values) x 100%
Target: > 95%
```

Where hardcoded values = hex colors + Tailwind color classes + px font sizes + non-token shadows.

## Output

### Coverage Matrix
```
File                              | C1 C2 C3 C4 C5 | H1 H2 H3 H4 H5 | W1 W2 W3 W4 W5 W6 | Score
----------------------------------|-----------------|-----------------|--------------------|---------
features/parties/PartyForm.tsx    | ✓  ✓  ✓  ✓  ✓  | ✓  ✗  ✗  ✓  ✓  | ✓  ✓  ✓  ✓  ✓  ✓  | 88%
features/parties/PartiesPage.tsx  | ✗  ✓  ✗  ✓  ✓  | ✓  ✓  ✓  ✓  ✓  | ✓  ✓  ✓  ✓  ✓  ✓  | 75%
...every file...
```

### Findings Report
```json
[{
  "id": "D-001",
  "file": "src/features/parties/PartiesPage.tsx",
  "line": 45,
  "criterion": "C1",
  "severity": "CRITICAL",
  "title": "Hardcoded hex color",
  "detail": "style={{ color: '#333' }} — should be var(--text-primary)",
  "fixHint": "Replace '#333' with 'var(--text-primary)'"
}]
```

### Summary
```
Design Compliance Report — <feature>
Files scanned: X
Token coverage: X%
CRITICAL: X (must fix)
HIGH: X (fix before merge)
WARNING: X (tracked)
Ship gate: PASS / BLOCKED
```

### Save Report
Write to `docs/AUDIT_REPORTS/DESIGN-<feature>-<date>.md`

## Ship Gate

| Condition | Result |
|-----------|--------|
| Any CRITICAL (C1-C5) | **BLOCKED** — fix before proceeding |
| HIGH > 3 | **REVIEW** — justify or fix |
| WARNING only | **PASS** |

## Auto-Fix (when run from /ship)

For CRITICAL findings, attempt auto-fix:
- C1 (hex colors): Map common hex values to CSS variables using `/hp-design` token table
- C2 (raw HTML): Replace `<button>` with `<Button>`, `<input>` with `<Input>`, etc.
- C4 (Tailwind colors): Map `text-gray-600` → `style={{ color: 'var(--text-secondary)' }}` etc.
- Re-scan file after fix to verify

For HIGH findings: report with fix hints, don't auto-fix (structural changes need human review).

## Rules
- NEVER modify source code when run standalone (read-only audit)
- Auto-fix ONLY when invoked from `/ship` pipeline (Step 3)
- 100% file coverage or audit isn't done
- Report includes coverage matrix showing what was CHECKED, not just what was FOUND
- Reference `/hp-design` SKILL.md for the authoritative token/component/template definitions
