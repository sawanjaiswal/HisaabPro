# HisaabPro Page & Field Templates

> Copy-paste JSX skeletons. Loaded on-demand from `SKILL.md` Phase 3 (BUILD).
> These are the ONLY sanctioned starting points — copy a skeleton, fill fields,
> do not redesign. Every token here is defined in `color-system.md`,
> `typography.md`, `spacing-shadows.md`, `motion.md` (the value SSOTs).

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

## PAGE ARCHETYPE — Emerald Hero (the signature skin)

> **The default skin for every primary screen** (Home, Party/Invoice/Payment
> detail, any list/hub that leads with a summary). Canonical DONE references:
> the **Home page** (`DashboardPage` / Home 2) and the **Party detail page**.
> Copy their skin — do not invent one.

**One continuous field, split in two:**

```
┌─────────────────────────┐  ← OS status bar (transparent)
│  Header  ← RECOLOURED    │     deep emerald --color-hero-surface (#003121),
│  to deep emerald, white  │     white title + white back/action icons
├─────────────────────────┤
│  Emerald hero field      │  ← greeting / summary tiles / hero amount sit
│  (white text on emerald) │     here, ON the emerald, under the header
│ ╭─────────────────────╮  │
│ │  WHITE ROUNDED SHEET │  │  ← main content lifts −space-4 into the emerald,
│ │  (radius-xl top)     │  │     radius-xl top corners, shadow-drawer-inset
│ │  …page content…      │  │
```

**Use the primitive — never hand-roll it:**

```tsx
import { HeroPage } from '@/components/layout/HeroPage'

<AppShell>
  <Header title={party.name} backTo={ROUTES.PARTIES} actions={menu} />
  <HeroPage hero={<SummaryTiles tiles={tiles} aria-label={t.summary} />}>
    {/* white-sheet content: identity card, tabs, rows, footer */}
  </HeroPage>
</AppShell>
```

- `HeroPage` renders the emerald `hero` field + white rounded sheet, and
  **recolours the global `<Header>` to emerald automatically** via its
  `.hp-hero-page` marker + `:has()` in `hero-page.css`. No per-page header CSS.
- `hero` is optional. Omit it for a page that opens straight into the sheet.
- Home's twin (`dashboard-top-section--dark` → `dashboard-white-section`) is
  the same pattern hand-built before the primitive existed — match its look.

**Rules:** text on emerald = white (`--color-white-inverse`) for values,
`--color-hero-text-secondary` (white @ 80%) for labels. Accents on emerald =
bright `--color-success-300/400`, never the dark brand emerald. The white sheet
uses normal light tokens.

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

### DETAIL PAGE (Emerald Hero skin — Party detail is canonical)
> The old gradient-hero-with-giant-amount template is RETIRED. Detail pages now
> use `HeroPage`: emerald bar → white identity card → `SummaryTiles` →
> underline tabs → rows → inline dual-action footer. Party detail
> (`src/features/parties/PartyDetailPage.tsx`) is the reference — copy it.

```tsx
<AppShell>
  <Header title={item.name} backTo={ROUTES.BACK} actions={<DetailMenu … />} />

  <HeroPage>{/* omit `hero` → identity card is the first thing in the sheet */}
    {/* 1 — White identity card: circle avatar + name + type pill + status pill */}
    <div className="detail-identity-card">
      <PartyAvatar name={item.name} size="lg" />              {/* circle */}
      <div className="detail-identity-info">
        <div className="flex items-center gap-2">
          <h2>{item.name}</h2>
          <Badge variant="info">{t.customer}</Badge>          {/* TYPE pill */}
        </div>
        <span>{formatPhone(item.phone)}</span>
        <span><MapPin className="w-4 h-4" />{location}</span>
      </div>
      <Badge variant={item.isActive ? 'success' : 'default'}>  {/* STATUS pill */}
        {item.isActive ? t.active : t.inactive}
      </Badge>
    </div>

    {/* 2 — Semantic stat tiles (Due / Sales / Last payment) */}
    <SummaryTiles tiles={[
      { id: 'due',   label: t.totalDue,   value: fmt(dueP),   tone: 'due'   },
      { id: 'sales', label: t.totalSales, value: fmt(salesP), tone: 'sales' },
      { id: 'paid',  label: t.lastPayment,value: fmt(lastP),  tone: 'info'  },
    ]} aria-label={t.summary} />

    {/* 3 — Underline tabs (Ledger first) */}
    <div className="party-detail-tabs" role="tablist">
      {tabs.map(tab => (
        <Button variant="none" key={tab.id} role="tab"
          className={`party-detail-tab${active === tab.id ? ' active' : ''}`}
          onClick={() => setActive(tab.id)}>{tab.label}</Button>
      ))}
    </div>

    {/* 4 — Tab panel (ledger rows / details / etc.) */}
    <div role="tabpanel">{/* … */}</div>

    {/* 5 — Inline dual-action footer (NOT a fixed bar) */}
    <div className="flex items-center gap-3">
      <Button variant="outline" icon={<MessageSquare className="w-4 h-4" />}
        className="flex-1" onClick={onStatement}>{t.sendStatement}</Button>
      <Button variant="primary" icon={<Wallet className="w-4 h-4" />}
        className="flex-1" onClick={onAddPayment}>{t.addPayment}</Button>
    </div>
  </HeroPage>
</AppShell>
```

### LEDGER / TRANSACTION ROW (direction-tinted icon square)
```tsx
{/* debit (sale / invoice) = coral-tinted up-arrow; credit (payment) = green down-arrow */}
<button type="button" className="ledger-row" onClick={() => onOpen(txn)}>
  <div className="ledger-row__date">
    <span className="ledger-row__day">{day}</span>     {/* 15 */}
    <span className="ledger-row__mon">{mon}</span>      {/* Jun */}
  </div>
  <span className={`ledger-row__icon ledger-row__icon--${txn.isCredit ? 'credit' : 'debit'}`}>
    {txn.isCredit ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
  </span>
  <div className="flex-1 min-w-0">
    <p className="ledger-row__title">{txn.title}</p>     {/* Sale Invoice */}
    <p className="ledger-row__ref">{txn.docNo}</p>       {/* INV-1056 */}
  </div>
  <div className="text-right tabular-nums">
    <span style={{ color: txn.isCredit ? 'var(--color-success-600)' : 'var(--text-primary)' }}>
      {txn.isCredit ? '−' : ''}{formatCurrency(txn.amount)}
    </span>
    {txn.mode && <p className="ledger-row__mode">{txn.mode}</p>}  {/* UPI / Cash */}
  </div>
  <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
</button>
```
- Debit icon square: `background: var(--color-error-50)` / arrow `--color-error-500` (coral).
- Credit icon square: `background: var(--color-success-50)` / arrow `--color-success-600`.
- Icon square: `--radius-md`, 40×40, centered.

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

### DATA TABLE PAGE (accounting grid — archetype O)
> For day book / trial balance / stock register / GST tables. Compact rows,
> columns kept on phone via horizontal scroll, right-aligned `tabular-nums`,
> a totals row. Use `<ResponsiveTable>` — never a hand-rolled `<table>`.

```tsx
<div className="min-h-screen pb-[calc(var(--bottom-nav-height)+2rem)]" style={{ backgroundColor: 'var(--color-gray-50)' }}>
  <Header title={t.dayBook} backTo={ROUTES.REPORTS} />
  {/* Toolbar: period + density toggle + export (compact, NOT space-y-6) */}
  <div className="flex items-center justify-between gap-2 px-4 py-2 border-b"
       style={{ borderColor: 'var(--color-gray-100)', backgroundColor: 'var(--color-gray-0)' }}>
    <LedgerMonthPicker value={month} onChange={setMonth} />
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setDensity(d => d === 'compact' ? 'comfortable' : 'compact')}
        className="min-h-[44px] px-3 rounded-[var(--radius-sm)] border text-[var(--fs-sm)]"
        style={{ borderColor: 'var(--color-gray-200)', color: 'var(--text-secondary)' }}>
        <Rows3 className="w-4 h-4" />
      </button>
      <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />}>{t.export}</Button>
    </div>
  </div>
  <ResponsiveTable
    density={density} alwaysTable zebra
    rowKey={r => r.id} rows={rows} loading={loading}
    error={error ? <ErrorState message={error} onRetry={refetch} /> : undefined}
    empty={<EmptyState title={t.noEntries} />}
    columns={columns}
  />
  {/* Totals row (bold, tinted) */}
  {!loading && rows.length > 0 && (
    <div className="flex items-center justify-between px-3 py-2 border-t font-semibold tabular-nums"
         style={{ backgroundColor: 'var(--color-gray-50)', borderColor: 'var(--color-gray-100)', color: 'var(--text-primary)' }}>
      <span>{t.total}</span>
      <span>{formatCurrency(totals.net)}</span>
    </div>
  )}
</div>
```

**Density modes** (never mix within one screen): comfortable (default, ≥44px
rows, `px-4 py-3`) for consumer screens A–N; compact (~36px rows, `px-3 py-1.5`,
`tabular-nums`, zebra) for archetype O grids only, via
`<ResponsiveTable density="compact">`. The `space-y-6` / 44px mandates are relaxed
**only inside** the grid; page chrome around it stays comfortable. Full detail:
`spacing-shadows.md` → Density Modes.

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

## BADGE PATTERNS
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
