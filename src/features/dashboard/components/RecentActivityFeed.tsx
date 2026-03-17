/** Dashboard — Recent transactions feed
 *
 * Shows dashboard-loaded items by default.
 * On search: debounced API call to /dashboard/activity/search
 * (returns up to 200 results, 24h window, server-side filtered).
 * All amounts in PAISE.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, IndianRupee, Search, X } from 'lucide-react'
import { formatCompactAmount, getInitials, formatDate } from '../dashboard.utils'
import { searchRecentActivity } from '../dashboard.service'
import type { RecentActivityItem } from '../dashboard.types'

const DEBOUNCE_MS = 300
const SKELETON_COUNT = 4

interface RecentActivityFeedProps {
  items: RecentActivityItem[]
  onItemClick: (item: RecentActivityItem) => void
  onAddPayment: (item: RecentActivityItem) => void
  onViewAll: () => void
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  items,
  onItemClick,
  onAddPayment,
  onViewAll,
}) => {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<RecentActivityItem[] | null>(null)
  const [searching, setSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(0 as unknown as ReturnType<typeof setTimeout>)

  const doSearch = useCallback((q: string) => {
    abortRef.current?.abort()

    if (!q.trim()) {
      setSearchResults(null)
      setSearching(false)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setSearching(true)

    searchRecentActivity(q.trim(), controller.signal)
      .then((results) => {
        if (!controller.signal.aborted) {
          setSearchResults(results)
          setSearching(false)
        }
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (!controller.signal.aborted) setSearching(false)
      })
  }, [])

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (!query.trim()) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    timerRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
  }, [query, doSearch])

  useEffect(() => () => { abortRef.current?.abort() }, [])

  const handleClear = () => {
    setQuery('')
    setSearchResults(null)
    setSearching(false)
    abortRef.current?.abort()
  }

  const displayItems = searchResults ?? items
  const isSearchActive = query.trim().length > 0

  if (items.length === 0 && !isSearchActive) {
    return (
      <div className="dashboard-transactions">
        <div className="dashboard-section-header">
          <span className="dashboard-section-title">Recent Transactions</span>
        </div>
        <div className="dashboard-txn-empty">
          <p>No recent transactions yet.</p>
          <p>Create an invoice to get started.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard-transactions">
      <div className="dashboard-section-header">
        <span className="dashboard-section-title">Recent Transactions</span>
        <button
          className="dashboard-section-link"
          onClick={onViewAll}
          aria-label="View all transactions in day book"
        >
          See All
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Search bar */}
      <div className="dashboard-txn-search">
        <Search size={16} className="dashboard-txn-search-icon" aria-hidden="true" />
        <input
          className="dashboard-txn-search-input"
          type="text"
          placeholder="Search by name, invoice, date, amount..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search recent transactions"
        />
        {query && (
          <button
            className="dashboard-txn-search-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Result count when searching */}
      {isSearchActive && !searching && searchResults && (
        <span className="dashboard-txn-search-count">
          {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
        </span>
      )}

      {/* Skeleton loading state */}
      {searching && (
        <div className="dashboard-txn-list" aria-busy="true" aria-label="Loading search results">
          {Array.from({ length: SKELETON_COUNT }, (_, i) => (
            <div key={i} className="dashboard-txn-row dashboard-txn-row--skeleton">
              <div className="dashboard-txn-avatar">
                <div className="skeleton dashboard-txn-avatar-skel" />
              </div>
              <div className="dashboard-txn-info">
                <div className="skeleton dashboard-txn-name-skel" />
                <div className="skeleton dashboard-txn-meta-skel" />
              </div>
              <div className="dashboard-txn-right">
                <div className="skeleton dashboard-txn-amount-skel" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!searching && (
        <div className="dashboard-txn-list" role="list" aria-label="Recent transactions">
          {displayItems.length === 0 && isSearchActive && (
            <div className="dashboard-txn-empty">
              <p>No transactions match &ldquo;{query}&rdquo;</p>
            </div>
          )}
          {displayItems.map((item) => {
            const isUnpaid = item.status === 'unpaid' || item.status === 'partial'
            const isInvoice = item.type === 'sale_invoice' || item.type === 'purchase_invoice'
            const showAdd = isUnpaid && isInvoice

            return (
              <div
                key={item.id}
                className="dashboard-txn-row"
                data-type={item.type}
                role="listitem"
                onClick={() => onItemClick(item)}
              >
                <div className="dashboard-txn-avatar">
                  <div className={`dashboard-txn-avatar-inner dashboard-txn-avatar-inner--${item.type}`}>
                    {getInitials(item.partyName)}
                  </div>
                </div>

                <div className="dashboard-txn-info">
                  <span className="dashboard-txn-name">{item.partyName}</span>
                  <div className="dashboard-txn-meta">
                    <span>{item.reference}</span>
                    <span className="dashboard-txn-meta-dot" aria-hidden="true" />
                    <span>{formatDate(item.date)}</span>
                  </div>
                </div>

                {showAdd && (
                  <button
                    className="dashboard-txn-add-btn"
                    onClick={(e) => { e.stopPropagation(); onAddPayment(item) }}
                    aria-label={`Record payment for ${item.partyName}`}
                  >
                    <IndianRupee size={14} aria-hidden="true" />
                    <span>Add</span>
                  </button>
                )}

                <div className="dashboard-txn-right">
                  <span className="dashboard-txn-amount">
                    - {formatCompactAmount(item.amount)}
                  </span>
                  {item.status && (
                    <span className={`dashboard-txn-status dashboard-txn-status--${item.status}`}>
                      {item.status === 'paid' ? 'PAID' : item.status === 'partial' ? 'PARTIAL' : 'UNPAID'}
                    </span>
                  )}
                  {item.mode && (
                    <span className="dashboard-txn-mode">{item.mode}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
