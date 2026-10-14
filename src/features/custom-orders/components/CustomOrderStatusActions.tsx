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
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((status) => (
          <Button
            key={status}
            type="button"
            variant={status === 'CANCELLED' ? 'destructive' : 'primary'}
            size="sm"
            onClick={() => handleTransition(status)}
            disabled={isPending}
            className="min-h-[44px]"
          >
            {STATUS_BUTTON_LABELS[status]}
          </Button>
        ))}
      </div>

      {showCancelPrompt && (
        <div className="flex flex-col gap-2 p-3 bg-red-50 rounded-lg">
          <label className="text-sm font-medium text-red-700">
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCancelConfirm}
              disabled={!cancelReason.trim() || isPending}
              className="min-h-[44px]"
            >
              {t.coConfirmCancel}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { setShowCancelPrompt(false); setCancelReason('') }}
              className="min-h-[44px]"
            >
              {t.back}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
