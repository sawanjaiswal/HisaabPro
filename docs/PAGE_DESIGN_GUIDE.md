# HisaabPro — Page Design Guide

> Apply these patterns to every page. No exceptions. When in doubt, match the Dashboard.

## Aesthetic: Warm Luxury Utility

**DFII: 17/15** — Deep teal trust + lime energy on warm cream canvas. Premium enough for Cred users, functional enough for Rs 8,000 Android phones.

**Differentiation anchor:** Warm cream-to-white gradient + teal gradient summary cards + lime accent pops. If screenshotted without logo, instantly recognizable vs Vyapar (cold gray) or MyBillBook (flat white).

---

## 6 Page Templates

Every screen in the app follows one of these templates:

### 1. List Page (Parties, Invoices, Products, Payments)

```
AppShell
  Header (frosted glass, sticky)
  PageContainer
    SummaryBar (teal gradient card with 3 metrics)
    FilterBar (search pill + scrollable pill tabs)
    4 UI States:
      Loading → Skeleton
      Error → ErrorState + retry
      Empty → EmptyState + CTA
      Success → Card list with dividers
  FAB (teal gradient circle, bottom-right)
```

**Key visual rules:**
- Summary bar: `card-primary` class = teal gradient (`linear-gradient(135deg, #1b6369, #0f3638)`)
- Labels inside summary: `rgba(255, 255, 255, 0.6)`, uppercase, 0.6875rem, letter-spacing 0.06em
- Amounts inside summary: white, 1.125rem, weight 700, green for received, coral for due
- Search bar: white pill with subtle shadow, focus glow `rgba(11, 79, 94, 0.08)`
- Active pill tab: teal-600 bg with subtle shadow `rgba(11, 79, 94, 0.2)`
- List items: `txn-row` pattern (avatar + info + amount), dividers between
- FAB: teal gradient circle with glow shadow

### 2. Detail Page (Party Detail, Invoice Detail, Payment Detail)

```
AppShell
  Header (frosted, back button + title + actions)
  PageContainer
    Hero Header (large avatar + name + badge + key metric)
    Pill Tabs (Overview / Transactions / Addresses)
    Tab Content
```

**Key visual rules:**
- Hero header: 56px avatar, name 1.25rem/700, badge next to name
- Key metric (balance/total): `money-hero` class, colored by sign (green/red)
- Tab content: card sections with generous padding
- Info rows: label (gray-500, 0.75rem) + value (gray-800, 0.9375rem/600)

### 3. Form Page (Create Party, Create Invoice, Record Payment)

```
AppShell
  Header (back + title)
  PageContainer
    Pill Tabs (multi-section form)
    Form Sections (one visible at a time)
  Sticky Bottom Bar (Save + Save & Add Another)
```

**Key visual rules:**
- Input height: 52px, 1.5px border, 12px radius
- Focus: 2px teal-400 border + padding adjust
- Error: 2px red border + 0.833rem error text below
- Sticky bar: white bg, shadow-md, safe-area padding, full-width primary button (56px height)
- Section gap: `var(--space-5)` between field groups

### 4. Hub Page (Reports, Settings)

```
AppShell
  Header (back + title)
  PageContainer
    Card Grid (2-col mobile, 3-col tablet)
    OR Section Groups (settings pattern)
```

**Key visual rules:**
- Report cards: white, 20px radius, shadow (no borders), 20px padding
- Report icon: 44px rounded square, accent color at 12% opacity bg
- Settings sections: uppercase title (0.6875rem), items in white card group
- Touch targets: all items 44px min height

### 5. Report Page (Invoice Report, Stock Summary, Day Book)

```
AppShell
  Header (back + title)
  PageContainer
    FilterBar (date range + status + grouping pills)
    SummaryBar (horizontal scrollable metric cards)
    Content (flat list or grouped with collapsible headers)
```

**Key visual rules:**
- Filter pills: scrollable horizontal, active = teal filled
- Summary items: white cards with shadow (no borders), metric + label
- Grouped headers: click to expand/collapse, chevron rotates
- Items: same txn-row pattern as list pages

### 6. Standalone Page (Login, Onboarding)

```
Full-screen
  Background (warm gradient or teal gradient)
  Centered content card
  Primary action button
```

---

## Global Visual Rules (every page)

### Background
- Body: `linear-gradient(180deg, #f8f7f4 0%, #faf9f6 40%, #fdfdfc 100%)` — warm cream fading to white
- `background-attachment: fixed` — gradient doesn't scroll
- Dashboard adds its own `dashboard-page` background on top

### Header
- Frosted glass: `rgba(248, 247, 244, 0.92)` + `backdrop-filter: blur(16px)`
- Bottom border: `1px solid rgba(0, 0, 0, 0.04)`
- Title: 1.25rem / 700 / gray-900
- Back button: 40x40 circle, transparent → gray-100 on :active
- Always sticky, always z-index: 20

### Cards
- White, 20px radius, 20px padding
- Shadow: `0 2px 12px rgba(26, 25, 23, 0.04), 0 1px 3px rgba(26, 25, 23, 0.03)`
- **No borders** — shadow-only elevation on warm cream bg
- Teal gradient cards: `linear-gradient(135deg, #1b6369 0%, #0f3638 100%)`

### Avatars
- 44x44, 12px radius (rounded square, not circle)
- Subtle shadow: `0 2px 6px rgba(0, 0, 0, 0.08)`
- Colored by name hash, white text initials

### FAB
- 56x56, full circle
- Teal gradient background
- Shadow: `0 4px 14px rgba(15, 54, 56, 0.35)`
- Position: bottom-right, above bottom nav

### Badges
- Pill shape (full radius), 3px vertical padding
- 0.6875rem, 600 weight, uppercase, 0.02em letter-spacing
- Tinted background at ~50% opacity, darker text
- Status colors: green (paid), amber (pending), red (overdue), gray (draft), teal (info)

### Pill Tabs
- White bg, gray-200 border, 40px min-height
- Active: teal-600 bg, white text, subtle glow shadow
- :active (non-selected): gray-100 bg

### Search Bar
- White pill, gray-100 border, subtle shadow
- Focus: teal-300 border + `0 0 0 3px rgba(11, 79, 94, 0.08)` glow
- Icon: gray-400, 18px

### Transaction Rows
- Avatar (44px, rounded square) + info (name + subtitle) + amount/badge
- Divider between rows: `1px solid var(--color-gray-100)`
- Last divider hidden via `.list-item:last-child .divider { display: none }`
- Min touch height: 44px
- :active opacity: 0.7-0.85

### Empty States
- Centered, icon (40-48px, gray-300), title (1.125rem/600), description (0.875rem/gray-500)
- CTA button below (primary, medium size)
- Max description width: 280px

---

## Typography Quick Reference

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Page title (header) | 1.25rem | 700 | gray-900 |
| Section title | 1.125rem | 700 | gray-800 |
| Card heading | 0.9375rem | 600 | gray-800 |
| Body text | 0.9375rem | 400 | gray-600 |
| Meta/subtitle | 0.75rem | 400-500 | gray-400/500 |
| Label (uppercase) | 0.6875rem | 500-600 | gray-500 or white/60% |
| Badge text | 0.6875rem | 600 | semantic color |
| Nav label | 0.6875rem | 500 | gray-400 (active: teal) |
| Hero amount | 2rem+ | 700 | gray-900 |
| Card amount | 1.125rem | 700 | white or semantic |

---

## Spacing Quick Reference

| Context | Value | Token |
|---------|-------|-------|
| Page side padding | 16px | `var(--side-padding)` |
| Section gap | 24px | `var(--space-6)` |
| Card inner padding | 20px | `var(--space-5)` |
| Item gap in list | 12px | `var(--space-3)` |
| Field gap in forms | 20px | `var(--space-5)` |
| Small gap | 8px | `var(--space-2)` |
| Tiny gap | 4px | `var(--space-1)` |

---

## Color Palette (tokens only, never hardcode)

| Role | Token | Hex |
|------|-------|-----|
| Brand primary | `--color-primary-500` | #0B4F5E |
| Brand teal dark | `--color-primary-600` | #052D35 |
| Lime accent | `--color-lime-accent` | #cfdf2e |
| Lime (secondary) | `--color-secondary-300` | #E0EA49 |
| Success | `--color-success-600` | #16A34A |
| Error | `--color-error-500` | #EF4444 |
| Warning | `--color-warning-600` | #D97706 |
| Body bg | Gradient (see above) | #f8f7f4 → #fdfdfc |
| Card bg | `--color-gray-0` | #FFFFFF |
| Text primary | `--color-gray-800` | #2A2824 |
| Text secondary | `--color-gray-500` | #7A7870 |
| Text muted | `--color-gray-400` | #9C9A92 |
| Border light | `--color-gray-100` | #F0EFEB |

---

## Anti-Patterns

- Flat gray-50 backgrounds (use the warm gradient)
- Cards with borders instead of shadows (shadow-only on warm bg)
- Hard circle avatars (use rounded squares, 12px radius)
- Generic blue buttons (teal gradient for primary actions)
- Sharp 8px radius on large cards (use 16-20px)
- Default Inter weight 400 everywhere (use 600-700 for headings, 500 for labels)
- Inline hex colors (always use CSS variables)
- framer-motion (CSS only)
