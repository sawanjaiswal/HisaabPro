/**
 * MandateSetupDrawer — guides the user through UPI Autopay setup.
 *
 * Online-only (server creates the Razorpay subscription + UPI intent).
 * Polls mandate status every 30s via useMandateStatus while PENDING.
 */

import { useState } from 'react'
import { Smartphone, ShieldCheck, Loader2 } from 'lucide-react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useMandateStatus } from '@/hooks/useMandateStatus'
import { api } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

interface MandateSetupDrawerProps {
  open: boolean
  onClose: () => void
}

interface MandateCreateResponse {
  mandateId: string
  upiIntent: string
}

export function MandateSetupDrawer({ open, onClose }: MandateSetupDrawerProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const qc = useQueryClient()
  const { mandate, isPending, isActive, refetch } = useMandateStatus({
    enabled: open,
  })
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!navigator.onLine) {
      toast.error(t.upgradeFailedTryAgain)
      return
    }
    setCreating(true)
    try {
      const res = await api<MandateCreateResponse>('/subscription/mandate', {
        method: 'POST',
        body: JSON.stringify({}),
        entityType: 'mandate',
        entityLabel: 'UPI Autopay',
      })
      // Optimistic api() returns {} when offline-queued; guard before deref.
      if (res?.upiIntent) {
        window.location.href = res.upiIntent
      }
      await refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.mandateFailed)
    } finally {
      setCreating(false)
    }
  }

  async function handleClose() {
    await qc.invalidateQueries({ queryKey: ['subscription'] })
    onClose()
  }

  return (
    <Drawer open={open} onClose={handleClose} title={t.mandateSetupTitle} size="md">
      <div className="px-4 py-4 space-y-4">
        <div
          className="rounded-[var(--radius-md)] p-3 flex items-start gap-3"
          style={{
            backgroundColor: 'var(--color-primary-100)',
            border: '1px solid var(--color-primary-400)',
          }}
        >
          <ShieldCheck
            className="w-5 h-5 flex-shrink-0 mt-0.5"
            style={{ color: 'var(--color-primary-500)' }}
            aria-hidden
          />
          <p
            className="text-[var(--fs-sm)]"
            style={{ color: 'var(--text-primary)' }}
          >
            {t.mandateSetupDesc}
          </p>
        </div>

        {isActive ? (
          <div
            className="rounded-[var(--radius-md)] p-3 flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-success-50)',
              border: '1px solid var(--color-success-500)',
            }}
          >
            <ShieldCheck
              className="w-5 h-5"
              style={{ color: 'var(--color-success-500)' }}
              aria-hidden
            />
            <span
              className="text-[var(--fs-sm)] font-medium"
              style={{ color: 'var(--text-primary)' }}
            >
              {t.mandateActive}
            </span>
          </div>
        ) : isPending ? (
          <div
            className="rounded-[var(--radius-md)] p-3 flex items-center gap-2"
            style={{
              backgroundColor: 'var(--color-warning-50)',
              border: '1px solid var(--color-warning-500)',
            }}
          >
            <Loader2
              className="w-5 h-5 animate-spin"
              style={{ color: 'var(--color-warning-500)' }}
              aria-hidden
            />
            <span
              className="text-[var(--fs-sm)]"
              style={{ color: 'var(--text-primary)' }}
            >
              {t.mandateCheckingStatus}
            </span>
          </div>
        ) : null}

        <Button
          variant="primary"
          className="w-full min-h-[44px]"
          loading={creating}
          disabled={creating || isActive}
          onClick={handleCreate}
        >
          <Smartphone className="w-5 h-5" />
          {t.mandateOpenUpiApp}
        </Button>

        {mandate?.mandateId && (
          <p
            className="text-[var(--fs-xs)] text-center"
            style={{ color: 'var(--text-muted)' }}
          >
            ID: {mandate.mandateId}
          </p>
        )}
      </div>
    </Drawer>
  )
}

export default MandateSetupDrawer
