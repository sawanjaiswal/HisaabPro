/**
 * GSTR-3B Summary Page — PR 11
 *
 * Period selector → 11-row summary table → JSON/CSV export buttons.
 * 4 UI states: loading / error / empty / success
 * Offline guard: toast if !navigator.onLine on export
 * Mobile-first 320px
 */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useLanguage } from '@/hooks/useLanguage'
import { EmptyState } from '@/components/feedback/EmptyState'
import { FileText } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useGstr3bSummary, useGstr3bExport } from './useGstr3b'
import type { Gstr3bSection } from './gst-returns.types'

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

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(n)
}

interface SectionTableProps {
  sections: Gstr3bSection[]
  netPayable: number
}

function SectionTable({ sections, netPayable }: SectionTableProps) {
  const { t } = useLanguage()
  return (
    <div className="gstr3b-table-wrap">
      <table className="gstr3b-table">
        <thead>
          <tr>
            <th className="gstr3b-col-section">{t.gstr3bColSection}</th>
            <th className="gstr3b-col-desc">{t.gstr3bColDescription}</th>
            <th className="gstr3b-col-amt">{t.gstr3bColTaxable}</th>
            <th className="gstr3b-col-amt">CGST</th>
            <th className="gstr3b-col-amt">SGST</th>
            <th className="gstr3b-col-amt">IGST</th>
            <th className="gstr3b-col-amt">Cess</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((s) => (
            <tr key={s.section} className="gstr3b-row">
              <td className="gstr3b-section-num">{s.section}</td>
              <td>{s.description}</td>
              <td className="gstr3b-amt">{fmt(s.taxableValue)}</td>
              <td className="gstr3b-amt">{fmt(s.cgst)}</td>
              <td className="gstr3b-amt">{fmt(s.sgst)}</td>
              <td className="gstr3b-amt">{fmt(s.igst)}</td>
              <td className="gstr3b-amt">{fmt(s.cess)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="gstr3b-net-row">
            <td colSpan={2} className="gstr3b-net-label">{t.gstr3bNetPayable}</td>
            <td className="gstr3b-amt gstr3b-net-amt" colSpan={5}>{fmt(netPayable)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export default function Gstr3bPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [period, setPeriod] = useState(currentPeriod)

  const { data, isLoading, isError, error } = useGstr3bSummary(period)
  const exportMut = useGstr3bExport()

  const handleExport = useCallback(async (format: 'JSON' | 'CSV') => {
    if (!navigator.onLine) {
      toast.error(t.gstr3bMustBeOnline)
      return
    }
    const idempotencyKey = generateKey()
    const result = await exportMut.mutateAsync({ period, idempotencyKey })
    // result may be {} if offline — tolerate optimistic return
    if (!result || !('jsonData' in result)) return

    if (format === 'JSON') {
      downloadBlob(
        JSON.stringify(result.jsonData, null, 2),
        `GSTR3B_${period}.json`,
        'application/json',
      )
    } else {
      downloadBlob(result.csvData, `GSTR3B_${period}.csv`, 'text/csv')
    }
    toast.success(t.gstr3bExportSuccess)
  }, [period, exportMut, toast, t])

  const summary = data?.summary
  const exportedAt = data?.exportedAt
  const hasData = summary && summary.sections.length > 0

  return (
    <AppShell>
      <Header title={t.gstr3bPageTitle} backTo={true} />
      <PageContainer>
        <div className="gstr3b-page">

          {/* Period selector */}
          <div className="gstr1-period-row">
            <label className="gstr1-period-label" htmlFor="gstr3b-period">
              {t.gstr1PeriodLabel}
            </label>
            <input
              id="gstr3b-period"
              type="month"
              className="gstr1-period-input"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              max={currentPeriod()}
            />
          </div>

          {/* Status badge */}
          {exportedAt && (
            <div className="gstr1-status-banner gstr1-status-exported">
              {t.gstr3bExportedOn.replace('{date}', new Date(exportedAt).toLocaleDateString('en-IN'))}
            </div>
          )}
          {!exportedAt && !isLoading && (
            <div className="gstr1-status-banner gstr1-status-pending">
              {t.gstr3bNotExported}
            </div>
          )}

          {/* Loading */}
          {isLoading && (
            <div className="gstr1-loading" aria-busy="true">
              <div className="gstr1-spinner" />
              <span>{t.gstr3bLoading}</span>
            </div>
          )}

          {/* Error */}
          {isError && !isLoading && (
            <div className="gstr1-error" role="alert">
              {t.gstr3bErrorMsg}
              {error instanceof Error && (
                <p className="gstr1-error-detail">{error.message}</p>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !isError && !hasData && (
            <EmptyState
              icon={<FileText size={22} aria-hidden="true" />}
              title={t.gstr3bNoData}
            />
          )}

          {/* 11-row summary table */}
          {!isLoading && !isError && hasData && (
            <SectionTable sections={summary.sections} netPayable={summary.netPayable} />
          )}

          {/* Export buttons */}
          {!isLoading && !isError && (
            <div className="gstr1-export-row">
              <Button
                variant="primary"
                disabled={exportMut.isPending}
                onClick={() => { void handleExport('JSON') }}
              >
                {exportMut.isPending ? t.gstr3bExporting : t.gstr3bDownloadJson}
              </Button>
              <button
                className="btn btn-outline"
                disabled={exportMut.isPending}
                onClick={() => { void handleExport('CSV') }}
              >
                {t.gstr3bDownloadCsv}
              </button>
            </div>
          )}

          {exportMut.isError && (
            <div className="gstr1-error" role="alert">
              {t.gstr3bExportFailed}
            </div>
          )}
        </div>
      </PageContainer>
    </AppShell>
  )
}
