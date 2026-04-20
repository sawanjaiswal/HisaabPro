# Paid-Feature Gating & Gold-Standard Hardening | PRD

> Status: **IN PROGRESS** — started 2026-04-21
> Owner: Sawan
> Estimated effort: 5 days (5 batches × 1 day)
> Audit score baseline: 45/100 → target: 90/100

---

## 1. Problem

HisaabPro ships 20+ paid features but only 8 are enforced server-side. FREE-tier users can:
- Read P&L, Balance Sheet, Cash Flow, Aging, Profitability reports
- Access full Accounting module (CoA, journals, trial balance)
- Create recurring invoices
- See `razorpaySubId` of their business (info leak)
- Restore / permanently delete from recycle-bin without `requirePermission()`
- Bypass plan check via offline queue replay
- Spam core CRUD (documents/products/parties) with no user-scoped rate limit

No `<PlanGate>` on the frontend → paid routes load, fire API, show raw 402. No e2e tests prove any of the plan gates actually work → silent regressions.

## 2. Goal

Every paid feature enforced at **every** entry point: backend route · frontend route · UI trigger · deep link · offline sync · direct API. Plan boundaries verified by automated tests.

## 3. Non-goals

- New plan tiers or pricing changes
- Billing UI redesign
- Razorpay migration
- Admin plan override tooling

## 4. Success criteria

- [ ] `PLAN_LIMITS` covers all 20+ paid features (not just 8)
- [ ] `requirePlan()` middleware applied to every paid route (grep proof)
- [ ] `<PlanGate>` HOC wraps every paid frontend route
- [ ] Offline queue revalidates plan before replay
- [ ] Core CRUD has user-scoped rate limits
- [ ] Playwright specs: FREE → 402/upgrade CTA for every paid feature (≥ 10 specs)
- [ ] Audit score: 90+/100

## 5. Scope (5 batches)

### Batch 1 — Backend plan gating (Day 1)
Extend `PLAN_LIMITS`; add `requirePlan()` where missing; strip `razorpaySubId` leak; gate recycle-bin with `requirePermission()`.

### Batch 2 — Frontend `<PlanGate>` (Day 2)
New HOC reads plan from AuthContext, wraps paid routes, renders existing `UpgradePrompt` instead of hitting API.

### Batch 3 — Offline queue plan check (Day 3)
Before each dequeue, revalidate plan (cached `/me` / `/subscription`); block + toast on lockout.

### Batch 4 — Rate limits (Day 4)
`userMutationLimiter` (e.g., 200/hr per user) on documents/products/parties/payments CRUD.

### Batch 5 — Playwright plan specs (Day 5)
One spec per plan boundary. CI gate: any new route without plan test → red.

## 6. Acceptance tests

1. FREE user hits `/reports/profit-loss` → frontend renders `<UpgradePrompt>`, no API call.
2. FREE user curls `GET /api/businesses/:id/reports/profit-loss` → 402 `UPGRADE_REQUIRED`.
3. PRO user downgraded to FREE mid-session: offline queue blocks paid mutations on replay.
4. Salesman curls `GET /api/businesses/:id/subscription` → response excludes `razorpaySubId`.
5. Salesman tries `POST /recycle-bin/:id/restore` → 403 `PERMISSION_DENIED`.
6. 500 sequential `POST /documents` from one user → rate-limited at 201st.

## 7. Risks

- **Existing FREE users lose access to features they previously used** — mitigate by grandfathering: launch gate in "log-only" mode for 7 days before enforcing.
- **Offline queue lockout frustrates users with intermittent connectivity** — mitigate by distinguishing "plan lapsed" from "plan never allowed"; keep draft if the former.
- **Rate limits break legitimate bulk import** — mitigate by making limiter configurable per endpoint + higher ceiling for owner role.

## 8. Rollout

- Feature-flag `PAID_GATING_V2` in `server/src/config/features.ts`. Default `false`, flip after E2E green.
- Sentry breadcrumb on every 402/gate for 2 weeks to spot FPs.
