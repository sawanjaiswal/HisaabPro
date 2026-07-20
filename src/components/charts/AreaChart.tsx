/** AreaChart — zero-dependency inline SVG area + line chart with an end dot.
 *
 * No chart library (Rs 8-15K Android / 2G-3G target). Responsive: fills its
 * container width via viewBox + preserveAspectRatio. Optional x-axis labels.
 */

import { useId } from 'react'

interface AreaChartProps {
  /** Raw values (any scale) — normalised internally. */
  data: number[]
  /** Line + fill colour (CSS var recommended). */
  color: string
  /** Evenly-spaced axis labels; only the first and last are shown (start/end). */
  xLabels?: string[]
  /** Draw faint horizontal grid lines behind the trace. */
  showGrid?: boolean
  height?: number
  className?: string
}

const VB_WIDTH = 320
/** Horizontal insets so the end dot + glow never clip at the SVG edges. */
const PAD_LEFT = 6
const PAD_RIGHT = 12
/** Number of horizontal grid lines. */
const GRID_LINES = 4

export function AreaChart({ data, color, xLabels, showGrid = false, height = 130, className }: AreaChartProps) {
  const gradientId = useId()
  const fadeId = useId()
  const maskId = useId()
  if (data.length < 2) {
    return <div className={className} style={{ height }} aria-hidden="true" />
  }

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const padTop = 8
  const padBottom = 10
  const usableH = height - padTop - padBottom
  const usableW = VB_WIDTH - PAD_LEFT - PAD_RIGHT
  const stepX = usableW / (data.length - 1)

  const points = data.map((v, i) => {
    const x = PAD_LEFT + i * stepX
    const y = padTop + usableH * (1 - (v - min) / span)
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${points[points.length - 1][0].toFixed(1)} ${height} L${PAD_LEFT} ${height} Z`
  const [endX, endY] = points[points.length - 1]

  const gridYs = showGrid
    ? Array.from({ length: GRID_LINES }, (_, i) => padTop + (usableH * i) / (GRID_LINES - 1))
    : []
  const edgeLabels = xLabels && xLabels.length > 0 ? [xLabels[0], xLabels[xLabels.length - 1]] : []

  return (
    <div className={className}>
      <div className="area-chart-plot" style={{ position: 'relative' }}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${VB_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Sales trend chart"
      >
        <defs>
          {/* Vertical fill fade: colour under the line → transparent at the base. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          {/* Horizontal "fade-in": the whole trace emerges from the left edge. */}
          <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" />
            <stop offset="10%" stopColor="#000" />
            <stop offset="55%" stopColor="#fff" />
            <stop offset="100%" stopColor="#fff" />
          </linearGradient>
          <mask id={maskId}>
            <rect x="0" y="0" width={VB_WIDTH} height={height} fill={`url(#${fadeId})`} />
          </mask>
        </defs>
        {/* Horizontal grid lines behind the trace. */}
        {gridYs.map((gy) => (
          <line
            key={gy}
            x1={PAD_LEFT}
            y1={gy}
            x2={VB_WIDTH - PAD_RIGHT}
            y2={gy}
            stroke="var(--overlay-white-70, rgba(255,255,255,0.7))"
            strokeOpacity="0.12"
            strokeWidth="1"
          />
        ))}
        <g mask={`url(#${maskId})`}>
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      </svg>
      {/* End marker is an HTML overlay so it stays a true circle despite the
          SVG's non-uniform preserveAspectRatio stretch. */}
      <span
        className="area-chart-enddot"
        style={{
          left: `${(endX / VB_WIDTH) * 100}%`,
          top: `${(endY / height) * 100}%`,
          ['--dot-color' as string]: color,
        }}
        aria-hidden="true"
      />
      </div>
      {edgeLabels.length > 0 && (
        <div className="area-chart-xaxis">
          {edgeLabels.map((label, i) => (
            <span key={`${i}-${label}`} className="area-chart-xlabel">{label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
