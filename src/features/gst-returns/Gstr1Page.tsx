/**
 * GSTR-1 Export Page — PR 10
 *
 * Period selector → summary table → export buttons (JSON / CSV)
 * 4 UI states: loading / error / empty (backfill prompt) / success
 * Offline guard: toast if !navigator.onLine on export
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { FileText } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { useGstr1Summary, useGstr1Export } from './useGstr1'
import type { Gstr1Summary } from './gst-returns.types'

function currentPeriod(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function generateKey(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function downloadBlob(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

interface SummaryTableProps { summary: Gstr1Summary }

function SummaryTable({ summary }: SummaryTableProps) {
  const { t } = useLanguage()
  const rows: Array<{ key: keyof Gstr1Summary; label: string }> = [
    { key: 'b2b',   label: t.gstr1B2bLabel },
    { key: 'b2cl',  label: t.gstr1B2clLabel },
    { key: 'b2cs',  label: t.gstr1B2csLabel },
    { key: 'cdnr',  label: t.gstr1CdnrLabel },
    { key: 'cdnur', label: t.gstr1CdnurLabel },
    { key: 'hsn',   label: t.gstr1HsnLabel },
    { key: 'nil',   label: t.gstr1NilLabel },
    { key: 'exp',   label: t.gstr1ExpLabel },
  ]
  return (
    <table className="gstr1-summary-table">
      <thead>
        <tr>
          <th>{t.gstr1TableSection}</th>
          <th>{t.gstr1TableRows}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, label }) => (
          <tr key={key}>
            <td>{label}</td>
            <td className="gstr1-count">{summary[key] as number}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function Gstr1Page() {
  const { t } = useLanguage()
  const toast = useToast()
  const navigate = useNavigate()
  const [period, setPeriod] = useState(currentPeriod)

  const { data, isLoading, isError, error, refetch } = useGstr1Summary(period)
  const exportMut = useGstr1Export()

  const handleExport = useCallback(async (format: 'JSON' | 'CSV') => {
    if (!navigator.onLine) {
      toast.error(t.gstr1MustBeOnline)
      return
    }
    const idempotencyKey = generateKey()
    const result = await exportMut.mutateAsync({ period, idempotencyKey })
    // result may be {} if offline — tolerate optimistic return
    if (!result || !('jsonData' in result)) return

    if (format === 'JSON') {
      downloadBlob(JSON.stringify(result.jsonData, null, 2), `GSTR1_${period}.json`, 'application/json')
    } else {
      downloadBlob(result.csvData, `GSTR1_${period}.csv`, 'text/csv')
    }
    toast.success(t.gstr1ExportSuccess)
  }, [period, exportMut, toast, t])

  const summary = data?.summary
  const exportedAt = data?.exportedAt

  return (
    <AppShell>
      <Header title={t.gstr1PageTitle} backTo={true} />
      <PageContainer>
        <div className="gstr1-page">

          {/* Period selector */}
          <div className="gstr1-period-row">
            <label className="gstr1-period-label" htmlFor="gstr1-period">
              {t.gstr1PeriodLabel}
            </label>
            <input
              id="gstr1-period"
              type="month"
              className="gstr1-period-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              max={currentPeriod()}
            />
          </div>

          {/* Status banner */}
          {exportedAt && (
            <div className="gstr1-status-banner gstr1-status-exported">
              {t.gstr1ExportedOn.replace('{date}', new Date(exportedAt).toLocaleDateString('en-IN'))}
            </div>
          )}
          {!exportedAt && !isLoading && (
            <div className="gstr1-status-banner gstr1-status-pending">
              {t.gstr1NotExported}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="gstr1-loading" aria-busy="true">
              <div className="gstr1-spinner" />
              <span>{t.gstr1Loading}</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <ErrorState
              title={t.gstr1ErrorMsg}
              message={error instanceof Error ? error.message : undefined}
              onRetry={() => { void refetch() }}
            />
          )}

          {/* Empty / backfill prompt */}
          {!isLoading && !isError && summary && summary.b2b === 0 && (
            <EmptyState
              icon={<FileText size={22} aria-hidden="true" />}
              title={t.gstr1NoB2bFound}
              action={
                <button
                  className="gstr1-backfill-link"
                  onClick={() => navigate(ROUTES.GST_BACKFILL)}
                >
                  {t.gstr1RunBackfill}
                </button>
              }
            />
          )}

          {/* Summary table */}
          {!isLoading && !isError && summary && (
            <SummaryTable summary={summary} />
          )}

          {/* Export buttons */}
          {!isLoading && !isError && (
            <div className="gstr1-export-row">
              <Button
                variant="primary"
                disabled={exportMut.isPending}
                onClick={() => { void handleExport('JSON') }}
              >
                {exportMut.isPending ? t.gstr1Exporting : t.gstr1DownloadJson}
              </Button>
              <button
                className="btn btn-outline"
                disabled={exportMut.isPending}
                onClick={() => { void handleExport('CSV') }}
              >
                {t.gstr1DownloadCsv}
              </button>
            </div>
          )}

          {exportMut.isError && (
            <div className="gstr1-error" role="alert">
              {t.gstr1ExportFailed}
            </div>
          )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
