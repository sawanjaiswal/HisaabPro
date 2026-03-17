/** Party Transactions Tab — Ledger view with running balance
 *
 * Shows combined invoices + payments chronologically, similar to
 * MyBillBook's "Ledger (Statement)" tab. Each row shows date,
 * reference, description, debit/credit amount, and running balance.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, CreditCard, ChevronDown } from 'lucide-react'
import '../party-transactions.css'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { getPartyTransactions } from '../party.service'
import { formatAmount, paisaToRupees } from '../party.utils'
import type { PartyTransaction, PartyTransactionListResponse } from '../party.types'

interface PartyTransactionsTabProps {
  partyId: string
}

type LoadStatus = 'loading' | 'error' | 'success'

const PAGE_SIZE = 20

export function PartyTransactionsTab({ partyId }: PartyTransactionsTabProps) {
  const navigate = useNavigate()

  const [transactions, setTransactions] = useState<PartyTransaction[]>([])
  const [summary, setSummary] = useState<PartyTransactionListResponse['summary'] | null>(null)
  const [status, setStatus] = useState<LoadStatus>('loading')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const fetchTransactions = useCallback((pageNum: number, append: boolean, signal?: AbortSignal) => {
    if (!append) setStatus('loading')
    else setIsLoadingMore(true)

    getPartyTransactions(partyId, { page: pageNum, limit: PAGE_SIZE }, signal)
      .then((data) => {
        if (append) {
          setTransactions((prev) => [...prev, ...data.transactions])
        } else {
          setTransactions(data.transactions)
        }
        setSummary(data.summary)
        setHasMore(pageNum < data.pagination.totalPages)
        setStatus('success')
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return
        if (!append) setStatus('error')
      })
      .finally(() => setIsLoadingMore(false))
  }, [partyId])

  useEffect(() => {
    const controller = new AbortController()
    fetchTransactions(1, false, controller.signal)
    return () => controller.abort()
  }, [fetchTransactions])

  const handleLoadMore = () => {
    const nextPage = page + 1
    setPage(nextPage)
    fetchTransactions(nextPage, true)
  }

  const handleTxnClick = (txn: PartyTransaction) => {
    if (txn.type === 'INVOICE') {
      navigate(`/invoices/${txn.id}`)
    } else {
      navigate(`/payments/${txn.id}`)
    }
  }

  const retry = () => {
    setPage(1)
    fetchTransactions(1, false)
  }

  if (status === 'loading') {
    return (
      <div className="party-txn-tab">
        <Skeleton height="3.5rem" borderRadius="var(--radius-md)" />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <Skeleton height="4rem" borderRadius="var(--radius-md)" count={5} />
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <ErrorState
        title="Could not load transactions"
        message="Check your connection and try again."
        onRetry={retry}
      />
    )
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={<FileText size={40} aria-hidden="true" />}
        title="No transactions yet"
        description="Create an invoice or record a payment to start tracking business with this party."
        action={
          <button
            className="btn btn-primary btn-md"
            onClick={() => navigate('/invoices/new')}
            aria-label="Create invoice for this party"
          >
            Create Invoice
          </button>
        }
      />
    )
  }

  return (
    <div className="party-txn-tab">
      {/* Summary bar */}
      {summary && (
        <div className="party-txn-summary">
          <div className="party-txn-summary-item">
            <span className="party-txn-summary-label">Total Debit</span>
            <span className="party-txn-summary-value party-txn-summary-value--debit">
              {formatAmount(summary.totalDebit)}
            </span>
          </div>
          <div className="party-txn-summary-item">
            <span className="party-txn-summary-label">Total Credit</span>
            <span className="party-txn-summary-value party-txn-summary-value--credit">
              {formatAmount(summary.totalCredit)}
            </span>
          </div>
          <div className="party-txn-summary-item">
            <span className="party-txn-summary-label">Balance</span>
            <span className={`party-txn-summary-value ${summary.closingBalance > 0 ? 'party-txn-summary-value--debit' : 'party-txn-summary-value--credit'}`}>
              {formatAmount(Math.abs(summary.closingBalance))}
              <small>{summary.closingBalance > 0 ? ' DR' : summary.closingBalance < 0 ? ' CR' : ''}</small>
            </span>
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="party-txn-list" role="list" aria-label="Transaction ledger">
        {transactions.map((txn) => (
          <button
            key={`${txn.type}-${txn.id}`}
            className="party-txn-row"
            onClick={() => handleTxnClick(txn)}
            role="listitem"
            aria-label={`${txn.description} — ${formatAmount(Math.abs(txn.amount))}`}
          >
            <div className={`party-txn-icon ${txn.type === 'INVOICE' ? 'party-txn-icon--invoice' : 'party-txn-icon--payment'}`}>
              {txn.type === 'INVOICE'
                ? <FileText size={16} aria-hidden="true" />
                : <CreditCard size={16} aria-hidden="true" />
              }
            </div>

            <div className="party-txn-info">
              <span className="party-txn-ref">{txn.reference}</span>
              <span className="party-txn-desc">{txn.description}</span>
              <span className="party-txn-date">
                {new Date(txn.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>

            <div className="party-txn-amounts">
              <span className={`party-txn-amount ${txn.amount > 0 ? 'party-txn-amount--debit' : 'party-txn-amount--credit'}`}>
                {txn.amount > 0 ? '+' : ''}{paisaToRupees(txn.amount)}
              </span>
              <span className="party-txn-balance">
                Bal: {paisaToRupees(txn.runningBalance)}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          className="btn btn-ghost btn-md party-txn-load-more"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          aria-label="Load more transactions"
        >
          {isLoadingMore ? 'Loading...' : (
            <>
              Load More
              <ChevronDown size={16} aria-hidden="true" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
