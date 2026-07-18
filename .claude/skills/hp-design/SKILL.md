---
name: hp-design
description: HisaabPro design system — RIGID workflow. MUST activate for ANY UI/page/component work. Deep Emerald Green (#026F39) + Lime-Yellow accent palette, warm cream backgrounds, deep-emerald hero surfaces, premium fintech aesthetic.
---

# HisaabPro Design Workflow

> WORKFLOW, not reference. Follow phases IN ORDER. Skipping = rejection.
> OVERRIDE: If ui-ux-pro-max suggests colors or fonts, IGNORE those.
> HisaabPro tokens are FINAL. Only use external guidance for UX/layout.
>
> **New here? Read `golden-path.md` once** — one feature built Phase 0→4 end to
> end. It is the canonical worked example; pattern-match against it when unsure.

## Phase 0 — INIT (runs on activation)

Do these in parallel, ONCE per session:

1. **Touch the session marker** so pre-tool-gate.sh allows frontend writes:
   ```bash
   touch /Users/sawanjaiswal/Projects/HisaabPro/.claude/design-session-active
   ```
   Without this, writes to `src/(features|components/ui|components/layout|components/feedback|pages|styles)/**/*.{tsx,css}`
   are blocked by `pre-tool-gate.sh → check-design-gate.cjs`. TTL: 240 min.

2. **Load the SSOT** (mandatory, no exceptions):
   - `.claude/design-system.config.cjs` — banned patterns, component registry,
     token prefixes, session gate config (single source imported by the hook)
   - The reference card below (routing tables + token namespaces)

3. **Confirm loaded:** "Config loaded (N banned patterns, M components). Tokens ready."

## Phase 0.5 — INVENTORY SCAN (mandatory, before Phase 1)

**Scan what exists before proposing anything new.** Paste raw output into the
plan file under an `## Inventory` section so the user can audit what you saw:

```bash
ls src/components/ui/ 2>/dev/null                  # reusable primitives
ls src/components/layout/ 2>/dev/null               # layout shells
ls src/components/feedback/ 2>/dev/null             # 4-state building blocks
grep -rnE "variants\s*[:=]|variant:\s*['\"]" src/components/ui/ 2>/dev/null | head -20
find src/features -name '*.tsx' -not -name '*.test.*' 2>/dev/null | head
```

Then grep for near-matches by concept (money display, avatar with badge,
segmented control). If a concept already exists as a component or variant,
**extend it** — do not fork.

## Phase 0.75 — VARIANT-FIRST RULE (mandatory)

Before any Phase-1 row maps to `NONE — justify creation`, the plan MUST answer
in writing for each such row:

> "Did an existing component's variant list cover this with a new variant,
> size, or state? If no: which component in the Phase 0.5 inventory is
> closest, and why is extending it worse than forking?"

Default bias: **extend variants before forking components.** A new
`variant="tenant"` on `Badge` is cheaper, better-tested, and dark-mode-safe
for free. A new `TenantBadge.tsx` duplicates all of that. Only fork when:

- The new component has different semantics (`Dialog` vs `Drawer`)
- Composition is the right call — wrapper lives in `src/features/**/components/`
  and imports the underlying primitive from `@/components/ui/`
- The primitive genuinely does not exist yet — propose in `src/components/ui/`
  with a changelog note in the plan

## Phase 1 — ANALYZE

For each UI element in the task, produce a **COMPONENT MAP**:

| UI Element | Component (from config) | Props/Variant | Notes |
|------------|-------------------------|---------------|-------|
| Submit btn | Button                  | variant="primary", loading | fullWidth |
| Name field | Input                   | icon, error, label |     |
| NEW: X     | NONE — justify creation | —             | Why  |

**Gate:** if >2 items map to NONE, stop and ask if the scope is right.

## Phase 2 — PLAN (mechanically enforced)

Write the plan to `.claude/design-plan-active.md`. The hook `check-design-gate.cjs`
reads it and blocks Phase 3 writes until `status: approved`.

**Step 2a — Write the plan file** with frontmatter:

```markdown
---
status: draft           # set to "approved" ONLY after user confirms
task: [Feature Name]
createdAt: [ISO timestamp]
approvedAt:             # fill when user approves
---

## Checklist: [Feature Name]

Files to create/modify (each ≤ 250 lines):
- [ ] src/features/[name]/[name].types.ts
- [ ] src/features/[name]/[name].constants.ts
- [ ] src/features/[name]/use[Name].ts
- [ ] src/features/[name]/components/[Component].tsx
- [ ] src/features/[name]/[Name].tsx

## Design tokens (specific vars — from the namespace table below)
- Colors: var(--color-primary-500), var(--color-gray-50), …
- Radius: var(--radius-xl) card, --radius-md input, --radius-sm button
- FS: var(--fs-xl), var(--fs-df), var(--fs-sm)
- Z: Z.* (src/config/zIndexes.ts)
- Timing: TIMINGS.* (src/config/timings.ts) or var(--duration-*)

## UI components (from config.COMPONENTS)
- Button (primary, loading) — CTA
- Input — fields
- ConfirmDialog — destructive confirmations
- Badge — status

## Translation keys
- t.[…] via useLanguage() — EN + HI (no hardcoded strings)

## 4 UI states (mandatory)
- Loading: <Skeleton> or animate-pulse block
- Error: <ErrorState message onRetry />
- Empty: <EmptyState title action />
- Success: data render
```

**Step 2b — Gate:** show the checklist to the user. WAIT for "approved" /
"go ahead" / similar. Do NOT assume approval.

**Step 2c — After approval:** rewrite the plan with `status: approved` and
`approvedAt: [ISO now]`. Only then can Phase 3 writes succeed.

TTL on the plan file: 240 min. After that the hook re-blocks UI writes —
scope change or long pause = plan again.

## Phase 3 — BUILD

Follow the checklist mechanically. **Copy skeletons from `page-templates.md`**
(FIELD TEMPLATES, PAGE TEMPLATES, HOOK/SKELETON/BADGE, the Emerald Hero skin) —
do not redesign. Every rule traces to `.claude/design-system.config.cjs`:

- Every color → `var(--color-*)` (see TOKEN NAMESPACES below)
- Every z-index → `Z.*` from `config/zIndexes` or `var(--z-*)`
- Every timing → `TIMINGS.*` or `var(--duration-*)`
- Every string → `t.keyName` via `useLanguage()`
- Every interactive element → component from `config.COMPONENTS` (COMPONENT LOOKUP)
- Every confirmation → `<ConfirmDialog>` (not window.confirm)
- Every toast → `useToast()` (not alert())
- Max 250 lines per file; feature order: types > constants > utils > hook > components > Page

**Banned patterns:** see `config.BANNED_PATTERNS` — each cites its enforcer.
Don't write them. What is / isn't mechanically caught: **ENFORCEMENT MAP** below.

## Phase 4 — VERIFY (falsifiable — a command, not a claim)

Run all three. Each must print its `*_OK` token; a non-baseline failure = not done.

```bash
npx tsc -b --noEmit                                   && echo TSC_OK
node scripts/enforce.js                               && echo ENFORCE_OK
node .claude/skills/hp-design/check-refs.mjs          && echo REFS_OK
```

Then walk the **POST-BUILD CHECKLIST** below — every box ticked, all 4 UI states
present at 320px. If `enforce.js` reports OVERSIZED/errors in files THIS change
did not touch, note them as pre-existing baseline (don't fix silently, don't
claim they're yours). **Done = TSC_OK + ENFORCE_OK + REFS_OK + checklist complete.**

## Session gate (mechanical enforcement)

- Marker: `.claude/design-session-active` (touched by Phase 0, gitignored)
- TTL: 240 min from mtime
- Plan file: `.claude/design-plan-active.md` (status: approved required)
- Gated paths + exemptions: `.claude/design-system.config.cjs → SESSION_GATE`
- Gate script: `.claude/hooks/check-design-gate.cjs`
- Wired via: `~/.claude/hooks/pre-tool-gate.sh`

If Phase 0 is skipped, pre-tool-gate rejects every Write/Edit to a UI file.

---

# HisaabPro Design System — Execution Card

> This card is for **deciding and routing**. Full token *values* live in the
> reference files (single source of truth); full JSX skeletons live in
> `page-templates.md`. Read those on-demand — see DEEP REFERENCE at the bottom.

## PRE-BUILD (mandatory)

- [ ] Run `ls src/components/ui/` — search for existing component before building
- [ ] Confirm all strings use `t.keyName` via `useLanguage()` from `src/context/LanguageContext.tsx` (translations in `src/lib/translations.{en,hi}.ts`)
- [ ] Pick the SCREEN ARCHETYPE, then copy its PAGE TEMPLATE from `page-templates.md`
- [ ] Pick field types from FIELD TEMPLATES (`page-templates.md`) — copy exact JSX per field
- [ ] Confirm colors use CSS variables — no hex, no Tailwind color classes

## COMPONENT LOOKUP (use these — NEVER raw HTML)

| Need | Use | NEVER |
|------|-----|-------|
| **Emerald-hero page shell** | `<HeroPage hero={…}>…</HeroPage>` | Hand-rolled dark-header + white-sheet |
| **Detail stat tiles** (Due/Sales/Paid) | `<SummaryTiles tiles={…}>` | Custom 3-up stat divs |
| Button | `<Button variant="primary\|secondary\|outline\|text\|ghost\|danger">` | `<button>` |
| Input | `<Input>` | `<input>` |
| Card | `<Card>` | `<div>` with bg/border |
| Drawer (bottom sheet) | `<Drawer>` | Custom modal |
| Modal (centered) | `<Modal>` | Custom popup |
| Confirm dialog | `<ConfirmDialog>` | Custom confirmation |
| Badge / status pill / type pill | `<Badge variant="success\|error\|warning\|info\|default">` | Custom pill |
| **Underline tabs** | `.party-detail-tabs` + `.party-detail-tab[.active]` pattern | Custom colored-bg tab bar |
| **List / settings / activity row** | **tinted icon-square row** (see `screen-archetypes.md` → motif + D/H/K) | Plain `<li>`, untinted icon |
| **Filter / status pills** | **segmented chip row** (active=emerald fill; see archetypes → C) | Custom coloured-bg tab bar |
| **Transaction / ledger row** | direction-tinted icon square (see `page-templates.md` → LEDGER ROW) | Plain `<li>` |
| **Data-dense / accounting table** | `<ResponsiveTable density="compact" alwaysTable zebra>` | Hand-rolled `<table>`; cards for tabular data |
| **Any tabular list** | `<ResponsiveTable>` (cards <md, table ≥md) | Hand-rolled `<table>` |
| **Bottom dual-action footer** | 2× `<Button>` (outline + primary) inline row | Fixed bar in feature CSS |
| 4 states | `<Skeleton>` / `<EmptyState>` / `<ErrorState>` / `<Spinner>` | Custom loading/error/empty |
| Toggle | checkbox with toggle CSS | Custom checkbox |
| Avatar | `<PartyAvatar>` or `<Avatar>` | Custom avatar div |
| Accordion | `<Accordion>` | Custom collapsible |
| Error banner | `<ErrorState message={error} />` | Custom error div |
| Offline indicator | `<OfflineBanner>` | Custom offline div |
| Toast | `useToast()` from ToastContainer | `alert()` |
| Feedback | `<FeedbackWidget>` | Custom feedback |
| Scanner | `<BarcodeScanner>` | Custom camera |

## ICON MAP (exact icon per field — no improvising)

| Field type | Icon | Field type | Icon |
|-----------|------|-----------|------|
| Person name | `<User />` | Payment UPI | `<Smartphone />` |
| Phone | `<Phone />` | Invoice | `<FileText />` |
| Amount/Rate | `<IndianRupee />` or `₹` span | Product | `<Package />` |
| Email | `<Mail />` | Stock | `<Warehouse />` |
| Address | `<MapPin />` | Settings | `<Settings />` |
| Search | `<Search />` | Calendar | `<Calendar />` |
| Sort/Filter | `<SlidersHorizontal />` | GST/Tax | `<Receipt />` |
| Add action | `<Plus />` | Barcode | `<Barcode />` |
| Close | `<X />` | Payment cash | `<Wallet />` |

All from `lucide-react`. Sizes: form fields `w-4 h-4`, action buttons `w-5 h-5`,
dialog headers `w-6 h-6`.

## TOKEN NAMESPACES (which prefix — values live in the reference files)

Never write a raw hex, rgb, px, ms, or Tailwind color/size class. Pick the
namespace; open the reference file only when you need the exact value.

| Namespace | Prefix / source | Full values in |
|-----------|-----------------|----------------|
| Colors (palette, status, hero, overlays) | `var(--color-*)`, `var(--text-*)`, `var(--gradient-*)` | `color-system.md` |
| Border radius | `var(--radius-{sm,md,lg,xl,full})` | `spacing-shadows.md` |
| Spacing (8pt grid) | `var(--space-*)`, `px-4` side-padding | `spacing-shadows.md` |
| Shadows / elevation | `var(--shadow-*)` | `spacing-shadows.md` |
| Z-index | `Z.*` (`src/config/zIndexes.ts`) or `var(--z-*)` | `spacing-shadows.md` |
| Type scale / font | `var(--fs-*)`, `var(--font-*)` (all rem) | `typography.md` |
| Motion / easing | `var(--duration-*)`, `var(--ease-*)`, `TIMINGS.*` | `motion.md` |

**High-frequency radius (memorise):** Card `--radius-xl` (20) · Input/toast
`--radius-md` (12) · Button `--radius-sm` (8) · Modal/drawer-top `--radius-lg`
(16) · chip/avatar `--radius-full`.

### Two greens — the rule you break most (full version: `color-system.md`)

The app has a deep **brand emerald** (`--color-primary-*`, #026F39) AND a bright
**success green** (`--color-success-500`, #22C55E). Never mix them:
- **Brand emerald** = identity & primary actions: logo, primary buttons,
  BottomNav active tab/underline/**FAB**, dark hero surfaces, links.
- **Success green** = status only: paid chips, up-deltas, "Good", toast success.
  Never a primary CTA or nav element.
- On the dark emerald hero, accents (up-delta, chart line, sparkline) go bright
  `--color-success-300/400` for contrast — never the dark brand emerald.

### SECTION LAYOUT RULES (mechanically enforced — do not violate)

Every UI section (className matching `-section`, `section-`, or `__section`):
1. **`py-0`** — 0 padding top AND bottom on the section container. `pt-N`/`pb-N`/
   `py-N` (N>0) is a compile-time error. Inner breathing room goes on a child.
2. **Section-group gap = exactly 24px** — parent stacks with `space-y-6` or
   `gap-6` ONLY. Any other value on a section-group container is an error.
3. Horizontal padding (`px-4`) is fine — never vertical.

Vertical rhythm comes from ONE place (the group gap), not each section's `py-*`.
Enforcer: `.claude/design-system.config.cjs` → `section-{top,bottom}-padding-nonzero`,
`section-py-nonzero`, `section-inline-padding-top/bottom`, `section-group-wrong-gap`.

## SCREEN ARCHETYPES (pick one before you build)

The 64-screen design set resolves to a small set of recurring **compositions**.
Identify the archetype, then copy its PAGE TEMPLATE from `page-templates.md`.
Full catalog (skeletons + rules): `screen-archetypes.md`.

| Screen kind | Archetype | Backbone |
|-------------|-----------|----------|
| Sales / Customers / Products / Expenses / any list | **A — List/Index** | search → filter chips (C) → date-grouped tinted rows (D) → totals+sparkline footer (I) |
| Customer/Supplier ledger, Invoice/Payment/Product detail | **B — Entity Detail** | `HeroPage` → identity card → action-icons (E) → `SummaryTiles` → tabs → dual-action footer |
| Success / Error / Empty / Offline / Permission | **F — Full-screen status** | centred illustration → title → sub → primary+secondary |
| Onboarding / Setup / Import / Opening Balance | **G — Multi-step wizard** | step bar + `Step X of Y` → per-step form → Continue/Skip |
| Settings / Business Profile / Security / Subscription | **H — Grouped list** | section-titled tinted rows + chevron/toggle/value |
| Reports Home | **L — Reports hub** | 2-col report cards + Favourites |
| Day book / trial balance / register / GST table / any accounting grid | **O — Data-dense grid** | `<ResponsiveTable density="compact" alwaysTable zebra>` + totals row |
| Dashboard | **Emerald Hero + stages** | staged reveal (Stage 0→3) → Home 2 (shipped) |

> **Two densities, on purpose.** Archetypes A–N are the whitespace-generous
> *consumer* skin (Raju). Archetype **O is the data-dense *accounting* skin**
> (Priya/Amit) — compact rows, columns, `tabular-nums`, totals rows. On archetype-O
> surfaces the `space-y-6` / 44px-row mandates are **relaxed for the grid itself**
> (rows are the content). Never rebuild a data grid from cards — mount
> `<ResponsiveTable>`.

**Signature skin — Emerald Hero:** the default for every primary screen. Mount
`<HeroPage>` (emerald bar + white rounded sheet, recolours `<Header>` for free).
Canonical DONE refs: `DashboardPage` (Home 2) + `PartyDetailPage`. Full diagram +
JSX: `page-templates.md` → PAGE ARCHETYPE. Every archetype rides the same
primitives: emerald `<Header>`, green FAB in the 5-tab BottomNav, warm-cream bg,
white cards, the tinted icon-square motif, 4 UI states, `t.*` strings.

## ENFORCEMENT MAP (what is mechanically caught vs convention)

Know which rules a machine will stop you on, and which rely on you. "Enforced"
= a build/commit fails; "convention" = only this skill + review catch it.

| Rule | Status | Where |
|------|--------|-------|
| Section `py-0` + 24px group gap | **enforced** | `enforce.js` / `design-system.config.cjs` banned patterns |
| No raw `fetch()` in feature code | **enforced** | `scripts/enforce-offline.mjs` (pre-commit) |
| Mutations pass `entityType`+`entityLabel` | **enforced** | `scripts/enforce-offline.mjs` |
| File ≤ 250 lines | **enforced** | `enforce.js` (OVERSIZED) |
| Fixed-bottom / sticky-top outside primitives | **enforced** | `enforce.js` checks 9–12 (PLATFORM_SHELL) |
| `env(safe-area-*)` in feature code | **enforced** | `enforce.js` check 9 |
| tsc types clean | **enforced** | `tsc -b --noEmit` |
| Docs reference live components/tokens | **enforced** | `check-refs.mjs` (this skill) |
| Component used vs raw HTML (`<Button>` not `<button>`) | *convention* | COMPONENT LOOKUP + review |
| Two-greens (brand vs success) | *convention* | this card + `color-system.md` |
| `var(--*)` tokens vs hex/Tailwind color | *partly* | some hex caught by `enforce.js`; palette-class not |
| 4 UI states present | *convention* | POST-BUILD checklist + review |
| `t.*` strings, no hardcoded English | *convention* | review (i18n keys not auto-diffed) |
| Correct radius/icon per element | *convention* | this card |

Convention rules are the ones to double-check by hand — nothing will fail the
build if you get them wrong.

## POST-BUILD CHECKLIST (mandatory)

- [ ] Every color uses `var(--*)` — no hex/rgb/Tailwind color classes
- [ ] Icons from `lucide-react` — correct icon per field type
- [ ] Components used: `<Button>`, `<Input>`, `<Card>`, `<Badge>` — no raw HTML
- [ ] Border radius matches: Card=`--radius-xl`, Input=`--radius-md`, Button=`--radius-sm`, Drawer=`--radius-lg`
- [ ] All 4 UI states: loading skeleton, error+retry, empty+CTA, success
- [ ] All strings use `t.keyName` — no hardcoded English
- [ ] Touch targets >= 44px (`min-h-[44px]`)
- [ ] Page has bottom nav clearance (`pb-[calc(var(--bottom-nav-height)+2rem)]`)
- [ ] Dark mode works via CSS variables (auto-switches via `tokens-dark.css`)
- [ ] Font sizes use `var(--fs-*)` tokens (all rem)
- [ ] Number inputs: `onKeyDown` blocks e/E/+/-, hides native spinners
- [ ] Skeleton uses `animate-pulse` + `var(--color-gray-200)` blocks
- [ ] Amounts displayed with `tabular-nums`; Indian format (Rs 1,00,000) via `Intl.NumberFormat('en-IN')`; paise on the wire
- [ ] Warm cream background on pages (`var(--color-gray-50)`)
- [ ] **Every section container has `py-0`; section-group stacks with `space-y-6`/`gap-6`; inner padding on a CHILD**
- [ ] No raw `fetch()` outside allowlist; if unavoidable, pass `AbortController.signal`
- [ ] No PII in `console.*` / logger calls (phone, email, pin, otp, password)
- [ ] Offline compliance (`.claude/rules/OFFLINE_RULES.md`): `api()` used, mutations pass `entityType`+`entityLabel`, no `localStorage` for entity data, tolerate optimistic `{}` return
- [ ] Variant-first: any new component answers "why not extend an existing variant" in the plan

## DEEP REFERENCE (read on-demand, NOT upfront)

| File | When to read |
|------|-------------|
| `golden-path.md` | **First time / when unsure** — one feature built Phase 0→4 end to end |
| `page-templates.md` | **Building any page** — all FIELD + PAGE + HOOK/SKELETON/BADGE JSX skeletons, the Emerald Hero skin |
| `screen-archetypes.md` | **Choosing a composition** — the 14 recurring screen archetypes (A–O) + the tinted-icon-square motif, from the 64-screen set |
| `component-catalog.md` | Every component's props, usage example, and the decision tree |
| `color-system.md` | Full palette + dark-mode values, status/hero/overlay tints, two-greens rule, data-grid tints |
| `typography.md` | Complete type scale, font pairing rules |
| `spacing-shadows.md` | Full spacing scale, radius, z-index, elevation, density modes |
| `motion.md` | Animation tokens, easing curves, keyframe inventory |
| `brand-guidelines.md` | Logo usage, brand voice, Indian formatting, two-density philosophy |
| `check-refs.mjs` | Freshness guard — run in Phase 4; fails if docs cite a dead component/token |
