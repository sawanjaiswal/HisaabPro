# HisaabPro Spacing & Elevation System

> SSOT: `src/styles/tokens-core.css`

## Spacing Scale (8pt grid)

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| `--space-1` | 0.25rem (4px) | `gap-1`, `p-1` | Tight gaps (icon-to-icon) |
| `--space-2` | 0.5rem (8px) | `gap-2`, `p-2` | Small gaps (icon-to-label) |
| `--space-3` | 0.75rem (12px) | `gap-3`, `p-3` | Input padding, list gaps |
| `--space-4` | 1rem (16px) | `gap-4`, `p-4` | Standard card padding, page gutters |
| `--space-5` | 1.25rem (20px) | `gap-5`, `p-5` | Section padding |
| `--space-6` | 1.5rem (24px) | `gap-6`, `p-6` | Between card groups |
| `--space-8` | 2rem (32px) | `gap-8`, `p-8` | Section breaks |

## Page Layout

| Token | Value | Usage |
|-------|-------|-------|
| `--side-padding` | 16px | Horizontal page padding (`px-4`) |
| `--bottom-nav-height` | `calc(72px + safe-area)` | Bottom nav height (safe area aware) |

### Layout Patterns
| Class | Effect |
|-------|--------|
| `px-4` | Horizontal page padding (16px) |
| `pb-[calc(var(--bottom-nav-height)+2rem)]` | Bottom clearance for nav |
| `max-w-md mx-auto` | Centered form container |
| `min-h-screen` | Full height page |

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 8px | Buttons, small chips |
| `--radius-md` | 12px | Inputs, toast |
| `--radius-lg` | 16px | Modals, drawers (top) |
| `--radius-xl` | 20px | Cards, large containers |
| `--radius-full` | 9999px | Pills, avatars, chips |

### Component Radius — ACTUAL values
| Element | Token | Tailwind | NEVER |
|---------|-------|----------|-------|
| Cards | `--radius-xl` (20px) | `rounded-[var(--radius-xl)]` | `rounded-lg` |
| Inputs | `--radius-md` (12px) | `rounded-[var(--radius-md)]` | `rounded-md` |
| Buttons | `--radius-sm` (8px) | `rounded-[var(--radius-sm)]` | `rounded-full` |
| Drawers (top) | `--radius-lg` (16px) | `rounded-t-[var(--radius-lg)]` | `rounded-t-md` |
| Modals | `--radius-lg` (16px) | `rounded-[var(--radius-lg)]` | `rounded-md` |
| Chips/Badges | `--radius-full` | `rounded-full` | `rounded-lg` |
| Avatars | `--radius-full` | `rounded-full` | anything else |

## Shadows

### Standard Shadows
| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(26,25,23,0.04)` | Hairline elevation |
| `--shadow-sm` | `0 1px 3px rgba(26,25,23,0.06), ...` | Subtle cards |
| `--shadow-md` | `0 4px 6px -1px rgba(26,25,23,0.06), ...` | Standard cards |
| `--shadow-card` | `0 2px 12px rgba(26,25,23,0.04), ...` | Default card shadow |
| `--shadow-card-hover` | `0 4px 16px rgba(26,25,23,0.08), ...` | Card hover state |
| `--shadow-modal` | `0 20px 25px -5px rgba(26,25,23,0.1)` | Modals |
| `--shadow-subtle` | `0 2px 8px rgba(0,0,0,0.06)` | Gentle elevation |

### Contextual Shadows
| Token | Usage |
|-------|-------|
| `--shadow-fab` | Primary FAB (teal glow) |
| `--shadow-fab-lime` | Lime accent FAB glow |
| `--shadow-dropdown` | Dropdown menus |
| `--shadow-drawer-bottom` | Bottom drawer slide-up |
| `--shadow-drawer-desktop` | Desktop drawer/modal |
| `--shadow-nav-drop` | Bottom nav elevation |
| `--shadow-pill-active` | Active filter pill |
| `--shadow-focus-primary` | Focus ring shadow |
| `--shadow-teal-btn` | Teal button glow |

### Dark Theme Shadows
| Token | Usage |
|-------|-------|
| `--shadow-card-dark` | Dark mode card (border accent) |
| `--shadow-card-dark-hover` | Dark mode card hover |
| `--shadow-card-dark-sm` | Small dark mode card |

### Backdrop & Overlay
| Token | Value | Usage |
|-------|-------|-------|
| `--backdrop-color` | `rgba(26,25,23,0.5)` | Modal backdrop (light) |
| `--backdrop-dark` | `rgba(0,0,0,0.4)` | Dark backdrop |
| `--backdrop-feedback` | `rgba(0,0,0,0.6)` | Strong backdrop |
| `--header-glass-bg` | `rgba(248,247,244,0.92)` | Frosted header |

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Sticky | `var(--z-sticky)` = 20 | Sticky headers, sub-headers |
| Overlay | `var(--z-overlay)` = 40 | Backdrops, FABs |
| Modal | `var(--z-modal)` = 50 | Modals, drawers |
| Toast | `var(--z-toast)` = 70 | Toast notifications |

## Touch Targets

| Minimum | Comfortable | Usage |
|---------|-------------|-------|
| 44px | 48px | All interactive elements MUST be >= 44px |

Use `min-h-[44px]` on all buttons, links, interactive rows.

## Icon Sizes

| Size | Value | Usage |
|------|-------|-------|
| Small | `w-4 h-4` (16px) | Form field icons, small buttons |
| Medium | `w-5 h-5` (20px) | Action buttons, nav |
| Large | `w-6 h-6` (24px) | Dialog headers, feature icons |
| XL | `w-8 h-8` (32px) | Hero/empty state icons |
