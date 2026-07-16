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
  /** Evenly-spaced axis labels shown under the chart (e.g. dates). */
  xLabels?: string[]
  height?: number
  className?: string
}

const VB_WIDTH = 320

export function AreaChart({ data, color, xLabels, height = 130, className }: AreaChartProps) {
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
  const stepX = VB_WIDTH / (data.length - 1)

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = padTop + usableH * (1 - (v - min) / span)
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${VB_WIDTH} ${height} L0 ${height} Z`
  const [endX, endY] = points[points.length - 1]

  return (
    <div className={className}>
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
        <g mask={`url(#${maskId})`}>
          <path d={area} fill={`url(#${gradientId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
        {/* End marker sits outside the mask so it stays fully opaque. */}
        <circle cx={endX} cy={endY} r="6" fill={color} fillOpacity="0.25" />
        <circle cx={endX} cy={endY} r="3.5" fill={color} stroke="#fff" strokeWidth="1.5" />
      </svg>
      {xLabels && xLabels.length > 0 && (
        <div className="area-chart-xaxis">
          {xLabels.map((label) => (
            <span key={label} className="area-chart-xlabel">{label}</span>
          ))}
        </div>
      )}
    </div>
  )
}
