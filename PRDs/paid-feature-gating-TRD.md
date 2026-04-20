# Paid-Feature Gating — Technical Design

> Companion to `paid-feature-gating-PRD.md`
> Last updated: 2026-04-21

---

## 1. Current state

- `server/src/config/plans.ts` — `PlanLimits` has 8 flags. Needs ~14 total.
- `server/src/middleware/subscription-gate.ts` — `requirePlan(minPlan)` + `requireQuota()` already implemented. Reuse.
- `server/src/middleware/permission.ts` — `requirePermission(perm)` + `requireOwner()` already implemented. Reuse.
- Frontend: `UpgradePrompt` component exists (unused on paid routes). No `<PlanGate>`.
- Offline queue at `src/lib/offline.ts` (TBC) — replays mutations without plan recheck.

## 2. Schema changes

### 2.1 `PlanLimits` interface (plans.ts)

```ts
export interface PlanLimits {
  // Existing
  maxUsers: number
  maxInvoicesPerMonth: number
  gstFeatures: boolean
  customRoles: boolean
  multiGodown: boolean
  posMode: boolean
  tallyExport: boolean
  eInvoicing: boolean
  prioritySupport: boolean
  // NEW
  advancedReports: boolean     // P&L, BS, CF, Aging, Profitability, Discounts
  accounting: boolean          // CoA, Journal, Trial Balance, Bank, Loans, Cheques
  recurringInvoices: boolean
  batchTracking: boolean
  serialTracking: boolean
  taxReports: boolean          // GST returns, TDS/TCS reconciliation
}
```

Tier distribution:
- **FREE** — all `false` except invoice/user quotas
- **PRO** — advancedReports, accounting, recurringInvoices, taxReports, customRoles, gstFeatures
- **BUSINESS** — all of PRO + multiGodown, posMode, tallyExport, eInvoicing, batchTracking, serialTracking

### 2.2 New permission strings (settings.service.ts role templates)
- `billing.view` — gate `GET /subscription`, `GET /razorpay/*`
- `recycle_bin.restore`, `recycle_bin.delete` — already standard pattern

## 3. Backend changes

### 3.1 New middleware `requireFeature(flag)`

```ts
// server/src/middleware/subscription-gate.ts
export function requireFeature(flag: keyof PlanLimits) {
  return async (req, res, next) => {
    if (!req.user?.businessId) return next()
    const { plan } = await getBusinessPlan(req.user.businessId)
    if (PLAN_LIMITS[plan][flag]) return next()
    sendError(res, `Feature '${flag}' requires upgrade.`, 'UPGRADE_REQUIRED', 402)
  }
}
```

Flag-based is stricter than tier-based — a tier with the flag unlocked passes; others 402.

### 3.2 Route changes

| Route file | Add |
|---|---|
| `financial-reports.ts` | `requireFeature('advancedReports')` on all GETs |
| `accounting.ts` (if present; check) | `requireFeature('accounting')` |
| `recurring.ts` | `requireFeature('recurringInvoices')` on POST + list |
| `tax-reports.ts`, `tds-tcs.ts`, `gst-returns.ts` | `requireFeature('taxReports')` (keep existing gstFeatures where correct) |
| `subscription.ts` | Strip `razorpaySubId` from response body |
| `razorpay.ts` GETs | `requirePermission('billing.view')` |
| `recycle-bin.ts` | `requirePermission('recycle_bin.restore'|'recycle_bin.delete')` on mutations |

### 3.3 Rate-limiter

```ts
// server/src/middleware/rate-limit.ts
export const userMutationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,          // 1h
  max: 300,                            // 300 mutations / user / hour
  keyGenerator: (req) => req.user?.id ?? req.ip,
  standardHeaders: true,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
})
```

Apply to `documents.ts`, `products.ts`, `parties.ts`, `payments.ts` mutation groups.

## 4. Frontend changes

### 4.1 `<PlanGate>` HOC

```tsx
// src/features/subscription/PlanGate.tsx
interface Props { feature: keyof PlanLimits; children: ReactNode }
export function PlanGate({ feature, children }: Props) {
  const { plan, isLoading } = usePlan()        // new hook, reads from /subscription
  if (isLoading) return <PlanGateSkeleton />
  if (PLAN_LIMITS[plan][feature]) return <>{children}</>
  return <UpgradePrompt feature={feature} />   // existing component
}
```

### 4.2 `usePlan()` hook
- Reads `cachedSubscription` from sessionStorage first
- Fetches `/api/businesses/:id/subscription` on mount if stale (>5min)
- Invalidates on `switchBusiness`

### 4.3 Route wrapping
In `App.tsx`, wrap routes:
```tsx
<Route path={ROUTES.REPORTS_PROFIT_LOSS} element={
  <PlanGate feature="advancedReports"><ProfitLossPage/></PlanGate>
} />
```

Paid routes to wrap (≥ 15): profit-loss, balance-sheet, cash-flow, aging, profitability, discounts, all accounting screens, recurring, tax returns, TDS, e-invoice, e-way-bill, tally-export, POS, godowns.

## 5. Offline queue changes

`src/lib/offline.ts`:
- Before `processPendingMutations()`, call `await refreshPlan()`.
- For each queued mutation, check `isFeatureAllowed(mutation.type, plan)`.
- If blocked, keep in queue + toast "Downgraded — upgrade to resume sync for X actions".

Mapping mutation → feature flag lives in a small table, not scattered.

## 6. Testing

### 6.1 Unit
- `PLAN_LIMITS` snapshot test — any accidental flag flip fails CI.
- `requireFeature` middleware: covers allow/deny/no-user.

### 6.2 Playwright (e2e/paid-gating.spec.ts)
For each paid feature, two specs:
1. FREE user → `<UpgradePrompt>` renders, no API call fires
2. FREE user curls route → 402 + `UPGRADE_REQUIRED`

### 6.3 Offline
- Seed queued mutation → downgrade plan → replay → assert mutation stays queued + user sees toast.

## 7. Rollout

1. Merge middleware + flags (server) behind `PAID_GATING_V2=false` → ship dark.
2. Flip on in staging, let internal team shake for 48h.
3. Enable in prod in "log-only" mode 7 days (Sentry breadcrumb instead of 402).
4. Flip to enforcing.
5. Monitor Sentry "UPGRADE_REQUIRED" rate for 7 days post-enable; hotfix FPs.

## 8. Open questions

- Should `taxReports` be PRO or BUSINESS? (Indian MSMEs — PRO is defensible)
- Grandfather FREE users who had paid features before? (Recommend: no; soft-rollout covers it)
- Billing info permission — new `billing.view` or reuse `requireOwner()`? (Recommend new, so Accountant role can also see billing)
