# Landing Page Redesign — Design Spec

## Overview

Premium overhaul of the HisaabPro landing page to improve conversion, fix light mode issues, and elevate visual quality to match the "looks expensive — and it's free?" goal.

**Stack:** React 19 + TypeScript + Tailwind CSS 4 + motion (framer-motion)
**Scope:** Existing landing page components in `src/components/ui/` and `src/features/landing/`

## Section Flow (approved)

```
1. Hero + Nav          — new headline, secondary CTA, inline social proof
2. Social Proof Bar    — NEW component (stats strip)
3. Feature Bento Grid  — existing, add section bg
4. How It Works        — REDESIGN with vertical/horizontal timeline
5. Pricing             — existing, fix heading size
6. Testimonials        — existing, add pause-on-hover, section bg
7. FAQ                 — existing, moved after testimonials
8. Final CTA           — existing, fix light mode contrast
9. Footer              — existing, fix max-width
+ Sticky Mobile CTA    — NEW component (floating bottom bar)
```

## Section 1: Hero Redesign

### Headline
```
Run your entire business
from your pocket.
Even without internet.
```

### Changes
- **Secondary CTA button**: "Watch Demo" ghost button next to "Start 14-Day Free Trial"
  - Light: `border border-gray-300 text-gray-700 hover:bg-gray-50`
  - Dark: `border border-white/20 text-white hover:bg-white/5`
- **Inline social proof**: Below CTA buttons, single line
  - Content: `★★★★★ 4.8/5 rating | 10,000+ businesses | No credit card`
  - Style: `text-sm text-gray-600 dark:text-gray-400` (gray-600 minimum for light bg contrast)
- **Primary CTA color fix**: Use `bg-[#1e3a5f] text-white hover:bg-[#2563eb]` in BOTH modes. All primary CTAs across the entire page use this same treatment — no theme-inverted buttons.
- **Secondary CTA ("Watch Demo")**: Scrolls to `#features` section (soft anchor to show the product)
- **Local images**: Download and save to `public/images/`:
  - `https://i.postimg.cc/Ss6yShGy/glows.png` → `public/images/hero-glow.png`
  - `https://i.postimg.cc/SKcdVTr1/Dashboard2.png` → `public/images/dashboard-preview.png`
  - Reference as `/images/hero-glow.png` and `/images/dashboard-preview.png`
  - Also update `src/features/landing/components/LandingHero.tsx` if it references the same URLs
- **Gradient button variant fix**: Same `bg-[#1e3a5f]` base, not theme-inverted

### Files Modified
- `src/components/ui/saa-s-template.tsx` (Hero, Button variants)

## Section 2: Social Proof Bar (NEW)

### Component: `SocialProofBar`
Location: `src/components/ui/social-proof-bar.tsx`

### Design
- Full-width strip with subtle background: `bg-black/[0.02] dark:bg-white/[0.03]`
- Top/bottom border: `border-y border-gray-200/60 dark:border-white/[0.06]`
- 4 stats in a centered row with vertical dividers:
  1. **10,000+** — Indian businesses
  2. **₹50Cr+** — invoices created
  3. **★★★★★ 4.8** — Play Store rating
  4. **99.9%** — uptime guarantee
- **Desktop**: Horizontal flex, `gap-10`, stats centered
- **Mobile**: 2x2 grid, `gap-6`
- **Animation**: Numbers count up on scroll into view (use `whileInView` from motion)
- **Container**: `max-w-7xl mx-auto px-6`

### Light/Dark
- Numbers: `text-gray-900 dark:text-white` (font-bold)
- Labels: `text-gray-600 dark:text-gray-400` (text-sm — gray-600 for light bg #e8f4ff contrast)
- **Reduced motion**: If `prefers-reduced-motion`, show final numbers immediately without count-up animation
- Stars: `text-amber-500` in both modes

## Section 3: Feature Bento Grid

### Changes
- Add section background for rhythm: wrap in `bg-transparent` (no change needed, it's the "main bg" slot)
- No other changes — this section is strong as-is

## Section 4: How It Works — Timeline Redesign

### Design: Vertical timeline (mobile) / Horizontal (desktop)

**Vertical (mobile, default):**
- Each step: numbered circle (40x40, gradient bg) + connecting vertical line + title + description + time badge
- Numbered circles use step-specific gradient colors:
  1. Blue: `from-blue-500 to-[#1e3a5f]`
  2. Violet: `from-violet-500 to-violet-700`
  3. Emerald: `from-emerald-500 to-emerald-700`
  4. Amber: `from-amber-500 to-amber-700`
- Connecting line: 2px wide, gradient fading from step color to transparent
- Time badges: pill-shaped (`rounded-full`), step-colored background at 10% opacity
  - "30 seconds", "2 minutes", "2 taps", "Unlimited"
- Animation: staggered `whileInView` from left, 0.15s delay between steps

**Horizontal (lg: and above):**
- Same numbered circles, connected by horizontal line
- Content below each circle
- 4-column grid

**Section wrapper:**
- Add `id="how-it-works"` (fixes dead footer link)
- Background: `bg-black/[0.02] dark:bg-white/[0.03]` (tinted slot)
- Container: `max-w-7xl mx-auto px-6`

### Files Modified
- `src/components/ui/feature-hover-effects.tsx` (rewrite — this is the component currently rendered in `LandingPage.tsx`)
- `src/features/landing/components/LandingHowItWorks.tsx` — DELETE (dead code, not rendered; was an earlier version)
- `src/features/landing/landing.constants.ts` — remove STEPS data if it becomes unused after deleting LandingHowItWorks

## Section 5: Pricing

### Changes
- Heading: `text-3xl` → `text-4xl font-semibold lg:text-5xl` (match all sections)
- Container already uses `max-w-6xl` — keep as is (pricing cards look better slightly narrower)
- No other changes

### Files Modified
- `src/components/ui/pricing-section.tsx` (heading only)

## Section 6: Testimonials

### Changes
- **Pause on hover**: Use `useAnimationControls()` from motion/react
  - `controls.stop()` on `onMouseEnter` (pauses the infinite translateY animation)
  - `controls.start({ translateY: "-50%", transition: { duration, repeat: Infinity, ... } })` on `onMouseLeave`
  - Wrap the testimonial columns container with the hover handlers
- **Section background**: Wrap in tinted bg `bg-black/[0.02] dark:bg-white/[0.03]`
- No other changes — testimonial content and layout are excellent

### Files Modified
- `src/components/ui/testimonial-v2.tsx`

## Section 7: FAQ

### Changes
- **Position**: Moved after Testimonials (was before Pricing)
- No content or style changes

### Files Modified
- `src/features/landing/LandingPage.tsx` (reorder)

## Section 8: Final CTA — Light Mode Fix

### Changes
All hardcoded dark-mode colors replaced with theme-aware classes:

| Current | Fixed |
|---------|-------|
| `text-neutral-400` (body) | `text-gray-600 dark:text-gray-400` |
| `text-neutral-400` (trust badges) | `text-gray-500 dark:text-gray-400` |
| `text-neutral-400 hover:text-white` (Contact Us) | `text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white` |
| `bg-white text-black` (button) | `bg-[#1e3a5f] text-white` (same in both modes — matches Hero CTA) |
| `hover:bg-neutral-200` (button hover) | `hover:bg-[#2563eb]` (same in both modes) |

- Heading: add explicit `text-gray-900 dark:text-white` (remove inline style override)
- Background glow: works in both modes (keep as-is)

### Files Modified
- `src/components/ui/cta-section.tsx`

## Section 9: Footer

### Changes
- `max-w-6xl` → `max-w-7xl` (consistent with all sections)

### Files Modified
- `src/components/ui/footer-section.tsx`

## Sticky Mobile CTA (NEW)

### Component: `StickyMobileCTA`
Location: `src/components/ui/sticky-mobile-cta.tsx`

### Behavior
- **Appears**: When user scrolls past hero CTA (use IntersectionObserver on hero CTA button)
- **Hides**: When hero CTA or final CTA section is in viewport
- **Viewport**: Mobile only — `md:hidden`
- **Animation**: Slide up + fade in, 200ms ease-out

### Design
- Fixed bottom bar: `fixed bottom-0 left-0 right-0 z-[${Z.floatingAction}]` (import from `src/config/zIndexes.ts` — value 40, below nav at 30... wait, nav is z-50 in current code. Use `z-[40]` which is `Z.floatingAction` from the project's z-index scale, below `Z.dropdown` at 50)
- Background: `bg-black/95 dark:bg-black/95 backdrop-blur-xl` (dark in both modes for contrast)
- Light mode also uses dark bar (CTA bars should pop, not blend)
- Layout: flex row — left side text ("Start free trial" + "14 days, no card"), right side button
- Button: `bg-white text-black rounded-lg px-5 py-2.5 font-semibold text-sm`
- Safe area padding: `pb-[env(safe-area-inset-bottom)]` for iPhone

### Files Modified
- `src/components/ui/sticky-mobile-cta.tsx` (new)
- `src/features/landing/LandingPage.tsx` (add component)

## Section Background Rhythm

Pattern applied via wrapper classes in `LandingPage.tsx`:

```
Hero            — transparent (main bg)
Social Proof    — bg-black/[0.02] dark:bg-white/[0.03] + border-y
Features        — transparent
How It Works    — bg-black/[0.02] dark:bg-white/[0.03]
Pricing         — transparent
Testimonials    — bg-black/[0.02] dark:bg-white/[0.03]
FAQ             — transparent
CTA             — bg-black/[0.02] dark:bg-white/[0.03] (wrapper in LandingPage.tsx) + existing radial glow (inside cta-section.tsx, stacks on top)
Footer          — transparent
```

Light mode tint: `bg-black/[0.02]` = barely visible warm gray
Dark mode tint: `bg-white/[0.03]` = subtle elevation from pure black

## CSS Changes

### `landing.css`
- Remove bento grid bottom fade gradients that clash with section backgrounds (or make them match the parent section bg)
- Ensure heading gradient works correctly on all sections

## Container Width Consistency

All sections use `max-w-7xl mx-auto px-6` except:
- Pricing: keeps `max-w-6xl` (intentionally narrower for 3-card grid readability)
- Footer: changed from `max-w-6xl` → `max-w-7xl`

## Light Mode Contrast Requirements (WCAG AA)

**Note:** Light mode background from `landing.css` is `#e8f4ff` (not pure white). Contrast ratios measured against this background:

| Element | Minimum | Class | Ratio on #e8f4ff |
|---------|---------|-------|-----------------|
| Body text | 4.5:1 | `text-gray-700` (#374151) | ~6.5:1 |
| Muted text | 4.5:1 | `text-gray-600` (#475569) | ~5.2:1 |
| Headings | 7:1 | `text-gray-900` (#0f172a) | ~13:1 |
| Links | 4.5:1 | `text-gray-600 hover:text-gray-900` | ~5.2:1 / ~13:1 |

Never use `text-gray-400` (#9ca3af) or `text-gray-500` (#64748b) for text on the `#e8f4ff` background — both fail WCAG AA (~2.9:1 and ~3.9:1 respectively).

**Heading gradients** (CSS gradient text-fill in `landing.css`) are decorative — the gradient fades to 60% opacity at the bottom of headings. This is acceptable because the readable content (top portion) maintains sufficient contrast, and headings are large text (WCAG AA large text threshold is 3:1).

## Files Summary

| File | Action |
|------|--------|
| `src/features/landing/LandingPage.tsx` | Reorder sections, add wrappers, add new components |
| `src/components/ui/saa-s-template.tsx` | New headline, secondary CTA, inline social proof, button color fix |
| `src/components/ui/social-proof-bar.tsx` | NEW — stats strip component |
| `src/components/ui/feature-hover-effects.tsx` | REWRITE — timeline design |
| `src/components/ui/sticky-mobile-cta.tsx` | NEW — floating mobile CTA |
| `src/components/ui/cta-section.tsx` | Fix all light mode colors |
| `src/components/ui/testimonial-v2.tsx` | Add pause-on-hover |
| `src/components/ui/pricing-section.tsx` | Fix heading size |
| `src/components/ui/footer-section.tsx` | Fix max-width |
| `src/features/landing/landing.css` | Fix fade gradients, section bg support |
| `src/features/landing/components/LandingHowItWorks.tsx` | DELETE — dead code, not rendered |
| `src/features/landing/landing.constants.ts` | Clean up unused STEPS data if present |
| `public/images/hero-glow.png` | NEW — downloaded from postimg.cc |
| `public/images/dashboard-preview.png` | NEW — downloaded from postimg.cc |

## Testing Plan

- [ ] Dark mode: all sections render correctly
- [ ] Light mode: all text passes WCAG AA contrast (4.5:1)
- [ ] Mobile 375px: social proof 2x2 grid, sticky CTA appears, no horizontal scroll
- [ ] Mobile 320px: no overflow, touch targets 44px+
- [ ] Tablet 768px: responsive grid layouts
- [ ] Desktop 1280px: horizontal timeline, full layouts
- [ ] Sticky CTA: appears/hides correctly based on scroll position
- [ ] Testimonial: pauses on hover, resumes on mouse leave
- [ ] `#how-it-works` link works from footer
- [ ] `prefers-reduced-motion`: all animations disabled
- [ ] No external image dependencies (postimg.cc removed)
