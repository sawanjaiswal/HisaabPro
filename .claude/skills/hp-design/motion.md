# HisaabPro Motion & Animation System

> SSOT: `src/styles/tokens-core.css` + `src/styles/animations.css` + `src/styles/base.css`

## Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--duration-fast` | 100ms | Button press, toggle, checkbox |
| `--duration-normal` | 200ms | Standard transitions (hover, color change) |
| `--duration-slow` | 300ms | Page transitions, modals, drawers |

## Easing Curves

| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Standard (Material Design) — most transitions |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Bounce effect — toasts, success feedback |

Add `--ease-in` (`cubic-bezier(0.4, 0, 1, 1)`) for exit and `--ease-out` (`cubic-bezier(0, 0, 0.2, 1)`) for enter when needed.

## Built-in Keyframes (from animations.css)

| Keyframe | Effect | Usage |
|----------|--------|-------|
| `spin` | 360° rotation | Spinners, loading indicators |
| `shimmer` | 200% bg slide | Skeleton loading (animate-pulse alternative) |
| `fadeIn` | opacity 0→1 | General reveal |
| `slideUp` | translateY(8px) + fade | Page content entrance |
| `scaleIn` | scale(0.95) + fade | Modal/dialog entrance |
| `accordion-down` | height 0→auto | Collapsible sections open |
| `accordion-up` | height auto→0 | Collapsible sections close |
| `page-enter` | translateY(8px) + fade | Route change transitions |
| `drawer-rise` | white drawer elevation | Page container mount |
| `header-enter` | slide-down from top | Header appearance |

## Page Transition System (base.css)

- Suspense fallback uses `fadeIn` with 150ms delay
- Page content: `page-enter` animation (300ms)
- Landing page: no transform (preserves fixed positioning)
- Dark mode inherits same transitions automatically

## Animation Classes

| Class | Effect | Duration |
|-------|--------|----------|
| `animate-pulse` | Opacity pulse | 2s infinite |
| `animate-spin` | 360° rotation | 1s infinite |
| Stagger delay | `style={{ animationDelay: '0.1s' }}` per item | Sequential list entrance |

## Motion Principles

1. **Fast over fancy** — 100-300ms for most interactions. Users shouldn't wait
2. **Physics-based** — `--ease-spring` for playful UI (toasts, badges), `--ease-default` for standard
3. **Respect preferences** — `@media (prefers-reduced-motion: reduce)` disables ALL animations
4. **No layout shift** — use `transform` and `opacity` only (GPU-composited)
5. **Button press** — `active:scale-95` for tactile feedback on pressable elements
6. **Stagger list items** — 50-100ms delay increment per item for list entrance
7. **Page transitions** — fade-in + slight translateY. Never slide entire page left/right

## Focus Ring

Applied globally via `:focus-visible`:
```css
outline: 2px solid var(--color-primary-400);
outline-offset: 2px;
```
Keyboard users only — not triggered by mouse clicks.

## Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

All animations gracefully degrade. No motion-dependent functionality.
