/** CurrentTimeLine — thin "now" indicator that re-positions every minute.
 *
 *  Pure presentational; the parent owns the grid math.
 */

import { useEffect, useState } from 'react'

interface CurrentTimeLineProps {
  topPx: number
  /** Hide when the current time is outside the grid range. */
  visible: boolean
}

export function CurrentTimeLine({ topPx, visible }: CurrentTimeLineProps) {
  // Bump a tick every minute so the parent's `pxFromTopForDate` recomputes.
  // The parent passes the resulting `topPx` down; this component only owns
  // the timer + render.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!visible) return null

  return (
    <div
      className="appt-now-line"
      style={{ top: `${topPx}px` }}
      role="presentation"
      aria-hidden="true"
    >
      <span className="appt-now-dot" />
      <span className="appt-now-bar" />
    </div>
  )
}
