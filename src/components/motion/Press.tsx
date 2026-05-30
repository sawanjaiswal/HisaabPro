/** Press — wraps any content with a spring scale-down on tap/click.
 *
 * Gives every tappable surface the same physical "give" without each call site
 * reinventing whileTap. Renders a plain wrapper (no interactive element of its
 * own), so it is safe to wrap an existing button/anchor without nesting roles.
 * Respects prefers-reduced-motion.
 */

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { SPRING } from './motion.tokens'

interface PressProps {
  children: ReactNode
  className?: string
  /** Scale at full press. Default 0.97 — subtle but felt. */
  scale?: number
  disabled?: boolean
}

export function Press({ children, className, scale = 0.97, disabled = false }: PressProps) {
  const reduce = useReducedMotion()
  if (reduce || disabled) {
    return <div className={className}>{children}</div>
  }
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={SPRING.snappy}
      style={{ touchAction: 'manipulation' }}
    >
      {children}
    </motion.div>
  )
}
