# HisaabPro Color System

> SSOT: `src/styles/tokens-colors.css` + `src/styles/tokens-dark.css`
> Theme switch: `[data-theme="dark"]` on `:root`

## Core Palette

### Primary (Deep Emerald Green — trust, growth, money)
> Migrated 2026-07 from Deep Teal (#0B4F5E). Green now signals both brand
> identity AND the "money/growth" story that fits a billing app.
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `#E6F3EC` | Ultra-light tint backgrounds |
| `--color-primary-100` | `#D2ECDC` | Soft tint, selected states |
| `--color-primary-200` | `#A5D8BA` | Light tint |
| `--color-primary-300` | `#55B384` | Medium tint |
| `--color-primary-400` | `#068A48` | Focus rings, active states |
| `--color-primary-500` | `#026F39` | **BRAND PRIMARY** — logos, headers, links |
| `--color-primary-600` | `#024E29` | CTA button background |
| `--color-primary-700` | `#013D20` | CTA hover, nav-active, FAB, dark on lime accent |
| `--color-primary-800` | `#012E18` | Darkest tint, deep hero surface |
| `--color-primary-900` | `#011F10` | Near-black emerald |

> **Two greens — keep them distinct.** Brand emerald (`--color-primary-*`,
> #026F39) = identity, primary CTAs, nav-active tab/underline/FAB, dark hero
> surfaces, links. Success green (`--color-success-500`, #22C55E, below) =
> **status only** — paid chips, up-deltas, "Good". Never a primary CTA or nav
> element. On dark emerald hero surfaces, accents (up-delta, chart line,
> sparkline dot) use bright `--color-success-300/400` for contrast.

### Secondary (Lime-Yellow — energy, CTAs)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-secondary-50` | `#FCFDED` | Ultra-light lime |
| `--color-secondary-100` | `#FAFCE4` | Soft lime |
| `--color-secondary-200` | `#F0F3A8` | Light lime |
| `--color-secondary-300` | `#E0EA49` | **ACCENT** — highlight CTAs, badges |
| `--color-secondary-400` | `#C8D232` | Hover lime |
| `--color-secondary-500` | `#B3BB3A` | Pressed lime |

### Neutrals (Warm-Tinted — NOT cool gray)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-gray-0` | `#FFFFFF` | Card bg, input bg |
| `--color-gray-50` | `#F8F7F4` | **Page bg** (warm cream — NexoWallet signature) |
| `--color-gray-100` | `#F0EFEB` | Card borders, dividers |
| `--color-gray-200` | `#E2E0DA` | Input borders, disabled |
| `--color-gray-300` | `#C5C3BB` | Placeholder text |
| `--color-gray-400` | `#9C9A92` | Muted text, secondary icons |
| `--color-gray-500` | `#7A7870` | Secondary text |
| `--color-gray-600` | `#5A584F` | Body text |
| `--color-gray-700` | `#3D3B35` | Strong text |
| `--color-gray-800` | `#2A2824` | Headings, primary text |
| `--color-gray-900` | `#1A1917` | Near-black |

### Status Colors
| Status | 50 (bg) | 100 | 500 (main) | 600 | 700 |
|--------|---------|-----|------------|-----|-----|
| **Success** | `#ECFDF5` | `#D1FAE5` | `#22C55E` | `#16A34A` | `#15803D` |
| **Error** | `#FEF2F2` | `#FEE2E2` | `#EF4444` | `#DC2626` | `#B91C1C` |
| **Warning** | `#FFFBEB` | `#FEF3C7` | `#F59E0B` | `#D97706` | `#B45309` |
| **Info** | `#EFF6FF` | `#DBEAFE` | `#3B82F6` | `#2563EB` | `#1D4ED8` |

### Emerald Hero surface (signature two-tone skin)
> The dark field behind the header + hero content on every primary screen
> (Home, Party detail, …). Paired with the white rounded sheet below it.
| Token | Value | Usage |
|-------|-------|-------|
| `--color-hero-surface` | `#003121` | Dark emerald hero surface + recoloured header |
| `--color-hero-text-secondary` | `rgba(255,255,255,.8)` | Labels/eyebrows on the emerald field |
| `--color-white-inverse` | `#FFFFFF` | Values / titles on the emerald field |

- Home's hand-built twin samples a slightly different pair
  (`--hp-dash-surface: #012619`, `--hp-dash-card: #003121`); new pages use
  `--color-hero-surface` via `HeroPage`.
- Accents on the emerald (up-delta, chart line, sparkline dot) use bright
  `--color-success-300/400` — never the dark brand emerald (invisible on it).

### Special Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--color-lime-accent` | `#cfdf2e` | Figma design accent |
| `--color-whatsapp` | `#25D366` | WhatsApp buttons/links |
| `--color-white-inverse` | `#FFFFFF` | Always white |
| `--color-black-inverse` | `#111827` | Always black |

## Semantic Text Colors (auto-mapped)
| Token | Maps to | Usage |
|-------|---------|-------|
| `--text-primary` | `--color-gray-800` | Main text |
| `--text-secondary` | `--color-gray-600` | Supporting text |
| `--text-muted` | `--color-gray-400` | Placeholders, captions |
| `--text-inverse` | `--color-white-inverse` | Text on dark bg |

## Gradients (Hero Cards)
| Name | Start | End | Usage |
|------|-------|-----|-------|
| Emerald | `--gradient-teal-start` (#026F39) | `--gradient-teal-end` (#013D20) | Collected/received cards (token name kept for compatibility) |
| Coral | `--gradient-coral-start` (#ef5350) | `--gradient-coral-end` (#c62828) | Due/overdue cards |
| Amber | `--gradient-amber-start` (#f59e0b) | `--gradient-amber-end` (#d97706) | Low stock alerts |
| Calculator | `--gradient-calc-start` (#026F39) | `--gradient-calc-end` (#013D20) | Calculator display |
| Cream page | `--color-cream-start` (#f9f9ed) | via `--color-cream-mid` (#fafaef) | `--color-cream-end` (#fdfdfd) | Dashboard/landing bg |

## Subtle Background Tints (badges, chips)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-success-bg-subtle` | `rgba(34, 197, 94, 0.12)` | Paid badge bg |
| `--color-error-bg-subtle` | `rgba(239, 68, 68, 0.12)` | Overdue badge bg |
| `--color-warning-bg-subtle` | `rgba(245, 158, 11, 0.12)` | Pending badge bg |
| `--color-info-bg-subtle` | `rgba(59, 130, 246, 0.12)` | Info badge bg |
| `--color-primary-bg-subtle` | `rgba(2, 111, 57, 0.12)` | Primary (emerald) tint bg |

## Overlay System
| Token | Value | Usage |
|-------|-------|-------|
| `--overlay-white-*` | 01 to 90 opacity | Frosted glass, watermarks |
| `--overlay-black-*` | 04 to 20 opacity | Darkening effects |
| `--overlay-primary-*` | 04 to 25 opacity | Emerald tint overlays (FAB shadow, etc.) |
| `--overlay-success-*` | 05 to 25 opacity | Green tint overlays |
| `--overlay-error-*` | 05 to 35 opacity | Red tint overlays |
| `--overlay-warning-*` | 05 to 25 opacity | Amber tint overlays |
| `--backdrop-color` | `rgba(26, 25, 23, 0.5)` | Modal backdrop |
| `--backdrop-dark` | `rgba(0, 0, 0, 0.4)` | Dark backdrop |
| `--backdrop-feedback` | `rgba(0, 0, 0, 0.6)` | Strong backdrop |
| `--header-glass-bg` | `rgba(248, 247, 244, 0.92)` | Frosted header (light) |

## Dark Theme
Applied via `[data-theme="dark"]` in `tokens-dark.css`. All tokens auto-swap:
- Primary brightens to emerald (#35C176) — inverted ramp, 50=darkest
- Secondary brightens (#D4DC4A)
- Grays invert (bg: #0B0F15, text: #E0E2E7)
- Shadows darken with border accent overlays
- Components need ZERO `dark:` prefixes — CSS variables handle everything

## Summary-Tile Tones (`<SummaryTiles>` — detail pages)
The 3-up stat tiles on Party/Invoice/Payment detail. Each `tone` maps to a
light tint bg + a toned value colour:
| `tone` | Value colour | Tile bg | Use |
|--------|--------------|---------|-----|
| `due` | `--color-error-500` | `--color-error-50` | Amount owed / overdue |
| `sales` | `--color-success-600` | `--color-success-50` | Total sales / received |
| `paid` | `--color-success-600` | `--color-success-50` | Paid amount |
| `info` | `--color-info-600` | `--color-info-50` | Last payment / dated facts |
| `neutral` | `--text-primary` | `--color-gray-50` | Plain count / fallback |

## Category icon-square tints (the universal list/row/tile motif)
Every list row, settings row, quick-action tile, report card, notification, and
priority item carries a 40×40 `--radius-md` icon square, tinted by category. This
is the single most-repeated element in the app (see `screen-archetypes.md`). Use
ONLY these existing families — no purple/violet token exists:
| Category | Square bg | Icon colour |
|----------|-----------|-------------|
| Customer / party / collection | `--color-primary-50` | `--color-primary-500` |
| Payment received / money-in | `--color-success-50` | `--color-success-600` |
| Expense / due / overdue / out-of-stock | `--color-error-50` | `--color-error-500` |
| Product / stock / inventory / low-stock | `--color-warning-50` | `--color-warning-600` |
| Invoice / estimate / quotation / supplier / purchase | `--color-info-50` | `--color-info-600` |
| Draft / disabled / neutral / "More" | `--color-gray-100` | `--color-gray-500` |

> Mockups render quotations/purchase in violet — map to `info` (blue) in code.

## Ledger Row Direction Tints (transaction rows)
Direction-coloured icon square on ledger/transaction rows:
| Direction | Icon | Square bg | Arrow colour |
|-----------|------|-----------|--------------|
| Debit (sale / invoice, balance ↑) | `ArrowUp` | `--color-error-50` (coral) | `--color-error-500` |
| Credit (payment received, balance ↓) | `ArrowDown` | `--color-success-50` | `--color-success-600` |

The credit amount renders green with a leading `−` (`--color-success-600`);
the debit amount stays `--text-primary`.

## Data-Grid / Accounting Table Tints (archetype O)
Compact accounting grids (`<ResponsiveTable density="compact" alwaysTable zebra>` —
day book, trial balance, stock register, GST tables). Reuse existing neutrals — no
new tokens:
| Element | Token |
|---------|-------|
| Gridline / row divider | `--color-gray-100` |
| Zebra alt-row tint (odd rows) | `--color-gray-50` |
| Sticky header bg | `--color-gray-50` |
| Totals row bg (bold, `tabular-nums`) | `--color-gray-50` |
| Debit amount (Dr, balance ↑) | `--color-error-500` |
| Credit amount (Cr, balance ↓) | `--color-success-600` |

Numbers are always right-aligned + `tabular-nums`. This is the accounting-density
counterpart of the consumer icon-square row above — same palette, tighter spacing.

## Rules

1. **NEVER use raw hex in components** — always `var(--color-*)` or `style={{ color: 'var(--color-*)' }}`
2. **NEVER use Tailwind color classes** (`bg-green-500`, `text-gray-600`) — use CSS variables
3. **Dark mode is automatic** — tokens swap via `[data-theme="dark"]`, no `dark:` prefixes
4. **Warm neutrals** — text/border use warm grays, never cold (#374151)
5. **Financial amounts**: positive = `--color-success-600`, negative = `--color-error-500`
6. **Badge backgrounds**: use `--color-*-bg-subtle` (12% opacity), NOT solid colors
