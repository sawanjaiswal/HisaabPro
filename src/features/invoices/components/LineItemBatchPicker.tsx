/** BAT-05 — batch pick button + picker modal for a line item */

import React, { useState } from 'react'
import { Package } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { BatchPicker } from '@/features/inventory/components/BatchPicker'
import { Button } from '@/components/ui/Button'

interface LineItemBatchPickerProps {
  productId: string
  batchId: string | null | undefined
  expiredBatchPolicy: 'HARD_BLOCK' | 'WARN_ONLY'
  onSelect: (batchId: string) => void
}

export const LineItemBatchPicker: React.FC<LineItemBatchPickerProps> = ({
  productId,
  batchId,
  expiredBatchPolicy,
  onSelect,
}) => {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="mb-2">
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1 text-xs border-dashed min-h-[44px] px-2.5 py-1 ${
            batchId ? 'text-[var(--color-primary)] border-[var(--color-primary)]' : 'text-[var(--color-text-muted)] border-[var(--color-border)]'
          }`}
          aria-label={batchId ? `Batch selected — ${t.pickBatch}` : t.pickBatch}
        >
          <Package size={12} aria-hidden="true" />
          {batchId ? `${t.pickBatch} ✓` : t.pickBatch}
        </Button>
      </div>

      {open && (
        <BatchPicker
          productId={productId}
          expiredBatchPolicy={expiredBatchPolicy}
          selectedBatchId={batchId ?? null}
          onSelect={(id) => {
            onSelect(id)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
