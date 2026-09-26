/** EntitySearch Types — SSOT for all typeahead & entity creation searchboxes */

import type { ReactNode } from 'react'

export interface EntityBadge {
  text: string
  variant?: 'customer' | 'supplier' | 'both' | 'staff' | 'default' | 'success' | 'warning'
}

export interface EntitySearchItem {
  id: string
  title: string
  subtitle?: string
  badge?: EntityBadge
  pricePaise?: number
  priceDisplay?: string
  isAdded?: boolean
  icon?: ReactNode
  raw?: any
}

export interface EntitySearchProps<T = any> {
  id?: string
  label?: string
  placeholder?: string
  autoFocus?: boolean
  selectedId?: string
  selectedTitle?: string
  onSelect: (item: T) => void
  onClearSelection?: () => void
  
  /** Query & Results fetching */
  onFetchResults: (query: string, signal: AbortSignal) => Promise<T[]>
  mapToItem: (raw: T) => EntitySearchItem
  
  /** Instant Entity Creation (e.g. "Add 'sawan' as a client") */
  entityName?: string // e.g. "client", "product"
  entityPlural?: string // e.g. "clients", "products"
  onCreateOption?: (query: string) => Promise<void> | void
  isCreating?: boolean
  
  /** Custom renderers */
  renderSelected?: (props: { id: string; title: string; onClear: () => void }) => ReactNode
  renderItem?: (item: EntitySearchItem, onSelect: () => void, isHighlighted: boolean) => ReactNode
  
  error?: string
  className?: string
  showLabel?: boolean
  keepOpenOnSelect?: boolean
}
