---
symptom: /settings/transaction-controls — the Lock Period dropdown ("Never") overlaps its own label/description text instead of sitting in a normal two-column row
root_cause_file: src/features/settings/components/LockPeriodSection.tsx (pre-fix) / src/components/ui/overlay.css:110
root_cause_reason: <Select> is placed as a bare flex child of .txn-control-row with no width-constraining wrapper; its trigger (.rx-select-trigger) has an explicit width:100%, which resolves the flex item's flex-basis to the full row width (a "transferred size" per the flex-basis:auto + definite-width spec rule), leaving almost none of the row's width for the sibling label column
---
## 5-whys
1. Why does the dropdown overlap the label? — the label/description flex sibling (.txn-control-content) renders in a column only a few px wide, so its wrapped text visually collides with the dropdown next to it.
2. Why is .txn-control-content squeezed to near-zero width? — it has `flex: 1` (flex-basis: 0%, grow: 1) but there's no extra space left in the row to grow into — its sibling, the Select trigger, is already claiming almost the entire row width.
3. Why does the Select trigger claim the entire row? — `.rx-select-trigger` (src/components/ui/overlay.css:110) sets `width: 100%`, and the Select component (Radix Select.Root renders no wrapping DOM node) puts that trigger directly as the flex item — no intermediate div constrains its size.
4. Why does width:100% on a flex item consume the whole row? — per the flexbox spec, when a flex item has flex-basis:auto (the default, since the trigger doesn't set `flex`) and a definite `width`, that width is used as the item's flex-basis ("transferred size"). A width:100% definite value transfers to a flex-basis of ~100% of the container — starving the other flex-grow:1 sibling of space.
5. Why wasn't this caught earlier? — every other `<Select>` usage in the codebase is inside a full-width form field (its own container, not a shared row with label text), where width:100% is exactly the desired behavior. LockPeriodSection.tsx is the one place a `<Select>` is dropped into a label+control row pattern (matching ApprovalTogglesSection's toggle rows and ThresholdSection's fixed-width `.txn-threshold-input`), and it's the only one missing the flex-shrink:0 / fixed-width wrapper those sibling sections already use.

## Hypothesis
Wrap the `<Select>` in `LockPeriodSection.tsx` with a `.txn-control-select` div (`flex-shrink: 0; width: auto; min-width: 112px`) — mirroring the pattern `.txn-threshold-input` already uses in the same file for the same row layout — so the label column keeps its `flex: 1` share of the row.

## Verification
- FE tsc clean.
- Re-screenshotted /settings/transaction-controls (375px, unauthenticated dev-login session) before/after:
  before — "Never" dropdown squeezed the label into a ~30px column, text wrapping one word per line and visually overlapping the dropdown; after — dropdown sits in its own fixed column beside the label, matching the Approvals/Thresholds rows below it.
