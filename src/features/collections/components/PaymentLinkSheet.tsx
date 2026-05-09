/**
 * PaymentLinkSheet — bottom sheet for creating and viewing payment links.
 *
 * 4 states: loading, error, success, idempotent (already-active).
 * WhatsApp share via wa.me + encodeURIComponent.
 */

import { useState, useCallback } from 'react'
import { Copy, Share2, Loader2, AlertCircle, Link } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { useCreatePaymentLink, usePaymentLinks } from '../usePaymentLink'
import { formatCurrency } from '@/lib/format'

interface PaymentLinkSheetProps {
  open: boolean
  onClose: () => void
  invoiceId: string
  invoiceNumber: string
  balanceDue: number        // paise
  partyName: string
  partyPhone?: string
  businessName: string
}

export function PaymentLinkSheet({
  open,
  onClose,
  invoiceId,
  invoiceNumber,
  balanceDue,
  partyName,
  businessName,
}: PaymentLinkSheetProps) {
  const toast = useToast()
  const [submitted, setSubmitted] = useState(false)

  const { data: existingLinks, isLoading: linksLoading } = usePaymentLinks(
    open ? invoiceId : undefined,
  )

  const activeLink = existingLinks?.find(
    (l) => l.status === 'CREATED' && new Date(l.expireBy) > new Date(),
  )

  const mutation = useCreatePaymentLink()

  const handleCreate = useCallback(() => {
    setSubmitted(true)
    const key = `pl-${invoiceId}-${Date.now()}`
    mutation.mutate(
      { invoiceId, invoiceNumber, amountPaise: balanceDue, idempotencyKey: key },
      {
        onError: (err) => {
          toast.error(err.message || 'Could not create link — check connection')
        },
      },
    )
  }, [invoiceId, invoiceNumber, balanceDue, mutation, toast])

  const currentLink = mutation.data ?? activeLink

  const handleCopy = () => {
    if (!currentLink?.shortUrl) return
    navigator.clipboard.writeText(currentLink.shortUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Could not copy — please copy manually')
    })
  }

  const handleWhatsApp = () => {
    if (!currentLink?.shortUrl) return
    const amount = formatCurrency(currentLink.amountPaise)
    const body = encodeURIComponent(
      `Hi ${partyName}, please pay ${amount} for invoice ${invoiceNumber} using this link: ${currentLink.shortUrl} — ${businessName}`,
    )
    window.open(`https://wa.me/?text=${body}`, '_blank', 'noopener,noreferrer')
  }

  const isLoading = linksLoading || mutation.isPending
  const hasError = mutation.isError && !currentLink

  const expiry = currentLink
    ? new Date(currentLink.expireBy).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : null

  return (
    <Drawer open={open} onClose={onClose} title="Payment Link" size="sm">
      <div style={{ padding: 'var(--space-4)', minHeight: 200 }}>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-6)' }}>
            <Loader2 size={32} className="spin" aria-hidden="true" />
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--fs-sm)' }}>
              {mutation.isPending ? 'Generating link…' : 'Loading…'}
            </span>
          </div>
        )}

        {/* Error */}
        {hasError && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
            <AlertCircle size={28} color="var(--color-error-500)" aria-hidden="true" />
            <p style={{ color: 'var(--color-error-500)', textAlign: 'center', fontSize: 'var(--fs-sm)' }}>
              {mutation.error?.message || 'Could not create payment link'}
            </p>
            <button className="btn btn-secondary btn-sm" onClick={handleCreate}>
              Retry
            </button>
          </div>
        )}

        {/* Success / Active link */}
        {currentLink && !isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {/* Amount */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-1)' }}>
                Amount due
              </p>
              <p style={{ fontSize: 'var(--fs-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {formatCurrency(currentLink.amountPaise)}
              </p>
            </div>

            {/* Short URL pill */}
            <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-full)', padding: 'var(--space-2) var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Link size={14} aria-hidden="true" style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentLink.shortUrl ?? 'rzp.io/…'}
              </span>
            </div>

            {/* Full URL for copy */}
            <input
              readOnly
              value={currentLink.shortUrl ?? ''}
              aria-label="Payment link URL"
              style={{ fontSize: 'var(--fs-xs)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', width: '100%', boxSizing: 'border-box' }}
            />

            {/* Expiry + status */}
            {expiry && (
              <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                {currentLink.status === 'PAID'
                  ? `Paid on ${new Date(currentLink.paidAt!).toLocaleDateString('en-IN')}`
                  : `Active — link valid until ${expiry}`}
              </p>
            )}

            {/* Actions */}
            {currentLink.status !== 'PAID' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <button className="btn btn-primary btn-md" onClick={handleCopy} style={{ width: '100%' }}>
                  <Copy size={16} aria-hidden="true" />
                  Copy Link
                </button>
                <button className="btn btn-secondary btn-md" onClick={handleWhatsApp} style={{ width: '100%' }}>
                  <Share2 size={16} aria-hidden="true" />
                  Share on WhatsApp
                </button>
              </div>
            )}
          </div>
        )}

        {/* No link yet — show create button */}
        {!currentLink && !isLoading && !hasError && !submitted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingTop: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              Generate a Razorpay payment link for {formatCurrency(balanceDue)}.
            </p>
            <button className="btn btn-primary btn-md" onClick={handleCreate} style={{ width: '100%' }}>
              Generate Payment Link
            </button>
          </div>
        )}
      </div>
    </Drawer>
  )
}
