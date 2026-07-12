---
symptom: Landing page and /settings/subscription/checkout render a solid black rectangle over ~15% of the viewport during fast scrolling
root_cause_file: src/components/ui/before-after-section.tsx, cta-section.tsx, invoice-templates-section.tsx (whileInView viewport config)
root_cause_reason: Framer Motion's whileInView sections start at initial={opacity:0}; the amount:0.15 IntersectionObserver threshold only fires once 15% of the element is already inside the viewport, so a fast scroll (flick, jump-to-anchor, or main-thread lag on a low-end Android device) outruns the callback and the section sits at opacity:0 for several frames — which reads as solid black against the dark landing theme background
---
## 5-whys
1. Why does a black rectangle appear? — A whileInView section is rendered at its `initial` state (opacity: 0) instead of animating in.
2. Why is it stuck at opacity: 0? — The IntersectionObserver callback that flips it to `whileInView` hasn't fired yet.
3. Why hasn't it fired? — The observer only triggers once the element crosses the `amount: 0.15` threshold already inside the viewport — there's no lead time before the element is visually on-screen.
4. Why does that cause a visible gap? — Fast scrolls (flick-scroll, anchor jump, or scroll during main-thread jank on a low-end device) move the element into the visible viewport within a single frame or two, faster than the observer callback + React re-render + repaint pipeline can catch up.
5. Why wasn't this caught earlier? — The three sections (before-after-section.tsx, cta-section.tsx, invoice-templates-section.tsx) each hardcoded their own local `viewport={{ once: true, amount: 0.15 }}` config with no shared margin/lead-time, so there was no single place to add a fix or notice the duplication.

## Hypothesis
Add a `margin` (rootMargin-equivalent) to the viewport config so the IntersectionObserver fires ~300px before the section is scrolled into view, giving the animation time to complete before the section is visually reached. Consolidate the duplicated reveal helpers into one shared SSOT module (`src/components/ui/motion-reveal.ts`) exporting `REVEAL_VIEWPORT` and `revealProps()`, so the fix applies everywhere at once and future landing sections reuse it instead of re-duplicating.

## Verification
- Reproduced pre-fix via agent-browser (unauthenticated session, IndexedDB/sessionStorage cleared, fast `scroll down 6000/8000`) — confirmed a stretch of black between sections on both 375px and 1440px viewports.
- Applied fix: `src/components/ui/motion-reveal.ts` (new shared module), consumed by `before-after-section.tsx`, `cta-section.tsx`, `invoice-templates-section.tsx` (both the `fade()`/`reveal()` helper call sites and the two remaining inline `motion.div` usages in invoice-templates-section.tsx).
- `npx tsc -b --noEmit` — clean.
- Re-ran the same fast-scroll repro post-fix on 375px and 1440px — full-page screenshots show no black rectangle; all sections render with content.
