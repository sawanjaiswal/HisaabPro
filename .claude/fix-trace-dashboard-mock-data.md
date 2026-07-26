---
symptom: The dashboard shows every business the same ₹52,300 / +18% / "Raj Traders payment due" — numbers that belong to no account.
root_cause_file: src/features/dashboard/dashboard-preview.mock.ts:1
root_cause_reason: The redesign's placeholder fixtures were imported by the live hero, tiles, carousel and priorities card, so the shipped render path never asked the server for these numbers at all.
---

## 5-whys

1. **Why does the hero show ₹52,300 on a fresh account?**
   `DashboardSalesHero` read `HERO_MOCK` from `dashboard-preview.mock.ts` instead of props.
2. **But why did a component in the live render path read a mock at all?**
   The Home-2 redesign built hero / metric tiles / overview carousel / priorities
   against fixtures so the visual could be reviewed before the data existed.
3. **But why did the fixtures survive the redesign landing?**
   `/dashboard/home` never gained the fields they stood in for — there was no
   sales-per-day series, no collections or expenses window, no cash in hand.
   Deleting the mock would have left blank cards, so it stayed.
4. **But why was that invisible for a whole release?**
   Nothing distinguishes a fabricated number from a real one on screen, and no
   test compared a rendered amount to the API response — so both the reviewer
   and the suite saw a dashboard that "worked".
5. **But why could the priorities card fall back to invented rows?**
   `DashboardPage` rendered `PRIORITY_ITEMS` whenever the live list was empty,
   treating "nothing to chase" as a rendering hole to fill rather than the
   correct, calm answer.

Root cause: the render path had no server-side source for these numbers, so
placeholder fixtures became the source of truth.

## Hypothesis

Give the numbers a real origin and the mock has nothing left to do. Adding a
`trend` block to `GET /dashboard/home` — 30-day sales / collections / expenses
totals, the prior 30-day window for the deltas, a dense per-day series, cash in
hand, and today vs yesterday — lets the hero, tiles and carousel render from
props, lets `dashboard-preview.mock.ts` be deleted outright, and lets the
priorities card render nothing when there is nothing to chase. Metrics with no
honest basis are omitted, not estimated: there is no profit tile (no COGS is
tracked) and cash in hand carries `deltaPct: null` (a balance has no prior
window), so the UI shows no chip rather than a made-up percentage.

## Failing test

e2e/gold/dashboard.spec.ts — TC-DASH-02 asserts each rendered amount equals the
matching `/dashboard/home` value; TC-DASH-06 asserts the chart series sums to
the total it is drawn from; TC-DASH-01 asserts the invented priority rows appear
zero times. All three fail on the pre-fix build.
src/features/dashboard/__tests__/dashboard-trend.utils.test.ts pins the "no
invented metric" rules at the unit level.

## Did I fix the symptom or the cause?

The cause. The mock file is deleted, so the fallback cannot be reintroduced by
accident, and every number on the screen now traces to a query scoped by
`businessId` against this business's own Document and Payment rows.
