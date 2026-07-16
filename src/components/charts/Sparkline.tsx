/** Sparkline — zero-dependency inline SVG trend line.
 *
 * No chart library (Rs 8-15K Android / 2G-3G target). Pure SVG path from an
 * array of numbers, normalised to the viewBox. Optional gradient area fill.
 */

import { useId } from 'react'

interface SparklineProps {
  /** Raw values (any scale) — normalised internally. */
  data: number[]
  /** Line + fill colour (CSS var recommended). */
  color: string
  /** Draw a soft gradient area under the line. Default true. */
  fill?: boolean
  width?: number
  height?: number
  className?: string
}

export function Sparkline({
  data,
  color,
  fill = true,
  width = 120,
  height = 40,
  className,
}: SparklineProps) {
  const gradientId = useId()
  if (data.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const stepX = width / (data.length - 1)
  const pad = 2

  const points = data.map((v, i) => {
    const x = i * stepX
    const y = pad + (height - pad * 2) * (1 - (v - min) / span)
    return [x, y] as const
  })

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${width} ${height} L0 ${height} Z`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
