---
symptom: /settings/units list rows render with low-contrast text, worst in dark mode where the unit name is nearly invisible
root_cause_file: src/features/units/units.css:117-119 (pre-fix)
root_cause_reason: the dark-mode media-query block manually remapped raw --color-gray-N values using a Tailwind-style mental model (higher N = darker), but this codebase's tokens-dark.css inverts the gray scale within dark mode (gray-50 is the darkest background, gray-900 is the lightest/most prominent text) precisely so semantic tokens keep working across themes with zero manual overrides — the manual override picked the wrong end of the scale
---
## 5-whys
1. Why is /settings/units low contrast? — the unit name/symbol/count text and row dividers use color values that don't meet contrast expectations, worst in dark mode.
2. Why does dark mode fail worst? — `.unit-list-item__name { color: var(--color-gray-100) }` in the dark-mode override resolves to #1A2030 (near-black navy) against a #141922 (near-black navy) page background — almost zero contrast.
3. Why is --color-gray-100 dark against a dark background? — src/styles/tokens-dark.css redefines the entire --color-gray-* scale for dark mode: gray-50 is the darkest tone (page bg), gray-900 is the lightest tone (primary text) — the opposite direction of the light-mode scale.
4. Why would a developer write `color-gray-100` expecting a light color? — every other raw-gray usage in the codebase (e.g. Tailwind conventions) treats low numbers as light and high numbers as dark; units.css's manual dark-mode block followed that assumption instead of this project's inverted dark scale.
5. Why didn't this get caught by the semantic-token layer? — units.css used raw `--color-gray-N` for text/border color instead of the semantic `--color-text-primary/secondary/muted` and `--color-border` tokens (per PAGE_AUDIT_CHECKLIST.md §B). Those semantic tokens already flip correctly across themes purely from the --color-gray-* redefinition in tokens-dark.css — no manual dark-mode override needed at all. Bypassing them was the SSOT violation that let the wrong-direction mapping happen.

## Hypothesis
Replace every raw `--color-gray-N` text/border reference in units.css with the semantic tokens (`--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-border`), and delete the manual dark-mode overrides for `.unit-group__title`, `.unit-list-item`, and `.unit-list-item__name` (the `.unit-category-badge` dark override is untouched — its data-category-agnostic pill uses light-bg/dark-text and isn't a semantic-token candidate here). The semantic tokens already resolve correctly per theme via the existing --color-gray-* cascade, eliminating the inverted mapping at its source.

## Addendum
While verifying, found the dark-mode override used the wrong trigger mechanism too: units.css gated its
dark styles behind `@media (prefers-color-scheme: dark)`, but this app's actual theme toggle sets
`[data-theme="dark"]` on `<html>` (see `src/context/ThemeContext.tsx`) — independent of the OS color
scheme. No other feature CSS file in the codebase uses the media-query form; they all either use the
semantic tokens (which flip via the `[data-theme="dark"]` selector in tokens-dark.css) or scope their own
overrides under `[data-theme="dark"]` directly. Converted the remaining `.unit-category-badge` override
to `[data-theme="dark"] .unit-category-badge` to match convention.

## Verification
- FE tsc clean.
- `node scripts/enforce.js` — no new errors/warnings introduced (pre-existing unrelated findings only).
- Re-screenshotted /settings/units via agent-browser: light mode unaffected (already correct); dark mode
  toggled via `document.documentElement.setAttribute('data-theme', 'dark')` (the app's real mechanism,
  not OS media emulation) — unit name/symbol/count text and row dividers now render with clear contrast,
  where the name text was previously near-invisible against the background.
