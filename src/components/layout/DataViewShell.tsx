/**
 * DataViewShell — Standard Level 6 Page Shell for Lists, Tables & Ledgers.
 *
 * Enforces:
 * 1. Global AppShell and Header with action slots.
 * 2. Sticky Search and FilterChips header bar with zero layout jitter.
 * 3. 4 Mandatory UI states: Loading Skeleton, Error State, Empty State, and Data view.
 * 4. Guaranteed bottom navigation clearance: `pb-[calc(var(--bottom-nav-height)+2.5rem)]`.
 * 5. Floating Action Button (FAB) or footer summary docking.
 */

import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { SearchInput } from '@/components/ui/SearchInput'
import { FilterChips, type FilterChipOption } from '@/components/ui/FilterChips'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/feedback/Skeleton'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Button } from '@/components/ui/Button'

export interface DataViewShellProps<TFilter extends string = string> {
  /** Page title in the header */
  title: string
  /** Back navigation path */
  backTo?: string | true
  /** Header action buttons/icons */
  headerActions?: ReactNode
  /** Search query state */
  searchQuery?: string
  /** Search change handler */
  onSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Search clear handler */
  onSearchClear?: () => void
  /** Search input placeholder */
  searchPlaceholder?: string
  /** Filter chip options */
  filterOptions?: FilterChipOption<TFilter>[]
  /** Currently active filter value */
  activeFilter?: TFilter
  /** Filter selection handler */
  onFilterChange?: (val: TFilter) => void
  /** Label for filter chips aria accessibility */
  filterLabel?: string
  /** Loading state */
  isLoading?: boolean
  /** Error message */
  error?: string | null
  /** Retry callback on error */
  onRetry?: () => void
  /** Whether data list is empty */
  isEmpty?: boolean
  /** Empty state title */
  emptyTitle?: string
  /** Empty state subtitle/description */
  emptyDescription?: string
  /** Empty state action button */
  emptyAction?: { label: string; onClick: () => void }
  /** Content to render on success state */
  children: ReactNode
  /** Whether to render bottom navigation bar (default: true) */
  showBottomNav?: boolean
  /** Optional floating action button or bottom summary */
  floatingAction?: ReactNode
  /** Additional container styling */
  className?: string
}

export function DataViewShell<TFilter extends string = string>({
  title,
  backTo,
  headerActions,
  searchQuery,
  onSearchChange,
  onSearchClear,
  searchPlaceholder,
  filterOptions,
  activeFilter,
  onFilterChange,
  filterLabel = 'Filter items',
  isLoading = false,
  error = null,
  onRetry,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  children,
  showBottomNav = true,
  floatingAction,
  className = '',
}: DataViewShellProps<TFilter>) {
  const hasFilterBar = Boolean(onSearchChange || (filterOptions && onFilterChange && activeFilter !== undefined))

  return (
    <AppShell>
      <Header title={title} backTo={backTo} actions={headerActions} />

      {hasFilterBar && (
        <div className="sticky top-[var(--header-height)] z-[var(--z-sticky)] bg-[var(--color-gray-0)] border-b border-gray-100 px-4 py-3 space-y-2.5 shadow-xs">
          {onSearchChange && searchQuery !== undefined && (
            <SearchInput
              value={searchQuery}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder={searchPlaceholder}
            />
          )}
          {filterOptions && onFilterChange && activeFilter !== undefined && (
            <FilterChips
              options={filterOptions}
              value={activeFilter}
              onChange={onFilterChange}
              label={filterLabel}
            />
          )}
        </div>
      )}

      <PageContainer
        variant="list"
        className={`py-4 ${showBottomNav ? 'pb-[calc(var(--bottom-nav-height)+2.5rem)]' : 'pb-12'} ${className}`}
      >
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton height="4rem" borderRadius="var(--radius-lg)" count={3} />
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={onRetry} />
        ) : isEmpty ? (
          <EmptyState
            title={emptyTitle || 'No items found'}
            description={emptyDescription}
            action={
              emptyAction ? (
                <Button variant="primary" size="sm" onClick={emptyAction.onClick}>
                  {emptyAction.label}
                </Button>
              ) : undefined
            }
          />
        ) : (
          children
        )}
      </PageContainer>

      {floatingAction}
      {showBottomNav && <BottomNav />}
    </AppShell>
  )
}
