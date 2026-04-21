/**
 * CouponDetailPage — Admin coupon detail with redemption stats
 * Feature #96
 */

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Skeleton } from '@/components/feedback/Skeleton'
import { useToast } from '@/hooks/useToast'
import { ApiError } from '@/lib/api'
import * as couponService from './coupon.service'
import { STATUS_LABELS, STATUS_COLORS, DISCOUNT_TYPE_LABELS, APPLIES_TO_LABELS } from './coupon.constants'
import { formatDiscount, formatUsage, formatCouponDate, formatCouponDateTime, paiseToRupees } from './coupon.utils'
import type { CouponDetail } from './coupon.types'
import './coupon.css'
import { useLanguage } from '@/hooks/useLanguage'

type Status = 'loading' | 'error' | 'success'

export default function CouponDetailPage() {
  const { t } = useLanguage()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const [detail, setDetail] = useState<CouponDetail | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setStatus('loading')

    couponService
      .getCouponDetail(id, controller.signal)
      .then((data) => {
        setDetail(data)
        setStatus('success')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        setStatus('error')
        const msg = err instanceof ApiError ? err.message : 'Failed to load coupon'
        toast.error(msg)
      })

    return () => controller.abort()
  }, [id, toast])

  if (status === 'loading') {
    return (
      <>
        <Header title={t.couponDetail} />
        <PageContainer>
          <div className="coupon-detail-skeleton" aria-busy="true">
            <Skeleton width="40%" height="1.5rem" />
            <Skeleton width="60%" height="1rem" />
            <Skeleton width="100%" height="6rem" />
          </div>
        </PageContainer>
      </>
    )
  }

  if (status === 'error' || !detail) {
    return (
      <>
        <Header title={t.couponDetail} />
        <PageContainer>
          <ErrorState
            title={t.couldntLoadCoupon}
            message={t.couponMayNotExist}
            onRetry={() => navigate(0)}
          />
        </PageContainer>
      </>
    )
  }

  const { coupon, redemptions, stats } = detail
  const statusColor = STATUS_COLORS[coupon.status]

  return (
    <>
      <Header
        title={coupon.code}
        actions={
          <button
            className="coupon-back-btn"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
        }
      />

      <PageContainer>
        {/* Status + Discount */}
        <section className="coupon-detail-hero fade-up">
          <div className="coupon-detail-code-row">
            <Tag size={20} aria-hidden="true" />
            <h2 className="coupon-detail-code">{coupon.code}</h2>
            <span
              className="coupon-card-status"
              style={{ '--status-color': statusColor } as React.CSSProperties}
            >
              {STATUS_LABELS[coupon.status]}
            </span>
          </div>
          <p className="coupon-detail-discount">
            {formatDiscount(coupon.discountType, coupon.discountValue)}
            {' '}
            <span className="coupon-detail-type">
              ({DISCOUNT_TYPE_LABELS[coupon.discountType]} &middot; {APPLIES_TO_LABELS[coupon.appliesTo]})
            </span>
          </p>
          {coupon.description && (
            <p className="coupon-detail-desc">{coupon.description}</p>
          )}
        </section>

        {/* Stats */}
        <section className="coupon-detail-stats">
          <div className="coupon-stat">
            <span className="coupon-stat-value">{stats.totalRedeemed}</span>
            <span className="coupon-stat-label">{t.redeemed}</span>
          </div>
          <div className="coupon-stat">
            <span className="coupon-stat-value">{paiseToRupees(stats.totalDiscountGiven)}</span>
            <span className="coupon-stat-label">{t.totalDiscount}</span>
          </div>
          <div className="coupon-stat">
            <span className="coupon-stat-value">{formatUsage(coupon.usageCount, coupon.maxUses)}</span>
            <span className="coupon-stat-label">{t.usage}</span>
          </div>
        </section>

        {/* Details */}
        <section className="coupon-detail-info">
          <h3 className="coupon-detail-section-title py-0">{t.couponDetail}</h3>
          <dl className="coupon-detail-dl">
            <dt>{t.validFrom}</dt>
            <dd>{formatCouponDateTime(coupon.validFrom)}</dd>
            <dt>{t.validUntilCoupon}</dt>
            <dd>{coupon.validUntil ? formatCouponDateTime(coupon.validUntil) : t.noExpiry}</dd>
            <dt>{t.maxPerUser}</dt>
            <dd>{coupon.maxUsesPerUser}</dd>
            {coupon.razorpayOfferId && (
              <>
                <dt>{t.razorpayOffer}</dt>
                <dd>{coupon.razorpayOfferId}</dd>
              </>
            )}
            <dt>{t.created}</dt>
            <dd>{formatCouponDateTime(coupon.createdAt)}</dd>
          </dl>
        </section>

        {/* Redemptions */}
        <section className="coupon-detail-redemptions">
          <h3 className="coupon-detail-section-title py-0">
            Redemptions ({redemptions.length})
          </h3>
          {redemptions.length === 0 ? (
            <p className="coupon-detail-empty">{t.noRedemptionsYet}</p>
          ) : (
            <div className="coupon-redemption-list">
              {redemptions.map((r) => (
                <div key={r.id} className="coupon-redemption-item">
                  <span className="coupon-redemption-user">
                    {r.user.name ?? r.user.phone}
                  </span>
                  <span className="coupon-redemption-amount">
                    {paiseToRupees(r.discountApplied)}
                  </span>
                  <span className="coupon-redemption-date">
                    {formatCouponDate(r.redeemedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </PageContainer>
    </>
  )
}
