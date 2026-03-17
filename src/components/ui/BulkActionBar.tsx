/** Bulk Action Bar — Sticky bottom bar for multi-select operations
 *
 * Slides up from bottom when items are selected. Shows count + action buttons.
 * Used across Parties, Products, Invoices, Payments list pages.
 */

import { X, Trash2, Download, Send } from 'lucide-react'
import './bulk-action-bar.css'

export interface BulkAction {
  id: string
  label: string
  icon: 'delete' | 'export' | 'share'
  /** Makes the button red/danger style */
  isDanger?: boolean
  onClick: () => void
}

interface BulkActionBarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onClear: () => void
  actions: BulkAction[]
  /** Whether any action is currently in progress */
  isProcessing?: boolean
}

const ICON_MAP = {
  delete: Trash2,
  export: Download,
  share: Send,
} as const

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClear,
  actions,
  isProcessing = false,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null

  const allSelected = selectedCount === totalCount

  return (
    <div className="bulk-bar" role="toolbar" aria-label="Bulk actions">
      <div className="bulk-bar-left">
        <button
          className="bulk-bar-close"
          onClick={onClear}
          aria-label="Clear selection"
          disabled={isProcessing}
        >
          <X size={18} aria-hidden="true" />
        </button>
        <span className="bulk-bar-count">
          {selectedCount} selected
        </span>
        {!allSelected && (
          <button
            className="bulk-bar-select-all"
            onClick={onSelectAll}
            disabled={isProcessing}
            aria-label={`Select all ${totalCount} items`}
          >
            Select All ({totalCount})
          </button>
        )}
      </div>

      <div className="bulk-bar-actions">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon]
          return (
            <button
              key={action.id}
              className={`bulk-bar-action${action.isDanger ? ' bulk-bar-action--danger' : ''}`}
              onClick={action.onClick}
              disabled={isProcessing}
              aria-label={action.label}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="bulk-bar-action-label">{action.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
