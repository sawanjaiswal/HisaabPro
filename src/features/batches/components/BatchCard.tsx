/** BatchCard — Single batch row in list */

import { useState } from 'react'
import { Package, Calendar, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes.config'
import { formatPaise } from '@/lib/format'
import { getExpiryStatus, formatExpiryDate } from '../batch.utils'
import { EXPIRY_BADGE_CLASSES, EXPIRY_STATUS_LABELS } from '../batch.constants'
import { DeleteBatchDialog } from './DeleteBatchDialog'
import type { Batch } from '../batch.types'

interface BatchCardProps {
  batch: Batch
  onDelete: (id: string, batchNumber: string) => void
  isDeleting: boolean
}

export function BatchCard({ batch, onDelete, isDeleting }: BatchCardProps) {
  const navigate = useNavigate()
  const [showDelete, setShowDelete] = useState(false)
  const expiryStatus = getExpiryStatus(batch.expiryDate)
  const badgeClass = EXPIRY_BADGE_CLASSES[expiryStatus]
  const badgeLabel = EXPIRY_STATUS_LABELS[expiryStatus]

  const handleClick = () => navigate(ROUTES.BATCH_DETAIL.replace(':id', batch.id))
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDelete(true)
  }

  return (
    <div
      className="batch-card"
      role="button"
      tabIndex={0}
      aria-label={`View batch ${batch.batchNumber}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      style={{ cursor: 'pointer' }}
    >
      <div className="batch-card-icon" aria-hidden="true">
        <Package size={20} />
      </div>

      <div className="batch-card-info">
        <div className="batch-card-header">
          <span className="batch-card-number">{batch.batchNumber}</span>
          <span className={badgeClass} aria-label={`Expiry status: ${badgeLabel}`}>
            {badgeLabel}
          </span>
        </div>

        <div className="batch-card-meta">
          <span className="batch-card-stock">
            Stock: {batch.currentStock}
          </span>
          {batch.expiryDate && (
            <span className="batch-card-expiry">
              <Calendar size={12} aria-hidden="true" />
              {formatExpiryDate(batch.expiryDate)}
            </span>
          )}
        </div>

        <div className="batch-card-prices">
          {batch.costPrice !== null && (
            <span className="batch-card-price">
              Cost: {formatPaise(batch.costPrice)}
            </span>
          )}
          {batch.salePrice !== null && (
            <span className="batch-card-price">
              Sale: {formatPaise(batch.salePrice)}
            </span>
          )}
        </div>
      </div>

      {batch.currentStock === 0 && (
        <button
          type="button"
          className="batch-card-delete"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          aria-label={`Delete batch ${batch.batchNumber}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      )}

      {showDelete && (
        <DeleteBatchDialog
          batchNumber={batch.batchNumber}
          isDeleting={isDeleting}
          onConfirm={() => onDelete(batch.id, batch.batchNumber)}
          onCancel={() => setShowDelete(false)}
        />
      )}
    </div>
  )
}
