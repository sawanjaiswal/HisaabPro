import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface NumberTickerProps {
  value: number
  delay?: number
  className?: string
  decimalPlaces?: number
}

export function NumberTicker({
  value,
  delay = 0,
  className,
  decimalPlaces = 0,
}: NumberTickerProps) {
  const spanRef = useRef<HTMLSpanElement>(null)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(0)
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    const el = spanRef.current
    if (!el) return

    const duration = 2000 // ms

    function easeOutExpo(t: number): number {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
    }

    function animate(timestamp: number) {
      const node = spanRef.current
      if (!node) return

      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutExpo(progress)
      const current = startValueRef.current + (value - startValueRef.current) * eased

      node.textContent = current.toFixed(decimalPlaces)

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        node.textContent = value.toFixed(decimalPlaces)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimatedRef.current) {
          hasAnimatedRef.current = true
          observer.disconnect()
          const timeout = setTimeout(() => {
            startTimeRef.current = null
            frameRef.current = requestAnimationFrame(animate)
          }, delay * 1000)
          return () => clearTimeout(timeout)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)

    return () => {
      observer.disconnect()
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [value, delay, decimalPlaces])

  return (
    <span
      ref={spanRef}
      className={cn('inline-block tabular-nums', className)}
    >
      {(0).toFixed(decimalPlaces)}
    </span>
  )
}
