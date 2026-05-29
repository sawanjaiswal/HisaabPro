/** Motion tokens — the single source of truth for the app's spring physics.
 *
 * Design audit (DESIGN_AUDIT_motion.md): the app had ZERO spring physics and
 * no feature-level motion. These presets give every premium interaction the
 * same feel. Durations mirror the CSS `--duration-*` / `--ease-*` tokens so
 * JS-driven and CSS-driven motion stay consistent.
 */

import type { Transition, Variants } from 'motion/react'

/** Spring presets — tuned to read as "physical" without overshooting wildly. */
export const SPRING = {
  /** Snappy UI feedback — press, toggles, small chips. */
  snappy: { type: 'spring', stiffness: 520, damping: 30, mass: 0.7 },
  /** Default for entrances and surface motion. */
  gentle: { type: 'spring', stiffness: 260, damping: 26, mass: 0.9 },
  /** Soft, slightly bouncy — hero numbers, celebratory moments. */
  bouncy: { type: 'spring', stiffness: 180, damping: 18, mass: 1 },
} satisfies Record<string, Transition>

/** Number count-up — a tween reads cleaner than a spring for digits. */
export const NUMBER_TWEEN: Transition = {
  duration: 0.9,
  ease: [0.16, 1, 0.3, 1], // --ease-premium
}

/** Stagger entrance — parent orchestrates, children rise + fade in. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: SPRING.gentle },
}

/** Page/route transition — subtle slide + fade, no layout shift. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } },
}
