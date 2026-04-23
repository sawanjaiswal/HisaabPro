---
name: hp-design
description: HisaabPro design system — RIGID workflow. MUST activate for ANY UI/page/component work. Deep Teal + Lime-Yellow palette, warm cream backgrounds, NexoWallet-inspired premium aesthetic.
---

# HisaabPro Design Workflow

> WORKFLOW, not reference. Follow phases IN ORDER. Skipping = rejection.
> OVERRIDE: If ui-ux-pro-max suggests colors or fonts, IGNORE those.
> HisaabPro tokens are FINAL. Only use external guidance for UX/layout.

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
   - The reference card below (tokens, templates, components)

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

## Design tokens (specific vars — from reference card)
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

Follow the checklist mechanically using the reference card below. Every rule
traces to `.claude/design-system.config.cjs`:

- Every color → `var(--color-*)` (see TOKEN_NAMESPACES.cssVarPrefixes)
- Every z-index → `Z.*` from `config/zIndexes` or `var(--z-*)`
- Every timing → `TIMINGS.*` or `var(--duration-*)`
- Every string → `t.keyName` via `useLanguage()`
- Every interactive element → component from `config.COMPONENTS`
- Every confirmation → `<ConfirmDialog>` (not window.confirm)
- Every toast → `useToast()` (not alert())
- Max 250 lines per file; feature order: types > constants > utils > hook > components > Page

**Banned patterns:** see `config.BANNED_PATTERNS` — each cites its enforcer.
Don't write them.

## Phase 4 — VERIFY

After all files built:

1. `node scripts/enforce.js` (or the project's standard enforcement command)
2. Walk the checklist — every box ticked, all 4 UI states present.
3. If errors → fix → re-run until 0.

**Done =** 0 enforce errors + checklist complete.

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

## PRE-BUILD (mandatory)

- [ ] Run `ls src/components/ui/` — search for existing component before building
- [ ] Confirm all strings use `t.keyName` via `useLanguage()` from `src/context/LanguageContext.tsx` (translations in `src/lib/translations.{en,hi}.ts`)
- [ ] Pick the correct PAGE TEMPLATE below — copy skeleton, fill in fields
- [ ] Pick field types from FIELD TEMPLATES — copy exact JSX per field
- [ ] Confirm colors use CSS variables from `tokens-colors.css` — no hex, no Tailwind color classes

## COMPONENT LOOKUP (use these — NEVER raw HTML)

| Need | Use | NEVER |
|------|-----|-------|
| Button | `<Button variant="primary\|secondary\|outline\|text\|ghost\|danger">` | `<button>` |
| Input | `<Input>` | `<input>` |
| Card | `<Card>` | `<div>` with bg/border |
| Drawer (bottom sheet) | `<Drawer>` | Custom modal |
| Modal (centered) | `<Modal>` | Custom popup |
| Confirm dialog | `<ConfirmDialog>` | Custom confirmation |
| Badge | `<Badge variant="success\|error\|warning\|info\|default">` | Custom pill |
| 4 states | `<Skeleton>` / `<EmptyState>` / `<ErrorState>` / `<Spinner>` | Custom loading/error/empty |
| Toggle | checkbox with toggle CSS | Custom checkbox |
| Avatar | `<PartyAvatar>` or `<avatar>` | Custom avatar div |
| Accordion | `<accordion>` | Custom collapsible |
| Error banner | `<ErrorState message={error} />` | Custom error div |
| Offline indicator | `<OfflineBanner>` | Custom offline div |
| Toast | `useToast()` from ToastContainer | `alert()` |
| Feedback | `<FeedbackWidget>` | Custom feedback |
| Scanner | `<BarcodeScanner>` | Custom camera |

## ICON MAP (exact icon per field — no improvising)

| Field type | Icon | Import |
|-----------|------|--------|
| Person name | `<User className="w-4 h-4" />` | `lucide-react` |
| Phone | `<Phone className="w-4 h-4" />` | `lucide-react` |
| Amount/Rate | `<IndianRupee className="w-4 h-4" />` or `₹` prefix span | `lucide-react` |
| Email | `<Mail className="w-4 h-4" />` | `lucide-react` |
| Address | `<MapPin className="w-4 h-4" />` | `lucide-react` |
| Search | `<Search className="w-4 h-4" />` | `lucide-react` |
| Sort/Filter | `<SlidersHorizontal className="w-4 h-4" />` | `lucide-react` |
| Add action | `<Plus className="w-4 h-4" />` | `lucide-react` |
| Close | `<X className="w-5 h-5" />` | `lucide-react` |
| Payment cash | `<Wallet className="w-4 h-4" />` | `lucide-react` |
| Payment UPI | `<Smartphone className="w-4 h-4" />` | `lucide-react` |
| Invoice | `<FileText className="w-4 h-4" />` | `lucide-react` |
| Product | `<Package className="w-4 h-4" />` | `lucide-react` |
| Stock | `<Warehouse className="w-4 h-4" />` | `lucide-react` |
| Settings | `<Settings className="w-4 h-4" />` | `lucide-react` |
| Calendar | `<Calendar className="w-4 h-4" />` | `lucide-react` |
| GST/Tax | `<Receipt className="w-4 h-4" />` | `lucide-react` |
| Barcode | `<Barcode className="w-4 h-4" />` | `lucide-react` |

Icon sizes: form fields = `w-4 h-4`, action buttons = `w-5 h-5`, dialog headers = `w-6 h-6`.

## TOKENS (CSS variables only — no hex, no Tailwind color classes)

### Colors
| Purpose | Token |
|---------|-------|
| Primary brand | `var(--color-primary-500)` (#0B4F5E deep teal) |
| Primary CTA bg | `var(--color-primary-600)` (#052D35) |
| Primary CTA hover | `var(--color-primary-700)` (#042329) |
| Primary light tint | `var(--color-primary-100)` (#DAEBEA) |
| Accent (lime) | `var(--color-secondary-300)` (#E0EA49) |
| Accent CTA text | `var(--color-primary-700)` (dark on lime) |
| Page bg (warm cream) | `var(--color-gray-50)` (#F8F7F4) |
| Card bg | `var(--color-gray-0)` (#FFFFFF) |
| Card border | `var(--color-gray-100)` (#F0EFEB) |
| Input bg | `var(--color-gray-0)` |
| Input border | `var(--color-gray-200)` (#E2E0DA) |
| Input focus ring | `var(--color-primary-400)` (#0A6375) |
| Primary text | `var(--text-primary)` → `var(--color-gray-800)` (#2A2824) |
| Secondary text | `var(--text-secondary)` → `var(--color-gray-600)` (#5A584F) |
| Muted text | `var(--text-muted)` → `var(--color-gray-400)` (#9C9A92) |
| Inverse text | `var(--text-inverse)` → `var(--color-white-inverse)` (#FFF) |
| Error | `var(--color-error-500)` (#EF4444) |
| Error bg | `var(--color-error-50)` (#FEF2F2) |
| Success | `var(--color-success-500)` (#22C55E) |
| Success bg | `var(--color-success-50)` (#ECFDF5) |
| Warning | `var(--color-warning-500)` (#F59E0B) |
| Warning bg | `var(--color-warning-50)` (#FFFBEB) |
| Info | `var(--color-info-500)` (#3B82F6) |
| WhatsApp | `var(--color-whatsapp)` (#25D366) |
| Lime accent | `var(--color-lime-accent)` (#cfdf2e) |

### Gradients (hero cards)
| Purpose | Start → End |
|---------|------------|
| Teal (collected/received) | `var(--gradient-teal-start)` → `var(--gradient-teal-end)` |
| Coral (due/overdue) | `var(--gradient-coral-start)` → `var(--gradient-coral-end)` |
| Amber (low stock) | `var(--gradient-amber-start)` → `var(--gradient-amber-end)` |
| Warm cream page | `var(--color-cream-start)` → `var(--color-cream-mid)` → `var(--color-cream-end)` |

### Border Radius
| Element | CSS class | Value | NEVER |
|---------|-----------|-------|-------|
| Cards | `rounded-[var(--radius-xl)]` | 20px | `rounded-lg` |
| Inputs | `rounded-[var(--radius-md)]` | 12px | `rounded-md` |
| Buttons | `rounded-[var(--radius-sm)]` | 8px | `rounded-full` |
| Drawers (top) | `rounded-t-[var(--radius-lg)]` | 16px top | `rounded-t-md` |
| Modals | `rounded-[var(--radius-lg)]` | 16px | `rounded-md` |
| Chips/badges | `rounded-full` | pill | `rounded-lg` |
| Avatars | `rounded-full` | circle | anything else |

### Typography
| Element | Classes |
|---------|---------|
| Page title (list) | `text-[var(--fs-2xl)] font-bold` + `var(--text-primary)` |
| Page title (form) | `text-[var(--fs-xl)] font-semibold` + `var(--text-primary)` |
| Section title | `text-[var(--fs-lg)] font-semibold` + `var(--text-primary)` |
| Subtitle / desc | `text-[var(--fs-sm)]` + `var(--text-secondary)` |
| Label above input | `block text-[var(--fs-sm)] font-medium` + `var(--text-secondary)` |
| Row item name | `text-[var(--fs-df)] font-semibold leading-tight truncate` + `var(--text-primary)` |
| Row subtitle | `text-[var(--fs-xs)] mt-0.5` + `var(--text-muted)` |
| Hero amount | `text-[var(--fs-5xl)] font-bold tabular-nums` |
| Inline error | `mt-1 text-[var(--fs-xs)]` + `var(--color-error-500)` |
| Helper text | `mt-1 text-[var(--fs-xs)]` + `var(--text-muted)` |
| Body default | `text-[var(--fs-df)]` (15px) + `var(--text-primary)` |
| Caption | `text-[var(--fs-xs)]` (12px) + `var(--text-muted)` |
| Button text | `text-[var(--fs-base)] font-semibold` |

Font family: `var(--font-primary)` = Inter. `var(--font-display)` = Inter. `var(--font-mono)` = JetBrains Mono.
All font sizes MUST use rem via `var(--fs-*)`. Hero sizes use `var(--fs-5xl)` or `var(--fs-6xl)`.

### Spacing
| Use | Tailwind |
|-----|----------|
| Page horizontal | `px-4` (16px = `var(--side-padding)`) |
| Form wrapper | `px-4 py-6 max-w-md mx-auto` |
| Form fields gap | `space-y-4` |
| Label to input gap | `mb-1.5` |
| Title block to form | `mb-6` |
| Submit button | `mt-6` on Button |
| Cancel link | `mt-4 text-center` |
| List header | `px-4 pt-4 pb-2` |
| List content | `px-4 py-4` |
| Card grid gap | `gap-3` |
| **Section container vertical padding** | **`py-0` (0px top AND bottom — mandatory)** |
| **Section group gap** | **`space-y-6` or `gap-6` (24px = `var(--space-6)`) — mandatory between section siblings** |
| Section horizontal padding | `px-4` (inherits side padding) |
| Section internal padding | Move to INNER child (`<div className="py-4">…</div>`), not the section wrapper |
| Bottom nav clearance | `pb-[calc(var(--bottom-nav-height)+2rem)]` |

### SECTION LAYOUT RULES (mechanically enforced)

Every UI section (a div/frame identified by a className matching `-section`,
`section-`, or `__section`) MUST obey:

1. **padding-top: 0** and **padding-bottom: 0** on the section container.
   - `py-0` is required. `pt-N`/`pb-N`/`py-N` where N > 0 is a compile-time error.
   - If you need inner breathing room, add an inner child with its own padding.
2. **Gap between sections: exactly 24px** (= `var(--space-6)`).
   - Parent that stacks sections uses `space-y-6` or `gap-6` ONLY. Other values
     on a section-group container are a compile-time error.
3. Horizontal padding on the section is fine (`px-4`), just never vertical.

Why: consistent vertical rhythm comes from ONE place (the section-group gap),
not from each section adding its own `py-*` which compounds unpredictably.
Sections that own their own vertical padding fight the grid.

Enforcer: `.claude/design-system.config.cjs` → banned patterns
`section-top-padding-nonzero`, `section-bottom-padding-nonzero`,
`section-py-nonzero`, `section-inline-padding-top/bottom`,
`section-group-wrong-gap`.

### Shadows
| Element | Token |
|---------|-------|
| Card (default) | `var(--shadow-card)` |
| Card (hover) | `var(--shadow-card-hover)` |
| Modal | `var(--shadow-modal)` |
| FAB (teal) | `var(--shadow-fab)` |
| FAB (lime) | `var(--shadow-fab-lime)` |
| Drawer | `var(--shadow-drawer-bottom)` |
| Dropdown | `var(--shadow-dropdown)` |
| Subtle | `var(--shadow-subtle)` |
| Header glass | frosted: `backdrop-filter: blur(16px)` + `var(--header-glass-bg)` |

### Motion
| Duration | Token | Usage |
|----------|-------|-------|
| 100ms | `var(--duration-fast)` | Button press, toggle |
| 200ms | `var(--duration-normal)` | Standard transitions |
| 300ms | `var(--duration-slow)` | Page transitions, modals |
| Easing | `var(--ease-default)` | Standard (Material) |
| Spring | `var(--ease-spring)` | Bounce (toasts, success) |

### Z-Index
| Layer | Value | Usage |
|-------|-------|-------|
| Sticky | `var(--z-sticky)` = 20 | Headers, sticky rows |
| Overlay | `var(--z-overlay)` = 40 | Backdrops |
| Modal | `var(--z-modal)` = 50 | Modals, drawers |
| Toast | `var(--z-toast)` = 70 | Toast notifications |

---

## FIELD TEMPLATES (copy per field type — don't invent)

### Name Field
```tsx
<div>
  <div className="flex items-center gap-1.5 mb-1.5">
    <label className="block text-[var(--fs-sm)] font-medium" style={{ color: 'var(--text-secondary)' }}>
      {t.customerName}
    </label>
  </div>
  <Input type="text" maxLength={100}
    placeholder={t.customerName} value={name} onChange={handleNameChange}
    error={nameError} disabled={loading} />
</div>
```

### Phone Field
```tsx
<div>
  <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
    {t.phoneNumber}
  </label>
  <Input type="text" inputMode="numeric" maxLength={10}
    placeholder={t.phoneNumber} value={phone}
    onChange={(e) => { const f = e.target.value.replace(/\D/g, ''); setPhone(f); }}
    error={phoneError} disabled={loading} />
</div>
```

### Amount Field (rupee prefix)
```tsx
<div>
  <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
    {t.amount}
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-[var(--fs-sm)]"
          style={{ color: 'var(--text-secondary)' }}>₹</span>
    <input type="number" step="0.01" min="0" placeholder="0.00"
      value={amount} onChange={(e) => setAmount(e.target.value)}
      onKeyDown={(e) => { if (['e','E','+','-'].includes(e.key)) e.preventDefault(); }}
      className="w-full pl-8 pr-3 py-3 border rounded-[var(--radius-md)] focus:outline-none focus:ring-2 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      style={{ backgroundColor: 'var(--color-gray-0)', borderColor: 'var(--color-gray-200)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--color-primary-400)' } as React.CSSProperties} />
  </div>
</div>
```

### Select (grid buttons)
```tsx
<div>
  <label className="block text-[var(--fs-sm)] font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
    {t.paymentMode}
  </label>
  <div className="grid grid-cols-2 gap-2">
    {options.map(({ value, icon: Icon, label }) => (
      <button key={value} type="button" onClick={() => setSelected(value)}
        className="flex items-center gap-2 px-3 py-2.5 border rounded-[var(--radius-sm)] transition-all min-h-[44px]"
        style={{
          borderColor: selected === value ? 'var(--color-primary-500)' : 'var(--color-gray-200)',
          backgroundColor: selected === value ? 'var(--color-primary-bg-subtle)' : 'var(--color-gray-0)',
          color: selected === value ? 'var(--color-primary-500)' : 'var(--text-primary)',
        }}>
        <Icon className="w-4 h-4" />
        <span className="text-[var(--fs-sm)] font-medium">{label}</span>
      </button>
    ))}
  </div>
</div>
```

### Section Grouping Rule
- Max 4 fields per section. 5+ fields -> split into named sections
- Section divider: `mb-6` gap + section label
- Section label: `<p className="text-[var(--fs-xs)] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>{t.sectionName}</p>`
- Rate cards: wrap in `<div className="p-4 rounded-[var(--radius-md)] space-y-3" style={{ backgroundColor: 'var(--color-gray-50)', border: '1px solid var(--color-gray-200)' }}>`

---

## PAGE TEMPLATES (copy skeleton — don't redesign)

### FORM PAGE
```tsx
<div className="min-h-screen" style={{ backgroundColor: 'var(--color-gray-50)' }}>
  <div className="px-4 py-6 max-w-md mx-auto">
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-[var(--fs-xl)] font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}>{t.pageTitle}</h2>
        <p className="text-[var(--fs-sm)]" style={{ color: 'var(--text-secondary)' }}>{t.pageSubtitle}</p>
      </div>
    </div>
    {error && <ErrorState message={error} />}
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Paste field templates here */}
      <Button type="submit" loading={loading} disabled={!isValid || loading} className="w-full mt-6">
        {loading ? t.saving : t.save}
      </Button>
    </form>
    <div className="mt-4 text-center">
      <button type="button" onClick={() => navigate(-1)}
              className="text-[var(--fs-sm)] hover:underline" style={{ color: 'var(--text-secondary)' }}>
        {t.cancel}
      </button>
    </div>
  </div>
</div>
```

### LIST PAGE
```tsx
<div className="min-h-screen pb-[calc(var(--bottom-nav-height)+2rem)]" style={{ backgroundColor: 'var(--color-gray-50)' }}>
  <div className="border-b" style={{ backgroundColor: 'var(--color-gray-0)', borderColor: 'var(--color-gray-100)' }}>
    <div className="px-4 pt-4 pb-2">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-[var(--fs-2xl)] font-bold" style={{ color: 'var(--text-primary)' }}>{t.title}</h1>
          <p className="text-[var(--fs-xs)] mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t.subtitle}</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>{t.add}</Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input placeholder={t.search} icon={<Search className="w-4 h-4" />}
                 value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button type="button" className="flex items-center gap-1.5 px-3 py-2.5 border rounded-[var(--radius-sm)] text-[var(--fs-sm)] min-h-[44px]"
                style={{ borderColor: 'var(--color-gray-200)', color: 'var(--text-secondary)' }}>
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    </div>
  </div>
  <div className="px-4 py-4">
    {loading ? <ListSkeleton /> : error ? <ErrorState message={error} onRetry={refetch} /> :
     !data?.length ? <EmptyState title={t.noItemsYet} action={t.addFirst} /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.map(item => <ItemCard key={item.id} item={item} />)}
      </div>
    )}
  </div>
</div>
```

### LIST ROW ITEM
```tsx
<button type="button" className="w-full px-4 py-3.5 text-left border-b"
  style={{ borderColor: 'var(--color-gray-100)' }} onClick={() => onSelect(item)}>
  <div className="flex items-center gap-3">
    <PartyAvatar name={item.name} size="sm" />
    <div className="flex-1 min-w-0">
      <p className="text-[var(--fs-df)] font-semibold leading-tight truncate"
         style={{ color: 'var(--text-primary)' }}>{item.name}</p>
      <p className="text-[var(--fs-xs)] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.subtitle}</p>
    </div>
    <div className="text-right flex-shrink-0">{/* Amount or badge */}</div>
  </div>
</button>
```

### DETAIL PAGE
```tsx
<div className="min-h-screen pb-[calc(var(--bottom-nav-height)+2rem)]" style={{ backgroundColor: 'var(--color-gray-50)' }}>
  {/* Hero section with gradient */}
  <div className="px-4 py-6" style={{ background: 'linear-gradient(135deg, var(--gradient-teal-start), var(--gradient-teal-end))' }}>
    <h1 className="text-[var(--fs-2xl)] font-bold" style={{ color: 'var(--text-inverse)' }}>{item.name}</h1>
    <p className="text-[var(--fs-5xl)] font-bold tabular-nums mt-2" style={{ color: 'var(--text-inverse)' }}>
      {formatCurrency(item.amount)}
    </p>
  </div>
  {/* Content cards */}
  <div className="px-4 -mt-4 space-y-4">
    <Card className="p-4">{/* details */}</Card>
  </div>
</div>
```

### SETTINGS PAGE
```tsx
<div className="min-h-screen pb-[calc(var(--bottom-nav-height)+2rem)]" style={{ backgroundColor: 'var(--color-gray-50)' }}>
  <div className="border-b" style={{ backgroundColor: 'var(--color-gray-0)', borderColor: 'var(--color-gray-100)' }}>
    <div className="px-4 py-3">
      <h1 className="text-[var(--fs-2xl)] font-bold" style={{ color: 'var(--text-primary)' }}>{t.settings}</h1>
    </div>
  </div>
  <div className="px-4 space-y-4 pt-4 pb-6">{/* Settings sections */}</div>
</div>
```

### DASHBOARD CARD (hero summary)
```tsx
<div className="rounded-[var(--radius-xl)] p-5 relative overflow-hidden"
     style={{ background: 'linear-gradient(135deg, var(--gradient-teal-start), var(--gradient-teal-end))' }}>
  <p className="text-[var(--fs-sm)] font-medium" style={{ color: 'var(--color-hero-text-secondary)' }}>{t.totalReceived}</p>
  <p className="text-[var(--fs-5xl)] font-bold tabular-nums mt-1" style={{ color: 'var(--text-inverse)' }}>
    {formatCurrency(amount)}
  </p>
</div>
```

---

## HOOK SKELETON (copy for form pages)

```tsx
const [field, setField] = useState('');
const [fieldError, setFieldError] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError('');
  // 1. Validate all fields
  if (!name.trim()) { setNameError(t.required); return; }
  // 2. Submit
  setLoading(true);
  try {
    const result = await api.create({ name: name.trim() });
    toast.success(t.addedSuccessfully);
    navigate(ROUTES.TARGET);
  } catch (err) {
    setError(err instanceof Error ? err.message : t.failedToSave);
  } finally {
    setLoading(false);
  }
};
```

## SKELETON TEMPLATE (loading state)
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
  {[1,2,3,4,5,6].map(i => (
    <div key={i} className="border rounded-[var(--radius-xl)] p-4 animate-pulse"
         style={{ backgroundColor: 'var(--color-gray-0)', borderColor: 'var(--color-gray-100)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full" style={{ backgroundColor: 'var(--color-gray-200)' }} />
        <div className="flex-1">
          <div className="h-4 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--color-gray-200)' }} />
          <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--color-gray-200)' }} />
        </div>
      </div>
    </div>
  ))}
</div>
```

### BADGE PATTERNS
```tsx
{/* Status badges */}
<Badge variant="success">{t.paid}</Badge>      {/* green bg, green text */}
<Badge variant="warning">{t.pending}</Badge>    {/* amber bg, amber text */}
<Badge variant="error">{t.overdue}</Badge>      {/* red bg, red text */}
<Badge variant="default">{t.draft}</Badge>      {/* gray bg, gray text */}

{/* Amount display */}
<span className="tabular-nums font-semibold" style={{ color: 'var(--color-success-600)' }}>
  +{formatCurrency(received)}
</span>
<span className="tabular-nums font-semibold" style={{ color: 'var(--color-error-500)' }}>
  -{formatCurrency(due)}
</span>
```

---

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
- [ ] Amounts displayed with `tabular-nums` class for alignment
- [ ] Indian number format (Rs 1,00,000) via `Intl.NumberFormat('en-IN')`
- [ ] Warm cream background on pages (`var(--color-gray-50)`)
- [ ] **Every section container has `py-0` (0 top AND bottom padding)**
- [ ] **Section-group parent stacks with `space-y-6` or `gap-6` (24px)**
- [ ] Inner padding lives on a CHILD of the section, not the section itself
- [ ] No raw `fetch()` outside `src/lib/api.ts` / `src/lib/auth.ts` /
      `hooks/useOnlineStatus.ts`; if unavoidable, pass `AbortController.signal`
- [ ] No PII in `console.*` / logger calls (phone, email, pin, otp, password)
- [ ] Offline compliance (see `.claude/rules/OFFLINE_RULES.md`):
      `api()` used, mutations pass `entityType`+`entityLabel`, no
      `localStorage` writes for entity data
- [ ] Variant-first: any new component must answer "why not extend an
      existing variant" in the plan

## DEEP REFERENCE (read on-demand, NOT upfront)

| File | When to read |
|------|-------------|
| `brand-guidelines.md` | Logo usage, brand voice, Indian formatting rules |
| `color-system.md` | Full palette with dark mode values, overlay system |
| `typography.md` | Complete type scale, font pairing rules |
| `spacing-shadows.md` | Full spacing scale, z-index layers, elevation system |
| `motion.md` | Animation tokens, easing curves, keyframe inventory |
| `component-catalog.md` | Every component's usage examples and decision tree |
