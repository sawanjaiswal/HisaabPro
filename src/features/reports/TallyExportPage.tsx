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

function getFYRange(): { from: string; to: string } {
  const now = new Date()
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  return {
    from: `${year}-04-01`,
    to: `${year + 1}-03-31`,
  }
}

export default function TallyExportPage() {
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
      toast.success('Tally XML downloaded')
    } catch {
      toast.error('Export failed. Check your connection and try again.')
    } finally {
      setExporting(false)
      submitRef.current = false
    }
  }

  return (
    <AppShell>
      <Header title="Tally Export" backTo={ROUTES.REPORTS} />
      <PageContainer>
        <div className="finance-section">
          <div className="finance-section__header">
            <span className="finance-section__title">Export to TallyPrime</span>
          </div>
          <div className="finance-section__rows tally-export__body">
            <p className="tally-export__desc">
              Export your ledger accounts and journal entries as a Tally-compatible XML file. Import this into TallyPrime for accounting reconciliation.
            </p>
            <div className="finance-date-bar">
              <span className="finance-date-bar__label">From</span>
              <input type="date" className="finance-date-bar__input" value={dateRange.from} onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))} aria-label="From date" />
              <span className="finance-date-bar__label">To</span>
              <input type="date" className="finance-date-bar__input" value={dateRange.to} onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))} aria-label="To date" />
            </div>
            <button
              type="button"
              className="finance-date-bar__refresh-btn tally-export__download-btn"
              onClick={handleExport}
              disabled={exporting}
              aria-label="Download Tally XML"
            >
              {exporting ? 'Exporting...' : (
                <><Download size={16} aria-hidden="true" /> Download XML</>
              )}
            </button>
          </div>
        </div>

        <div className="finance-empty tally-export__info">
          <div className="finance-empty__icon" aria-hidden="true"><FileCode size={32} /></div>
          <p className="finance-empty__title">TallyPrime Compatible</p>
          <p className="finance-empty__desc">
            The exported XML includes all ledger masters and vouchers. Open TallyPrime, go to Import Data, and select the downloaded file.
          </p>
        </div>
      </PageContainer>
    </AppShell>
  )
}
