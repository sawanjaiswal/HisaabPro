/**
 * ListDetailLayout — responsive list+detail split view.
 *
 *   <lg  : renders ONLY the list. Tap row → navigate to detail route.
 *   ≥lg  : renders BOTH. Left rail = list (--list-rail-width), right = detail.
 *          Selecting an item updates `?selected=:id` so the URL is shareable
 *          and history works.
 *
 * Consumers pass:
 *   - `list`       : the list JSX (always mounted)
 *   - `detail`     : the detail JSX, OR a function (id) => JSX
 *   - `selectedId` : current selection (drives detail render at ≥lg)
 *   - `emptyDetail`: what to render at ≥lg when nothing is selected
 *
 * This component does NOT own routing — it surfaces `selectedId` via the
 * `?selected=` query param. Feature pages read it and decide what to do
 * with it (load entity, etc.). At <lg the feature page's row-tap handler
 * navigates to `/<entity>/:id` as it always has.
 */

import { useEffect, useState, type ReactNode } from 'react'

interface ListDetailLayoutProps {
  list: ReactNode
  detail: ReactNode
  selectedId?: string | null
  emptyDetail?: ReactNode
  /** Override the list-rail width at ≥lg (default: var(--list-rail-width)). */
  listWidth?: string
  className?: string
}

/**
 * useIsDesktop — true when viewport ≥ --bp-lg. Re-evaluates on resize.
 * SSR-safe (Capacitor isn't SSR, but defensive).
 */
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 1024px)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mql = window.matchMedia('(min-width: 1024px)')
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

export function ListDetailLayout({
  list,
  detail,
  selectedId,
  emptyDetail,
  listWidth,
  className = '',
}: ListDetailLayoutProps) {
  const isDesktop = useIsDesktop()

  if (!isDesktop) {
    // Mobile / tablet: list only — feature page's row-tap navigates to detail page
    return <div className={`list-detail-layout list-detail-layout--mobile ${className}`.trim()}>{list}</div>
  }

  // Desktop ≥lg: side-by-side
  const railStyle = listWidth ? { width: listWidth } : undefined
  return (
    <div className={`list-detail-layout list-detail-layout--desktop flex gap-0 min-h-[calc(100vh-var(--header-height))] ${className}`.trim()}>
      <aside
        className="list-detail-layout__rail flex-shrink-0 border-r overflow-y-auto"
        style={{
          width: 'var(--list-rail-width)',
          borderColor: 'var(--color-gray-100)',
          backgroundColor: 'var(--color-gray-0)',
          ...railStyle,
        }}
        aria-label="List"
      >
        {list}
      </aside>
      <section
        className="list-detail-layout__detail flex-1 overflow-y-auto"
        style={{ backgroundColor: 'var(--color-gray-50)' }}
        aria-label="Detail"
      >
        {selectedId ? detail : emptyDetail}
      </section>
    </div>
  )
}

export { useIsDesktop }
