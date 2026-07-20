/** Product Detail — Overview metric card: tinted icon · label · value ·
 *  "This Month" · trailing sparkline. Reuses the zero-dep AreaChart. */

import React from 'react'
import { AreaChart } from '@/components/charts/AreaChart'

export type MetricTone = 'sales' | 'units' | 'profit' | 'price'

interface ProductMetricCardProps {
  icon: React.ReactNode
  tone: MetricTone
  label: string
  value: string
  sub: string
  spark: number[]
  sparkColor: string
}

export const ProductMetricCard: React.FC<ProductMetricCardProps> = ({
  icon,
  tone,
  label,
  value,
  sub,
  spark,
  sparkColor,
}) => {
  return (
    <div className={`pd-metric pd-metric--${tone}`}>
      <div className="pd-metric__head">
        <span className={`pd-metric__icon pd-metric__icon--${tone}`} aria-hidden="true">
          {icon}
        </span>
        <span className="pd-metric__label">{label}</span>
      </div>
      <span className="pd-metric__value tabular-nums">{value}</span>
      <div className="pd-metric__foot">
        <span className="pd-metric__sub">{sub}</span>
        <AreaChart data={spark} color={sparkColor} height={34} className="pd-metric__spark" />
      </div>
    </div>
  )
}
