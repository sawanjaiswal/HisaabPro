**[11:21 AM]**

**Verdict: REVISE.** The diagnosis is correct and the dual-write problem is real. But Rule 1 as written guards only a fraction of the problem, and Rule 2 can't be enforced by regex at all. The viewport, touch-target and barcode items in your brief don't apply to this change, since it is config and policy only. Perf and compatibility are covered below.

**What I checked (🧪 static, nothing run)**
- `src/repositories/` already has Party, Product, Invoice and Payment repositories, and `OutboxEngine.enqueueInTx` runs inside `create`, `update` and `delete`.
- `void api(...)` appears 6 times. All of them sit next to a repository write:
  - `party-crud.service.ts:97,130,163`
  - `product-crud.service.ts:147,199`
  - `invoice-crud.service.ts:159`
- Each of those writes twice: the repository outbox and a direct `api()` call. That is the ghost-duplicate bug.
- `useParties.ts:62-65` has the blocking fallback: `if (local && local.parties.length > 0) …; return getParties(filters)`.
- Only 7 files import `@/repositories`. The "40 modules on System A" are not touched by Rule 1, because its regex only matches four entity paths.

**Rule 1: right idea, weak guard**
1. **The regex misses the dual-write shapes.**
   - `createParty` has a second path: `catch { await api('/parties', …) }`. It is non-`void`, so the regex ignores it. That path writes to the server directly, and `api()` queues offline mutations on its own. Offline, you get a third queue in addition to the outbox.
   - The `.catch(() => {})` on a separate line, or a `void` on a wrapper function, also slips past.
   - Real dual-write is "a repository call and `api('/<entity>', {method≠GET})` in the same file". Regex can't see that. Guard it with a small AST or script check in `scripts/ssot/` instead: in any `*-crud.service.ts` that imports a repository, a mutating `api()` call to that entity's path is a violation.
2. **The baseline problem.** The gate only ratchets legacy down. If the 6 existing hits are grandfathered, the guard exists but the bug still ships. Remove the 6 `void api` calls and the `catch`-fallback `api()` calls in the same change, then freeze the baseline at 0 for this rule.
3. **The Module and `exports` fields don't fit.**
   - `src/repositories/index.ts` isn't under `SHARED_DIRS` (`src/lib`, `src/hooks`, …). Add `src/repositories` or the index won't track importers.
   - `exports` must list the real classes (`PartyRepository`, …). `--validate` will fail on any name that isn't exported.
4. **Missing exemption.** The sync pusher that drains the outbox legitimately calls the server. Its path must be excluded, or add `// ssot-allow` with a reason. Check this before enabling the rule.
5. **Scope.** Four entities leaves out expenses, categories and the rest. Name the next entities in the rule so the guard grows with the repository set. Otherwise drift moves to whichever feature isn't listed.

**Rule 2: a policy, not an SSOT guard**
- You can't regex "never fall back to a network fetch". Don't add it to `ssot.config.mjs` as a guarded row. A row with `forbidden: []` is discovery only and gives no protection.
- To make it mechanical, put the contract in one shared hook, for example `useRepositoryList(repo, filters)`. It does a local read, runs SWR in the background, and exposes `isHydrating`. Then add a forbidden pattern for the old shape (`\.length\s*>\s*0\)\s*return` inside `src/features/**/use*.ts`) and migrate the entity hooks onto it. That gives you real SSOT.
- **`isHydrating` can't be `length === 0`.** An empty local result is ambiguous: it could be a never-synced device or a truly empty business. Persist a per-entity, per-filter `lastHydratedAt` marker in Dexie meta. Without it, a new user sees a false "no parties" empty state, or a permanent spinner.
- **Server-side filters and pagination don't map to local reads.** Search, cursor pagination and server-side aggregates would return a different set from Dexie. The contract must say whether local serves a superset and filters client-side, or serves only the first page. Don't promise "always return the repository result directly" until that is decided.
- **The SWR merge must be non-clobbering.** `raw = [...pendingTemps, ...serverList]`, and `temp_*` records must survive the merge. Line 60 of `useParties.ts` (`void getParties(filters).catch(() => {})`) shows the revalidate result isn't clearly merged back. Verify that before relying on it.

**Performance and compatibility**
- Rule 1 has no runtime cost. It is a commit-time check.
- Rule 2 is faster on repeat visits, but `isHydrating` plus background SWR adds a second render. Memoize the derived list, and drive SWR from scoped `ENTITY_MUTATED` events rather than a global refetch.
- Compatibility with the 40 modules: adding the config rows breaks nothing. Removing the dual writes does change behavior. Any caller that reads `createParty`'s server return (`PartyDetail` with a real id) will now get the local temp record. Handle the optimistic-return contract from `OFFLINE_RULES` Rule 5. Check these callers before landing it.

**Counter-proposal, in order**
1. Remove the 6 `void api` calls and the 3 `catch`-fallback `api()` calls. Repository failure surfaces as an error; it does not fall back to a direct write.
2. Add the AST/script check for "repository plus mutating `api()` for the same entity". Keep the regex as a cheap first line. Baseline 0.
3. Fix the registry row: add `src/repositories` to `SHARED_DIRS`, list real exports, exempt the sync pusher.
4. Build `useRepositoryList` with a Dexie `lastHydratedAt` marker and `isHydrating`. Migrate the 4 hooks onto it. Guard the old pattern.
5. Proof: `npm run ssot` exit 0, `tsc`, and a test. The test is "create party while offline, then online", asserting exactly 1 outbox row and 1 server row. It must fail on the current code.

**[11:21 AM]**