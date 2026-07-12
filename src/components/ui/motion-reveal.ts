/** Shared scroll-reveal viewport config for the landing page's whileInView sections.
 *
 * `margin` pre-triggers the reveal 300px before a section enters the viewport (top-to-bottom
 * scroll direction only, matching how users read the page). Without this, a fast scroll —
 * flick-scrolling, jump-to-anchor, or main-thread lag on a low-end Android device — outruns
 * Framer Motion's IntersectionObserver callback, leaving the section at its `initial`
 * `opacity: 0` for a stretch of frames. Against the dark landing theme this reads as a solid
 * black rectangle rather than a missed fade-in.
 */
export const REVEAL_VIEWPORT = { once: true, amount: 0.15 as const, margin: '0px 0px 300px 0px' }

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

export function revealProps(reducedMotion: boolean | null, delay: number, y = 25) {
  return {
    initial: reducedMotion ? false : ({ opacity: 0, y } as const),
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: REVEAL_VIEWPORT,
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  }
}
