/**
 * ScaledMockup — renders children at a fixed design width and CSS-scales
 * down to fit the container. The internal layout never reflows; it shrinks
 * like an image preserving aspect ratio.
 *
 * Usage:
 *   <ScaledMockup designWidth={900}>
 *     <HeroDashboardMockup />
 *   </ScaledMockup>
 */

import { useRef, useEffect, useState, type ReactNode } from 'react'

interface ScaledMockupProps {
  /** The pixel width the mockup was designed at. */
  designWidth: number
  children: ReactNode
  className?: string
}

export function ScaledMockup({ designWidth, children, className = '' }: ScaledMockupProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [innerHeight, setInnerHeight] = useState(0)

  useEffect(() => {
    const outer = outerRef.current
    const inner = innerRef.current
    if (!outer || !inner) return

    const update = () => {
      const containerWidth = outer.clientWidth
      const s = Math.min(containerWidth / designWidth, 1)
      setScale(s)
      setInnerHeight(inner.scrollHeight)
    }

    update()

    const ro = new ResizeObserver(update)
    ro.observe(outer)
    // Also observe inner in case content changes height
    ro.observe(inner)

    return () => ro.disconnect()
  }, [designWidth])

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        width: '100%',
        overflow: 'hidden',
        // Outer container shrinks to match the scaled inner height
        height: innerHeight * scale || 'auto',
      }}
    >
      {/* Middle wrapper = actual rendered width, centered via margin auto */}
      <div style={{ width: designWidth * scale, margin: '0 auto' }}>
        <div
          ref={innerRef}
          style={{
            width: designWidth,
            transformOrigin: 'top left',
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
