---
symptom: On /parties/:id a subscription-fetch blip replaces the whole page with "Couldn't verify your plan", locking the user out of a FREE-tier feature.
repro: Load any FREE-tier page (parties/products/invoices) while the API is unreachable or the subscription GET is slow (>8s) — PlanGate shows ErrorState instead of the page. Reproduced live: servers down -> proxy 502 BACKEND_DOWN -> useSubscription isError -> ErrorState.
root_cause_file: src/features/subscription/PlanGate.tsx:34
root_cause_reason: The error/timeout branch short-circuits to ErrorState BEFORE computing entitlement, so a UX-only gate fails closed even for features that every tier (incl. FREE) already unlocks.
class: wrong-failure-mode
regression_since: d4128de (feat(gating): gold-standard paid-feature gating) — gate was written fail-closed from the start; newly exposed by the app "silently dying" in dev.
flip_proof: manual — PlanGate.test.tsx 3 FAIL at HEAD (parties blocked on error/loading/timeout), 5 PASS in working tree; mask sweep found no sibling fail-closed gates.
---
## 5-whys
1. Why does /parties show the error? -> PlanGate returns <ErrorState> when isError||timedOut [read PlanGate.tsx:34].
2. Why does a fetch error block the page? -> the error branch runs before isFeatureAllowed; no fallback-to-FREE path [read PlanGate.tsx:34-59].
3. Why is that wrong for parties? -> isFeatureAllowed('FREE','parties')===true; user is entitled on every tier, so plan verification is irrelevant to whether it renders [read plan-limits.ts:52-82].
4. Why is failing closed harmful with no upside? -> the FE gate is UX-only; the server (subscription-gate.ts) is the real enforcer and itself falls back to FREE when the plan can't be resolved [read subscription-gate.ts:55-113]. FE fail-closed diverges from the BE contract and buys zero security.
5. Why did nothing catch it? -> no test pins the failure-mode; the "assume FREE when unverifiable" policy lives nowhere — it's a bare inline branch.
## Hypothesis
Extract the failure-mode policy into a pure SSOT resolveGateAccess() that mirrors the server floor: for a FREE-tier feature render children in loading+error states (block only on known LOCKED); for a paid feature keep loading/error/retry. PlanGate becomes a thin renderer. Pin with tests so fail-closed-on-uncertainty can't recur.
## Bug class & fix shape
class: wrong-failure-mode
shape: SSOT (pure gate-policy module + tests) — not minimal
why-not-SSOT: n/a (using SSOT)
## Failing test
src/features/subscription/__tests__/PlanGate.test.tsx
