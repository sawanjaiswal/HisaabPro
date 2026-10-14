/** CustomOrderDetailPage — /orders/:id — header, status pill, actions, items, advances, convert CTA */

import { Text } from '@/components/ui/Text'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useParams, useNavigate } from 'react-router-dom'
import { Pencil, Calendar, User, IndianRupee, Plus } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { Header } from '@/components/layout/Header'
import { PageContainer } from '@/components/layout/PageContainer'
import { ErrorState } from '@/components/feedback/ErrorState'
import { useCustomOrder } from '../hooks/useCustomOrder'
import { CustomOrderStatusPill } from '../components/CustomOrderStatusPill'
import { CustomOrderStatusActions } from '../components/CustomOrderStatusActions'
import { CustomOrderItemsList } from '../components/CustomOrderItemsList'
import { CustomOrderAdvancesList } from '../components/CustomOrderAdvancesList'
import { CustomOrderConvertButton } from '../components/CustomOrderConvertButton'
import { RecordAdvanceModal } from '../components/RecordAdvanceModal'
import { formatOrderNumber, formatPaise, canConvertToInvoice } from '../custom-orders.utils'
import { ORDER_ROUTES } from '../custom-orders.constants'
import { useLanguage } from '@/context/LanguageContext'
import { Heading } from '@/components/ui/Heading'

import { Card } from '@/components/ui/Card'

function DetailSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-3 p-4" aria-busy="true" aria-label={t.coLoadingOrder}>
      {[180, 120, 80, 60, 250].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 4 ? 120 : 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <Heading level={2} className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider m-0">{title}</Heading>
      {children}
    </section>
  )
}

const isFinal = (status: string) => status === 'INVOICED' || status === 'CANCELLED'

export default function CustomOrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { data: order, status, refetch } = useCustomOrder(id)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const isOnline = navigator.onLine

  if (status === 'pending') return <AppShell><Header title={t.coOrderDetails} /><DetailSkeleton /></AppShell>

  if (status === 'error' || !order) {
    return (
      <AppShell>
        <Header title={t.coOrderDetails} backTo={ORDER_ROUTES.LIST} />
        <PageContainer>
          <ErrorState
            title={t.coLoadErrorTitle}
            message={t.coConnectionRetry}
            onRetry={refetch}
            action={
              <div className="flex items-center gap-3">
                <Button variant="primary" onClick={() => refetch()}>
                  {t.retry ?? 'Try Again'}
                </Button>
                <Button variant="outline" onClick={() => navigate(ORDER_ROUTES.LIST)}>
                  {t.back ?? 'Back to Orders'}
                </Button>
              </div>
            }
          />
        </PageContainer>
      </AppShell>
    )
  }

  const delivery = order.deliveryAt
    ? new Date(order.deliveryAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const showConvert = canConvertToInvoice(order.status, order.invoiceId)

  return (
    <AppShell>
      <Header
        title={formatOrderNumber(order.orderNumber, order.id)}
        actions={
          !isFinal(order.status) ? (
            <Button
              type="button"
              variant="ghost" size="sm"
              onClick={() => navigate(ORDER_ROUTES.EDIT(id))}
              aria-label={t.coEditOrderAria}
              style={{ minHeight: 44 }}
            >
              <Pencil size={16} aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <PageContainer>
        <div className="flex flex-col gap-5">

          {/* Header card */}
          <Card className="p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <Heading level={1} className="text-lg font-bold text-[var(--color-text)] m-0 leading-snug">{order.title}</Heading>
              <CustomOrderStatusPill status={order.status} size="md" />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <User size={14} aria-hidden="true" />
                <span>{order.partyName}</span>
              </div>
              {delivery && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <Calendar size={14} aria-hidden="true" />
                  <span>{t.coDeliveryLabel}: {delivery}{order.deliverySlot ? ` · ${order.deliverySlot}` : ''}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1 font-bold text-xl text-[var(--color-text)]">
                <IndianRupee size={18} aria-hidden="true" />
                {formatPaise(order.totalPaise)}
              </div>
              {order.balancePaise > 0 && (
                <span className="text-sm font-semibold text-[var(--color-warning-700)] bg-[var(--color-warning-50)] rounded-md px-2 py-0.5">
                  {t.coBalPrefix} ₹{formatPaise(order.balancePaise)}
                </span>
              )}
            </div>

            {order.notes && (
              <Text className="text-sm text-[var(--color-text-secondary)] m-0">
                {order.notes}
              </Text>
            )}
          </Card>

          {/* Status actions */}
          {!isFinal(order.status) && (
            <Section title={t.coSecActions}>
              <CustomOrderStatusActions orderId={id} orderTitle={order.title} currentStatus={order.status} />
            </Section>
          )}

          {/* Convert to invoice CTA */}
          {showConvert && (
            <Section title={t.coSecInvoice}>
              <Text className="text-sm text-[var(--color-text-secondary)] m-0">
                {t.coReadyToInvoice}
              </Text>
              <CustomOrderConvertButton orderId={id} orderTitle={order.title} isOnline={isOnline} />
            </Section>
          )}

          {/* Already invoiced */}
          {order.invoiceId && (
            <Section title={t.coSecInvoice}>
              <Button
                type="button"
                variant="ghost" size="sm"
                onClick={() => navigate(`/invoices/${order.invoiceId}`)}
                className="self-start min-h-[44px]"
              >
                {t.coViewInvoice}
              </Button>
            </Section>
          )}

          {/* Line items */}
          <Section title={t.coSecItems}>
            <CustomOrderItemsList items={order.items} />
          </Section>

          {/* Totals */}
          <div className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-1 items-end">
            {order.discountPaise > 0 && (
              <div className="flex gap-4 text-sm text-red-600">
                <span>{t.coDiscount}</span>
                <span>-₹{formatPaise(order.discountPaise)}</span>
              </div>
            )}
            <div className="flex gap-4 font-bold text-base text-[var(--color-text)]">
              <span>{t.coTotal}</span>
              <span>₹{formatPaise(order.totalPaise)}</span>
            </div>
          </div>

          {/* Advances */}
          <Section title={t.coSecAdvances}>
            <CustomOrderAdvancesList
              advances={order.advances}
              orderId={id}
              orderTitle={order.title}
              orderStatus={order.status}
              advancePaise={order.advancePaise}
              balancePaise={order.balancePaise}
              totalPaise={order.totalPaise}
            />
            {!isFinal(order.status) && (
              <Button
                type="button"
                variant="ghost" size="sm"
                onClick={() => setShowAdvanceModal(true)}
                className="self-start min-h-[44px] flex items-center gap-1"
              >
                <Plus size={15} aria-hidden="true" />
                {t.coRecordAdvance}
              </Button>
            )}
          </Section>

          {/* Cancel info */}
          {order.status === 'CANCELLED' && order.cancelReason && (
            <div className="p-3 bg-red-50 rounded-lg">
              <Text className="m-0 text-sm text-red-700">
                <strong>{t.coCancelledPrefix}:</strong> {order.cancelReason}
              </Text>
            </div>
          )}
        </div>
      </PageContainer>

      {showAdvanceModal && (
        <RecordAdvanceModal
          orderId={id}
          orderTitle={order.title}
          onClose={() => setShowAdvanceModal(false)}
        />
      )}
    </AppShell>
  )
}
