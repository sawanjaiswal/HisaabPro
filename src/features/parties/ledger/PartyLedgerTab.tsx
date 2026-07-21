/** Party Detail — Ledger tab: search + filter + month toolbar, row list, PDF export */

import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { pdf } from '@react-pdf/renderer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { usePartyLedger } from './usePartyLedger'
import { PartyLedgerPDF } from './PartyLedgerPDF'
import { filterRowsByQuery } from './ledger.utils'
import { LedgerRowList } from './components/LedgerRowList'
import { LedgerToolbar } from './components/LedgerToolbar'
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
  const [query, setQuery] = useState('')

  // Search narrows what is on screen only. The running-balance figures stay
  // computed from the full row set — a filtered ledger whose balances re-derive
  // from the visible subset would show numbers that do not reconcile.
  const visibleRows = useMemo(() => filterRowsByQuery(rows, query), [rows, query])

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
      <LedgerToolbar
        query={query}
        onQueryChange={setQuery}
        from={from}
        to={to}
        onMonthChange={handleMonthChange}
        showFilter={!lockTypes}
        filterCount={selectedTypes.length}
        onOpenFilter={() => setFilterOpen(true)}
      />

      {!lockTypes && (
        <LedgerFilterDrawer
          open={filterOpen}
          onClose={() => setFilterOpen(false)}
          from={from}
          to={to}
          selectedTypes={selectedTypes}
          onApply={handleApplyFilters}
          onExport={rows.length > 0 ? handleExportPDF : undefined}
          isExporting={isExporting}
        />
      )}

      {/* Loading */}
      {status === 'loading' && <LedgerLoading />}

      {/* Error */}
      {status === 'error' && <LedgerError onRetry={refresh} />}

      {/* Success */}
      {status === 'success' && (
        <>
          {visibleRows.length === 0 ? (
            <LedgerEmpty />
          ) : (
            <>
              <LedgerRowList
                rows={visibleRows}
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
