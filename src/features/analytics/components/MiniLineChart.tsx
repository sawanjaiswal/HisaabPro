/** MiniLineChart (#146) — dependency-free SVG sparkline.
 *
 * Observed months render as a solid line, projected months as a dashed
 * continuation. No charting lib: keeps the bundle tiny for low-end Android. */

import { useMemo } from 'react'
import type { RevenuePoint } from '../analytics.types'
import { buildChartGeometry, monthLabel } from '../analytics.utils'

const VIEW_W = 300
const VIEW_H = 88

interface MiniLineChartProps {
  data: RevenuePoint[]
  /** Accessible description of the series. */
  ariaLabel: string
}

export function MiniLineChart({ data, ariaLabel }: MiniLineChartProps) {
  const geo = useMemo(() => buildChartGeometry(data, VIEW_W, VIEW_H), [data])

  if (data.length === 0) return null

  return (
    <div className="mini-chart">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="mini-chart__svg"
        role="img"
        aria-label={ariaLabel}
        preserveAspectRatio="none"
      >
        {geo.solidPath && (
          <polyline
            className="mini-chart__line mini-chart__line--solid"
            points={geo.solidPath}
            fill="none"
          />
        )}
        {geo.dashedPath && (
          <polyline
            className="mini-chart__line mini-chart__line--dashed"
            points={geo.dashedPath}
            fill="none"
          />
        )}
        {geo.points.map((pt, i) => (
          <circle
            key={data[i].month}
            cx={pt.x}
            cy={pt.y}
            r={2.5}
            className={`mini-chart__dot${pt.projected ? ' mini-chart__dot--projected' : ''}`}
          />
        ))}
      </svg>
      <div className="mini-chart__labels" aria-hidden="true">
        {data.map((p) => (
          <span
            key={p.month}
            className={`mini-chart__label${p.projected ? ' mini-chart__label--projected' : ''}`}
          >
            {monthLabel(p.month)}
          </span>
        ))}
      </div>
    </div>
  )
}
