# HisaabPro — Visual Craft & Token/Layout Consistency Audit

> READ-ONLY audit. Scope: 72 feature areas under `src/`. Goal: "super
> professionally designed, everything super standard and consistent" while
> keeping the intentional identity (Poppins, glow, dark mode). This audits
> CONSISTENCY OF EXECUTION, not the aesthetic.
>
> SSOT: `.claude/skills/hp-design/`. Gate: `scripts/enforce.js`. Per-page
> checklist: `.claude/rules/PAGE_AUDIT_CHECKLIST.md` (A–N).
>
> Date: 2026-05-29. Method: grep/glob breadth across `src/`. Counts exclude
> `*.test.*`.

---

## TL;DR

The app is **far more consistent than raw counts imply**. The headline
numbers (535 raw-hex, 223 palette classes, 204 tailwind-radius, 278
tailwind-text-scale) are dominated by **marketing/landing + PDF/print +
template-config files**, which are intentionally exempt from the token
system (enforce.js `MARKETING_UI` allowlist, line 74/317).

In **real in-app feature UI**, the true violation surface is small and
sharply localized:

- **0** Tailwind palette classes (`bg-emerald-500` etc.) in feature code.
- **2** files with `dark:` classes in feature code (rest are marketing).
- **12** naked-hex occurrences across **4 files** (all e-way-bill / e-invoice
  dialogs).
- **0** ad-hoc empty-states; EmptyState is a single shared component used by
  67 files.
- **0** non-lucide icon imports.

The **single biggest structural gap is enforcement**: `enforce.js` has **no
token-consistency check for `.tsx` feature code**. It only bans raw hex
*inside CSS gradient functions* (Check 8). Every `.tsx` color/spacing/scale
violation today slips through the gate — consistency is held up by
discipline, not mechanically. That is the #1 thing the epic must fix.

---

## Per-category violation counts

Counts are total-codebase; the "real feature" column strips the marketing
allowlist (`features/landing/`, `components/ui/`, `components/magicui/`) and
the print/config families (`/pdf/`, `/receipt/`, `/voucher/`, `*Document*`,
`*PDF*`, `templates/*.configs.ts`, `*.constants.ts`).

| Category | Total | In marketing/print/config (exempt-ish) | In real feature UI | enforce.js catches? |
|---|---:|---:|---:|:--|
| Raw hex `#abc` / `#aabbcc` (tsx+ts) | 535 (236 files) | ~342 | ~186 files, but most are `var(--token, #fallback)` | NO (only in CSS gradients) |
| → **naked hex** (no `var()` fallback) in feature tsx | — | — | **12 (4 files)** | NO |
| `rgb()/rgba()` (tsx+ts) | 46 | ~38 (bento/pricing/landing) | ~8 (marketing pages) | NO |
| Tailwind palette `bg-/text-/border-…-NNN` | 223 (23 files) | **223** | **0** | partial (marketing exempt anyway) |
| Arbitrary hex `bg-[#…]` | 6 | most | few | NO |
| `dark:` classes | 40 (8 files) | 38 | **2 files** | NO |
| `z-50`/`z-[N]` literals (should be `Z.*`) | 39 | most | **1 file** (`ResponsiveTable.tsx`) | NO |
| Tailwind text scale `text-xs…5xl` (not `--fs-*`) | 278 | bulk in `components/ui/*` | moderate | NO |
| Raw `text-[NNpx]` font size | 0 | 0 | 0 | n/a (clean) |
| Tailwind `rounded-sm…full` (not `--radius-*`) | 204 | bulk marketing | moderate | NO |
| `rounded-[NNpx]` literal | 6 | — | few | NO |
| `shadow-sm…2xl` (not `--shadow-*`) | 28 | bulk marketing | few | NO |
| Page padding `px-3/px-5/px-6` (should be `px-4`) | 93 | bulk landing | ~15 real-feature lines | NO |
| `window.confirm` / `alert()` (banned) | 2 | 0 | **2** (1 real: `RecurringActionMenu.tsx`) | NO |
| Non-lucide icon imports | 0 | 0 | 0 | n/a (clean) |

### Worst-offender files

**Tailwind palette classes** (ALL marketing — acceptable per allowlist, but
should be visually consistent with the brand):
- `features/landing/components/LandingHero.tsx` (32)
- `features/landing/components/LandingPricing.tsx` (19)
- `features/landing/components/LandingComparison.tsx` (19)
- `components/ui/bento-grid.tsx` (18)
- `features/landing/components/PhoneMockup.tsx` (17)

**Raw hex** (mostly print/config — acceptable; PDFs need literal colors):
- `features/templates/template-gallery-modern.configs.ts` (72)
- `features/templates/template-gallery-industry.configs.ts` (72)
- `features/smart-greetings/smart-greetings.constants.ts` (27)
- `features/invoices/pdf/InvoicePdfDocument.tsx` (20)
- `features/payments/voucher/PaymentVoucherDocument.tsx` (18)

**Naked hex in REAL feature UI** (TRUE violations — MUST_FIX):
- `features/e-way-bill/EWayBillModal.tsx` (5) — `color:'#dc2626'`, `background:'#f9fafb'`, `borderRadius:'8px'`, inline `fontSize`
- `features/e-way-bill/EWayBillUpdatePartBDialog.tsx` (3)
- `features/e-way-bill/EWayBillCard.tsx` (2) — status pills `#dc2626/#fef2f2`, `#16a34a/#f0fdf4`
- `features/e-invoice/EInvoiceCard.tsx` (2) — same status-pill pattern

**Tailwind text scale** (marketing-heavy):
- `components/ui/invoice-templates-section-modal.tsx` (31)
- `components/ui/saa-s-template.tsx` (16)
- `components/ui/before-after-section.tsx` (15)

**`dark:` in real feature code:**
- `context/ThemeContext.tsx` (legitimate — theme machinery)
- `features/import/components/CommitBlockedBanner.tsx` (TRUE deviation — should use CSS-var theme swap)

**`px-3/5/6` real-feature deviations:**
- `features/settings/components/DocumentCustomFieldDrawer.tsx` (3)
- `features/hr/components/PayrollWizardStepDates.tsx` (3)
- `features/subscription/TierComparisonCard.tsx` (2)
- `features/invoices/components/ConvertDocumentDrawer.tsx` (1)

---

## 2. Spacing / layout consistency

- **`<PageContainer>` adoption is strong**: 151 feature `.tsx` files reference
  it. No widespread bare page shells found in real feature code.
- **Page horizontal padding is mostly clean** — `px-4` is the norm; the ~15
  real-feature `px-3/5/6` lines are inside drawers/wizard steps, not page
  roots. Marketing/landing carries the bulk of `px-3/5/6` (intentional).
- Check 7 in enforce.js already gates section `padding=0` + section-group
  `gap=24px`, so section spacing is mechanically protected.
- **Gap:** padding consistency for drawers/modals is NOT gated and drifts
  (px-3 vs px-4 vs px-5). The hp-design "px-4 only" rule applies to page
  bodies; drawer internal padding has no documented token, so authors guess.

## 3. Typography consistency

- Token scale (`text-[var(--fs-*)]`) exists in the SSOT but is **inconsistently
  applied**. Real feature code mixes `text-[var(--fs-*)]` with tailwind
  `text-sm/base/lg` (278 tailwind-scale occurrences overall) and with inline
  `style={{ fontSize: '0.8125rem' }}` (seen across all e-way-bill/e-invoice
  dialogs). Three competing type-size mechanisms = the biggest *typography*
  inconsistency, even though no single file is egregious.
- Headings/labels/body are visually consistent because most flow through
  shared `<Button>`, `<Input>`, `<Card>`, `<Badge>` — but free-form text in
  dialogs/cards routinely hardcodes `fontSize`.

## 4. Four UI states consistency

Shared primitives exist and are widely used: `EmptyState` (71 files),
`ErrorState` (130 files), `Skeleton`/`animate-pulse` (146 files).

But coverage is **uneven across the 72 areas**. Feature dirs with **no
EmptyState at all** (39 areas) include data-bearing list features that
should have one — e.g. `inventory`, `expenses`, `price-lists`,
`items-library`, `shared-ledger`, `other-income`, `loans`, `recurring`,
`cheques`, `bank-accounts`, `production-runs`, `bom`. (Some are legitimately
form/wizard-only: `auth`, `onboarding`, `pin-gate`, `checkout`, `voice`,
`pos`.)

Feature dirs with **no ErrorState** (27 areas) include `inventory`,
`price-lists`, `items-library`, `e-invoice`, `e-way-bill`, `bom`,
`production-runs`, `pos`, `storefront`.

**Conclusion:** the *components* are standard; the *application* of all-four-
states is partial. No mechanical check enforces "every list page renders
loading+error+empty+success", so coverage depends on the author.

## 5. Dark-mode parity

- Project uses CSS-var theme swap (`tokens-dark.css`), so `dark:` is a
  deviation. Only **2 real-feature files** use `dark:`
  (`CommitBlockedBanner.tsx` is the true offender; `ThemeContext.tsx` is
  machinery). Rest (38) are marketing/landing.
- **Theme-break risk = naked hex.** The 12 naked-hex occurrences in
  e-way-bill / e-invoice (`#dc2626`, `#f9fafb`, `#16a34a`, `#fef2f2`) will
  NOT theme-swap — those status pills/error text stay light-mode colors in
  dark mode. This is the concrete dark-mode parity bug.
- The `var(--token, #fallback)` pattern (bulk of the 186 "hex" files) DOES
  theme-swap correctly (token wins; fallback only fires if the var is
  missing). Acceptable, though fallbacks should ideally reference a base hex
  that matches the light token.

## 6. Empty-state & icon quality/consistency

- **EmptyState: consistent.** Single shared `components/feedback/EmptyState.tsx`
  used by 67 files. Only 3 bespoke wrappers exist
  (`DocumentEmptyState`, `JobsEmptyState`, `CustomOrdersEmptyState`) — these
  likely wrap the shared one with feature copy; verify they don't reimplement
  layout. **0 ad-hoc inline empty states** found.
- **Icons: clean.** 0 non-lucide imports (`react-icons`/`heroicons`/`mui`/
  `phosphor`/`tabler` all absent). Icon sizing not mechanically checked, but
  source is uniform.

## 7. Responsive consistency

- Breakpoints used are the standard tailwind set (`sm/md/lg/xl/2xl`) — no
  arbitrary `min-[NNNpx]:` breakpoints found in feature code. Spread is even;
  no single file over-customizes.
- `ResponsiveTable` primitive exists and is used; tables aren't hand-rolled.
- No 320/375/768/1024 overflow could be verified statically (would need
  browser), but the absence of ad-hoc breakpoints + PageContainer adoption is
  a good structural signal.

---

## Tiered fix list

### MUST_FIX (true violations breaking consistency / dark-mode)
1. **Naked hex in 4 dialog files** (e-way-bill ×3, e-invoice ×1) → replace
   `#dc2626/#16a34a/#f9fafb/#fef2f2/#f0fdf4` with `var(--color-danger/…)`
   tokens and the status-pill pattern with `<Badge variant>`. Fixes dark-mode
   parity. (12 occurrences.)
2. **Inline `fontSize` in those same dialogs** → use `text-[var(--fs-*)]` /
   `<Badge>` / typography components. Removes the 3rd competing type
   mechanism in the worst files.
3. **`dark:` in `CommitBlockedBanner.tsx`** → convert to CSS-var theme swap.
4. **`window.confirm` in `RecurringActionMenu.tsx`** → `<ConfirmDialog>`
   (checklist C, also a hp-design rule).
5. **`z-[…]` literal in `ResponsiveTable.tsx`** → `Z.*` from
   `config/zIndexes.ts`.

### SHOULD_FIX (drift that erodes "super standard" feel)
6. Sweep real-feature `var(--token, #hex)` fallbacks → confirm each fallback
   matches its light token (defense-in-depth; harmless today but a trap).
7. Standardize drawer/modal internal padding → add a documented token; fix
   the ~15 `px-3/5/6` real-feature lines (DocumentCustomFieldDrawer,
   PayrollWizardStepDates, TierComparisonCard, ConvertDocumentDrawer).
8. **Backfill 4 UI states** for data-list feature areas missing EmptyState/
   ErrorState (inventory, expenses, price-lists, items-library,
   shared-ledger, loans, cheques, bank-accounts, recurring, bom,
   production-runs, other-income). Use shared `EmptyState`/`ErrorState`.
9. Converge the type scale: pick `text-[var(--fs-*)]` as the single
   mechanism in feature code; migrate stray `text-sm/base/lg` and inline
   `fontSize`.

### FUTURE (marketing / print — intentionally exempt, polish later)
10. Marketing/landing palette + radius + shadow consistency pass (visual, not
    token) — ensure LandingHero/Pricing/Comparison share one mini-scale.
11. PDF/receipt/voucher hex is fine (print needs literals) — leave, but
    centralize the brand colors into one `pdf-theme.ts` constant so all
    documents stay in sync.

---

## Standardization checklist the epic should enforce APP-WIDE

The components and tokens already exist; the missing layer is **mechanical
enforcement on `.tsx` feature code**. Add these enforce.js checks (each is a
0-token grep gate, ratcheted so legacy doesn't block but new code can't
regress):

- [ ] **CHECK: no naked hex in feature `.tsx`** — ban `#[0-9a-f]{3,6}` in
      `src/features/**` *except* when immediately inside `var(--…, #…)`,
      `/pdf/`, `/receipt/`, `/voucher/`, `*Document*`, `*PDF*`, `*.configs.ts`,
      `theme*`. (Marketing allowlist already exists — reuse it.)
- [ ] **CHECK: no `dark:` classes outside `context/ThemeContext.tsx`** and the
      marketing allowlist (project uses CSS-var swap).
- [ ] **CHECK: no Tailwind palette classes** (`(bg|text|border|ring)-(red|…|stone)-\d{2,3}`)
      in feature code (already 0 — lock it in so it stays 0).
- [ ] **CHECK: no `z-50`/`z-\[…\]` literals** outside `config/zIndexes.ts`; use `Z.*`.
- [ ] **CHECK: no `window.confirm`/`alert(`** in feature code; use
      `<ConfirmDialog>`/`useToast()`.
- [ ] **CHECK (ratchet): no new inline `style={{ fontSize / color: '#…' }}`** —
      push to `text-[var(--fs-*)]` and color tokens.
- [ ] **CHECK (ratchet): page horizontal padding = `px-4`** on PageContainer
      children; flag new `px-3/5/6`.
- [ ] **LINT (report-only first): list-page 4-UI-state coverage** — flag any
      feature page that calls a list query but imports neither `EmptyState`
      nor `ErrorState`.
- [ ] Keep the existing marketing/print allowlist as the single SSOT for what
      is exempt — document it in hp-design so authors know the boundary.
- [ ] One documented **drawer/modal padding token** so internal padding stops
      drifting.
- [ ] Add an `icon-size` lint (lucide sizes `w-4/5/6`) — low priority, source
      is already uniform.

Net: identity untouched (Poppins/glow/dark-mode stay). The epic's job is
(a) clean ~20 true violations in ~7 files, (b) backfill 4-UI-states in ~12
list areas, and (c) convert today's discipline into ~7 mechanical gates so
the "super standard" property is enforced, not hoped for.
