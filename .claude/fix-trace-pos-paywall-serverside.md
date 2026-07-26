---
symptom: A shop whose plan does not include POS is refused the counter by the UI, but can ring up unlimited POS sales by calling /api/pos/* directly.
root_cause_file: server/src/routes/pos.ts:13
root_cause_reason: The POS router mounts its sub-routes with no plan gate, so `posMode` is enforced only in the client's <PlanGate>, which is advisory.
---

## 5-whys

1. **Why did Suite R create seven POS sales on a business the UI refuses to show POS for?**
   Because `POST /api/pos/sales` accepted them.
2. **But why did it accept them?** Because nothing in the `/api/pos` chain
   checks the business's plan — `auth → posCheckoutAuth → requireIdempotencyKey
   → requirePermission → idempotencyCheck → validate` has no plan step.
3. **But why is there no plan step, when POS is a paid feature?** Because
   `posMode` was enforced where it was first noticed to matter: `src/App.tsx`
   wraps `/pos*` in `<PlanGate feature="posMode">`. That is a routing decision,
   not an entitlement.
4. **But why did the client gate seem sufficient?** Because the entitlement was
   read as "which screens does this shop see" rather than "which documents may
   this shop create". Every other paid router made the second reading —
   `godowns`/`einvoice` mount `requirePlan('BUSINESS')`, `gst-returns`
   `requirePlan('PRO')`, `reports`/`bank`/`expenses` `requireFeature(...)`.
5. **But why did the divergence survive?** Because no test ever asked a
   non-POS-plan caller for a POS sale. The paywall's only proof was a screen
   that does not render — which any client, any curl, and the app's own offline
   queue can skip.

**Root cause:** the entitlement for POS lives in one place too few. `posMode` is
enforced in the client route table and nowhere on the server, so the paywall is
decoration. The SSOT for "may this business use POS" is
`PLAN_LIMITS[plan].posMode` (server/src/config/plans.ts), and the only honest
consumer of it is a server-side gate on the router that owns the feature.

## Hypothesis

Mounting `requireFeature('posMode')` from `server/src/middleware/subscription-gate.ts`
on the POS router — after `auth`, since the gate no-ops without `req.user` —
makes `/api/pos/*` answer 402 `UPGRADE_REQUIRED` for FREE and PRO businesses and
leaves BUSINESS / PRO_MAX untouched, matching what `<PlanGate>` already tells the
user. The seeded E2E business currently has no `Subscription` row, so
`resolveBusinessPlan` returns PRO (trialing) — no POS. Giving it a real
BUSINESS/ACTIVE subscription makes the E2E shop a POS shop, which is what every
POS spec has been assuming all along.

## Failing test

`e2e/gold/pos.spec.ts` — TC-POS-13: the foreign tenant (seeded, no subscription,
so FREE/PRO) posts a POS sale and must be refused 402 `UPGRADE_REQUIRED`.
Before the fix it is refused only by idempotency/validation, never by the plan.
