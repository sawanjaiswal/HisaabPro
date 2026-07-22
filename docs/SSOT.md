# SSOT Registry

> Generated from `ssot.config.mjs` by `scripts/ssot/doc.mjs`. Do not hand-edit.
> Check here FIRST before writing any shared util/service/hook.

Shared dirs scanned: `src/lib`, `src/hooks`, `server/src/lib`, `server/src/services`, `server/src/middleware`.
Exhaustive symbol index (auto, never stale): `.claude/ssot-index.json`
(`node scripts/ssot/index.mjs`).

## Canonical modules

| capability | canonical module | exports | enforcement |
|---|---|---|---|
| save/fetch data through the app API client | `src/lib/api.ts` | `api`, `ApiError` | ✅ guarded |
| format paise/number money for display | `src/lib/format.ts` | `formatPaise`, `formatNumber`, `formatDate`, `toLocalISODate` | ✅ guarded |
| show a transient toast notification | `src/hooks/useToast.ts` | `useToast` | ✅ guarded |
| confirm a destructive action | `src/components/ui/ConfirmDialog.tsx` | `ConfirmDialog` | ✅ guarded |
| reconcile party react-query cache after a mutation | `src/features/parties/party-cache.ts` | `reconcilePartyCreated`, `reconcilePartyUpdated`, `optimisticRemoveParty`, `reconcilePartyDeleted`, `invalidatePartyLists` | ✅ guarded |
| build TanStack Query cache keys | `src/lib/query-keys.ts` | `queryKeys` | discovery-only |
| merge Tailwind class names | `src/lib/utils.ts` | `cn` | discovery-only |
| persist a small local UI preference across app restarts | `src/lib/prefs-store.ts` | `getPref`, `setPref`, `removePref`, `clearPrefs` | discovery-only |
| carry the active tenant (business) context | `server/src/lib/business-context.ts` | `runInBusinessContext`, `getBusinessContext`, `runUnscoped` | ✅ guarded |
| inject tenant (businessId) scoping into Prisma queries | `server/src/lib/prisma-scoped.inject.ts` | `injectScope` | discovery-only |
| compare scoped vs unscoped query result-id sets | `server/src/lib/prisma-shadow.diff.ts` | `diffIds` | ✅ guarded |
| carry per-request provenance + route metadata for the shadow sink | `server/src/lib/request-meta.ts` | `getRequestMeta`, `runWithRequestMeta` | ✅ guarded |

## How it's enforced (no memory)

1. **Discovery** — `.claude/ssot-index.json` is generated from code; `/inventory`
   + the pre-Write surfacer read it so you never rebuild an existing module blind.
2. **Commit gate** — `node scripts/ssot/check.mjs` validates every row maps to
   live code and blocks any `forbidden` shape re-implemented outside its canon.
3. **Ratchet** — pre-existing legacy is grandfathered in `ssot.baseline.json` (committed);
   the violation count can only go DOWN. New drift fails the commit.
4. **Escape hatch** — `// ssot-allow: <capability>` (with a reason) for a
   deliberate, reviewed exception.

## Guarded capabilities

### save/fetch data through the app API client
Canon: `src/lib/api.ts`

Forbidden elsewhere (commit-blocked):
- `/fetch\(\s*[`'"]/api/`
- `/fetch\(\s*`\$\{[^`]*}/api/`

THE data save/fetch choke point. 147 importers.

### format paise/number money for display
Canon: `src/lib/format.ts`

Forbidden elsewhere (commit-blocked):
- `/toLocaleString\(\s*['"]en-IN['"]/`

Money/number/date display SSOT (frontend).

### show a transient toast notification
Canon: `src/hooks/useToast.ts`

Forbidden elsewhere (commit-blocked):
- `/window\.alert\(/`
- `/(?<![.\w])alert\(\s*['"`]/`

Toast SSOT. 201 importers — the most-reused module in the repo.

### confirm a destructive action
Canon: `src/components/ui/ConfirmDialog.tsx`

Forbidden elsewhere (commit-blocked):
- `/window\.confirm\(/`

Confirm SSOT (PAGE_AUDIT_CHECKLIST §C).

### reconcile party react-query cache after a mutation
Canon: `src/features/parties/party-cache.ts`

Forbidden elsewhere (commit-blocked):
- `/invalidateQueries\(\s*\{\s*queryKey:\s*queryKeys\.parties/`
- `/setQueriesData[^\n]*queryKeys\.parties\.all/`

Party list/detail cache reconciliation SSOT. Fixed the save-not-showing bug.

### carry the active tenant (business) context
Canon: `server/src/lib/business-context.ts`

Forbidden elsewhere (commit-blocked):
- `/new AsyncLocalStorage<[^>]*[Bb]usiness/`

Tenant context SSOT. runUnscoped is the ONLY sanctioned cross-tenant window.

### compare scoped vs unscoped query result-id sets
Canon: `server/src/lib/prisma-shadow.diff.ts`

Forbidden elsewhere (commit-blocked):
- `/onlyUnscoped\s*[:=]\s*[^;\n]*\.filter\(/`
- `/onlyScoped\s*[:=]\s*[^;\n]*\.filter\(/`

Shadow diff SSOT. One comparison, one cap. Don't hand-roll id-set difference for the harness.

### carry per-request provenance + route metadata for the shadow sink
Canon: `server/src/lib/request-meta.ts`

Forbidden elsewhere (commit-blocked):
- `/new AsyncLocalStorage<[^>]*(?:RequestMeta|[Pp]rovenance)/`

Request-meta frame SSOT. Opened beside the tenant frame in auth; runUnscoped/job paths omit it deliberately.

