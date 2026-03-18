/** Library Item List — Selectable items from the library */

import { Plus } from 'lucide-react'
import type { LibraryItem } from '../items-library.types'

interface LibraryItemListProps {
  items: LibraryItem[]
  total: number
  hasMore: boolean
  onSelect: (item: LibraryItem) => void
  onLoadMore: () => void
}

export function LibraryItemList({ items, total, hasMore, onSelect, onLoadMore }: LibraryItemListProps) {
  if (items.length === 0) {
    return (
      <div className="library-empty">
        <p>No items found. Try a different search or category.</p>
      </div>
    )
  }

  return (
    <>
      <p className="library-count">{total} items</p>
      <div className="library-item-list" role="list" aria-label="Library items">
        {items.map((item) => (
          <div key={item.id} className="library-item" role="listitem">
            <div className="library-item-info">
              <span className="library-item-name">{item.name}</span>
              <span className="library-item-meta">
                {item.hsn && <span>HSN: {item.hsn}</span>}
                {item.unit && <span>{item.unit}</span>}
              </span>
            </div>
            <button
              type="button"
              className="library-item-add"
              onClick={() => onSelect(item)}
              aria-label={`Add ${item.name} to your products`}
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
      {hasMore && (
        <button type="button" className="btn btn-ghost btn-md library-load-more" onClick={onLoadMore}>
          Load More
        </button>
      )}
    </>
  )
}
