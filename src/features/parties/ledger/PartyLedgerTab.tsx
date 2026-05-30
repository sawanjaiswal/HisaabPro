/** Party Detail — Ledger tab: date range + voucher type filter + table + PDF export */

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FileDown } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { usePartyLedger } from './usePartyLedger'
import { PartyLedgerPDF } from './PartyLedgerPDF'
import { LedgerTable } from './components/LedgerTable'
import { LedgerLoading } from './components/LedgerLoading'
import { LedgerEmpty } from './components/LedgerEmpty'
import { LedgerError } from './components/LedgerError'
import { formatPaise } from '@/lib/format'
import type { LedgerVoucherType } from './ledger.types'
import './ledger.css'
import { Input } from '@/components/ui/Input'

interface PartyLedgerTabProps {
  partyId: string
  partyName: string
  businessName: string
}

const ALL_TYPES: { label: string; value: LedgerVoucherType }[] = [
  { label: 'Sale',        value: 'SALE' },
  { label: 'Purchase',    value: 'PURCHASE' },
  { label: 'Payment',     value: 'PAYMENT' },
  { label: 'Receipt',     value: 'RECEIPT' },
  { label: 'Credit Note', value: 'CREDIT_NOTE' },
  { label: 'Debit Note',  value: 'DEBIT_NOTE' },
  { label: 'Journal',     value: 'JOURNAL' },
]

export function PartyLedgerTab({ partyId, partyName, businessName }: PartyLedgerTabProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const {
    rows,
    openingBalance,
    closingBalance,
    totalCount,
    status,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    from,
    to,
    selectedTypes,
    setFrom,
    setTo,
    setSelectedTypes,
    refresh,
  } = usePartyLedger(partyId)

  const [isExporting, setIsExporting] = useState(false)

  const toggleType = useCallback(
    (type: LedgerVoucherType) => {
      setSelectedTypes(
        selectedTypes.includes(type)
          ? selectedTypes.filter((v) => v !== type)
          : [...selectedTypes, type],
      )
    },
    [selectedTypes, setSelectedTypes],
  )

  const handleExportPDF = useCallback(async () => {
    if (!rows.length || isExporting) return
    setIsExporting(true)
    try {
      const doc = (
        <PartyLedgerPDF
          data={{ partyId, partyName, fromDate: from, toDate: to, openingBalance, closingBalance, rows, nextCursor: null, totalCount }}
          businessName={businessName}
        />
      )
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ledger_${partyName.replace(/\s+/g, '_')}_${from}_${to}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      toast.success(t.ledgerDownloaded)
    } catch {
      toast.error(t.ledgerExportFailed)
    } finally {
      setIsExporting(false)
    }
  }, [rows, isExporting, partyId, partyName, from, to, openingBalance, closingBalance, totalCount, businessName, toast, t])

  return (
    <div className="party-ledger-tab">
      {/* Filters */}
      <div className="ledger-filters">
        <div className="ledger-date-row">
          <div className="ledger-date-group">
            <label htmlFor="ledger-from" className="ledger-date-label">{t.fromDate}</label>
            <Input
              id="ledger-from"
              type="date"
              className="ledger-date-input"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              max={to}
              aria-label={t.ledgerFromDate}
            />
          </div>
          <div className="ledger-date-group">
            <label htmlFor="ledger-to" className="ledger-date-label">{t.toDate}</label>
            <Input
              id="ledger-to"
              type="date"
              className="ledger-date-input"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              min={from}
              aria-label={t.ledgerToDate}
            />
          </div>
        </div>

        {/* Voucher type chips — multi-select */}
        <div
          className="ledger-type-chips"
          role="group"
          aria-label={t.filterByVoucherType}
        >
          {ALL_TYPES.map(({ label, value }) => {
            const active = selectedTypes.includes(value)
            return (
              <Button variant="none"
                key={value}
                type="button"
                className={`ledger-type-chip${active ? ' active' : ''}`}
                onClick={() => toggleType(value)}
                aria-pressed={active}
                aria-label={`${active ? t.remove : t.add} ${label} ${t.filter}`}
              >
                {label}
              </Button>
            )
          })}
        </div>
      </div>

      {/* Loading */}
      {status === 'loading' && <LedgerLoading />}

      {/* Error */}
      {status === 'error' && <LedgerError onRetry={refresh} />}

      {/* Success */}
      {status === 'success' && (
        <>
          {rows.length === 0 ? (
            <LedgerEmpty />
          ) : (
            <>
              {/* Summary */}
              <div className="ledger-summary" aria-label={t.ledgerSummary}>
                <div className="ledger-summary-card">
                  <p className="ledger-summary-label">{t.openingBalance}</p>
                  <p className="ledger-summary-value">{formatPaise(Math.abs(openingBalance))}</p>
                </div>
                <div className="ledger-summary-card">
                  <p className="ledger-summary-label">{t.closingBalance}</p>
                  <p className="ledger-summary-value">{formatPaise(Math.abs(closingBalance))}</p>
                </div>
              </div>

              {/* Export PDF */}
              <div className="ledger-export-bar">
                <Button
                  type="button"
                  variant="ghost" size="sm"
                  onClick={handleExportPDF}
                  disabled={isExporting}
                  aria-label={t.downloadLedgerPDF}
                >
                  <FileDown size={16} aria-hidden="true" />
                  <span>{isExporting ? t.exporting : t.downloadPdf}</span>
                </Button>
              </div>

              <LedgerTable
                rows={rows}
                openingBalance={openingBalance}
                closingBalance={closingBalance}
              />

              {/* Load more */}
              {hasNextPage && (
                <Button variant="none"
                  type="button"
                  className="ledger-load-more"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  aria-label={t.loadMoreRows}
                >
                  {isFetchingNextPage ? t.loading : `${t.loadMore} (${totalCount - rows.length} ${t.remaining})`}
                </Button>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
