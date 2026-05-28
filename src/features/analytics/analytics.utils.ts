/** Predictive analytics (#146) — pure presentation helpers.
 *
 * No charting library (Rs 8K-15K Android target, 2G/3G): the SVG path
 * math lives here so the MiniLineChart component stays declarative. */

import type { RevenuePoint } from './analytics.types'

/** A point projected into the chart's pixel viewBox. */
export interface ChartPoint {
  x: number
  y: number
  projected: boolean
}

export interface ChartGeometry {
  /** Observed-segment polyline points, "x,y x,y …". */
  solidPath: string
  /** Projected-segment polyline (includes the last observed point so the
   *  dashed line connects to the solid one). */
  dashedPath: string
  points: ChartPoint[]
}

/**
 * Map revenue points to an SVG viewBox of `width`×`height`, leaving a small
 * vertical pad so the top/bottom markers aren't clipped. A flat series
 * (all-equal, including all-zero) is drawn along the vertical midline.
 */
export function buildChartGeometry(
  data: RevenuePoint[],
  width: number,
  height: number,
  pad = 6,
): ChartGeometry {
  if (data.length === 0) {
    return { solidPath: '', dashedPath: '', points: [] }
  }

  const values = data.map((p) => p.revenuePaise)
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min
  const usable = height - pad * 2
  const stepX = data.length > 1 ? width / (data.length - 1) : 0

  const points: ChartPoint[] = data.map((p, i) => {
    const ratio = span === 0 ? 0.5 : (p.revenuePaise - min) / span
    return {
      x: data.length > 1 ? i * stepX : width / 2,
      // SVG y grows downward — invert so higher revenue sits higher.
      y: pad + (1 - ratio) * usable,
      projected: p.projected,
    }
  })

  const toStr = (pt: ChartPoint) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`
  const lastObservedIdx = points.reduce(
    (acc, pt, i) => (pt.projected ? acc : i),
    0,
  )

  const solid = points.filter((p) => !p.projected)
  // Dashed segment starts at the last observed point for visual continuity.
  const dashed = points.slice(lastObservedIdx).filter((_, i, arr) =>
    i === 0 || arr[i].projected,
  )

  return {
    solidPath: solid.map(toStr).join(' '),
    dashedPath: points.some((p) => p.projected) ? dashed.map(toStr).join(' ') : '',
    points,
  }
}

/** "Mar", "Apr" … from an ISO YYYY-MM-DD month key (UTC-safe). */
export function monthLabel(isoMonth: string): string {
  const d = new Date(`${isoMonth}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' })
}
