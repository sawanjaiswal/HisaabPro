import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { cn } from '@/lib/utils'

interface BlurFadeProps {
  children: ReactNode
  className?: string
  /** Delay in seconds before the animation starts after entering viewport */
  delay?: number
  /** Animation duration in seconds */
  duration?: number
  /** Direction of slide: 'up' | 'down' | 'left' | 'right' | 'none' */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
  /** Blur amount in pixels */
  blur?: number
  /** Force the in-view state (useful for SSR or pre-rendering) */
  inView?: boolean
}

const SLIDE_OFFSETS: Record<NonNullable<BlurFadeProps['direction']>, string> = {
  up: 'translateY(16px)',
  down: 'translateY(-16px)',
  left: 'translateX(16px)',
  right: 'translateX(-16px)',
  none: 'none',
}

export function BlurFade({
  children,
  className,
  delay = 0,
  duration = 0.4,
  direction = 'up',
  blur = 6,
  inView: forceInView,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(forceInView ?? false)

  useEffect(() => {
    if (forceInView) {
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [forceInView])

  const hiddenTransform =
    direction === 'none' ? 'none' : SLIDE_OFFSETS[direction]

  const baseStyle: CSSProperties = {
    transitionProperty: 'opacity, transform, filter',
    transitionDuration: `${duration}s`,
    transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
    transitionDelay: `${delay}s`,
  }

  const hiddenStyle: CSSProperties = {
    ...baseStyle,
    opacity: 0,
    transform: hiddenTransform,
    filter: `blur(${blur}px)`,
  }

  const visibleStyle: CSSProperties = {
    ...baseStyle,
    opacity: 1,
    transform: 'none',
    filter: 'blur(0px)',
  }

  return (
    <div
      ref={ref}
      className={cn('will-change-[opacity,transform,filter]', className)}
      style={visible ? visibleStyle : hiddenStyle}
    >
      {children}
    </div>
  )
}
