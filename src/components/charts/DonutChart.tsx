/** DonutChart — zero-dependency inline SVG part-to-whole chart.
 *
 * No chart library (Rs 8-15K Android / 2G-3G target), same constraint as
 * AreaChart. Slices are drawn as stroke-dasharray arcs on concentric circles
 * so there is no path maths and no layout thrash.
 *
 * Values may be any scale (paise, counts) — shares are computed internally.
 */

import './donut-chart.css'

export interface DonutSlice {
  id: string
  /** Legend label (already translated by the caller) */
  label: string
  /** Raw value — same unit across slices */
  value: number
  /** Slice colour, CSS variable string */
  color: string
}

interface DonutChartProps {
  slices: DonutSlice[]
  /** Diameter in px */
  size?: number
  /** Ring thickness in px */
  thickness?: number
  /** Rendered in the middle of the ring (total, count, …) */
  centerLabel?: string
  centerSub?: string
  /** Accessible description of the whole chart */
  ariaLabel: string
}

const VB = 100

export function DonutChart({
  slices,
  size = 132,
  thickness = 14,
  centerLabel,
  centerSub,
  ariaLabel,
}: DonutChartProps) {
  const total = slices.reduce((sum, s) => sum + Math.max(0, s.value), 0)
  const radius = (VB - thickness) / 2
  const circumference = 2 * Math.PI * radius

  // Running offset so each arc starts where the previous one ended.
  let consumed = 0

  return (
    <div className="donut-chart" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${VB} ${VB}`} role="img" aria-label={ariaLabel}>
        <circle
          className="donut-chart__track"
          cx={VB / 2}
          cy={VB / 2}
          r={radius}
          strokeWidth={thickness}
        />
        {total > 0 &&
          slices.map((slice) => {
            const share = Math.max(0, slice.value) / total
            const dash = share * circumference
            const offset = consumed * circumference
            consumed += share
            if (dash <= 0) return null
            return (
              <circle
                key={slice.id}
                className="donut-chart__slice"
                cx={VB / 2}
                cy={VB / 2}
                r={radius}
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            )
          })}
      </svg>
      {(centerLabel || centerSub) && (
        <div className="donut-chart__center" aria-hidden="true">
          {centerLabel && <span className="donut-chart__center-value">{centerLabel}</span>}
          {centerSub && <span className="donut-chart__center-label">{centerSub}</span>}
        </div>
      )}
    </div>
  )
}
