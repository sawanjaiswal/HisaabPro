verdict: PASS

# Architecture re-audit — refresh-token-family-rotation (rev 2)

Audited: 2026-05-26T22:04:00Z
Auditor: architecture-auditor
Audit of: `.claude/design-plan-active--refresh-token-family-rotation--bare-215932.md`

## MUST_FIX verification

| Rev1 finding | Rev2 evidence | Status |
|---|---|---|
| arch M1 — `password-reset.ts` missing; `deleteMany` destroys audit | files_planned L15; file-plan row L210 swaps to `updateMany({ revokedReason: 'password-reset' })` | RESOLVED |
| arch M2 — `logout.ts` does not revoke family | files_planned L21; file-plan row L216 `updateMany({ where:{family}, data:{revokedAt, revokedReason:'logout'} })` | RESOLVED |
| arch M3 — NOT NULL alter unsafe | Schema L77 keeps `family String?`; explicit "No NOT NULL alter… stays nullable forever" L111, L251; acceptance "additive-only" L44 | RESOLVED |
| arch M4 — `listSessions` shows ghost rows; no covering index | `revokedAt: null` filter L211; composite `@@index([userId, revokedAt, expiresAt])` L90 | RESOLVED |
| arch M5 — admin path coverage ambiguity | Dedicated section L224-231 declares admin-auth out of scope, defers to `admin-session-rotation` future epic | RESOLVED |

## SHOULD_FIX verification

S6 (no new rotation file), S7 (2 test files), S8 (blacklist removed from refresh route), S9 (switch-business new family), S10 (Sentry decided), S11 (no `family` in JWT) — all resolved per Findings→fixes table (L276-298), cross-checked against file-plan rows.

## Net assessment

Plan is implementation-ready. File estimates respect the ≤250L rule; rotation logic lives inline in `auth/login.ts` (~190L). Migration is purely additive (columns + 2 indexes), no skew gate needed. Concurrent-rotation race defended in depth: Serializable isolation + `FOR UPDATE` row lock + partial unique on `(family, replacedBy)` + P2002 catch-and-map. Legacy NULL-family rows handled by `row.family ?? row.id`. Acceptance covers happy / reuse / unknown-sig / concurrent / legacy-NULL / audit-trail preservation. No new MUST_FIX gaps.

Proceed to security re-audit and code.
