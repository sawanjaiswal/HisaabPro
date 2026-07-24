/** CustomOrderStatusActions — buttons mapping current → allowed transitions */

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { getNextStatuses } from '../custom-orders.utils'
import { useTransitionCustomOrder } from '../hooks/useTransitionCustomOrder'
import type { CustomOrderStatus } from '../custom-orders.types'
import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderStatusActionsProps {
  orderId: string
  orderTitle: string
  currentStatus: CustomOrderStatus
}

export function CustomOrderStatusActions({ orderId, orderTitle, currentStatus }: CustomOrderStatusActionsProps) {
  const { t } = useLanguage()
  const STATUS_BUTTON_LABELS: Record<CustomOrderStatus, string> = {
    RECEIVED:      t.coBtnMarkReceived,
    IN_PRODUCTION: t.coBtnStartProduction,
    READY:         t.coBtnMarkReady,
    DELIVERED:     t.coBtnMarkDelivered,
    INVOICED:      t.coBtnMarkInvoiced,
    CANCELLED:     t.coBtnCancelOrder,
  }
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const { mutate, isPending } = useTransitionCustomOrder()

  const nextStatuses = getNextStatuses(currentStatus)
  if (nextStatuses.length === 0) return null

  const handleTransition = (to: CustomOrderStatus) => {
    if (to === 'INVOICED') return // only via convert-to-invoice endpoint
    if (to === 'CANCELLED') {
      setShowCancelPrompt(true)
      return
    }
    mutate({ id: orderId, data: { toStatus: to }, title: orderTitle })
  }

  const handleCancelConfirm = () => {
    if (!cancelReason.trim()) return
    mutate({
      id: orderId,
      data: { toStatus: 'CANCELLED', reason: cancelReason },
      title: orderTitle,
    })
    setShowCancelPrompt(false)
    setCancelReason('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
        {nextStatuses.map((status) => (
          <Button variant="none"
            key={status}
            type="button"
            className={status === 'CANCELLED' ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'}
            onClick={() => handleTransition(status)}
            disabled={isPending}
            style={{ minHeight: 44 }}
          >
            {STATUS_BUTTON_LABELS[status]}
          </Button>
        ))}
      </div>

      {showCancelPrompt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', background: 'var(--color-error-50)', borderRadius: 8 }}>
          <label style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--color-error-700)' }}>
            {t.coCancelReasonLabel} *
          </label>
          <Input
            type="text"
            className="input"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder={t.coCancelReasonPlaceholder}
            maxLength={500}
            aria-label={t.coCancelReasonAria}
          />
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="none"
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim() || isPending}
              style={{ minHeight: 44 }}
            >
              {t.coConfirmCancel}
            </Button>
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => { setShowCancelPrompt(false); setCancelReason('') }}
              style={{ minHeight: 44 }}
            >
              {t.back}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
