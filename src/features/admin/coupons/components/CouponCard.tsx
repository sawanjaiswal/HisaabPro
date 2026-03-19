/**
 * CouponCard — List item for admin coupon management
 * Feature #96
 */

import { useState } from 'react'
import { Tag, Trash2, Eye } from 'lucide-react'
import type { Coupon } from '../coupon.types'
import { STATUS_LABELS, STATUS_COLORS } from '../coupon.constants'
import { formatDiscount, formatUsage, formatCouponDate } from '../coupon.utils'
import '../coupon.css'

interface CouponCardProps {
  coupon: Coupon
  onView: (id: string) => void
  onDeactivate: (id: string, code: string) => Promise<boolean>
}

export function CouponCard({ coupon, onView, onDeactivate }: CouponCardProps) {
  const [confirming, setConfirming] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const statusColor = STATUS_COLORS[coupon.status]
  const statusLabel = STATUS_LABELS[coupon.status]

  const handleDeactivateClick = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeactivating(true)
    await onDeactivate(coupon.id, coupon.code)
    setDeactivating(false)
    setConfirming(false)
  }

  return (
    <div className="coupon-card" role="article" aria-label={`Coupon ${coupon.code}`}>
      <div className="coupon-card-header">
        <div className="coupon-card-code-row">
          <Tag size={16} aria-hidden="true" className="coupon-card-icon" />
          <span className="coupon-card-code">{coupon.code}</span>
        </div>
        <span
          className="coupon-card-status"
          style={{ '--status-color': statusColor } as React.CSSProperties}
        >
          {statusLabel}
        </span>
      </div>

      <div className="coupon-card-body">
        <div className="coupon-card-discount">
          {formatDiscount(coupon.discountType, coupon.discountValue)}
        </div>
        {coupon.description && (
          <p className="coupon-card-desc">{coupon.description}</p>
        )}
      </div>

      <div className="coupon-card-meta">
        <span>Usage: {formatUsage(coupon.usageCount, coupon.maxUses)}</span>
        <span>From: {formatCouponDate(coupon.validFrom)}</span>
        {coupon.validUntil && (
          <span>Until: {formatCouponDate(coupon.validUntil)}</span>
        )}
      </div>

      <div className="coupon-card-actions">
        <button
          className="coupon-card-btn"
          onClick={() => onView(coupon.id)}
          aria-label={`View ${coupon.code} details`}
        >
          <Eye size={16} aria-hidden="true" />
          View
        </button>
        {coupon.status !== 'DEACTIVATED' && (
          <button
            className="coupon-card-btn coupon-card-btn--danger"
            onClick={handleDeactivateClick}
            onBlur={() => setConfirming(false)}
            disabled={deactivating}
            aria-label={confirming ? `Confirm deactivate ${coupon.code}` : `Deactivate ${coupon.code}`}
          >
            <Trash2 size={16} aria-hidden="true" />
            {deactivating ? 'Deactivating...' : confirming ? 'Confirm?' : 'Deactivate'}
          </button>
        )}
      </div>
    </div>
  )
}
