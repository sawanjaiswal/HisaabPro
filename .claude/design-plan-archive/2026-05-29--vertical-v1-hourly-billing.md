---
status: approved
feature: vertical-v1-hourly-billing
created: 2026-05-28T18:30:00Z
approver: Sawan
approved_at: 2026-05-28T18:35:00Z
session: bare-235108
proposer: claude
high_risk_paths_touched:
  - server/prisma/schema.prisma
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/src/schemas/job.schemas.ts
  - server/src/services/job/create.ts
  - server/src/services/job/update.ts
  - server/src/services/job/selects.ts
  - server/src/services/job/convert-to-invoice.ts
  - src/features/jobs/jobs.types.ts
  - src/features/jobs/api/jobs.api.types.ts
  - src/features/jobs/jobs.utils.ts
  - src/features/jobs/components/JobForm.tsx
  - src/features/jobs/components/JobItemsList.tsx
  - src/features/jobs/components/JobItemRow.tsx
  - src/lib/translations.en.ext53.ts
  - src/lib/translations.hi.ext53.ts
  - src/lib/translations.ts
agents_invoked:
  - architecture-auditor (output: docs/EPIC_vertical-v1-hourly-billing/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-28T18:27:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 4 MUST_FIX (GST acceptance claim, phantom job.types.ts, selects keys not enumerated, FE types not threaded) + 3 SHOULD_FIX (JobForm 244L split, BE/FE clamp drift, translations 4 edits)
  - ts: 2026-05-28T18:30:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
acceptance:
  backend:
    - tsc clean (cd server && npx tsc --noEmit)
    - prisma migrate dev applies cleanly; migration is additive-only (nullable cols + enum default)
    - curl 201 create job with an HOURLY line (quantity=hours, ratePaise=rate/hr)
    - curl 401 unauth
    - curl 400 invalid kind / negative hours / hours over cap
    - convert-to-invoice — for a NON-GST tenant the hourly line total equals round(hours*ratePerHour); for a GST tenant the line BASE equals round(hours*ratePerHour) and the existing tax engine layers CGST/SGST/IGST + round-off on top unchanged (no new math path — verify base, not final, equals the hand calc)
  frontend:
    - screenshots: loading · error · empty · success · 320px
    - JobForm hourly-line toggle renders "hours × ₹/hr"; totals match BE
    - console clean
---

# V1 — Hourly Billing on Jobs — Plan

## Scope
Service verticals (plumber/freelancer/salon/clinic) cannot bill by the hour as a
first-class concept today. A JobItem already stores `quantity Decimal(12,3)` +
`ratePaise`, and the line math is `round(quantity * ratePaise) - discountPaise`
— so an hourly line is *arithmetically* already possible (quantity = hours).
What's missing is **semantics + UX + estimate-vs-actual tracking**.

This epic adds:
1. A `kind` discriminator on JobItem (`ITEM` | `HOURLY`, default `ITEM`) so a line
   can be rendered and labelled as "X hours @ ₹Y/hr" instead of a generic qty row.
2. Job-level `estimatedHours` / `actualHours` (Decimal, nullable) for
   quote-vs-actual visibility on the detail page. Purely informational — does NOT
   feed totals (totals stay line-driven, single source of truth).
3. FE form UX: per-line toggle to "Hourly", which relabels the qty input as
   "Hours" and the rate input as "Rate / hour". No new math path.
4. Convert-to-invoice carries hourly lines unchanged (quantity=hours, rate=hr-rate);
   line description is annotated `(Xh @ ₹Y/hr)` so the invoice reads naturally.

**Out of scope (FUTURE):** timers/stopwatch, multi-rate per staff member (that's V4
commission territory), rounding rules (15-min increments), per-party default rates.

## Why the math stays unchanged (key safety property)
`lineTotalPaise = round(hours * ratePerHourPaise) - discountPaise` is identical to
the existing `round(quantity * ratePaise) - discountPaise`. HOURLY is a *labelling*
of the same fields, not a second calculation. This means:
- No money-SSOT risk: still paise Int, still the one `computeItemTotal` helper.
- `estimatedHours`/`actualHours` are tracking-only and never summed into money.

**Boundary caveat (from architecture critique, MUST_FIX #1):** the "unchanged"
property holds for the **Job entity**. At the invoice boundary, `convertJobToInvoice`
→ `createDocument` runs the full tax engine (`create-tax-prep.ts`): for a GST tenant
the line *base* `round(hours*rate)` is preserved but CGST/SGST/IGST + round-off layer
on top — so the final invoice line total legitimately differs from the bare hand
calc. This is correct existing behaviour, not a regression. The acceptance gate is
written to assert the *base*, not the final, equals the hand calc (see acceptance).

**BE/FE clamp parity (MUST/​SHOULD):** FE `jobs.utils.ts:39` clamps the line base
with `Math.max(0, …)`; BE `create.ts:14` does not. Hourly's higher rate × fractional
hours widens the divergence window, so this epic adds the same `Math.max(0, …)` clamp
to BE create.ts + update.ts to keep them byte-identical.

## File Plan
| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/schema.prisma | modify | +12 | schema (enum JobItemKind; JobItem.kind; Job.estimatedHours/actualHours) |
| server/prisma/migrations/<ts>_job_hourly_billing/migration.sql | create (generated) | ~15 | migration (additive: CREATE TYPE, ADD COLUMN ... DEFAULT/NULL) |
| server/src/schemas/job.schemas.ts | modify | +12 | Zod: kind enum on jobItemSchema; estimatedHours/actualHours `.number().min(0).max(100000)` optional. DTO types are the `z.infer` here (no separate types file). |
| server/src/services/job/selects.ts | modify | +6 | add keys `kind` to item select in JOB_DETAIL_SELECT + the convert-to-invoice item select; add `estimatedHours, actualHours` to JOB_DETAIL_SELECT job-level |
| server/src/services/job/create.ts | modify | +8 | persist item.kind (default ITEM), job estimatedHours/actualHours; clamp line base with `Math.max(0, round(qty*rate))` to match FE jobs.utils.ts:39 |
| server/src/services/job/update.ts | modify | +8 | same on edit (kind, hours, clamp) |
| server/src/services/job/convert-to-invoice.ts | ~~modify~~ NO-OP | 0 | **Deviation:** the document `lineItemSchema` has no per-line `description` field — invoice lines derive their name from the product, and the job-item description is already dropped on conversion today. Annotating `(Xh @ ₹Y/hr)` would require editing `document.schemas.ts` + `document/create.ts`, both **outside** approved `files_planned`. The money acceptance (base = `round(hours*ratePerHr)`) holds purely via field reuse — no change needed here. |
| src/features/jobs/jobs.types.ts | modify | +5 | JobItem.kind: 'ITEM'\|'HOURLY'; JobDetail.estimatedHours/actualHours: number\|null |
| src/features/jobs/api/jobs.api.types.ts | modify | +5 | CreateJobItemInput.kind?; CreateJobInput.estimatedHours?/actualHours? |
| src/features/jobs/jobs.utils.ts | modify | +6 | kind-aware label helper (math untouched; existing Math.max(0,…) clamp kept) |
| src/features/jobs/components/JobItemRow.tsx | **create** | ~90 | extract the per-line editor (description/qty/rate/discount) + Hourly toggle that relabels qty→Hours, rate→Rate/hr. MANDATORY split — JobForm is already 244L. |
| src/features/jobs/components/JobForm.tsx | modify | ~0 net | consume `<JobItemRow>` (removes inline row markup ≈ same line count), add job-level estimatedHours/actualHours fields |
| src/features/jobs/components/JobItemsList.tsx | modify | +10 | render "Xh @ ₹Y/hr" for HOURLY rows on detail |
| src/lib/translations.en.ext53.ts | create | ~20 | EN strings |
| src/lib/translations.hi.ext53.ts | create | ~20 | HI strings |
| src/lib/translations.ts | modify | +4 | en import + hi import + en spread + hi spread (line 126) — 4 edits, not 3 |

> `JobItemRow.tsx` is a **hard create**, not conditional: JobForm.tsx is already
> 244L, so the row editor MUST be extracted before adding the toggle, or the file
> blows the 250L cap.

## Migration sequence (additive-only — no backfill, no drop)
```sql
CREATE TYPE "JobItemKind" AS ENUM ('ITEM', 'HOURLY');
ALTER TABLE "JobItem" ADD COLUMN "kind" "JobItemKind" NOT NULL DEFAULT 'ITEM';
ALTER TABLE "Job" ADD COLUMN "estimatedHours" DECIMAL(10,2);
ALTER TABLE "Job" ADD COLUMN "actualHours" DECIMAL(10,2);
```
All existing rows get `kind = 'ITEM'` via the default; hours stay NULL. No
make-NOT-NULL step needed (hours are intentionally nullable). Safe under concurrent
writes — column adds with a constant default are metadata-only on PG ≥ 11.
`npx prisma migrate dev --name job_hourly_billing` (never `db push`).

## API contracts
- `POST /api/jobs` / `PATCH /api/jobs/:id`: `items[].kind?: 'ITEM'|'HOURLY'`
  (default ITEM); top-level `estimatedHours?` / `actualHours?` as `number` with Zod
  `.min(0).max(100000)` (upper bound prevents absurd/overflow input — critique note).
- Response DTO (`JobDetail`): each item gains `kind`; job gains
  `estimatedHours`/`actualHours` (number|null).
- 400 on `kind` not in enum, or negative hours.

## Security cuts
- `businessId` always from `req.user!.businessId`, never body (existing pattern,
  unchanged). No new auth surface — same `/api/jobs` routes, same `auth` middleware.
- No PII added. Hours/rate are business data already scoped by tenant.
- No money path change → no billing-gate trigger.

## Rollout
No feature flag needed — additive, backward-compatible (omitting `kind` = ITEM =
today's behaviour). Ship behind normal Jobs nav (already vertical-gated to service
types). FE degrades: an old client that never sends `kind` keeps working.

## Open questions
1. Should `actualHours` auto-suggest the sum of HOURLY line hours, or stay manual?
   → Proposed: manual (auto-suggest is a nicety, defer). 
2. Do we surface estimate-vs-actual variance % on the detail page? → Proposed: yes,
   read-only chip when both present; trivial, included.
