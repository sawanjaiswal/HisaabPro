/** GST Returns Page — GSTR-1 / GSTR-3B / GSTR-9 viewer and exporter (lazy loaded) */

import { useCallback } from 'react'
import { FileText, Download } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { ROUTES } from '@/config/routes.config'
import { useGstReturns } from './hooks/useGstReturns'
import { GstReturnSummary } from './components/GstReturnSummary'
import { ReportSkeleton } from './components/ReportSkeleton'
import type { GstReturnType } from './report-tax.types'
import './report-shared.css'
import './report-shared-ui.css'
import './report-tax.css'

const RETURN_TABS: { type: GstReturnType; label: string }[] = [
  { type: 'GSTR1',  label: 'GSTR-1' },
  { type: 'GSTR3B', label: 'GSTR-3B' },
  { type: 'GSTR9',  label: 'GSTR-9' },
]

export default function GstReturnsPage() {
  const {
    data,
    status,
    returnType,
    period,
    setReturnType,
    setPeriod,
    exportJson,
    isExporting,
    refresh,
  } = useGstReturns()

  const handleExport = useCallback(async () => {
    const result = await exportJson()
    if (result) {
      const blob = new Blob([JSON.stringify(result.json, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [exportJson])

  // ─── Loading state ──────────────────────────────────────────────────────

  if (status === 'loading') {
    return (
      <AppShell>
        <Header title="GST Returns" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ReportSkeleton rows={5} />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────

  if (status === 'error') {
    return (
      <AppShell>
        <Header title="GST Returns" backTo={ROUTES.REPORTS} />
        <PageContainer>
          <ErrorState
            title="Could not load GST return"
            message="Check your connection and try again."
            onRetry={refresh}
          />
        </PageContainer>
      </AppShell>
    )
  }

  // ─── Success + Empty states ─────────────────────────────────────────────

  return (
    <AppShell>
      <Header title="GST Returns" backTo={ROUTES.REPORTS} />

      <PageContainer>
        {/* Return type tab pills */}
        <div className="gst-return-tabs" role="tablist" aria-label="GST return type">
          {RETURN_TABS.map(({ type, label }) => (
            <button
              key={type}
              type="button"
              role="tab"
              aria-selected={returnType === type}
              className={`gst-return-tab${returnType === type ? ' gst-return-tab--active' : ''}`}
              onClick={() => setReturnType(type)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="gst-period-row">
          <label className="gst-period-label" htmlFor="gst-period">Period</label>
          <input
            id="gst-period"
            type="month"
            className="gst-period-input"
            value={period}
            aria-label="Select period (month)"
            onChange={(e) => setPeriod(e.target.value)}
          />
          {/* Export — GSTR-1 only */}
          {returnType === 'GSTR1' && data && (
            <button
              type="button"
              className="report-export-btn"
              onClick={handleExport}
              disabled={isExporting}
              aria-label="Export GSTR-1 as JSON"
            >
              <Download size={14} aria-hidden="true" />
              {isExporting ? 'Exporting…' : 'Export JSON'}
            </button>
          )}
        </div>

        {/* Empty state */}
        {!data && (
          <div className="report-empty">
            <div className="report-empty-icon" aria-hidden="true">
              <FileText size={28} />
            </div>
            <p className="report-empty-title">No data for this period</p>
            <p className="report-empty-desc">
              No {returnType} data found for {period}. Try selecting a different period.
            </p>
          </div>
        )}

        {/* Return data */}
        {data && (
          <GstReturnSummary returnType={returnType} data={data} />
        )}
      </PageContainer>
    </AppShell>
  )
}
