/** Dashboard — Recent transactions feed
 *
 * Shows dashboard-loaded items by default.
 * On search: debounced API call to /dashboard/activity/search
 * (24h window, up to 200 results). Falls back to client-side
 * filtering if backend is unavailable.
 * All amounts in PAISE.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { ChevronRight, Search, X } from 'lucide-react'
import { formatDate, formatAmount, formatCompactAmount, getDateGroup } from '../dashboard.utils'
import { searchRecentActivity } from '../dashboard.service'
import { TxnRow } from './TxnRow'
import type { RecentActivityItem } from '../dashboard.types'

const DEBOUNCE_MS = 300
const SKELETON_COUNT = 4

/** Client-side fallback when backend search is unavailable */
function filterLocally(items: RecentActivityItem[], q: string): RecentActivityItem[] {
  const lower = q.toLowerCase()
  return items.filter((item) =>
    item.partyName.toLowerCase().includes(lower) ||
    item.reference.toLowerCase().includes(lower) ||
    formatDate(item.date).toLowerCase().includes(lower) ||
    formatAmount(item.amount).includes(lower) ||
    formatCompactAmount(item.amount).includes(lower)
  )
}

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
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        if (!controller.signal.aborted) {
          // Backend unavailable — fall back to client-side filtering
          setSearchResults(filterLocally(items, q.trim()))
          setSearching(false)
        }
      })
  }, [items])

  useEffect(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    if (!query.trim()) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    timerRef.current = setTimeout(() => doSearch(query), DEBOUNCE_MS)
    return () => { if (timerRef.current !== null) clearTimeout(timerRef.current) }
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

  // Group items by date (Today / Yesterday / date) — only when not searching
  const groupedItems = useMemo(
    () => (!isSearchActive ? buildDateGroups(displayItems) : null),
    [isSearchActive, displayItems]
  )

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
          {groupedItems
            ? groupedItems.map((group) => (
                <React.Fragment key={group.label}>
                  <div className="dashboard-txn-date-header" role="separator">
                    {group.label}
                  </div>
                  {group.items.map((item) => (
                    <TxnRow key={item.id} item={item} onItemClick={onItemClick} onAddPayment={onAddPayment} />
                  ))}
                </React.Fragment>
              ))
            : displayItems.map((item) => (
                <TxnRow key={item.id} item={item} onItemClick={onItemClick} onAddPayment={onAddPayment} />
              ))}
        </div>
      )}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

interface DateGroup {
  label: string
  items: RecentActivityItem[]
}

function buildDateGroups(items: RecentActivityItem[]): DateGroup[] {
  const groups: DateGroup[] = []
  let currentLabel = ''
  for (const item of items) {
    const label = getDateGroup(item.date)
    if (label !== currentLabel) {
      groups.push({ label, items: [item] })
      currentLabel = label
    } else {
      groups[groups.length - 1].items.push(item)
    }
  }
  return groups
}

