/** BatchDetailInfo — Renders batch detail sections */

import { Calendar, Package, IndianRupee, FileText } from 'lucide-react'
import { formatPaise } from '@/lib/format'
import { getExpiryStatus, formatExpiryDate, daysUntilExpiry } from '../batch.utils'
import { EXPIRY_BADGE_CLASSES, EXPIRY_STATUS_LABELS } from '../batch.constants'
import type { Batch } from '../batch.types'

interface BatchDetailInfoProps {
  batch: Batch
}

export function BatchDetailInfo({ batch }: BatchDetailInfoProps) {
  const expiryStatus = getExpiryStatus(batch.expiryDate)

  return (
    <div className="batch-detail">
      <div className="batch-detail-status">
        <span className={EXPIRY_BADGE_CLASSES[expiryStatus]}>
          {EXPIRY_STATUS_LABELS[expiryStatus]}
        </span>
        {batch.expiryDate && expiryStatus !== 'none' && (
          <span className="batch-detail-days">
            {expiryStatus === 'expired'
              ? `Expired ${Math.abs(daysUntilExpiry(batch.expiryDate))} days ago`
              : `${daysUntilExpiry(batch.expiryDate)} days left`}
          </span>
        )}
      </div>

      <div className="batch-detail-section">
        <div className="batch-detail-row">
          <Package size={16} aria-hidden="true" />
          <span className="batch-detail-label">Stock</span>
          <span className="batch-detail-value">{batch.currentStock}</span>
        </div>
      </div>

      <div className="batch-detail-section">
        <div className="batch-detail-row">
          <Calendar size={16} aria-hidden="true" />
          <span className="batch-detail-label">Mfg Date</span>
          <span className="batch-detail-value">
            {formatExpiryDate(batch.manufacturingDate)}
          </span>
        </div>
        <div className="batch-detail-row">
          <Calendar size={16} aria-hidden="true" />
          <span className="batch-detail-label">Expiry</span>
          <span className="batch-detail-value">
            {formatExpiryDate(batch.expiryDate)}
          </span>
        </div>
      </div>

      <div className="batch-detail-section">
        <div className="batch-detail-row">
          <IndianRupee size={16} aria-hidden="true" />
          <span className="batch-detail-label">Cost Price</span>
          <span className="batch-detail-value">
            {batch.costPrice !== null ? formatPaise(batch.costPrice) : '--'}
          </span>
        </div>
        <div className="batch-detail-row">
          <IndianRupee size={16} aria-hidden="true" />
          <span className="batch-detail-label">Sale Price</span>
          <span className="batch-detail-value">
            {batch.salePrice !== null ? formatPaise(batch.salePrice) : '--'}
          </span>
        </div>
      </div>

      {batch.notes && (
        <div className="batch-detail-section">
          <div className="batch-detail-row batch-detail-row--notes">
            <FileText size={16} aria-hidden="true" />
            <span className="batch-detail-label">Notes</span>
            <p className="batch-detail-notes">{batch.notes}</p>
          </div>
        </div>
      )}
    </div>
  )
}
