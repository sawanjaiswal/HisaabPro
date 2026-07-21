# ARCHITECTURE — `server/src/lib/env.ts` split

**Status:** design only — no source file edited by this document.
**Author:** architect agent · 2026-07-21
**Trigger:** `server/src/lib/env.ts` is 292 lines; `scripts/enforce.js` check 1
(`MAX_LINES = 250`) errors on it. This is the last blocking enforce.js error.
**High-risk path:** `**/lib/env.ts` → Environment & secrets → required agent:
`architect` (per `~/.claude/rules/HIGH_RISK_PATHS.md`).

This is a **pure move refactor**. No behaviour change, no signature change, no
env-var-name change, no call-site change. Every rule below exists to keep that
promise mechanically checkable.

---

## 1. Verified facts (read from the repo, not assumed)

| Fact | Value | Source |
|---|---|---|
| File length | 292 lines | `server/src/lib/env.ts` |
| Enforce cap | 250 lines, check 1 | `scripts/enforce.js:30,85` |
| Server module system | `"type": "module"` (Node ESM) | `server/package.json:5` |
| tsconfig `moduleResolution` | **`bundler`**, not NodeNext | `server/tsconfig.json:5` |
| tsconfig `isolatedModules` | **`true`** | `server/tsconfig.json:16` |
| Runtime | `tsx src/index.ts` (dev/prod) and `node dist/index.js` (build) | `server/package.json:7,9,10` |
| SSOT registry row for `env.ts` | **none exists** | `ssot.config.mjs` (read in full; no `server/src/lib/env.ts` row) |
| SSOT scanner export-list support | yes — handles `export { A, B as C }` and `export type { D } from './d'` | `scripts/ssot/scan.mjs:34-42` |

### 1.1 Two corrections to the brief

The task brief states the server uses **NodeNext** resolution. It does not — it
uses `bundler`. The practical conclusion is unchanged (**`.js` specifiers are
mandatory**) but for a different reason, and the reason matters:

- `bundler` resolution would *tolerate* extensionless specifiers at typecheck
  time. TypeScript would emit no error.
- But `npm run build` → `tsc` → `node dist/index.js` runs under **real Node
  ESM**, which requires the extension. An extensionless specifier therefore
  typechecks clean, passes enforce.js, passes the SSOT gate, and then
  **`ERR_MODULE_NOT_FOUND` at production boot only**.

So `.js` specifiers are a hard rule here *and* the failure mode is invisible to
every static gate. Acceptance item A4 (real boot) is the only thing that catches
it — do not treat A4 as a formality.

Second correction: `isolatedModules: true` means the barrel **cannot** re-export
the three exported types with a value `export { … }`. `NicEnvKey`,
`RazorpayPlanResolution`, and `ScopedPrismaMode` must use `export type { … }`.
This is the single most likely way to break the build during this refactor.

### 1.2 Pre-existing defect surfaced by this audit — do not fix here

`validateScopedPrismaBoot()` (env.ts:279) has **zero call sites in the entire
repo**. Grep across `server/**` returns only its definition; the other hits are
in `docs/*.md`. `server/src/index.ts:11` calls `validateNicEnv()` and nothing
else.

This means the MF-3 tenant-isolation boot guard **is currently dead code**. The
`SECURITY_AUDIT_tenant-isolation.md:207` item M3 ("`validateScopedPrismaBoot()`
wired at boot") is checklisted but was never wired.

**Decision: out of scope for this refactor, and deliberately so.** This refactor
is a line-count fix; its entire safety argument rests on "behaviour is byte-for-
byte identical". Wiring a boot guard that can `throw` and halt production start
is a behaviour change to a tenant-isolation trust anchor, and it belongs in its
own change with its own security review. Mixing it in would mean a boot failure
during rollout is ambiguous between "the split broke something" and "the guard
now fires".

Consequence for the acceptance list: acceptance item A4 verifies
`validateScopedPrismaBoot` is **importable and behaviourally unchanged**, not
that it is called — because today it is not called. Asserting "both boot guards
fire" (as the brief's acceptance wording implies) would be asserting something
that is false before the refactor and would remain false after it.

Follow-up is filed in §8 as `FUTURE_EPIC: wire-scoped-prisma-boot-guard`.

---

## 2. Export inventory (symbol → domain → current line range)

23 exported symbols, 3 of which are types. One module-private const
(`VALID_NIC_ENVS`, line 87) is **not** exported and must stay private.

| # | Symbol | Kind | Domain | Lines |
|---|--------|------|--------|-------|
| 1 | `getEntitlementPrivateKey` | fn | entitlement | 7-9 |
| 2 | `getEntitlementPublicKey` | fn | entitlement | 12-14 |
| 3 | `getEntitlementKeyPrev` | fn | entitlement | 17-19 |
| 4 | `getRazorpayPlanProMax` | fn | billing | 22-32 |
| 5 | `RazorpayPlanResolution` | **type** | billing | 42-44 |
| 6 | `getRazorpayPlanId` | fn | billing | 46-63 |
| 7 | `getOverflowGraceDays` | fn | billing | 66-68 |
| 8 | `getSubscriptionGraceDays` | fn | billing | 71-73 |
| 9 | `NicEnvKey` | **type** | nic | 85 |
| — | `VALID_NIC_ENVS` | const | nic | 87 — **private, do not export** |
| 10 | `validateNicEnv` | fn (boot guard) | nic | 90-120 |
| 11 | `getNicEnvKey` | fn | nic | 123-125 |
| 12 | `isFcmConfigured` | fn | notifications | 133-135 |
| 13 | `isResendConfigured` | fn | notifications | 140-142 |
| 14 | `isMsg91Configured` | fn | notifications | 147-149 |
| 15 | `getMsg91WebhookSecret` | fn | notifications | 156-158 |
| 16 | `getResendWebhookSecret` | fn | notifications | 166-168 |
| 17 | `isAisensyConfigured` | fn | marketing | 176-178 |
| 18 | `getAisensyWebhookSecret` | fn | marketing | 184-186 |
| 19 | `getMsg91MarketingWebhookToken` | fn | marketing | 192-194 |
| 20 | `isMarketingEnabled` | fn | marketing | 199-201 |
| 21 | `getAnthropicApiKey` | fn | ocr | 209-211 |
| 22 | `getOcrModel` | fn | ocr | 217-219 |
| 23 | `getOcrMaxBytes` | fn | ocr | 225-228 |
| 24 | `isDriveConfigured` | fn | drive | 236-243 |
| 25 | `getDriveClientId` | const arrow | drive | 245 |
| 26 | `getDriveClientSecret` | const arrow | drive | 246 |
| 27 | `getDriveRedirectUri` | const arrow | drive | 247 |
| 28 | `getDriveTokenEncKey` | const arrow | drive | 248 |
| 29 | `ScopedPrismaMode` | **type** | scoped-prisma | 256 |
| 30 | `getScopedPrismaMode` | fn | scoped-prisma | 259-264 |
| 31 | `getScopedPrismaShadowSample` | fn | scoped-prisma | 267-271 |
| 32 | `validateScopedPrismaBoot` | fn (boot guard) | scoped-prisma | 279-292 |

(Numbering skips the private const; 32 rows, 31 exported symbols — recount for
the checklist: **31 exported symbols must appear in the barrel**. See §7 for the
mechanical count check, which is what actually enforces this, not the table.)

### 2.1 Only external dependency

`env.ts:83` — `import logger from './logger.js'`, used **only** inside
`validateNicEnv()` (lines 108, 110, 116, 118). It travels with the NIC domain.
No other domain gains or keeps a logger import. This matters: it is the only
reason any split file has a non-`process.env` dependency, and it means seven of
the eight domain files are dependency-free leaves.

### 2.2 Current importers (all use `.js` specifiers already)

| Importer | Symbols |
|---|---|
| `server/src/index.ts:3` | `validateNicEnv` |
| `server/src/lib/prisma.ts:21` | `getScopedPrismaMode` |
| `server/src/services/expense/expense-ocr.service.ts:14` | `getAnthropicApiKey`, `getOcrMaxBytes` |
| `server/src/services/expense/expense-ocr.client.ts:9` | `getOcrModel` |
| `server/src/services/subscription/checkout-session.service.ts:10` | `getRazorpayPlanId` |
| `server/src/routes/backup.ts:15` | `isDriveConfigured` |
| `server/src/services/ewaybill/ewaybill.nic-client.ts:15` | `getNicEnvKey` |
| `server/src/routes/webhooks/marketing-aisensy.routes.ts:26` | `getAisensyWebhookSecret` |
| `server/src/routes/webhooks/marketing-msg91.routes.ts:25` | `getMsg91MarketingWebhookToken` |
| `server/src/services/backup/drive-crypto.ts:14` | `getDriveTokenEncKey` |
| `server/src/services/backup/oauth-drive.service.ts:15-18` | `getDriveClientId`, `getDriveClientSecret`, `getDriveRedirectUri` |
| `server/src/routes/marketing.ts:9` | `isMarketingEnabled` |

**12 importers, 15 distinct symbols consumed.** All import from `lib/env.js`.
Zero import from a deep path (none exists yet).

### 2.3 The 16 currently-unimported symbols — a trap, not dead code

16 exported symbols have no importer today: the 3 entitlement keys,
`getRazorpayPlanProMax`, `getOverflowGraceDays`, `getSubscriptionGraceDays`, the
5 notification helpers, `isAisensyConfigured`, `RazorpayPlanResolution`,
`NicEnvKey`, `ScopedPrismaMode`, `getScopedPrismaShadowSample`,
`validateScopedPrismaBoot`.

**Do not treat this as licence to drop them.** It is the opposite — it is the
principal risk of this refactor, because dropping any of them from the barrel
produces **zero** signal: `tsc` is clean (nothing imports it), enforce.js is
clean, the SSOT gate is clean, and the server boots fine. The loss surfaces
weeks later when a feature imports it and gets a fresh, confusing error. §7's
export-count diff exists specifically to cover this blind spot, because no
existing gate does.

Note also that `noUnusedLocals: true` does not help here — it flags unused
*locals*, not unused *exports*.

---

## 3. File Plan

Convention: **flat dotted siblings** (`env.<domain>.ts`), not an `env/`
directory. Two reasons — it matches the existing repo convention for split
modules (`prisma-scoped.inject.ts`, `prisma-scoped.merge.ts`,
`prisma-scoped.rewrite.ts`), and it avoids the `env.ts`-vs-`env/index.ts`
resolution ambiguity that would exist if a directory sat beside the barrel of
the same name.

| # | Path | Action | Est. lines | Layer | SSOT | Build phase |
|---|------|--------|-----------|-------|------|-------------|
| 1 | `server/src/lib/env.entitlement.ts` | create | ~26 | env-accessor | new-ssot: none (leaf, not a shared capability) | P1 |
| 2 | `server/src/lib/env.billing.ts` | create | ~62 | env-accessor | new-ssot: none | P1 |
| 3 | `server/src/lib/env.nic.ts` | create | ~58 | env-accessor + boot guard | new-ssot: none | P1 |
| 4 | `server/src/lib/env.notifications.ts` | create | ~48 | env-accessor | new-ssot: none | P1 |
| 5 | `server/src/lib/env.marketing.ts` | create | ~40 | env-accessor | new-ssot: none | P1 |
| 6 | `server/src/lib/env.ocr.ts` | create | ~32 | env-accessor | new-ssot: none | P1 |
| 7 | `server/src/lib/env.drive.ts` | create | ~28 | env-accessor | new-ssot: none | P1 |
| 8 | `server/src/lib/env.scoped-prisma.ts` | create | ~50 | env-accessor + **trust anchor** | new-ssot: none | P1 |
| 9 | `server/src/lib/env.ts` | **rewrite → barrel** | ~58 | barrel | reuses: files 1-8 | P2 |

Every row is comfortably under 250. Largest is #2 at ~62. Total ~402 lines vs
292 today — the ~110-line delta is the barrel plus per-file headers, which is
the expected cost of the split and is not a smell.

**No `ssot.config.mjs` change is required.** There is no registry row for
`server/src/lib/env.ts` today (verified by reading the full registry — the two
`server/src/lib/*` rows are `business-context.ts` and `prisma-scoped.inject.ts`).
`npm run ssot --validate` only validates rows that exist, so it cannot go red
from this move. Adding a row is *possible* but not recommended: these are 31
independent `process.env` reads, not one shared capability, so there is no
meaningful `forbidden` regex to guard them with, and a discovery-only row would
add noise without catching drift.

For the record, had a row existed, the barrel's `export { … } from` list form
**is** visible to `scripts/ssot/scan.mjs` (it handles both declaration exports
and export-list/re-export forms, per `scan.mjs:34-42`) — so a barrel would have
kept `--validate` green. The brief's concern about a prior split breaking on
this is already addressed in the scanner; it just does not apply here.

---

## 4. Barrel — exact re-export shape

`server/src/lib/env.ts` after the rewrite. Note the mandatory `export type` for
the three types (`isolatedModules: true`) and `.js` on every specifier.

```ts
/**
 * Env accessor barrel — the single import surface for server env config.
 *
 * Split from a 292-line monolith (enforce.js check 1, max 250 lines).
 * Domain modules are siblings: env.<domain>.ts. Import from THIS file, not
 * from a sibling directly, so the import surface stays one grep away.
 *
 * Types use `export type` — required by tsconfig `isolatedModules: true`.
 * Specifiers keep `.js` — the server runs as real Node ESM (`"type":
 * "module"`), so an extensionless specifier typechecks clean under
 * `moduleResolution: bundler` and then fails at boot.
 */

export {
  getEntitlementPrivateKey,
  getEntitlementPublicKey,
  getEntitlementKeyPrev,
} from './env.entitlement.js'

export {
  getRazorpayPlanProMax,
  getRazorpayPlanId,
  getOverflowGraceDays,
  getSubscriptionGraceDays,
} from './env.billing.js'
export type { RazorpayPlanResolution } from './env.billing.js'

export { validateNicEnv, getNicEnvKey } from './env.nic.js'
export type { NicEnvKey } from './env.nic.js'

export {
  isFcmConfigured,
  isResendConfigured,
  isMsg91Configured,
  getMsg91WebhookSecret,
  getResendWebhookSecret,
} from './env.notifications.js'

export {
  isAisensyConfigured,
  getAisensyWebhookSecret,
  getMsg91MarketingWebhookToken,
  isMarketingEnabled,
} from './env.marketing.js'

export { getAnthropicApiKey, getOcrModel, getOcrMaxBytes } from './env.ocr.js'

export {
  isDriveConfigured,
  getDriveClientId,
  getDriveClientSecret,
  getDriveRedirectUri,
  getDriveTokenEncKey,
} from './env.drive.js'

export {
  getScopedPrismaMode,
  getScopedPrismaShadowSample,
  validateScopedPrismaBoot,
} from './env.scoped-prisma.js'
export type { ScopedPrismaMode } from './env.scoped-prisma.js'
```

31 symbols re-exported. Explicit named lists, **not** `export * from`. Reason: a
star re-export makes a dropped symbol invisible to review and lets the barrel
silently widen if a sibling adds an export later; the named list is the
inventory, and §7's count check reads it.

### 4.1 Module-graph impact: none

`import './env.js'` today pulls in `logger.js` (via `validateNicEnv`). After the
split, the barrel pulls all eight siblings, one of which pulls `logger.js`. Same
transitive set, same eager evaluation (all bodies are function declarations —
nothing executes at import time). No new cycle is introduced:
`prisma.ts → env.js → env.scoped-prisma.js` is a leaf, and `logger.js` does not
import `prisma.ts`.

Deep imports (`import { getOcrModel } from './env.ocr.js'`) will work and are
harmless, but **the plan does not introduce any** — zero call-site churn is the
constraint, and mixing both styles would make "who imports env config?" a
two-pattern grep.

---

## 5. Migration sequence

Strictly ordered. The invariant is that the tree typechecks and boots at **every
step boundary**, so a failure localises to one step.

**Step 0 — baseline capture (before touching anything).**
```
cd server && npx tsc -b --noEmit                      # expect clean
node ../scripts/enforce.js                            # expect exactly 1 error: env.ts oversized
npm run ssot                                          # expect exit 0
node -e "import('./src/lib/env.ts')"  # via tsx; see §7 for the real command
```
Record the **export-count baseline = 31** (§7). Without this number captured
first, §7's check has nothing to compare against.

**Step 1 — create the 8 sibling files (additive only).**
Copy each domain's code verbatim — same bodies, same JSDoc, same env-var names,
same defaults. `VALID_NIC_ENVS` moves into `env.nic.ts` and stays **un-exported**.
`env.nic.ts` carries `import logger from './logger.js'`.
`env.ts` is **not touched yet** — it still holds the originals.

At this point the tree has duplicate definitions in separate modules. That is
legal (no name collision across modules) and intentional: it means Step 1 cannot
break anything.

Verify: `npx tsc -b --noEmit` clean. Do not run enforce.js expecting green here
— `env.ts` is still 292 lines, so its one error persists by design.

**Step 2 — rewrite `env.ts` into the barrel (§4).** Delete all bodies, replace
with the re-export block. This is the only step that can break a call site.

Verify, in this order:
1. `npx tsc -b --noEmit` — clean. Catches a dropped symbol *that someone imports*
   (15 of 31) and every `export type` mistake.
2. §7 export-count diff — **31 = 31**. Catches a dropped symbol that nobody
   imports (the other 16). This is the step that has no other safety net.
3. `node ../scripts/enforce.js` — **0 errors**. env.ts is now ~58 lines.
4. `npm run ssot` — exit 0.

**Step 3 — boot proof.** `npm run dev` in `server/`. Confirm the process reaches
listening state and that `validateNicEnv()` still executes at `index.ts:11`
(observable: the `NIC_STUB_MODE_ACTIVE` / `NIC_IRP_CONFIGURED` log line appears
exactly as before). Then the negative test in §6.

**Step 4 — commit.** Single commit, `refactor:` (not `fix:` — nothing is broken;
per the global root-cause rule, `fix:` requires a 5-whys trace file, and a
line-count refactor has no defect to trace).

Suggested subject: `refactor(server): split lib/env.ts into per-domain modules behind a barrel`
Body should state: zero call-site churn, 31 symbols re-exported, no behaviour
change, and that `validateScopedPrismaBoot` remains unwired (pre-existing, §1.2).

---

## 6. Boot guards

### 6.1 `validateNicEnv()` — wired, must stay wired

Call site: `server/src/index.ts:11`, importing from `./lib/env.js` at line 3.
**That import line does not change** — the barrel re-exports the symbol from the
same specifier. The function moves to `env.nic.ts` with its body, its
`VALID_NIC_ENVS` dependency, and its `logger` import intact.

Positive proof: normal `npm run dev` logs the NIC stub/configured line.
Negative proof (the one that actually proves the guard is live):
```
NIC_ENV=prod NODE_ENV=development npm run dev   # MUST throw and exit non-zero
```
This must fail identically before and after the refactor. Run it at Step 0 and
Step 3 and compare the message text.

### 6.2 `validateScopedPrismaBoot()` — trust anchor, moves only

**MF-3 tenant-isolation trust anchor. Its behaviour must not change — only its
file location.** Copy the body byte-for-byte into `env.scoped-prisma.ts`:
the accepted-value list `['off','false','shadow','enforce','true']`, the
`SCOPED_PRISMA_CUTOVER_DONE === 'true'` check, the `NODE_ENV` production check,
the `getScopedPrismaMode() !== 'enforce'` condition, and both `throw` messages
verbatim. `getScopedPrismaMode()` is called from within
`validateScopedPrismaBoot()` — both live in `env.scoped-prisma.ts`, so that call
becomes module-local and does not route through the barrel. No cycle.

Same rule for `getScopedPrismaMode()`'s own parsing (`enforce`/`true` → enforce,
`shadow` → shadow, everything else → off): `server/src/lib/prisma.ts:103` reads
it once at module load to decide whether the scoping `$extends` layer attaches.
A parsing change here is a silent tenant-isolation drop. Copy, do not retype,
and diff the two bodies before deleting the original.

As established in §1.2, this function has no call site. This refactor does not
add one. Acceptance A4 asserts *importability and identical behaviour*, verified
by direct invocation (§7), not by observing it at boot — because it does not run
at boot today.

---

## 7. Mechanical check for the dropped-symbol blind spot

The core risk (§2.3) is invisible to tsc, enforce.js, and the SSOT gate. This is
the check that covers it. Run at Step 0 (baseline) and Step 2 (compare).

```
cd server
npx tsx -e "import('./src/lib/env.ts').then(m => \
  console.log(Object.keys(m).sort().join('\n')))" > /tmp/env-exports-after.txt
diff /tmp/env-exports-before.txt /tmp/env-exports-after.txt   # MUST be empty
```

Caveat, stated honestly: this enumerates **runtime value exports only**. The
three types (`NicEnvKey`, `RazorpayPlanResolution`, `ScopedPrismaMode`) are
erased at runtime and will not appear. Baseline is therefore **28 runtime keys**
(31 symbols − 3 types). The types are covered instead by a compile-time assertion
— add this to a scratch file, confirm it typechecks, then delete it:

```ts
import type { NicEnvKey, RazorpayPlanResolution, ScopedPrismaMode } from './src/lib/env.js'
const _a: NicEnvKey = 'sandbox'
const _b: ScopedPrismaMode = 'enforce'
const _c: RazorpayPlanResolution = { ok: false, missing: 'YEARLY' }
void _a; void _b; void _c
```

Behaviour spot-check for the trust anchor (§6.2), same before/after:
```
cd server
npx tsx -e "import('./src/lib/env.js').then(m => { \
  process.env.SCOPED_PRISMA_ENFORCE='garbage'; \
  try { m.validateScopedPrismaBoot(); console.log('NO THROW — WRONG') } \
  catch (e) { console.log('threw:', e.message) } })"
```
Must print the `Invalid SCOPED_PRISMA_ENFORCE=…` message identically both times.

---

## 8. Acceptance list

| # | Check | Command | Expected |
|---|---|---|---|
| A1 | Typecheck clean | `cd server && npx tsc -b --noEmit` | exit 0, no output |
| A2 | Enforce clean | `node scripts/enforce.js` | **0 errors** (env.ts oversized gone, nothing new) |
| A3 | SSOT gate | `npm run ssot` | exit 0 |
| A4 | Server boots | `cd server && npm run dev` | reaches listening; NIC log line unchanged |
| A5 | NIC guard live (negative) | `NIC_ENV=prod NODE_ENV=development npm run dev` | throws, same message as baseline |
| A6 | Scoped-prisma guard behaviour | §7 spot-check | same throw message as baseline |
| A7 | Export surface intact | §7 diff | empty diff, 28 runtime keys |
| A8 | Types re-exported | §7 compile-time assertion | typechecks |
| A9 | No call-site churn | `git diff --stat` | only `server/src/lib/env*.ts` touched; **no importer file in the diff** |
| A10 | Tests | `cd server && npm test` | no new failures vs baseline |

A9 is the cheapest and most direct proof of the zero-churn constraint: if any of
the 12 importers appears in the diff, the barrel is wrong.

**FUTURE_EPIC — `wire-scoped-prisma-boot-guard`:** call
`validateScopedPrismaBoot()` from `server/src/index.ts` beside
`validateNicEnv()`, closing security-audit item M3
(`SECURITY_AUDIT_tenant-isolation.md:207`). Requires `architect` + `security`
(tenant-isolation trust anchor, and it can halt production boot). Explicitly not
part of this refactor — see §1.2.

---

## 9. Risks

| # | Risk | Detected by | Severity |
|---|---|---|---|
| R1 | Symbol dropped from barrel, **nobody imports it** — no gate fires | §7 export diff (A7/A8) — the *only* detector | **High** — silent until a future feature needs it |
| R2 | Symbol dropped, someone imports it | A1 tsc, immediately | Low |
| R3 | Type re-exported with value `export {}` under `isolatedModules` | A1 tsc | Low — loud and immediate |
| R4 | Extensionless specifier in barrel | **Not** A1 (bundler tolerates it) — only A4 real boot | **High** — passes every static gate, fails at prod boot |
| R5 | `validateScopedPrismaBoot` / `getScopedPrismaMode` body altered during the move | A6 + line-by-line diff at Step 2 | **Critical** — tenant-isolation regression |
| R6 | `VALID_NIC_ENVS` accidentally exported | A7 diff (extra key appears) | Low — widens surface, no behaviour change |
| R7 | Import cycle via `logger.js` | A4 boot (would be a TDZ/undefined error) | Low — analysed §4.1, none introduced |
| R8 | Env-var *string* retyped during the move (e.g. `RESEND_API_KEY` → `RESEND_KEY`) | **No automated gate** — grep the diff for `process.env.` and confirm all 30+ literals are identical to baseline | **High** — a silently disabled provider |

R1, R4, and R8 share a shape and are the reason this doc exists: they all pass
tsc, enforce.js, and the SSOT gate. R8 has no mechanical detector at all — the
mitigation is a mandatory manual step at Step 2:

```
git diff -U0 server/src/lib/ | grep 'process\.env\.' | sort
```
Every removed line must have an identical added counterpart. Any asymmetry is a
retyped env var.

---

## 10. Gate paperwork

`scripts/enforce.js` blocks the edit until
`.claude/design-plan-active.md` exists with `status: approved`. Required
frontmatter for this change:

```yaml
status: approved
feature: env-split
created: <ISO 8601, now>
approver: Sawan
high_risk_paths_touched:
  - server/src/lib/env.ts
agents_invoked:
  - architect (output: docs/ARCHITECTURE_env-split.md)
acceptance:
  backend:
    - tsc clean
    - enforce.js 0 errors
    - npm run ssot exit 0
    - server boots, validateNicEnv fires
    - export-surface diff empty (28 runtime keys + 3 types)
```

Only `architect` is required — `**/lib/env.ts` maps to Environment & secrets,
whose Required-agents column is `architect` alone. `security` is not required by
the table. That said: this change touches a file containing a tenant-isolation
trust anchor, and §6.2/R5 are the reason a reviewer should read the
`env.scoped-prisma.ts` diff character-by-character even though no gate demands it.

The artifact-proof rule requires this file's mtime ≥ the plan's `created:`
timestamp, so write the plan file **after** this document.
