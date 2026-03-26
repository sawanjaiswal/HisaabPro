/** Tally Export Page — download Tally-compatible XML for a date range */

import { useState, useRef } from 'react'
import { Download, FileCode } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { useToast } from '@/hooks/useToast'
import { ROUTES } from '@/config/routes.config'
import { exportTally } from './finance.service'
import './report-finance.css'
import { useLanguage } from '@/hooks/useLanguage'

function getFYRange(): { from: string; to: string } {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return {
    from: `${year}-04-01`,
    to: `${year + 1}-03-31`,
  }
}

export default function TallyExportPage() {
  const { t } = useLanguage()
  const toast = useToast()
  const [dateRange, setDateRange] = useState(getFYRange)
  const [exporting, setExporting] = useState(false)
  const submitRef = useRef(false)

  async function handleExport() {
    if (submitRef.current) return
    submitRef.current = true
    setExporting(true)
    try {
      const xml = await exportTally(dateRange.from, dateRange.to)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tally-export-${dateRange.from}-to-${dateRange.to}.xml`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(t.tallyXmlDownloaded)
    } catch {
      toast.error(t.exportFailedConnection)
    } finally {
      setExporting(false)
      submitRef.current = false
    }
  }

  return (
    <AppShell>
      <Header title={t.tallyExport} backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-section">
          <div className="finance-section__header">
            <span className="finance-section__title">{t.exportToTallyPrime}</span>
          </div>
          <div className="finance-section__rows tally-export__body">
            <p className="tally-export__desc">
              {t.tallyExportDesc}
            </p>
            <div className="finance-date-bar">
              <span className="finance-date-bar__label">{t.from}</span>
              <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label={t.fromDate} />
              <span className="finance-date-bar__label">{t.to}</span>
              <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label={t.toDate} />
            </div>
            <button
              type="button"
              className="finance-date-bar__refresh-btn tally-export__download-btn"
              onClick={handleExport}
              disabled={exporting}
              aria-label={t.downloadTallyXml}
            >
              {exporting ? t.exporting : (
                <><Download size={16} aria-hidden="true" /> {t.downloadXml}</>
              )}
            </button>
          </div>
        </div>

        <div className="finance-empty tally-export__info">
          <div className="finance-empty__icon" aria-hidden="true"><FileCode size={32} /></div>
          <p className="finance-empty__title">{t.tallyPrimeCompatible}</p>
          <p className="finance-empty__desc">
            {t.tallyPrimeDesc}
          </p>
        </div>
      </PageContainer>
    </AppShell>
  )
}
