/** CustomOrderDetailPage — /orders/:id — header, status pill, actions, items, advances, convert CTA */

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

function DetailSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', padding: 'var(--space-4)' }} aria-busy="true" aria-label="Loading order details">
      {[180, 120, 80, 60, 250].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 4 ? 120 : 44, borderRadius: 8, width: `${w}px`, maxWidth: '100%' }} aria-hidden="true" />
      ))}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      <h2 style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{title}</h2>
      {children}
    </section>
  )
}

const isFinal = (status: string) => status === 'INVOICED' || status === 'CANCELLED'

export default function CustomOrderDetailPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: order, status, refetch } = useCustomOrder(id)
  const [showAdvanceModal, setShowAdvanceModal] = useState(false)
  const isOnline = navigator.onLine

  if (status === 'pending') return <AppShell><Header title="Order Details" /><DetailSkeleton /></AppShell>

  if (status === 'error' || !order) {
    return (
      <AppShell>
        <Header title="Order Details" />
        <PageContainer>
          <ErrorState title="Could not load order" message="Check your connection and try again" onRetry={refetch} />
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
              aria-label="Edit order"
              style={{ minHeight: 44 }}
            >
              <Pencil size={16} aria-hidden="true" />
            </Button>
          ) : undefined
        }
      />

      <PageContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Header card */}
          <div style={{ padding: 'var(--space-4)', background: 'var(--color-surface)', borderRadius: 12, boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
              <h1 style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: 'var(--color-text)', margin: 0, lineHeight: 1.3 }}>{order.title}</h1>
              <CustomOrderStatusPill status={order.status} size="md" />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
                <User size={14} aria-hidden="true" />
                <span>{order.partyName}</span>
              </div>
              {delivery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
                  <Calendar size={14} aria-hidden="true" />
                  <span>Delivery: {delivery}{order.deliverySlot ? ` · ${order.deliverySlot}` : ''}</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', fontWeight: 700, fontSize: 'var(--fs-xl)', color: 'var(--color-text)' }}>
                <IndianRupee size={18} aria-hidden="true" />
                {formatPaise(order.totalPaise)}
              </div>
              {order.balancePaise > 0 && (
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--color-warning-700)', background: 'var(--color-warning-50)', borderRadius: 6, padding: '3px 8px' }}>
                  Bal ₹{formatPaise(order.balancePaise)}
                </span>
              )}
            </div>

            {order.notes && (
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                {order.notes}
              </p>
            )}
          </div>

          {/* Status actions */}
          {!isFinal(order.status) && (
            <Section title="Actions">
              <CustomOrderStatusActions orderId={id} orderTitle={order.title} currentStatus={order.status} />
            </Section>
          )}

          {/* Convert to invoice CTA */}
          {showConvert && (
            <Section title="Invoice">
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', margin: 0 }}>
                Order is ready. Create an invoice to bill the customer.
              </p>
              <CustomOrderConvertButton orderId={id} orderTitle={order.title} isOnline={isOnline} />
            </Section>
          )}

          {/* Already invoiced */}
          {order.invoiceId && (
            <Section title="Invoice">
              <Button
                type="button"
                variant="ghost" size="sm"
                onClick={() => navigate(`/invoices/${order.invoiceId}`)}
                style={{ alignSelf: 'flex-start', minHeight: 44 }}
              >
                View Invoice
              </Button>
            </Section>
          )}

          {/* Line items */}
          <Section title="Items">
            <CustomOrderItemsList items={order.items} />
          </Section>

          {/* Totals */}
          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
            {order.discountPaise > 0 && (
              <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-error-600)' }}>
                <span>Discount</span>
                <span>-₹{formatPaise(order.discountPaise)}</span>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-4)', fontWeight: 700, fontSize: 'var(--fs-md)', color: 'var(--color-text)' }}>
              <span>Total</span>
              <span>₹{formatPaise(order.totalPaise)}</span>
            </div>
          </div>

          {/* Advances */}
          <Section title="Advances">
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
                style={{ alignSelf: 'flex-start', minHeight: 44, display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}
              >
                <Plus size={15} aria-hidden="true" />
                Record Advance
              </Button>
            )}
          </Section>

          {/* Cancel info */}
          {order.status === 'CANCELLED' && order.cancelReason && (
            <div style={{ padding: 'var(--space-3)', background: 'var(--color-error-50)', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--color-error-700)' }}>
                <strong>Cancelled:</strong> {order.cancelReason}
              </p>
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
