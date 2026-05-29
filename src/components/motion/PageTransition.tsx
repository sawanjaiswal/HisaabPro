/** PageTransition — wraps route content with a subtle slide+fade enter/exit.
 *
 * Pair with <AnimatePresence mode="wait"> in the router so routes cross-fade
 * instead of hard-cutting. Keyed by pathname upstream. Respects
 * prefers-reduced-motion (renders without transform).
 */

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { pageVariants } from './motion.tokens'

interface PageTransitionProps {
  children: ReactNode
  className?: string
}

export function PageTransition({ children, className }: PageTransitionProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
    >
      {children}
    </motion.div>
  )
}
