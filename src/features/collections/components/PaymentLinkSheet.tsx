/**
 * PaymentLinkSheet — bottom sheet for creating and viewing payment links.
 *
 * 4 states: loading, error, success, idempotent (already-active).
 * WhatsApp share via wa.me + encodeURIComponent.
 */

import { Text } from '@/components/ui/Text'
import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Copy, Share2, Loader2, AlertCircle, Link } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { useToast } from '@/hooks/useToast'
import { useCreatePaymentLink, usePaymentLinks } from '../usePaymentLink'
import { formatPaise } from '@/lib/format'
import { Input } from '@/components/ui/Input'

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
    const amount = formatPaise(currentLink.amountPaise)
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
      <div className="p-4 min-h-[200px]">

        {/* Loading */}
        {isLoading && (
          <div className="flex flex-col items-center gap-3 pt-6">
            <Loader2 size={32} className="spin" aria-hidden="true" />
            <span className="text-sm text-[var(--text-secondary)]">
              {mutation.isPending ? 'Generating link…' : 'Loading…'}
            </span>
          </div>
        )}

        {/* Error */}
        {hasError && !isLoading && (
          <div className="flex flex-col items-center gap-3 pt-4">
            <AlertCircle size={28} className="text-[var(--color-error-500)]" aria-hidden="true" />
            <Text className="text-[var(--color-error-500)] text-center text-sm">
              {mutation.error?.message || 'Could not create payment link'}
            </Text>
            <Button variant="secondary" size="sm" onClick={handleCreate}>
              Retry
            </Button>
          </div>
        )}

        {/* Success / Active link */}
        {currentLink && !isLoading && (
          <div className="flex flex-col gap-4">
            {/* Amount */}
            <div className="text-center">
              <Text className="text-xs text-[var(--color-text-secondary)] mb-1">
                Amount due
              </Text>
              <Text className="text-2xl font-bold text-[var(--color-text-primary)]">
                {formatPaise(currentLink.amountPaise)}
              </Text>
            </div>

            {/* Short URL pill */}
            <div className="bg-[var(--color-surface-2)] rounded-full py-2 px-3 flex items-center gap-2">
              <Link size={14} aria-hidden="true" className="text-[var(--color-text-secondary)] flex-shrink-0" />
              <span className="text-xs text-[var(--color-text-secondary)] truncate">
                {currentLink.shortUrl ?? 'rzp.io/…'}
              </span>
            </div>

            {/* Full URL for copy */}
            <Input
              readOnly
              value={currentLink.shortUrl ?? ''}
              aria-label="Payment link URL"
              className="text-xs p-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] w-full"
            />

            {/* Expiry + status */}
            {expiry && (
              <Text className="text-xs text-[var(--color-text-secondary)] text-center">
                {currentLink.status === 'PAID'
                  ? `Paid on ${new Date(currentLink.paidAt!).toLocaleDateString('en-IN')}`
                  : `Active — link valid until ${expiry}`}
              </Text>
            )}

            {/* Actions */}
            {currentLink.status !== 'PAID' && (
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="md" onClick={handleCopy} className="w-full">
                  <Copy size={16} aria-hidden="true" />
                  Copy Link
                </Button>
                <Button variant="secondary" size="md" onClick={handleWhatsApp} className="w-full">
                  <Share2 size={16} aria-hidden="true" />
                  Share on WhatsApp
                </Button>
              </div>
            )}
          </div>
        )}

        {/* No link yet — show create button */}
        {!currentLink && !isLoading && !hasError && !submitted && (
          <div className="flex flex-col gap-3 pt-2">
            <Text className="text-sm text-[var(--color-text-secondary)] text-center">
              Generate a Razorpay payment link for {formatPaise(balanceDue)}.
            </Text>
            <Button variant="primary" size="md" onClick={handleCreate} className="w-full">
              Generate Payment Link
            </Button>
          </div>
        )}
      </div>
    </Drawer>
  )
}
