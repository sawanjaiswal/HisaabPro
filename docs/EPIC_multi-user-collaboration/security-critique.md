verdict: PASS

# Security Critique — #150 Multi-User Collaboration (revision 2, plan-stage)

Scope: presence over per-business SSE + activation of dormant optimistic lock
as a conditional write with a `version Int` token. Re-audit of rev-1 findings.

## Rev-1 findings — closure status

| ID | Finding (rev-1) | Status | Evidence in plan |
|----|-----------------|--------|------------------|
| M1 | Cross-tenant existence oracle (404-vs-200 on foreign/unknown entityId) | CLOSED | §4 + §5: GET, POST /heartbeat, DELETE /leave all validate `entityId` ownership vs token `businessId` BEFORE any store read/write; foreign/unknown → identical `200 {peers:[]}` (204 leave). No oracle. |
| M2 | SSE emit businessId must come from token, `.strict()` Zod | CLOSED | §5: presence events keyed by token `businessId`, never body; per-business channel not widened. Heartbeat schema `.strict()`. |
| S1 | Overwrite must be permission-gated + clobbered value persisted | CLOSED | §1/§5: server-side edit-permission gate; clobbered prior value persisted via existing audit-emit path (recoverable). |
| S2 | Heartbeat DoS — rate limit + per-user entry cap | CLOSED | §5: auth-gated, server-side rate-limited, per-user entry cap with reject-beyond-cap. |

## New surface introduced by the revision

| Item | Severity | Assessment |
|------|----------|------------|
| `version Int @default(0)` column + conditional-write lock | OK | `updateMany WHERE {id, businessId, version}`; `count===0` collapses real-conflict and scoping-miss into one 409 — no distinction leaked. |
| 409 body `{code, serverVersion, updatedBy}` | OK | `updatedBy` only exists when a row matched, and a row only matches when `businessId`=token — so it is intra-business by construction. Foreign id → 0 rows → no serverVersion/updatedBy to surface. Not a cross-business leak. |

## NIT (non-blocking — do not gate ship)
- Add the acceptance test already listed (line 66) a sibling: a 409 on a
  FOREIGN/unknown entityId returns the oracle-free shape and carries NO
  `updatedBy`/`serverVersion`. Pins the rev-2 contract against regression.
- Confirm `updatedBy` is read off the matched row only, never a separate
  unscoped lookup. (Conditional-write design already guarantees this; make
  it explicit in the impl note.)

## Verdict
PASS. All four rev-1 findings (M1, M2, S1, S2) are closed in the plan. The
new `version` column + 409 conflict body introduce no cross-tenant leak. The
remaining item is a one-line test NIT, not a MUST_FIX. Proceed to build;
re-run security on the implementation diff (oracle parity + 409 body shape
are the two things to verify in code).
