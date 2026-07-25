# Per-Page Audit Checklist — hp-design SSOT

Every feature page touched in the responsive sweep (Waves 1-7) MUST pass this
checklist before commit. Source: `.claude/skills/hp-design/SKILL.md` execution
card + project rules (OFFLINE_RULES, PLATFORM_SHELL, PRISMA_MIGRATION_RULES).

Order: A→N. Mechanical enforcers cited where they exist
(`scripts/enforce.js`, ESLint, hooks).

---

## A. Strings & i18n

- [ ] Every user-facing string reads `t.keyName` via `useLanguage()` from `@/hooks/useLanguage`
- [ ] Keys added to BOTH `src/lib/translations.en.ts` AND `src/lib/translations.hi.ts`
- [ ] No hardcoded English/Hindi in JSX
- [ ] No raw template literals — use `t.keyName` helpers
- [ ] App name never hardcoded — `APP_NAME` from `@/config/app.config`

## B. Design tokens (no raw values)

- [ ] Colors: `var(--color-*)` — no hex, no rgb, no `bg-emerald-500`-style palette
- [ ] Radius: `rounded-[var(--radius-*)]` (xl=cards, md=inputs, sm=buttons, lg=modals, full=chips)
- [ ] Font size: `text-[var(--fs-*)]` tokens only
- [ ] Shadows: `var(--shadow-*)` tokens
- [ ] Duration: `var(--duration-*)` or `TIMINGS.*`
- [ ] Easing: `var(--ease-*)`
- [ ] Z-index: `Z.*` from `src/config/zIndexes.ts` — no `z-50` literals

## C. Components (no raw HTML for interactive elements)

- [ ] Buttons → `<Button variant="primary|secondary|outline|text|ghost|danger">`
- [ ] Inputs → `<Input>` (number-with-rupee per FIELD TEMPLATE exception)
- [ ] Cards → `<Card>`
- [ ] Confirms → `<ConfirmDialog>` (NEVER `window.confirm`)
- [ ] Modals → `<Modal>` / `<Drawer>`
- [ ] Badges → `<Badge variant="success|error|warning|info|default">`
- [ ] Avatars → `<PartyAvatar>` / `<Avatar>`
- [ ] Accordions → `<Accordion>`
- [ ] Toasts → `useToast()` (NEVER `alert()`)
- [ ] Scanner → `<BarcodeScanner>`
- [ ] Offline indicator → `<OfflineBanner>`

## D. Inline style discipline

- [ ] No `style={{ color: '#...' }}` literal hex
- [ ] `style={{ … }}` only for CSS variables or dynamic computed values
- [ ] No `className="bg-[#xxxxxx]"` arbitrary hex
- [ ] No Tailwind palette (`text-red-500`) — use semantic var

## E. Layout & spacing

- [ ] Page horizontal padding = `px-4` only (no px-3/px-5/px-6)
- [ ] Section containers: `py-0` (vertical padding on inner child)
- [ ] Section-group parent: `space-y-6` / `gap-6` (24px)
- [ ] Form fields: `space-y-4`
- [ ] Label→input gap: `mb-1.5`
- [ ] Bottom-nav clearance: `pb-[calc(var(--bottom-nav-height)+2rem)]`
- [ ] No `position: fixed; bottom: 0` outside platform-primitive allowlist
- [ ] No `position: sticky|fixed; top: 0` outside allowlist
- [ ] Touch targets ≥ 40px (`min-h-[40px]`) — hardware floor, independent of text size

## F. Responsive (Wave-specific)

- [ ] Page root wrapper is `<PageContainer variant="list|detail|form|dashboard|split">`
- [ ] List pages: grid breakpoints (1/2/3/4 across sm→xl)
- [ ] Forms: `max-w-2xl mx-auto` ≥md
- [ ] No horizontal scroll at 320, 375, 768, 1024, 1280, 1536
- [ ] Tables use `<ResponsiveTable>` (cards <md, table ≥md)
- [ ] Tap targets remain ≥40px on desktop
- [ ] SideNav rail does not overlap content at 1024-1279

## G. 4 UI states (mandatory)

- [ ] Loading: `<Skeleton>` / `<ListSkeleton>` / `animate-pulse`
- [ ] Error: `<ErrorState message onRetry />`
- [ ] Empty: `<EmptyState title action />`
- [ ] Success: data render
- [ ] All four visible at 320px without overflow

## H. Icons

- [ ] All icons from `lucide-react`
- [ ] Sizes: form `w-4 h-4`, action `w-5 h-5`, dialog header `w-6 h-6`
- [ ] Correct icon per field type (User/Phone/IndianRupee/Mail/MapPin/Search/etc.)

## I. Numbers, money, dates

- [ ] Amounts in paise (Int) on the wire; display via `formatCurrency()`
- [ ] Number columns: `tabular-nums`
- [ ] Indian format `Rs 1,00,000` via `Intl.NumberFormat('en-IN')`
- [ ] Number inputs block e/E/+/- on `onKeyDown`
- [ ] Native spinner hidden via `[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none`

## J. Offline (`.claude/rules/OFFLINE_RULES.md`)

- [ ] All API calls via `api()` from `@/lib/api` — no raw `fetch()`
- [ ] Mutations pass `entityType` + `entityLabel`
- [ ] Reads opt into cache only when PII-safe (`cacheReads: true`)
- [ ] No `localStorage` writes for entity data — use Dexie / sessionStorage
- [ ] Mutation handlers tolerate optimistic `{}` return

## K. File discipline

- [ ] Each file ≤ 250 lines
- [ ] 6-layer split: types → constants → utils → hooks → components → page
- [ ] One responsibility per file
- [ ] No PII in `console.*` / logger calls

## L. Accessibility

- [ ] Color contrast ≥ 4.5:1 body text (density scale is fine; **no font below 9px** — `--fs-3xs` is the hard floor)
- [ ] Focus rings visible on every interactive element
- [ ] Icon-only buttons have `aria-label`
- [ ] Inputs have associated `<label>` or `aria-label`
- [ ] Dark mode parity (auto via `tokens-dark.css`)

## M. Theme parity

- [ ] All colors via CSS variables — dark mode automatic
- [ ] No `dark:` Tailwind classes (project uses CSS-var theme swap)
- [ ] Tested in both light and dark modes

## N. Enforcement (must pass before commit)

- [ ] `node scripts/enforce.js` — 0 errors
- [ ] `npx tsc -b --noEmit` — 0 errors
- [ ] No new `eslint-disable` lines
- [ ] No `// TODO` / `// FIXME` left in the diff

---

## Quick reference — components & tokens

See `.claude/skills/hp-design/SKILL.md` execution card for the canonical
COMPONENT LOOKUP table, ICON MAP, TOKEN tables, PAGE TEMPLATES, and FIELD
TEMPLATES. This checklist is the **gate**; the SKILL is the **reference**.
