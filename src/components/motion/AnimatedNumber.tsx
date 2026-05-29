/** AnimatedNumber — counts a numeric value up to its target on mount/change.
 *
 * Pass the raw numeric `value` (e.g. paise) and a `format` fn; the component
 * animates the underlying number and renders the formatted string each frame.
 * Respects prefers-reduced-motion (jumps straight to the final value).
 */

import { useEffect, useRef } from 'react'
import { useReducedMotion, useMotionValue, animate } from 'motion/react'
import { NUMBER_TWEEN } from './motion.tokens'

interface AnimatedNumberProps {
  value: number
  format: (n: number) => string
  className?: string
  /** Skip the intro animation on the very first paint (e.g. SSR hydration). */
  immediateOnMount?: boolean
}

export function AnimatedNumber({ value, format, className, immediateOnMount = false }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLSpanElement>(null)
  const mv = useMotionValue(immediateOnMount ? value : 0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (reduce) {
      node.textContent = format(value)
      return
    }

    const controls = animate(mv, value, {
      ...NUMBER_TWEEN,
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    return () => controls.stop()
    // mv is stable; format is assumed pure for a given render
  }, [value, reduce]) // eslint-disable-line react-hooks/exhaustive-deps

  // Initial server/first paint shows the formatted target so there is never a flash of "0".
  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  )
}
