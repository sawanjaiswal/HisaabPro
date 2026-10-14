/**
 * Bulk Product Add — Toolbar and Paste Input Section
 */

import React from 'react'
import { Plus, Clipboard, Trash2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

interface BulkProductToolbarProps {
  onPasteClick: () => void
  onAddRows: (count: number) => void
  onClearEmpty: () => void
  validCount: number
  invalidCount: number
  isPasting: boolean
  pasteText: string
  onPasteTextChange: (text: string) => void
  onCancelPaste: () => void
  onApplyPaste: () => void
}

export const BulkProductToolbar: React.FC<BulkProductToolbarProps> = ({
  onPasteClick,
  onAddRows,
  onClearEmpty,
  validCount,
  invalidCount,
  isPasting,
  pasteText,
  onPasteTextChange,
  onCancelPaste,
  onApplyPaste,
}) => {
  return (
    <>
      <div className="bulk-product-toolbar">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onPasteClick}>
            <Clipboard size={15} className="mr-1.5" aria-hidden="true" />
            Paste from Excel / Sheets
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAddRows(1)}>
            <Plus size={15} className="mr-1" aria-hidden="true" />
            Add Row
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAddRows(5)}>
            + 5 Rows
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearEmpty}>
            <Trash2 size={14} className="mr-1" aria-hidden="true" />
            Clean Empty
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-success-600 bg-success-50 px-2.5 py-1 rounded-full border border-success-200">
            {validCount} ready to add
          </span>
          {invalidCount > 0 && (
            <span className="font-semibold text-error-600 bg-error-50 px-2.5 py-1 rounded-full border border-error-200 flex items-center gap-1">
              <AlertCircle size={12} /> {invalidCount} with issues
            </span>
          )}
        </div>
      </div>

      {isPasting && (
        <div className="p-4 bg-primary-50 border-b border-primary-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold text-primary-900">
              Paste tabular data below (Cmd+V / Ctrl+V):
            </span>
            <Button variant="ghost" size="sm" onClick={onCancelPaste}>
              Cancel
            </Button>
          </div>
          <Textarea
            className="bulk-paste-box"
            placeholder="Paste table data here (Name, Unit, Sale Price, Purchase Price, Stock...)"
            value={pasteText}
            onChange={(e) => onPasteTextChange(e.target.value)}
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="primary" size="sm" onClick={onApplyPaste}>
              Apply Pasted Data
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
