/** ReorderSummary (#148) — headline counts + total reorder value. */

import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { ReorderSummary as Summary } from '../reorder.types'

interface ReorderSummaryProps {
  summary: Summary
}

export function ReorderSummary({ summary }: ReorderSummaryProps) {
  const { t } = useLanguage()

  return (
    <Card className="reorder-summary">
      <div className="reorder-summary__metric">
        <span className="reorder-summary__value tabular-nums">{summary.needReorderCount}</span>
        <span className="reorder-summary__label">{t.reorderNeedCount}</span>
      </div>
      <div className="reorder-summary__divider" aria-hidden="true" />
      <div className="reorder-summary__metric">
        <span className="reorder-summary__value tabular-nums">
          {formatPaise(summary.totalSuggestedValuePaise)}
        </span>
        <span className="reorder-summary__label">{t.reorderTotalValue}</span>
      </div>
    </Card>
  )
}
