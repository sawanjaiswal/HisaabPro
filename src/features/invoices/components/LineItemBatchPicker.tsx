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
      <div style={{ marginBottom: 'var(--space-2)' }}>
        <Button variant="none"
          type="button"
          onClick={() => setOpen(true)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--fs-xs)',
            color: batchId ? 'var(--color-primary)' : 'var(--color-text-muted)',
            background: 'none',
            border: '1px dashed var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '4px 10px',
            cursor: 'pointer',
            minHeight: 44,
          }}
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
