// SSOT registry — the single source of canonical shared modules for THIS repo.
// Machine-authoritative: scripts/ssot/* read this file; docs/SSOT.md is rendered
// from it (never hand-edit the doc).
//
// Fill REGISTRY with this repo's real canonical modules. Two kinds of rows:
//   guarded   : has `forbidden` regex shapes → re-implementing them elsewhere
//               fails the commit gate (scripts/ssot/check.mjs).
//   discovery : forbidden: [] → listed for /inventory + pre-Write surfacing
//               (semantic capabilities that aren't regex-detectable).
//
// Adjust SHARED_DIRS to this repo's layout (where shared utils/services/hooks live).

export const SHARED_DIRS = [
  // Frontend shared layers
  "src/lib",
  "src/hooks",
  // Backend shared layers
  "server/src/lib",
  "server/src/services",
  "server/src/middleware",
];

export const REGISTRY = [
  // ── GUARDED (forbidden regex → new drift fails the gate) ─────────────────

  {
    capability: "save/fetch data through the app API client",
    module: "src/lib/api.ts",
    exports: ["api", "ApiError"],
    // Raw fetch() to our own /api bypasses cookie auth, CSRF, replay
    // protection, 401 refresh, the offline mutation queue AND the read cache.
    // Every save MUST go through api(). (Mirrors OFFLINE_RULES Rule 1.)
    forbidden: ["fetch\\(\\s*[`'\"]/api", "fetch\\(\\s*`\\$\\{[^`]*}/api"],
    note: "THE data save/fetch choke point. 147 importers.",
  },
  {
    capability: "format paise/number money for display",
    module: "src/lib/format.ts",
    exports: ["formatPaise", "formatNumber", "formatDate", "toLocalISODate"],
    // Hand-rolled Indian-locale money/number formatting drifts from the
    // canonical paise→rupee renderer (grouping, currency symbol, rounding).
    forbidden: ["toLocaleString\\(\\s*['\"]en-IN['\"]"],
    note: "Money/number/date display SSOT (frontend).",
  },
  {
    capability: "show a transient toast notification",
    module: "src/hooks/useToast.ts",
    exports: ["useToast"],
    // Native alert() blocks the thread, can't be themed, and escapes the
    // design system. Use useToast(). (PAGE_AUDIT_CHECKLIST §C.)
    forbidden: ["window\\.alert\\(", "(?<![.\\w])alert\\(\\s*['\"`]"],
    note: "Toast SSOT. 201 importers — the most-reused module in the repo.",
  },
  {
    capability: "confirm a destructive action",
    module: "src/components/ui/ConfirmDialog.tsx",
    exports: ["ConfirmDialog"],
    // window.confirm() is unthemeable and blocks. Use <ConfirmDialog>.
    forbidden: ["window\\.confirm\\("],
    note: "Confirm SSOT (PAGE_AUDIT_CHECKLIST §C).",
  },
  {
    capability: "reconcile party react-query cache after a mutation",
    module: "src/features/parties/party-cache.ts",
    exports: [
      "reconcilePartyCreated",
      "reconcilePartyUpdated",
      "optimisticRemoveParty",
      "reconcilePartyDeleted",
      "invalidatePartyLists",
    ],
    // Every party create/update/delete must reconcile the cache HERE. Scattered
    // invalidateQueries/setQueriesData on queryKeys.parties.* is exactly the
    // drift that let a created party show a success toast but not appear until
    // reload (usePartyForm forgot to invalidate; PartyDetailPage + bulk-import
    // too). One module owns it → the divergence can't recur.
    forbidden: [
      "invalidateQueries\\(\\s*\\{\\s*queryKey:\\s*queryKeys\\.parties",
      "setQueriesData[^\\n]*queryKeys\\.parties\\.all",
    ],
    note: "Party list/detail cache reconciliation SSOT. Fixed the save-not-showing bug.",
  },

  // ── DISCOVERY (forbidden: [] → surfaced for reuse, not regex-guarded) ─────

  {
    capability: "build TanStack Query cache keys",
    module: "src/lib/query-keys.ts",
    exports: ["queryKeys"],
    forbidden: [],
    note: "Inline string query keys cause cache-invalidation drift. Reuse queryKeys.",
  },
  {
    capability: "merge Tailwind class names",
    module: "src/lib/utils.ts",
    exports: ["cn"],
    forbidden: [],
    note: "clsx+twMerge wrapper. Don't re-roll className concatenation.",
  },
  {
    capability: "write an AuditLog entry",
    module: "server/src/services/settings/audit.ts",
    exports: ["createAuditEntry", "listAuditLog"],
    // Discovery-only (mirrors the scoped-Prisma injector row): ~48 service
    // files hand-roll `prisma.auditLog.create({...})` inline (grandfathered).
    // A `forbidden` guard would fire on all of them at once and demand freezing
    // ~47 baseline entries — the migration to route them through this writer is
    // a GOLD_STANDARD hardening follow-up, not a gate flip. Surfaced here so new
    // code reuses createAuditEntry, which owns the two FK invariants inline
    // writers keep getting wrong: businessId is a NOT-NULL FK (no literal
    // 'SYSTEM'), and a system actor leaves userId NULL + names itself via
    // systemActor (AuditLog.userId is onDelete:Restrict — a stray ref blocks the
    // user's later deletion). See .claude/fix-trace-erasure-audit-fk.md.
    forbidden: [],
    note: "Canonical AuditLog writer. tx-aware (pass a tx for atomic rollback) + system-actor-capable. enforce-audit-coverage.mjs counts a createAuditEntry() call as coverage.",
  },
  {
    capability: "persist a small local UI preference across app restarts",
    module: "src/lib/prefs-store.ts",
    exports: ["getPref", "setPref", "removePref", "clearPrefs"],
    // Discovery-only: localStorage writes in feature code are already
    // ratcheted to zero by scripts/enforce-offline.mjs, and the legacy
    // survivors (biometric ids, sync timestamp, playstore mock) are not UI
    // preferences — a regex guard here would only add noise.
    forbidden: [],
    note: "UI-preference SSOT (favourite reports, sticky UI choices). Cleared on logout via clearAuth().",
  },

  // ── Tenant isolation (Wave A, P0.1) ───────────────────────────────────────
  {
    capability: "carry the active tenant (business) context",
    module: "server/src/lib/business-context.ts",
    exports: ["runInBusinessContext", "getBusinessContext", "runUnscoped"],
    // The tenant frame lives in ONE AsyncLocalStorage. A second business-keyed
    // ALS anywhere else = a divergent context the scoping extension can't read.
    forbidden: ["new AsyncLocalStorage<[^>]*[Bb]usiness"],
    note: "Tenant context SSOT. runUnscoped is the ONLY sanctioned cross-tenant window.",
  },
  {
    capability: "inject tenant (businessId) scoping into Prisma queries",
    module: "server/src/lib/prisma-scoped.inject.ts",
    exports: ["injectScope"],
    // Discovery: manual `where:{ businessId }` is the legacy pattern across ~406
    // service files (grandfathered). Surfaced so new scoping logic reuses the
    // injector instead of hand-rolling AND-merge / findUnique→findFirst rewrites.
    forbidden: [],
    note: "Scoped-Prisma injector. Don't re-roll where-merge/rewrite; the $extends layer handles it.",
  },

  // ── Shadow harness (scoped-prisma-shadow epic, File #52) ──────────────────
  {
    capability: "compare scoped vs unscoped query result-id sets",
    module: "server/src/lib/prisma-shadow.diff.ts",
    exports: ["diffIds"],
    // The shadow harness's whole verdict rests on ONE comparison. A second
    // hand-rolled id-set diff would let the two sides classify divergence
    // differently — the classify/sink/canary paths would then disagree about what
    // "clean" means. `diffIds` owns the symmetric-difference AND the 20-id cap
    // (§9.3); re-rolling it drops the cap.
    //
    // Guarded on the harness's DISTINCTIVE output shape (`onlyUnscoped` /
    // `onlyScoped`), not on the generic "Set of mapped ids" idiom — the latter is
    // an everyday pattern (payment reconciliation, dedupe) and guarding it would
    // fire on unrelated code. The narrow guard catches a re-rolled shadow diff
    // without policing set arithmetic everywhere.
    forbidden: [
      "onlyUnscoped\\s*[:=]\\s*[^;\\n]*\\.filter\\(",
      "onlyScoped\\s*[:=]\\s*[^;\\n]*\\.filter\\(",
    ],
    note: "Shadow diff SSOT. One comparison, one cap. Don't hand-roll id-set difference for the harness.",
  },
  {
    capability: "carry per-request provenance + route metadata for the shadow sink",
    module: "server/src/lib/request-meta.ts",
    exports: ["getRequestMeta", "runWithRequestMeta"],
    // Same rule as the tenant frame directly above: this is ONE
    // AsyncLocalStorage carrying provenance ('http' vs 'job') and the matched
    // routeHint. A second meta-keyed ALS = a divergent slot the sink reads as
    // empty, which reappears as spurious `no-context`/blank-routeHint rows.
    forbidden: ["new AsyncLocalStorage<[^>]*(?:RequestMeta|[Pp]rovenance)"],
    note: "Request-meta frame SSOT. Opened beside the tenant frame in auth; runUnscoped/job paths omit it deliberately.",
  },
];
