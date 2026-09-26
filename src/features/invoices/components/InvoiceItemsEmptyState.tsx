import { Plus, Package } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InvoiceScanButton } from './InvoiceScanButton'
import type { ProductPick } from '../invoice.types'

interface InvoiceItemsEmptyStateProps {
  emptyTitle: string
  emptySub: string
  addItemLabel: string
  onToggleProductSearch: () => void
  onProductSelect: (pick: ProductPick) => void
}

export function InvoiceItemsEmptyState({
  emptyTitle,
  emptySub,
  addItemLabel,
  onToggleProductSearch,
  onProductSelect,
}: InvoiceItemsEmptyStateProps) {
  return (
    <div className="bg-[var(--color-gray-50)] rounded-[8px] p-6 text-center flex flex-col items-center justify-center space-y-2 border border-[var(--color-gray-100)] transition-all">
      <div className="inline-flex items-center justify-center text-slate-400 mb-1">
        <Package size={38} strokeWidth={1.5} />
      </div>
      <h4 className="text-sm font-bold text-slate-900">{emptyTitle}</h4>
      <p className="text-xs text-slate-500 max-w-xs">{emptySub}</p>
      <div className="flex items-center gap-2.5 pt-3">
        <Button
          variant="none"
          type="button"
          className="bg-[#026F39] hover:bg-[#025a2e] text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 transition-all"
          onClick={onToggleProductSearch}
        >
          <Plus size={14} />
          <span>+ {addItemLabel}</span>
        </Button>
        <div className="[&>button]:bg-emerald-50 [&>button]:text-[#026F39] [&>button]:hover:bg-emerald-100 [&>button]:font-bold [&>button]:text-xs [&>button]:px-4 [&>button]:py-2.5 [&>button]:rounded-xl [&>button]:border-0">
          <InvoiceScanButton onAdd={onProductSelect} />
        </div>
      </div>
    </div>
  )
}
