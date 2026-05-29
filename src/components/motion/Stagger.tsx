/** Stagger — choreographed entrance for a list/section of children.
 *
 * <Stagger> orchestrates; each direct child should be wrapped in <StaggerItem>
 * (or any motion element using the `staggerItem` variants). Children rise +
 * fade in sequence, giving the page a composed entrance instead of a hard cut.
 * Respects prefers-reduced-motion (renders instantly, no transform).
 */

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { staggerParent, staggerItem } from './motion.tokens'

interface StaggerProps {
  children: ReactNode
  className?: string
  /** Re-run the entrance whenever this key changes (e.g. data refresh). */
  replayKey?: string | number
}

export function Stagger({ children, className, replayKey }: StaggerProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      key={replayKey}
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  )
}

interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  )
}
