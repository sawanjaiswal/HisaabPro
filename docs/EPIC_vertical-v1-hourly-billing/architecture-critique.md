verdict: PASS

# Architecture Critique — V1 Hourly Billing (revision 2)

audit_of: .claude/design-plan-active--vertical-v1-hourly-billing--bare-235108.md
auditor: architecture-auditor
audited_at: 2026-05-29T00:00:00Z
revision: 2
must_fix_open: 0
should_fix_open: 0

All 4 MUST_FIX and 3 SHOULD_FIX from revision 1 are resolved and verified
against the live codebase. No new MUST_SHIP gaps found. Epic is unblocked.

## MUST_FIX — all resolved

| # | Finding | Resolution | Verified against |
|---|---------|------------|------------------|
| 1 | convert-to-invoice acceptance ignored GST tax layering | "Boundary caveat" §74-87 + acceptance line 44 now assert line **base** = round(hours·rate), not final; states tax engine layers CGST/SGST/IGST + round-off on top as correct existing behaviour | convert-to-invoice.ts:67 confirms it calls `createDocument` (full tax engine), so base-only assertion is the right gate |
| 2 | Phantom file server/src/services/job/job.types.ts | Removed from files_planned; file-plan note (line 99) explicitly routes DTO types to `z.infer` in job.schemas.ts | `ls` confirms no job.types.ts in service dir; job.schemas.ts exists |
| 3 | selects.ts new columns not enumerated | File-plan line 100 names exact keys: `kind` into JOB_DETAIL_SELECT item-select + convert-to-invoice item-select; `estimatedHours, actualHours` at job level | selects.ts confirms current item-select (id/sortOrder/productId/description/quantity/ratePaise/discountPaise/totalPaise) lacks all three — additions are correct |
| 4 | FE jobs.types.ts JobItem/JobDetail not threaded | File-plan lines 104-105 thread `JobItem.kind: 'ITEM'\|'HOURLY'`, `JobDetail.estimatedHours/actualHours: number\|null`, plus api.types.ts CreateJobItemInput.kind?/CreateJobInput hours | jobs.types.ts + jobs.api.types.ts both exist and are listed in files_planned |

## SHOULD_FIX — all resolved

| # | Finding | Resolution | Verified |
|---|---------|------------|----------|
| A | JobForm.tsx 244L → JobItemRow must be a hard create | File-plan line 107 marks JobItemRow.tsx **create** (~90L), with blockquote (114-116) calling it a hard, non-conditional extraction before adding the toggle | wc -l confirms JobForm.tsx = 244L; JobItemRow.tsx does not yet exist (planned create) |
| B | BE create.ts:14 missing Math.max(0,…) clamp present in FE jobs.utils.ts:39 | "clamp parity" note §89-92 + file-plan lines 101-102 add `Math.max(0, round(qty*rate))` to create.ts + update.ts | create.ts:14 confirms `Math.round(qty*ratePaise) - discountPaise` with NO clamp; jobs.utils.ts:39 confirms `Math.max(0, subtotal - discount)` — drift is real, fix is correctly scoped |
| C | Translations wiring is 4 edits not 3 | File-plan line 112 states "en import + hi import + en spread + hi spread (line 126) — 4 edits, not 3" | translations.ts confirms each ext needs an import + a spread on BOTH the en (line 126) and hi (line 127) objects = 4 edits |

## Additional verification (no new gaps)

- **ext numbering:** plan uses `ext53`; highest existing is `ext52` and the
  spread runs to ext52. ext53 is the correct next slot — no collision.
- **API contract upper bound:** hours now `.number().min(0).max(100000)`
  (lines 99, 132-133) — guards overflow/absurd input. Acceptance line 43
  exercises "hours over cap" → 400. Resolved.
- **Migration additive-only:** CREATE TYPE + ADD COLUMN with constant default
  (metadata-only on PG ≥ 11) + nullable hours, no backfill/NOT-NULL step.
  Ordering correct.

## What the architecture got right (preserve)

- Money-SSOT preserved: HOURLY is a labelling of existing quantity/ratePaise,
  no second calc path. Tracking hours never sum into totals.
- Backward-compatible rollout (omitted kind = ITEM = today) — no flag needed,
  old clients keep working.
- Tenant scoping unchanged (`req.user!.businessId`, never body).

## Still open

None blocking. The two Open Questions (lines 149-153) — auto-suggest
actualHours and variance chip — are correctly deferred/scoped as niceties and
do not gate the epic.
