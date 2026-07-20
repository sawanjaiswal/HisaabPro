/** Party Detail — Ledger tab: month dropdown + filter sheet + row list + PDF export */

import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FileDown, Filter } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { usePartyLedger } from './usePartyLedger'
import { PartyLedgerPDF } from './PartyLedgerPDF'
import { LedgerRowList } from './components/LedgerRowList'
import { LedgerMonthPicker } from './components/LedgerMonthPicker'
import { LedgerFilterDrawer } from './components/LedgerFilterDrawer'
import { LedgerLoading } from './components/LedgerLoading'
import { LedgerEmpty } from './components/LedgerEmpty'
import { LedgerError } from './components/LedgerError'
import type { LedgerVoucherType } from './ledger.types'
import './ledger.css'

interface PartyLedgerTabProps {
  partyId: string
  partyName: string
  businessName: string
  /** Fixed voucher-type filter (Invoices/Payments tabs). Hides the filter sheet. */
  lockTypes?: LedgerVoucherType[]
}

export function PartyLedgerTab({ partyId, partyName, businessName, lockTypes }: PartyLedgerTabProps) {
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
  } = usePartyLedger(partyId, lockTypes)

  const [isExporting, setIsExporting] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const handleMonthChange = useCallback(
    (nextFrom: string, nextTo: string) => {
      setFrom(nextFrom)
      setTo(nextTo)
    },
    [setFrom, setTo],
  )

  const handleApplyFilters = useCallback(
    (nextFrom: string, nextTo: string, types: LedgerVoucherType[]) => {
      setFrom(nextFrom)
      setTo(nextTo)
      setSelectedTypes(types)
    },
    [setFrom, setTo, setSelectedTypes],
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
      {/* Toolbar: month dropdown · filter + export */}
      <div className="ledger-toolbar">
        <LedgerMonthPicker from={from} to={to} onChange={handleMonthChange} />
        <div className="ledger-toolbar__actions">
          {!lockTypes && (
            <Button
              variant="none"
              type="button"
              className="ledger-filter-btn"
              onClick={() => setFilterOpen(true)}
              aria-label={t.filter}
            >
              <Filter size={16} aria-hidden="true" />
              <span>{t.filter}</span>
              {selectedTypes.length > 0 && (
                <span className="ledger-filter-badge">{selectedTypes.length}</span>
              )}
            </Button>
          )}
          {status === 'success' && rows.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleExportPDF}
              disabled={isExporting}
              aria-label={t.downloadLedgerPDF}
            >
              <FileDown size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>

      {!lockTypes && (
        <LedgerFilterDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          from={from}
          to={to}
          selectedTypes={selectedTypes}
          onApply={handleApplyFilters}
        />
      )}

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
              <LedgerRowList
                rows={rows}
                openingBalance={openingBalance}
                closingBalance={closingBalance}
                asOn={to}
              />

              {/* Load more */}
              {hasNextPage && (
                <Button
                  variant="none"
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
