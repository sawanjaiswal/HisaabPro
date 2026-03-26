# HisaabPro Color System

> SSOT: `src/styles/tokens-colors.css` + `src/styles/tokens-dark.css`
> Theme switch: `[data-theme="dark"]` on `:root`

## Core Palette

### Primary (Deep Teal — trust, professionalism)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary-50` | `#E7EFF1` | Ultra-light tint backgrounds |
| `--color-primary-100` | `#DAEBEA` | Soft tint, selected states |
| `--color-primary-200` | `#A8D4D4` | Light tint |
| `--color-primary-300` | `#5AACAB` | Medium tint |
| `--color-primary-400` | `#0A6375` | Focus rings, active states |
| `--color-primary-500` | `#0B4F5E` | **BRAND PRIMARY** — logos, headers |
| `--color-primary-600` | `#052D35` | CTA button background |
| `--color-primary-700` | `#042329` | CTA hover, dark on lime accent |
| `--color-primary-800` | `#031B20` | Darkest tint |
| `--color-primary-900` | `#021418` | Near-black teal |

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
| Teal | `--gradient-teal-start` (#1b6369) | `--gradient-teal-end` (#123e42) | Collected/received cards |
| Coral | `--gradient-coral-start` (#ef5350) | `--gradient-coral-end` (#c62828) | Due/overdue cards |
| Amber | `--gradient-amber-start` (#f59e0b) | `--gradient-amber-end` (#d97706) | Low stock alerts |
| Calculator | `--gradient-calc-start` (#0B4F5E) | `--gradient-calc-end` (#0a3d4a) | Calculator display |
| Cream page | `--color-cream-start` (#f9f9ed) | via `--color-cream-mid` (#fafaef) | `--color-cream-end` (#fdfdfd) | Dashboard/landing bg |

## Subtle Background Tints (badges, chips)
| Token | Value | Usage |
|-------|-------|-------|
| `--color-success-bg-subtle` | `rgba(34, 197, 94, 0.12)` | Paid badge bg |
| `--color-error-bg-subtle` | `rgba(239, 68, 68, 0.12)` | Overdue badge bg |
| `--color-warning-bg-subtle` | `rgba(245, 158, 11, 0.12)` | Pending badge bg |
| `--color-info-bg-subtle` | `rgba(59, 130, 246, 0.12)` | Info badge bg |
| `--color-primary-bg-subtle` | `rgba(27, 99, 105, 0.12)` | Primary tint bg |

## Overlay System
| Token | Value | Usage |
|-------|-------|-------|
| `--overlay-white-*` | 01 to 90 opacity | Frosted glass, watermarks |
| `--overlay-black-*` | 04 to 20 opacity | Darkening effects |
| `--overlay-primary-*` | 04 to 20 opacity | Teal tint overlays |
| `--overlay-success-*` | 05 to 25 opacity | Green tint overlays |
| `--overlay-error-*` | 05 to 35 opacity | Red tint overlays |
| `--overlay-warning-*` | 05 to 25 opacity | Amber tint overlays |
| `--backdrop-color` | `rgba(26, 25, 23, 0.5)` | Modal backdrop |
| `--backdrop-dark` | `rgba(0, 0, 0, 0.4)` | Dark backdrop |
| `--backdrop-feedback` | `rgba(0, 0, 0, 0.6)` | Strong backdrop |
| `--header-glass-bg` | `rgba(248, 247, 244, 0.92)` | Frosted header (light) |

## Dark Theme
Applied via `[data-theme="dark"]` in `tokens-dark.css`. All tokens auto-swap:
- Primary brightens to cyan (#3FAED6)
- Secondary brightens (#D4DC4A)
- Grays invert (bg: #0B0F15, text: #E0E2E7)
- Shadows darken with border accent overlays
- Components need ZERO `dark:` prefixes — CSS variables handle everything

## Rules

1. **NEVER use raw hex in components** — always `var(--color-*)` or `style={{ color: 'var(--color-*)' }}`
2. **NEVER use Tailwind color classes** (`bg-green-500`, `text-gray-600`) — use CSS variables
3. **Dark mode is automatic** — tokens swap via `[data-theme="dark"]`, no `dark:` prefixes
4. **Warm neutrals** — text/border use warm grays, never cold (#374151)
5. **Financial amounts**: positive = `--color-success-600`, negative = `--color-error-500`
6. **Badge backgrounds**: use `--color-*-bg-subtle` (12% opacity), NOT solid colors
