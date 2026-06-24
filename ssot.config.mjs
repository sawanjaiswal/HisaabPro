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
];
