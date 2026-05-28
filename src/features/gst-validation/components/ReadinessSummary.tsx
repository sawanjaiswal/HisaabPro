/** ReadinessSummary (#144) — verdict banner + blocker/warning/scanned counts. */

import { CheckCircle2, AlertOctagon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { useLanguage } from '@/hooks/useLanguage'
import type { GstFilingReadiness } from '../gst-validation.types'

interface ReadinessSummaryProps {
  data: GstFilingReadiness
}

export function ReadinessSummary({ data }: ReadinessSummaryProps) {
  const { t } = useLanguage()
  const { readyToFile, blockerCount, warningCount, documentsScanned } = data

  return (
    <Card className={`gstv-summary ${readyToFile ? 'gstv-summary--ready' : 'gstv-summary--blocked'}`}>
      <div className="gstv-summary__verdict">
        {readyToFile ? (
          <CheckCircle2 className="w-6 h-6" aria-hidden />
        ) : (
          <AlertOctagon className="w-6 h-6" aria-hidden />
        )}
        <span className="gstv-summary__title">
          {readyToFile ? t.gstReadinessReady : t.gstReadinessBlocked}
        </span>
      </div>

      <div className="gstv-summary__stats">
        <div className="gstv-stat">
          <span className="gstv-stat__value tabular-nums">{blockerCount}</span>
          <span className="gstv-stat__label">{t.gstReadinessBlockers}</span>
        </div>
        <div className="gstv-stat">
          <span className="gstv-stat__value tabular-nums">{warningCount}</span>
          <span className="gstv-stat__label">{t.gstReadinessWarnings}</span>
        </div>
        <div className="gstv-stat">
          <span className="gstv-stat__value tabular-nums">{documentsScanned}</span>
          <span className="gstv-stat__label">{t.gstReadinessScanned}</span>
        </div>
      </div>
    </Card>
  )
}
