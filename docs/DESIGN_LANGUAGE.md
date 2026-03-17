# HisaabPro Design Language

> Extracted from Figma dashboard design. Applied consistently across ALL pages.
> For page-level patterns and templates, see `PAGE_DESIGN_GUIDE.md`.

## Color Palette

### Primary Colors
- **Teal gradient**: `linear-gradient(148deg, #16555a 0%, #0f3638 100%)` — primary brand, To Collect cards, profile ring
- **Lime/Yellow-green**: `#cddc39` — accent, To Pay cards, FAB button, upgrade banners, badges
- **Background gradient**: `linear-gradient(to bottom, #f9f9ed 0%, #fdfdfd 100%)` — page background (yellow-warm to white)

### Text Colors
- **Primary text**: `#1a1a1a` — headings, names, amounts
- **Secondary text**: `#454940` — labels like "This Week Sale"
- **Muted text**: `#999999` — timestamps, subtitles, invoice refs
- **Inverse white**: `#ffffff` — text on teal cards
- **Inverse black**: `#1a1a1a` — text on lime cards
- **Link/Action**: `#16555a` — "See All", action buttons

### Semantic Colors
- **Error/Unpaid**: `#e50914` — UNPAID badge, overdue
- **Success/Paid**: `#0e8e41` — PAID badge, received
- **Border**: `#f3f4f6` — transaction dividers

### Surface Colors
- **White surface**: `#ffffff` — cards, drawer, bottom nav
- **Gray background**: `#f5f5f5` — Add button circles in starred
- **Teal light bg**: `rgba(22, 85, 90, 0.05)` — action pill backgrounds (Add/View buttons)
- **White semi**: `rgba(255, 255, 255, 0.9)` — icon containers on upgrade banner

## Typography

### Font Family
- **Primary**: `Inter` — all text
- **Weights**: Regular (400), Medium (500), SemiBold (600)

### Type Scale
| Element | Size | Weight | Line Height | Tracking | Color |
|---------|------|--------|-------------|----------|-------|
| Hero amount | 32px | SemiBold | 32px | 0.4px | #1a1a1a |
| App title | 20px | SemiBold | 32px | 0.4px | #1a1a1a |
| Card amount | 20px | SemiBold | 19.5px | -1px | white / #1a1a1a |
| Section heading | 17px | SemiBold | 23.8px | -0.43px | #1a1a1a |
| Txn heading | 16px | SemiBold | 25.2px | -0.44px | #1a1a1a |
| Party name | 16px | Medium | normal | -0.31px | #1a1a1a |
| Upgrade title | 15px | SemiBold | 18.75px | -0.23px | #1a1a1a |
| Txn amount | 14px | SemiBold | normal | -0.31px | #1a1a1a |
| Txn subtitle | 14px | Regular | normal | -0.15px | #999 |
| Card label | 13px | Medium | 19.5px | -0.08px | white / #1a1a1a |
| Hero subtitle | 13px | Regular | 20.8px | -0.08px | #454940 |
| Badge text | 12px | Medium | normal | — | #e50914 / #0e8e41 |
| Quick action label | 12px | Medium | 18px | — | #303030 |
| Starred name | 12px | Regular | 18px | — | #666 |
| Nav label | 11px | Medium | 16.5px | 0.06px | #999 |

## Spacing System

### Page Padding
- **Side padding**: `16px` — edge-to-edge content
- **Inner padding**: `24px` — inside cards, drawers, sections

### Component Gaps
- **Section gap**: `24px` — between major sections
- **Card gap**: `12px` — between collect/pay cards
- **Quick action gap**: `12px` — grid gap
- **Starred scroll gap**: `12px` — between avatar circles
- **Txn row gap**: `16px` — between avatar and text in transactions
- **Small gap**: `8px` — between icon and text inline
- **Tiny gap**: `2px` — between name and subtitle in transactions
- **Button gap**: `4px` — icon to text in pill buttons

## Border Radius
- **Cards (collect/pay)**: `24px`
- **Drawer top**: `24px`
- **Quick action icons**: `18px`
- **Profile avatar**: `full` (circle)
- **Starred avatars**: `full` (circle)
- **Pill buttons**: `40px`
- **FAB**: `full` (circle)
- **Upgrade banner icon bg**: `full` (circle)

## Shadows
- **Profile ring**: `0px 1px 3px rgba(0,0,0,0.1), 0px 1px 2px -1px rgba(0,0,0,0.1)`
- **Quick action boxes**: `0px 1px 3px rgba(0,0,0,0.01), 0px 1px 2px rgba(0,0,0,0.01)` (very subtle)
- **FAB**: `0px 10px 15px rgba(0,0,0,0.1)`
- **Txn avatar**: `0px 1px 3px rgba(0,0,0,0.1)`

## Layout Patterns

### Page Background
Every page uses the warm gradient: `linear-gradient(to bottom, #f9f9ed, #fdfdfd)` with a subtle decorative background graphic positioned at the top.

### Edge-to-Edge
- Content extends full width with 16px side padding
- No max-width constraint on mobile (full bleed)
- Desktop: max-width 480px centered

### Bottom Drawer Pattern
Content from the upgrade banner downward lives in a **bottom drawer** that:
- Has `border-radius: 24px 24px 0 0` on the top
- White background
- Can expand to full screen when swiped up
- Contains: Upgrade banner (lime bg), then white section with Starred + Recent Transactions

### Header Pattern
- Fixed at top, transparent by default
- Profile photo (40px, circle, teal gradient border, lime `#cfdf2e` plus badge)
- App name centered (20px SemiBold) — truly centered between left/right sides
- Right side: Calculator icon + Notification bell (20px icons)
- On scroll (`scrollY > 16`): frosted cream glass bg `rgba(249,249,237,0.98)` + `backdrop-filter: blur(16px)` + subtle bottom border
- Padding: `12px 16px` (uses `--side-padding`)

### Card Pair Pattern (Collect / Pay)
- Two equal-width cards side by side, 12px gap
- Left card: Teal gradient background, white text
- Right card: Lime `#cddc39` background, dark text
- Both: 24px padding, 24px border-radius
- Content: rupee symbol (13px) + amount (20px SemiBold), then label with arrow icon

### Quick Actions Grid
- 4 columns, equal width
- Each: white rounded box (18px radius) with icon (24px), label below (12px Medium)
- Very subtle shadow

### Starred Contacts
- Horizontal scroll, no scrollbar
- First item: gray circle with "+" icon, label "Add"
- Remaining: colored circle avatars (56px) with 2px white border + shadow
- Name below each (12px Regular #666)

### Transaction Rows
- Left: colored initial circle (24px) in white shadow container (32px)
- Middle: name (16px Medium) + subtitle "Invoice #NNN - Date" (14px Regular #999)
- Right: amount + status badge (PAID green / UNPAID red)
- Far right: pill button "Add" or "View" with teal icon

### Bottom Navigation
- White bar with SVG bezier-curve wave notch at top center (NOT a sharp circle cutout)
- SVG path: `M0,0 H140 C148,0 152,6 158,16 C166,32 176,44 187.5,44 C199,44 209,32 217,16 C223,6 227,0 235,0 H375 V90 H0 Z`
- `preserveAspectRatio="none"` on SVG so it stretches to fill any screen width
- Drop shadow follows the wave shape: `filter: drop-shadow(0 -4px 12px rgba(0, 0, 0, 0.08))` on parent nav
- Center FAB: 48px lime circle (`#cfdf2e`), sits above the notch with `margin-top: -18px`
- FAB shadow: `0 4px 14px rgba(207, 223, 46, 0.45)`
- Nav height: 90px (`--bottom-nav-height`)
- Nav items: icon (22px) + label (11px Medium), aligned to bottom of bar
- Active: teal color (`--color-primary-500`), inactive: `#999` text
- 4 nav items (Home, Parties, Invoices, Items) split left/right of FAB

## Decorative Elements
- **Background pattern**: Subtle circular/wavy graphic overlaid at top of page (low opacity, behind content)
- **Profile badge**: Small lime circle (20px) with crown icon at top-right of profile photo
- **Dot separator**: 6px gray circle between transaction subtitle items

## Global CSS Tokens (from `globals.css :root`)

These tokens are the SSOT. Always use them — never hardcode values.

| Token | Value | Use |
|-------|-------|-----|
| `--side-padding` | `16px` | Edge-to-edge content padding on all pages |
| `--bottom-nav-height` | `90px` | Bottom nav height (for page bottom padding) |
| `--color-primary-500` | `#0B4F5E` | Primary brand teal |
| `--color-secondary-300` | `#E0EA49` | Accent lime-yellow |
| `--space-1` to `--space-8` | 4px–32px | 8pt grid spacing |
| `--radius-sm/md/lg/xl/full` | 8px–9999px | Border radius scale |
| `--shadow-xs/sm/md/card` | Various | Shadow scale |
| `--duration-fast/normal/slow` | 100/200/300ms | Animation durations |
| `--z-sticky/overlay/modal/toast` | 20/40/50/70 | Z-index scale |

## Reusable Patterns for Future Pages

### Page Layout
```css
.page-container {
  padding: var(--space-6) var(--side-padding) calc(var(--bottom-nav-height) + 16px);
}
```
Every page uses `--side-padding` for horizontal padding and accounts for bottom nav height.

### Section Spacing
- Between major sections: `24px` (`--space-6`)
- Between items within a section: `12px` (`--space-3`)
- Between card pairs: `12px` gap

### Frosted Glass Effect (for sticky headers/toolbars)
```css
background: rgba(249, 249, 237, 0.98);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border-bottom: 1px solid rgba(0, 0, 0, 0.04);
```

### Card Style
- White background, `border-radius: 24px`, `padding: 24px`
- Very subtle shadow: `--shadow-card`
- No borders (shadow-only elevation)

### List Item Row
- 44px min touch target height
- Left: avatar/icon (32-40px circle)
- Middle: title (16px Medium) + subtitle (14px Regular #999)
- Right: amount/badge + action pill button

### Empty State
- Centered icon (48-64px, muted color)
- Title (16px SemiBold) + description (14px Regular #999)
- CTA button below

### Pill Button
- `border-radius: 40px`, `padding: 6px 12px`
- Teal text on light teal bg `rgba(22, 85, 90, 0.05)`
- Icon (14px) + label (12px Medium)

## Animation & Interaction
- **Drawer**: CSS transition on transform for bottom drawer expansion
- **Scroll**: Smooth horizontal scroll on starred contacts
- **Touch**: All interactive elements min 44x44px
- **Transitions**: 200ms ease for hover/active states
- **Header scroll**: Frosted glass appears at `scrollY > 16px`
- **CSS only**: No framer-motion — all animations via CSS keyframes/transitions
