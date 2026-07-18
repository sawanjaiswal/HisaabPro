# HisaabPro Component Catalog

> Location: `src/components/ui/`, `src/components/layout/`, `src/components/feedback/`
> ALWAYS search here before creating new components

## Decision Tree — What Component to Use

```
Need an emerald-hero page?  -> <HeroPage hero={...}>...</HeroPage>
Need detail stat tiles?     -> <SummaryTiles tiles={...}>
Need a button?              -> <Button variant="...">
Need a text input?          -> <Input>
Need a card container?      -> <Card>
Need a bottom sheet?        -> <Drawer>
Need a centered dialog?     -> <Modal>
Need confirmation?          -> <ConfirmDialog>
Need a status pill?         -> <Badge variant="...">
Need loading state?         -> <Skeleton> or <Spinner>
Need error state?           -> <ErrorState>
Need empty state?           -> <EmptyState>
Need a party avatar?        -> <PartyAvatar>
Need collapsible section?   -> <accordion>
Need barcode scanning?      -> <BarcodeScanner>
Need offline notice?        -> <OfflineBanner>
Need user feedback?         -> <FeedbackWidget>
Need toast notification?    -> useToast() from ToastContainer
Need CAPTCHA?               -> <Turnstile>
Need bulk selection?        -> <BulkActionBar>
Need a tabular list?        -> <ResponsiveTable> (cards <md, table >=md)
Need a dense accounting grid?-> <ResponsiveTable density="compact" alwaysTable zebra>
```

## Core Components

### HeroPage (`src/components/layout/HeroPage.tsx`) — signature skin
```tsx
import { HeroPage } from '@/components/layout/HeroPage';

<AppShell>
  <Header title={t.parties} backTo={ROUTES.HOME} actions={menu} />
  <HeroPage hero={<SummaryTiles tiles={tiles} />}>
    {/* white-sheet content */}
  </HeroPage>
</AppShell>
```
The Emerald Hero two-tone shell (see `brand-guidelines.md` → Signature Layout).
Renders the deep-emerald `hero` field + a white rounded sheet, and **recolours
the global `<Header>` to emerald automatically** via `.hp-hero-page` + `:has()`.
`hero` is optional (omit → sheet opens directly under the emerald bar). Use on
Home, Party/Invoice/Payment detail — never hand-roll a dark-header + white-sheet.

### SummaryTiles (`src/components/ui/SummaryTiles.tsx`)
```tsx
import { SummaryTiles } from '@/components/ui/SummaryTiles';

<SummaryTiles
  aria-label={t.summary}
  tiles={[
    { id: 'due',   label: t.totalDue,   value: fmt(dueP),   tone: 'due'   },
    { id: 'sales', label: t.totalSales, value: fmt(salesP), tone: 'sales' },
    { id: 'paid',  label: t.lastPayment,value: fmt(lastP),  tone: 'info'  },
  ]}
/>
```
Horizontal row of bordered stat tiles (muted label above a toned value). Pure
display — parent owns loading/error/empty; values are pre-formatted strings.
Tones: `due` (red) · `sales`/`paid` (green) · `info` (blue) · `neutral`. Feature
wrappers: `PartySummaryTiles`, `InvoiceSummaryTiles`.

### Button (`src/components/ui/Button.tsx`)
```tsx
import { Button } from '@/components/ui/Button';

<Button variant="primary" size="md" loading={false} className="w-full" disabled={false}>
  {t.save}
</Button>
```
| Prop | Options | Default |
|------|---------|---------|
| `variant` | `primary`, `secondary`, `outline`, `text`, `ghost`, `danger` | `primary` |
| `size` | `sm`, `md`, `lg` | `md` |
| `loading` | boolean | `false` |
| `disabled` | boolean | `false` |
| `icon` | ReactNode | — |
| `className` | string | — |

Styling: `btn-primary` = emerald bg (`--color-primary-600`, #024E29). `btn-accent` = lime bg (#E0EA49) + dark text.
All sizes enforce min 44px touch target.

### Input (`src/components/ui/Input.tsx`)
```tsx
import { Input } from '@/components/ui/Input';

<Input
  type="text"
  placeholder={t.enterName}
  value={name}
  onChange={(e) => setName(e.target.value)}
  error={nameError}
  disabled={loading}
/>
```
Font-size locked to 1rem (`--fs-base`) to prevent iOS zoom.
Border radius: `--radius-md` (12px).

### Card (`src/components/ui/Card.tsx`)
```tsx
import { Card } from '@/components/ui/Card';

<Card className="p-4">{/* content */}</Card>
```
Uses `--radius-xl` (20px) + `--shadow-card`. White bg on light, dark surface on dark theme.

### Badge (`src/components/ui/Badge.tsx`)
```tsx
import { Badge } from '@/components/ui/Badge';

<Badge variant="success">{t.paid}</Badge>
<Badge variant="error">{t.overdue}</Badge>
<Badge variant="warning">{t.pending}</Badge>
<Badge variant="default">{t.draft}</Badge>
```
Uses subtle bg tints (`--color-*-bg-subtle`) with matching text color.

### Drawer (`src/components/ui/Drawer.tsx`)
```tsx
import { Drawer } from '@/components/ui/Drawer';

<Drawer open={isOpen} onClose={() => setIsOpen(false)} title={t.editItem}>
  {/* drawer content */}
</Drawer>
```
Bottom sheet on mobile. Slides up from bottom. Max height ~85vh. Backdrop click closes.
Top radius: `--radius-lg` (16px).

### Modal (`src/components/ui/Modal.tsx`)
```tsx
import { Modal } from '@/components/ui/Modal';

<Modal open={isOpen} onClose={() => setIsOpen(false)} title={t.confirm}>
  {/* modal content */}
</Modal>
```
Centered dialog with backdrop blur. Escape key closes. Radius: `--radius-lg` (16px).

### ConfirmDialog (`src/components/ui/ConfirmDialog.tsx`)
```tsx
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

<ConfirmDialog
  open={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title={t.deleteInvoice}
  description={t.deleteWarning}
  confirmText={t.delete}
  variant="danger"
/>
```

### PartyAvatar (`src/components/ui/PartyAvatar.tsx`)
```tsx
import { PartyAvatar } from '@/components/ui/PartyAvatar';

<PartyAvatar name={party.name} size="sm" />
```
Generates avatar with initials. Consistent color from name hash.

## Layout Components

### AppShell (`src/components/layout/AppShell.tsx`)
App layout wrapper with header + content + bottom nav.

### Header (`src/components/layout/Header.tsx`)
Frosted glass header: `backdrop-filter: blur(16px)` + `var(--header-glass-bg)`.
Sticky positioning with `z-sticky` (20).

### BottomNav (`src/components/layout/BottomNav.tsx`)
5-tab bottom navigation. Safe area aware via `--bottom-nav-height`.

### PageContainer (`src/components/layout/PageContainer.tsx`)
Wraps page content with proper padding and bottom nav clearance.

### PageTransition (`src/components/layout/PageTransition.tsx`)
Route-level transition wrapper with fade+slideUp animation.

### ResponsiveTable (`src/components/layout/ResponsiveTable.tsx`)
```tsx
import { ResponsiveTable, type TableColumn } from '@/components/layout/ResponsiveTable';

// Consumer default — cards <md, table >=md
<ResponsiveTable
  rows={parties} rowKey={p => p.id} onRowClick={openParty}
  loading={isLoading}
  error={error ? <ErrorState message={error} onRetry={refetch} /> : undefined}
  empty={<EmptyState title={t.noParties} />}
  columns={columns}
/>

// Accounting grid — compact rows, columns kept on phone via scroll, zebra
<ResponsiveTable density="compact" alwaysTable zebra
  rows={entries} rowKey={e => e.id} columns={ledgerColumns} loading={loading} />
```
One primitive owns the card↔table switch AND the two densities. **Never
hand-roll a `<table>` or a card-list for tabular data.** Owns all 4 UI states
via props (`loading` / `error` / `empty` / data).

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `columns` | `TableColumn<T>[]` | — | `{ key, header, render, align?, width?, desktopOnly?, mobileHide? }` |
| `rows` | `T[]` | — | data |
| `rowKey` | `(row) => string` | — | stable identity |
| `onRowClick` | `(row) => void` | — | makes rows tappable |
| `loading` | boolean | — | renders skeleton rows |
| `error` | ReactNode | — | error state node |
| `empty` | ReactNode | — | empty state node |
| `skeletonRows` | number | `5` | loading skeleton count |
| `density` | `'comfortable' \| 'compact'` | `comfortable` | `compact` = ~36px rows (`px-3 py-1.5`) for accounting grids |
| `alwaysTable` | boolean | `false` | render the scrollable grid at every width (no card collapse <md) — for true accounting views |
| `zebra` | boolean | `false` | alternating row tint (`--color-gray-50`) for scan-ability |

`density`/`alwaysTable`/`zebra` are additive — omitting them preserves the
original consumer behaviour exactly. `align="right"` columns auto-get
`tabular-nums`. See `screen-archetypes.md` → archetype O for the full grid page.

## Feedback Components

### Skeleton (`src/components/feedback/Skeleton.tsx`)
```tsx
import { Skeleton } from '@/components/feedback/Skeleton';

<Skeleton className="h-4 w-3/4 rounded" />
```
Uses `animate-pulse` + gray bg. Group multiple skeletons for loading state.

### EmptyState (`src/components/feedback/EmptyState.tsx`)
```tsx
import { EmptyState } from '@/components/feedback/EmptyState';

<EmptyState
  icon={<FileText className="w-12 h-12" />}
  title={t.noInvoicesYet}
  description={t.createFirstInvoice}
  action={{ label: t.createInvoice, onClick: handleCreate }}
/>
```

### ErrorState (`src/components/feedback/ErrorState.tsx`)
```tsx
import { ErrorState } from '@/components/feedback/ErrorState';

<ErrorState message={error} onRetry={refetch} />
```

### Spinner (`src/components/feedback/Spinner.tsx`)
Small inline loading indicator.

### OfflineBanner (`src/components/feedback/OfflineBanner.tsx`)
Shows when device is offline. Auto-shows/hides.

### ToastContainer / useToast
```tsx
// Usage in any component:
const toast = useToast();
toast.success(t.saved);
toast.error(t.failedToSave);
```
Dark overlay style. Auto-dismiss. Max 3 visible.

### FeedbackWidget (`src/components/feedback/FeedbackWidget.tsx`)
In-app feedback form with screenshot capture.

## Specialized Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `BarcodeScanner` | `ui/BarcodeScanner.tsx` | Camera-based barcode scanning |
| `BulkActionBar` | `ui/BulkActionBar.tsx` | Sticky bulk operation toolbar |
| `Turnstile` | `ui/Turnstile.tsx` | Cloudflare CAPTCHA widget |
| `accordion` | `ui/accordion.tsx` | Collapsible sections |
| `avatar` | `ui/avatar.tsx` | Generic avatar component |
| `carousel` | `ui/carousel.tsx` | Horizontal carousel |
| `separator` | `ui/separator.tsx` | Visual divider |
| `PartySearch` | `ui/PartySearch/` | Party search + select dropdown |

## Landing Page Components (public marketing)
These live in `src/components/ui/` but are for the public landing page only:
- `hero-phone-mockup`, `hero-dashboard-mockup`
- `bento-grid`, `feature-bento-grid`, `cybernetic-bento-grid`
- `pricing-section`, `testimonials-with-marquee`
- `footer-section`, `cta-section`
- `saa-s-template` (main landing page template)
- `social-proof-bar`, `sticky-mobile-cta`

## Rules

1. **NEVER use raw HTML** — `<button>` -> `<Button>`, `<input>` -> `<Input>`, `<div>` card -> `<Card>`
2. **Search before creating** — `ls src/components/ui/` first
3. **All components use CSS variables** — dark mode works automatically
4. **All interactive elements >= 44px** touch target (WCAG)
5. **Toast for feedback** — `useToast()`, never `alert()`
6. **4 UI states mandatory** — loading (Skeleton), error (ErrorState), empty (EmptyState), success
7. **Icons from lucide-react** — never inline SVG for standard icons
