verdict: PASS

# Architecture Critique — Multi-User Collaboration (#150) — Revision 2

Re-audit of the revised plan against revision-1's three MUST_FIX. All three are
genuinely closed. No new gap invented; the LWW thesis and structure already stood.

## Revision-1 MUST_FIX — verification

| # | Rev-1 prescription | Rev-2 status |
|---|--------------------|--------------|
| M1 | Lock must move INTO the write — `updateMany({where:{id,businessId,version:expected}, data:{...patch, version:{increment:1}}})`, `count===0`→409; middleware demoted to pre-check | **CLOSED.** §1.1, §3 (L218-222), §7 all state exactly this via shared `optimistic-lock.ts`. File plan wires it through all four update services + `update-recompute.ts` (rows 176-180). Middleware explicitly "cheap pre-check only, never source of truth" (L189). |
| M2 | Add monotonic `version Int @default(0)`; reject `updatedAt` as lock token | **CLOSED.** schema row (L174) + §3 (L209) add it to Document/Payment/Party/Product. Single-step migration (default present → no NULL→backfill→NOT-NULL dance, L215). frontmatter `files_planned` lists schema.prisma + migrations/**. High-risk gate genuinely fires now. |
| M3 | Strict `>` moot once M1/M2 land | **CLOSED.** Comparison replaced by exact-match conditional write (§7). |

## Load-bearing question 3 — rollout gating

§6 step 1 explicitly forbids shipping client `X-Entity-Version` header + 409
`ConflictDialog` before the conditional write lands ("otherwise we ship a safety
feature that only *looks* like it works"). Correctly gated. PASS.

## Load-bearing question 4 — file plan after +6 backend files

All rows ≤250. `optimistic-lock.ts` ~70; presence store ~90 / service ~110 split
is clean; 5 update services take only +8 to +12 each (delegation, not God-file).
Layer order intact (schema→lib→service→route→middleware). No cycle. PASS.

## MUST_FIX (remaining)

None.

## SHOULD_FIX

| # | Finding |
|---|---------|
| S4 | Heartbeat teardown: plan covers TTL (45s) + rate-limit + per-user cap (§5), but does NOT name explicit `DELETE /leave` on `visibilitychange`/`pagehide`. Mobile backgrounding never fires unmount, so without it ghost editors linger up to 45s. Add to `usePresence` (hooks/usePresence.ts, already in plan). Non-blocking. |

## FUTURE_EPIC

- Redis pub/sub presence adapter — seam correctly placed; single-instance startup
  guard accepted for 1 Render instance (§3 note, L228-232).
- CRDT on a single free-text notes field only, if ever requested.

PASS. Fold S4 into the presence build; ship.
