# HisaabPro Typography System

> SSOT: `src/styles/tokens-core.css`

## Font Families

| Token | Font | Fallback | Usage |
|-------|------|----------|-------|
| `--font-primary` | Inter | 'Noto Sans Devanagari', system-ui, sans-serif | All text — body, headings, labels, buttons |
| `--font-display` | Inter | system-ui, sans-serif | Hero text, display sizes |
| `--font-mono` | JetBrains Mono | 'Roboto Mono', monospace | Code, invoice numbers, tabular data |

### Font Family Rules
- Inter is used for EVERYTHING (headings + body) — clean, premium feel
- Noto Sans Devanagari fallback for Hindi text
- Apply `tabular-nums` class on all financial figures for column alignment
- `font-mono` only for invoice numbers, barcodes, code

## Type Scale (all rem for accessibility)

| Token | Size | px equiv | Usage |
|-------|------|----------|-------|
| `--fs-3xs` | 0.625rem | 10px | Micro badges |
| `--fs-2xs` | 0.6875rem | 11px | Tiny labels, badge text |
| `--fs-xs` | 0.75rem | 12px | Captions, timestamps |
| `--fs-sm` | 0.8125rem | 13px | Secondary text, labels |
| `--fs-md` | 0.875rem | 14px | Body small, nav items |
| `--fs-df` | 0.9375rem | 15px | Default body, card text |
| `--fs-base` | 1rem | 16px | Inputs, primary body |
| `--fs-lg` | 1.0625rem | 17px | Emphasized body |
| `--fs-xl` | 1.125rem | 18px | Section titles |
| `--fs-2xl` | 1.25rem | 20px | Page titles |
| `--fs-3xl` | 1.375rem | 22px | Large headings |
| `--fs-4xl` | 1.5rem | 24px | Hero subheadings |
| `--fs-5xl` | 2rem | 32px | Hero headings |
| `--fs-6xl` | 3rem | 48px | Hero amounts |
| `--fs-7xl` | 3.5rem | 56px | Landing hero (extra) |

### Extra sizes
| Token | Size | Usage |
|-------|------|-------|
| `--fs-6-5xl` | 3.25rem (52px) | Tablet hero |
| `--fs-3-5xl` | 1.875rem (30px) | Login title |

## Font Weights

| Weight | Value | Tailwind | Usage |
|--------|-------|----------|-------|
| Regular | 400 | `font-normal` | Body text, descriptions |
| Medium | 500 | `font-medium` | Labels, secondary emphasis |
| Semibold | 600 | `font-semibold` | Headings, buttons, amounts |
| Bold | 700 | `font-bold` | Page titles, hero numbers |

## Typography Patterns

### Page Title (list pages)
```
text-[var(--fs-2xl)] font-bold
color: var(--text-primary)
```

### Page Title (form pages)
```
text-[var(--fs-xl)] font-semibold
color: var(--text-primary)
```

### Section Header
```
text-[var(--fs-xs)] font-medium uppercase tracking-wider
color: var(--text-muted)
```

### Card Title
```
text-[var(--fs-lg)] font-semibold
color: var(--text-primary)
```

### Body Text (default)
```
text-[var(--fs-df)] font-normal
color: var(--text-primary)
```

### Label / Caption
```
text-[var(--fs-sm)] font-medium
color: var(--text-secondary)
```

### Small / Muted
```
text-[var(--fs-xs)]
color: var(--text-muted)
```

### Hero Amount (Dashboard)
```
text-[var(--fs-5xl)] font-bold tabular-nums
color: var(--text-inverse) (on gradient) or var(--text-primary) (on white)
```

### Button Text
```
text-[var(--fs-base)] font-semibold
```

### Row Item Name
```
text-[var(--fs-df)] font-semibold leading-tight truncate
color: var(--text-primary)
```

### Row Item Subtitle
```
text-[var(--fs-xs)] mt-0.5
color: var(--text-muted)
```

## Rules

1. **ALL font sizes MUST use rem** via `var(--fs-*)` — never px
2. **Minimum readable font size: `var(--fs-3xs)` (10px)** — anything smaller is WCAG violation
3. **Input font-size MUST be `var(--fs-base)` (16px / 1rem)** — prevents iOS Safari auto-zoom
4. **Use `tabular-nums` class on financial numbers** — ensures columns align
5. **Line-height**: headings = 1.2-1.3, body = 1.5, relaxed = 1.6
6. **Letter-spacing**: tight (-0.02em) for display, normal (0) for body, wide (0.05em+) for labels/overlines
