# HisaabPro Screen Archetypes

> Distilled from the 64-screen GPT design set (2026-07). These are the **recurring
> compositions** every screen in the app is built from. Pick the archetype that
> matches the screen, copy the skeleton, fill with tokens/components from
> `SKILL.md`. This doc is *composition* reference — colors/sizes/components still
> come from the execution card in `SKILL.md`. Read on-demand, not upfront.
>
> Non-negotiable across ALL archetypes: emerald `<Header>` on hero pages · green
> FAB centred in the 5-tab BottomNav (Home · Customers · **+** · Reports · More) ·
> warm-cream page bg · white cards · `9:41`-style layouts scale 320→1536 · 4 UI
> states · every string via `t.*`.

---

## The universal motif — TINTED ICON SQUARE

Appears on **every** list row, settings row, quick-action tile, report card,
notification, and priority item. A 40×40 rounded square (`--radius-md`), tinted
by semantic category, holding a `w-5 h-5` lucide icon. This is the single most
repeated element in the whole design — get it right once, reuse everywhere.

Tint map (existing tokens only — see `color-system.md` → "Category icon-square tints"):

| Category | Icon | Square bg | Icon colour |
|----------|------|-----------|-------------|
| Customer / party / collection / money-in | `Users` `User` `IndianRupee` `ArrowDown` | `--color-primary-50` / `--color-success-50` | `--color-primary-500` / `--color-success-600` |
| Expense / due / overdue / money-out / out-of-stock | `Receipt` `ArrowUp` | `--color-error-50` | `--color-error-500` |
| Product / stock / inventory / low-stock | `Package` `Box` `Warehouse` | `--color-warning-50` | `--color-warning-600` |
| Invoice / estimate / quotation / supplier / purchase | `FileText` `Truck` `ShoppingCart` | `--color-info-50` | `--color-info-600` |
| Draft / disabled / neutral / "More" | `FileText` `MoreHorizontal` | `--color-gray-100` | `--color-gray-500` |

> The mockups render quotations/purchase in violet — **there is no purple token**.
> Use `info` (blue) tint in code. Do not invent a palette family.

```tsx
<span className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] flex-shrink-0"
      style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-500)' }}>
  <Users className="w-5 h-5" />
</span>
```

---

## A — LIST / INDEX PAGE

Sales · Customers · Products · Expenses · Purchases · Estimates · Employees ·
Payment History · Draft Invoices · Sales Return · Stock Adjustment. The most
common screen type.

```
Header (back · title · [+ add] + filter icon)
  Search Input (icon=Search)
  Filter-chip row  →  All · Paid · Unpaid · Overdue   (segmented pills, see C)
  ── date group header ("Today" / "8 Jun 2025") ······· right-aligned subtotal
     row · row · row                                     (each = tinted square, D)
  ── date group header ("Yesterday") ················· subtotal
     row · row
  Totals footer:  "Total Sales (This Month)  ₹1,25,000  ↑18%" + mini sparkline
FAB (+)
```

- Group rows by date; each group header carries a right-aligned running subtotal.
- Footer card = label + big `tabular-nums` amount + delta + a small area sparkline
  (green up / red down). See archetype I.
- 4 states: `<ListSkeleton>` · `<ErrorState onRetry>` · `<EmptyState action>` (the
  friendly illustration + CTA, archetype F) · rows.

## B — ENTITY DETAIL (ledger / record header)

Customer Ledger · Supplier Ledger · Product Details · Invoice Details · Payment
Details · Customer Statement. Builds on the **Emerald Hero** skin (SKILL.md →
PAGE ARCHETYPE). This is the canonical `HeroPage` detail flow, plus:

```
Header (emerald, back · name · share/edit action)
White identity card:
  avatar/initials OR business logo square · name · phone · GSTIN/location · status Badge
  [action-icon row]  ○ Call   ○ WhatsApp   ○ Location   ○ More     (circular btns, see E)
SummaryTiles 3-up:  Total Due (due) · Total Paid (sales) · Total Sales (info)
Underline tabs:  Ledger · Invoices · Details      (Overview · Invoices · Payments · Activity)
Tab panel:  date-grouped ledger rows (tinted square, D)  ·  amount + Unpaid/Paid state
Footer:  outline "View Statement" | primary "Add Payment"   (inline dual-action, NOT fixed)
```

- Product/Invoice/Payment variants swap the identity card for a product image row
  or a document header (INV-1051 · status badge · amount) but keep tabs + footer.
- Invoice Details tabs → Items table + Total; footer → "Download" + "Print / Share".

## C — FILTER-CHIP ROW (segmented pills)

On nearly every list + inside Filter/Sort sheets. Horizontal scroll pills.

- Active pill: `--color-primary-600` bg, white text.
- Inactive pill: transparent bg, `--color-gray-200` border, `--text-secondary`.
- Count style: `All (12)` · `Active (9)` · `Inactive (3)`.
- Full filter sheet (screen "Filter & Sort"): checkbox status list + Date Range +
  Sort-by segmented (Latest First / Oldest First) + Cancel | Apply Filters footer.

```tsx
<div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
  {chips.map(c => (
    <button key={c.id} type="button" onClick={() => setActive(c.id)}
      className="px-3.5 py-1.5 rounded-full text-[var(--fs-sm)] font-medium whitespace-nowrap min-h-[36px]"
      style={active === c.id
        ? { backgroundColor: 'var(--color-primary-600)', color: 'var(--color-white-inverse)' }
        : { border: '1px solid var(--color-gray-200)', color: 'var(--text-secondary)' }}>
      {c.label}
    </button>
  ))}
</div>
```

## D — LIST ROW (tinted square)

The workhorse row. Tinted icon square (motif above) · title + subtitle · right
column (amount `tabular-nums` + status text/`<Badge>` or chevron).

```tsx
<button type="button" className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b"
        style={{ borderColor: 'var(--color-gray-100)' }} onClick={() => onOpen(item)}>
  <span className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-md)] flex-shrink-0"
        style={{ backgroundColor: 'var(--color-primary-50)', color: 'var(--color-primary-500)' }}>
    <Icon className="w-5 h-5" />
  </span>
  <div className="flex-1 min-w-0">
    <p className="text-[var(--fs-df)] font-semibold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
    <p className="text-[var(--fs-xs)] mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.subtitle}</p>
  </div>
  <div className="text-right flex-shrink-0 tabular-nums">
    <p className="text-[var(--fs-df)] font-semibold" style={{ color: 'var(--text-primary)' }}>{fmt(item.amount)}</p>
    <p className="text-[var(--fs-xs)] mt-0.5" style={{ color: 'var(--color-error-500)' }}>{item.statusLabel}</p>
  </div>
</button>
```

## E — DETAIL ACTION-ICON ROW (circular quick actions)

Under the identity card on Customer/Supplier detail. 4 circular icon buttons with
labels: Call · WhatsApp · Location · More. Each = 44×44 circle, tinted `--color-gray-50`
bg, icon `--text-secondary`; WhatsApp icon uses `--color-whatsapp`. Labels below in
`--fs-xs` muted. Row is `flex justify-around`.

## F — FULL-SCREEN STATUS (success / error / empty / offline / permission)

Success Screen · Error State · Empty State · Offline · Access Denied. Centred
illustration → title → subtitle → primary button → secondary (outline) button.

- Success: green circle-check illustration · "Invoice Created!" · sub · "View Invoice" | "Create Another".
- Error: unplugged/alert illustration · "Something went wrong!" · "Try Again" | "Go Back".
- Empty: friendly character illustration · "No customers yet!" · "Add Customer" (use `<EmptyState>`).
- Offline: signal-off illustration + a "Pending Sync — N records" card (use `<OfflineBanner>` for the inline strip variant).
- Access Denied: locked-figure illustration · "Go Back" | "Request Access".

Reuse `<EmptyState>` / `<ErrorState>` where they fit; only the full-bleed
success/permission variants are net-new compositions (still built from Button +
tokens, centred `min-h-[70vh] flex-col`).

## G — MULTI-STEP WIZARD

Onboarding (New User Journey) · First-Time Setup · Import Data · Set Opening
Balances · Add Bank Account. Top = step progress bar + `Step X of Y` (or numbered
stepper dots with labels), one form section per step, primary "Continue", optional
ghost "Skip for Now".

- Progress bar: filled `--color-primary-500` track over `--color-gray-200`.
- Onboarding path-picker uses radio cards ("Notebook · Excel · Tally · Other") with
  a Recommended badge on the default.
- Import Data uses checkbox rows with record counts + tinted squares.

## H — SETTINGS / GROUPED LIST

Settings · Business Profile · Account & Security · Manage Business · Subscription.
Section-titled groups of rows: tinted icon square · title + subtitle · trailing
chevron / toggle / value. Toggles = the pill switch (checkbox + toggle CSS).
Destructive rows ("Delete Business") use `--color-error-*` text/outline.

## I — STAT CARD WITH SPARKLINE

Business Overview carousel on Home; report summary cards. White card: label · big
`tabular-nums` amount · delta (`↑18%` success / `↓6%` error) · a mini area sparkline
across the card bottom (green fill for up-trend, red for down). Swipeable row of 4
with page-dot indicator. Chart line/fill uses `--color-success-*` (up) or
`--color-error-*` (down); never brand emerald for the up-line on light cards.

## J — BREAKDOWN DONUT + LEGEND

Sales Report payment split. Donut chart + legend rows: coloured dot · label ·
amount · `(50%)`. Segments use categorical colours — map to success (Cash), info
(UPI), warning/error (Credit). Pair with a 2×2 "Summary" stat grid beside it.

## K — ACTIVITY TIMELINE

Recent Activity (Home) · Notification Center. Vertical connector line with a
coloured dot per item; each row = tinted square icon · title · subtitle · trailing
amount + timestamp. Dot colour follows the event's semantic tint.

## L — REPORTS HUB

Reports Home. Intro line + 2-col grid of report cards (tinted icon square · title ·
one-line subtitle) + a "Favourites" section with a star toggle. Cards route to the
report detail (P&L, Cash Flow, Stock History, GST — each a labelled figure list +
"View Detailed Report" CTA + trend line).

## M — QUICK-ACTIONS GRID

Home + dedicated Quick Actions screen. 4-column grid of tiles: tinted icon square
(centred) + label under. Editable order ("Edit"), grouped (Daily Actions · Reports
· Other). Last tile is "More" (neutral).

## N — WHATSAPP / REMINDER PREVIEW

Payment Reminder + WhatsApp Preview. A chat-bubble mock (WhatsApp-green bubble on
a chat-paper bg) previewing the outgoing message, plus reminder-type radio list
(Gentle / Overdue / Final) + "Send via WhatsApp" (`--color-whatsapp`) | SMS.

## O — DATA-DENSE / ACCOUNTING GRID

Day Book · Trial Balance · Stock Register · GST report tables · P&L with columns ·
any multi-column ledger for **Priya (wholesaler)** and **Amit (distributor)**, who
live in dense tables — not the card rows that serve **Raju**. This is the app's
*second density*, and it is a deliberate departure from the whitespace-generous
consumer skin. **Do not build it from cards.**

Rules:
- **Use `<ResponsiveTable density="compact" alwaysTable zebra>`** — never hand-roll
  a `<table>` (see `component-catalog.md`). `compact` = ~36px rows; `alwaysTable`
  keeps columns on phone via horizontal scroll (no card collapse); `zebra` aids
  horizontal scanning.
- **Numbers**: `align="right"` (auto-applies `tabular-nums`) on every amount/qty
  column. Right edges must line up.
- **Density overrides the consumer mandates on this surface only**: the `space-y-6`
  section gap and 44px row-height rules are relaxed for data grids. Rows are the
  content; don't pad them apart. (Surrounding page chrome still obeys the grid.)
- **Sticky**: header sticks (`ResponsiveTable` owns this); freeze the first column
  (label/date) for wide grids via a `desktopOnly`-style width + sticky cell.
- **Totals row**: append a bold summary row (`--color-gray-50` bg) — Dr/Cr totals,
  closing balance, net. Right-aligned `tabular-nums`, `--text-primary`, semibold.
- **Toolbar above the grid**: period picker (`Month ▾`) + filter/export icons +
  a **comfortable⇄compact density toggle** so the user picks their density.
- **Colour**: gridlines `--color-gray-100`, zebra `--color-gray-50`, header text
  `--text-secondary`; Dr/debit `--color-error-500`, Cr/credit `--color-success-600`.
- 4 states are first-class on `ResponsiveTable` (`loading`/`error`/`empty`).

```tsx
<ResponsiveTable
  density="compact" alwaysTable zebra
  rowKey={r => r.id} rows={rows} loading={loading}
  empty={<EmptyState title={t.noEntries} />}
  columns={[
    { key: 'date',  header: t.date,  render: r => r.date, width: 'w-24' },
    { key: 'particulars', header: t.particulars, render: r => r.name },
    { key: 'voucher', header: t.voucherNo, render: r => r.docNo, desktopOnly: true },
    { key: 'debit',  header: t.debit,  align: 'right', render: r => fmt(r.debit) },
    { key: 'credit', header: t.credit, align: 'right', render: r => fmt(r.credit) },
    { key: 'balance',header: t.balance,align: 'right', render: r => fmt(r.balance) },
  ]}
/>
```

---

## Dashboard stages (product behaviour, not a layout)

Home is **progressive**: it evolves Stage 0 → 3 as the user's data grows —
`Business Setup` checklist (Stage 0–1, % ring) → live `Today's Summary` tiles
(Stage 2, first invoice) → full metric tiles + delta + Recent Activity (Stage 3,
first payment) → the mature Emerald-Hero dashboard (Home 2, already shipped). New
dashboard work must respect this staged reveal, not assume full data on day one.
