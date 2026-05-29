---
status: approved
feature: hsn-seed-trgm-index
created: 2026-05-29T10:45:58Z
session: bare-161310
proposer: claude
high_risk_paths_touched:
  - prisma/schema.prisma
  - prisma/migrations/**
files_planned:
  - server/prisma/schema.prisma
  - server/prisma/migrations/**
  - server/prisma/data/hsn-curated.ts
  - server/prisma/seed.hsn.ts
  - server/src/routes/hsn.ts
  - server/package.json
agents_invoked:
  - architecture-auditor (output: docs/EPIC_hsn-seed-trgm-index/architecture-critique.md, verdict: PASS)
critique_history:
  - ts: 2026-05-29T16:14:00Z
    critic: architecture-auditor
    verdict: REVISE
    revision: 1
    findings: 1 MUST_FIX (drop-before-create ordering under no-tx), 2 SHOULD_FIX
  - ts: 2026-05-29T16:16:00Z
    critic: architecture-auditor
    verdict: PASS
    revision: 2
    note: "reordered SQL to create-then-drop + failure-cleanup comment; down-migration no longer recreates B-tree"
acceptance:
  backend:
    - tsc clean
    - "curl 200: GET /api/hsn/search?q=rice returns description matches"
    - "curl 401: GET /api/hsn/search without auth"
    - "curl 200: GET /api/hsn/:code single lookup; 404 unknown code"
    - "migration applies clean on shadow DB; down-migration provided"
    - "EXPLAIN shows GIN index used for ILIKE '%term%' on description"
approver: sawanjaiswal
approved_at: 2026-05-29T10:51:09.682Z

---

# HSN seed (curated subset) + trigram GIN index — Plan (#76)

## Problem (from FEATURE_AUDIT_SUMMARY #76)

`HsnCode` model exists but the table is **empty** — no seed ever creates rows
(`seed.gst.uqc.ts` only *updates* `uqc` on existing rows and currently finds
zero). Search (`routes/hsn.ts`) does `code startsWith` + `description contains
(insensitive)`. With no rows it returns nothing; once populated, the
`description contains` (→ `ILIKE '%q%'`) is a seq-scan with no trigram index.

The schema declares `@@index([description])` — a plain **B-tree**, which does
NOT accelerate `ILIKE '%q%'` (leading-wildcard). Per
`.claude/rules/PRISMA_MIGRATION_RULES.md`: "GIN indexes (trgm): raw SQL only —
no `@@index([name])` (duplicate B-tree)."

## Scope (this pass)

1. **Curated subset seed** (user decision: curated now, full 12K later) —
   ~150-250 hand-verified common HSN/SAC codes covering retail/wholesale
   (foodgrains, FMCG, textiles, electronics, stationery, common services SAC).
   Each code carries description, chapter, defaultRate (basis points),
   cess flags. Idempotent `upsert` keyed on `code` so re-running and a future
   full-12K load are both safe.
2. **Trigram GIN index** on `HsnCode.description` (raw SQL migration), replacing
   the redundant B-tree `@@index([description])`. `pg_trgm` already exists (two
   product/parties trgm migrations precede this). Mirrors
   `20260519000300_phase7_1b_b3_product_trgm_concurrent`.
3. Search route stays on Prisma `contains` mode `insensitive` (→ `ILIKE`),
   which the GIN now accelerates — minimal/no logic change; keep code-prefix
   first, description trgm fill second.

## Out of scope (FUTURE)

- Full ~12K HSN/SAC master load (needs an authoritative dataset from the user).
- Similarity-ranked ordering (`word_similarity` ORDER BY) — keep `code asc`.
- HSN auto-fill UI wiring on the product form (separate FE task).

## File Plan

| path | action | est-lines | layer |
|------|--------|-----------|-------|
| server/prisma/data/hsn-curated.ts | create | ~230 | data (typed const array) |
| server/prisma/seed.hsn.ts | create | ~70 | seed (idempotent upsert loop) |
| server/prisma/schema.prisma | modify | -1 | schema (drop `@@index([description])`) |
| server/prisma/migrations/<ts>_hsn_description_trgm/migration.sql | create | ~20 | migration (DROP btree + raw GIN) |
| server/src/routes/hsn.ts | modify | ~5 | route (comment/minor; logic stable) |
| server/package.json | modify | +1 | script `db:seed:hsn` |

Data file is split from seed logic so neither exceeds 250L (curated array is
the bulk). `hsn-curated.ts` ~230L of data rows; `seed.hsn.ts` ~70L of loop.

## Migration SQL (mirror of established pg_trgm pattern)

Order matters (architecture-critique MUST_FIX): under `-- prisma:no-transaction`
there is NO auto-rollback, so the new GIN must be **created and valid BEFORE**
the old B-tree is dropped. Otherwise a failed `CONCURRENTLY` build would leave
prod with the B-tree already gone AND an INVALID GIN — i.e. no usable
description index at all.

```sql
-- prisma:no-transaction  (CREATE INDEX CONCURRENTLY cannot run inside a tx)
-- Replace the redundant B-tree (ILIKE '%q%' can't use it) with a trigram GIN
-- that accelerates description substring search on HsnCode. HsnCode is a small
-- (~12K target) read-only reference table; CONCURRENTLY mirrors the product/
-- parties trgm migrations and is harmless on a tiny table.
--
-- ON FAILURE: this migration has no auto-rollback (no-tx). If the CONCURRENTLY
-- build aborts, an INVALID index named "hsn_description_trgm" remains — the
-- operator must `DROP INDEX IF EXISTS "hsn_description_trgm";` and re-run before
-- the migration is considered applied. The B-tree DROP only executes after a
-- successful create, so a mid-flight failure never leaves the table indexless.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "hsn_description_trgm"
  ON "HsnCode" USING gin ("description" gin_trgm_ops);
DROP INDEX IF EXISTS "HsnCode_description_idx";
```

Down-migration (manual rollback only): `DROP INDEX IF EXISTS
"hsn_description_trgm";`. We do **not** recreate the B-tree — re-adding
`HsnCode_description_idx` would be schema drift (the `@@index([description])`
line is removed from schema.prisma), and the route's `ILIKE` query gains nothing
from a B-tree anyway. Rollback therefore reverts description search to a
seq-scan on the small table, which is acceptable.

## Generation procedure (no `db push`)

1. Edit schema: remove `@@index([description])` from `HsnCode`.
2. `npx prisma migrate dev --name hsn_description_trgm --create-only` to scaffold
   the DROP INDEX, then hand-append the `CREATE EXTENSION` + raw GIN lines and
   the `-- prisma:no-transaction` header.
3. `npx prisma migrate dev` to apply.
4. `tsx prisma/seed.hsn.ts` to load curated rows (idempotent).

## Security / multi-tenant notes

- HSN codes are **global reference data** (no `businessId`) — read-only, no
  tenant scoping needed. Route already auth-gated (`router.use(auth)`).
- No PII. Seed contains only public GST tariff data.
- No write endpoints added; the table stays read-only at the API layer.

## Open questions

- None blocking. Curated subset size (~150-250) is a judgment call; will bias
  toward the most-used retail/wholesale codes + top services SAC.

## Rollout

Low-risk: additive seed + one index swap on a tiny read-only table. No app
behavior changes except search starts returning rows and runs on an index.
