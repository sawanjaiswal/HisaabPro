| Metric | v1 | v2 | v3 |
|--------|----|----|----|
| MUST_SHIP gaps | 6 | 0 | **1 (NEW_M1)** |
| SHOULD_SHIP gaps | 5 | 2 | 0 (NEW_S1 documented, NEW_S2 closed) |
| FUTURE_EPIC | 4 | 4 + 1 housekeeping | 4 + 1 housekeeping |
| Scope conformance breaks | 6 | 0 | 0 |
| Verdict | BLOCK | PASS_WITH_GAPS | **BLOCK** |
| Next | Architect v2 | Security agent | **Architect v4 (single-line path fix)** |

## Pass 4 — v4 (micro-patch verification)

Pass 4 verdict: **BLOCK**

### NEW_M1 status: **STILL_FAILS** (new evidence — Express mount-path mismatch)

The path string in v4 §3.1 was updated from phantom `pos.routes.ts` to real
`pos-sales.ts`, but the **route literal inside the code block is still wrong**
and two other tokens diverge from the real file. Builder copy-pasting v4 §3.1
will produce a route that doesn't match (and silently shadow the existing
checkout endpoint with a sibling `POST /api/pos/sales/sales`).

### Real file check

`/Users/sawanjaiswal/Projects/HisaabPro-epic-d/server/src/routes/pos-sales.ts:62`
real signature:
```ts
router.post(
  '/',                                  // ← path is '/', NOT '/sales'
  auth,                                 // ← imported as `auth`, NOT `requireAuth`
  requireIdempotencyKey,
  requirePermission('pos.create'),      // ← exists in real chain, missing from v4 §3.1
  idempotencyCheck(),                   // ← exists in real chain, missing from v4 §3.1
  asyncHandler(async (req, res) => { … })
)
```

Mount chain: `app.routes.ts:145 ['/api/pos', posRoutes]` → `pos.ts:15
router.use('/sales', salesRoutes)` → `pos-sales.ts:62 router.post('/', …)`.
The `/sales` segment is consumed at the PARENT mount, not the child route.

v4 §3.1 line 593 currently shows:
```ts
router.post('/sales', requireAuth, posCheckoutAuth, requireIdempotencyKey, posCheckoutHandler)
```

Four divergences (any one of which breaks copy-paste):
1. Path `'/sales'` → must be `'/'` (mounted under `'/sales'` by pos.ts:15)
2. `requireAuth` → real import name is `auth` (line 10)
3. `posCheckoutHandler` → real terminal is `asyncHandler(async (req, res) => { … })`
4. **Silently drops** `requirePermission('pos.create')` and `idempotencyCheck()`
   from the existing chain — both must be preserved AFTER `posCheckoutAuth`

### §12.16 + §12.17 existence: CONFIRMED

- §12.16 at line 1996 (`loyalty-balance.integration.test.ts: cross-tenant partyId returns 404 PARTY_NOT_FOUND`)
- §12.17 at line 2014 (`pos-checkout.integration.test.ts: loyalty_redemption with cross-tenant partyId rejected pre-tx`)
- §17.1 bullets at lines 2152-2162 cross-reference rows correctly

### Regression check on §3.6 / §4.2 / §6.3: CONFIRMED INTACT

- §3.6 server-only Party fields at line 857 — table + contract intact
- §4.2 deep-clone snapshot at line 1015 — Prisma `$transaction` snippet intact
- §6.3 `commissionLedgerAuth` factory at line 1240 — v2-deprecated vs v3-factory diff intact
- Line-shift (+53L from v3) did not break any pre-existing code block

### Phantom path grep

`pos.routes.ts` appears ONLY at line 4 (v4 changelog historical context) — confirmed clean.
`pos-sales.ts` appears at lines 4, 5, 590, 1455, 2154, 2156 — all five non-changelog
references are correct.

### Final disposition

**v5 required.** The path-string fix alone wasn't enough — v4 §3.1 still has
3 token mismatches + a silent drop of 2 existing middlewares against the real
`pos-sales.ts:62` signature. Fix is still typo-class (single code block, ~6L
re-write), but it must land before task-manager seeds `design-plan-active.md`.

Recommended v5 §3.1 code block:
```ts
// server/src/routes/pos-sales.ts:62 (mounted via pos.ts:15 → /api/pos/sales)
// Slot posCheckoutAuth between `auth` and `requireIdempotencyKey` so the
// permission gate fires BEFORE idempotency tokens are consumed.
router.post(
  '/',
  auth,
  posCheckoutAuth,            // NEW v3 / S3
  requireIdempotencyKey,
  requirePermission('pos.create'),
  idempotencyCheck(),
  asyncHandler(async (req, res) => { /* existing handler */ })
)
```

File plan #14b note should also flip "between requireAuth and requireIdempotencyKey"
→ "between `auth` and `requireIdempotencyKey`" to match real import name.
§17.1 bullet at line 2154 has the same `requireAuth` → `auth` cosmetic fix.

## Pass 5 — v5 (token-mismatch verification)

**Audited:** 2026-05-17 · **Scope:** Pass-4 BLOCK items only (3 token mismatches in v4 §3.1) · **Verdict:** PASS

| Check | v5 location | Required token(s) | Found | Status |
|-------|-------------|-------------------|-------|--------|
| §3.1 code block matches Pass-4 snippet byte-for-byte | lines 610-618 | `router.post('/', auth, posCheckoutAuth, requireIdempotencyKey, requirePermission('pos.create'), idempotencyCheck(), asyncHandler(...))` with `posCheckoutAuth` in position 3 | exact match — leaf `'/'`, `auth` pos 2, `posCheckoutAuth` pos 3, full 5-middleware chain preserved | PASS |
| File plan #14b notes `auth` (not `requireAuth`) + all 5 middlewares preserved | line 1480 | `between \`auth\` and \`requireIdempotencyKey\`` + literal "preserve all 5 existing middlewares" + chain `auth, requireIdempotencyKey, requirePermission('pos.create'), idempotencyCheck(), asyncHandler(...)` at line 62 | all present verbatim | PASS |
| §17.1 v3/S3 bullet has `pos-sales.ts:62`, `auth` not `requireAuth`, and explicit preservation of other 2 middlewares | lines 2177-2183 | `pos-sales.ts:62` + `between \`auth\` and \`requireIdempotencyKey\`` + `existing requirePermission('pos.create') and idempotencyCheck() preserved` | all present | PASS |

**Conclusion:** v5 cleared for build — task-manager may seed `design-plan-active.md`.
No new gaps surfaced. No further architecture revision required.
