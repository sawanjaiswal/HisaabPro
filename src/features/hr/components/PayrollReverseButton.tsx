/** PayrollReverseButton — Phase 6 PR6 FE
 *
 * Destructive action on PayrollRunDetailPage. Triggers a ConfirmDialog
 * with the period in the description so the user can't mistakenly reverse
 * the wrong run.
 *
 * BE returns 409 PAYROLL_ALREADY_REVERSED OR PAYMENT_ALREADY_REVERSED —
 * `usePayrollMutations().reverse` normalises both to a single toast. We
 * just call `.mutate()` here.
 *
 * Idempotency: the mutation hook mints a fresh UUID per attempt. A retry
 * (from offline queue replay or user double-tap) sends the SAME key.
 */

import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate } from '@/lib/format'
import { usePayrollMutations } from '../usePayroll'

interface PayrollReverseButtonProps {
  payrollRunId: string
  fromDate: string
  toDate: string
  disabled?: boolean
  onReversed?: () => void
}

export function PayrollReverseButton({
  payrollRunId,
  fromDate,
  toDate,
  disabled,
  onReversed,
}: PayrollReverseButtonProps) {
  const { t } = useLanguage()
  const mutations = usePayrollMutations()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    mutations.reverse.mutate(payrollRunId, {
      onSuccess: () => {
        setConfirmOpen(false)
        onReversed?.()
      },
      onError: () => {
        // Toast already shown by the hook; close the dialog so the user
        // can read the toast without it being obscured.
        setConfirmOpen(false)
      },
    })
  }

  const description = (t.payrollReverseConfirmDescription as string)
    .replace('{from}', formatDate(fromDate))
    .replace('{to}', formatDate(toDate))

  return (
    <>
      <Button
        variant="destructive"
        size="md"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || mutations.reverse.isPending}
        loading={mutations.reverse.isPending}
        className="flex-1"
      >
        <Undo2 size={18} aria-hidden="true" className="inline-block mr-1" />
        {t.payrollReverseCta as string}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { if (!mutations.reverse.isPending) setConfirmOpen(false) }}
        onConfirm={handleConfirm}
        title={t.payrollReverseConfirmTitle as string}
        description={description}
        confirmLabel={t.payrollReverseCta as string}
        cancelLabel={t.cancel as string}
        isDanger
        isLoading={mutations.reverse.isPending}
      />
    </>
  )
}
