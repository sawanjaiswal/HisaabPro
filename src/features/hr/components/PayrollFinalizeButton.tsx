/** PayrollFinalizeButton — Phase 6 PR6 FE
 *
 * Confirm-then-finalize the previewed payroll. Owns the ConfirmDialog;
 * the wizard owns the navigation on success.
 *
 * Idempotency: the mutation hook mints a fresh UUID per `.mutate()` call.
 * A second tap while the first is in flight is a no-op (button is disabled
 * on `isPending`).
 *
 * Offline tolerance: `usePayrollMutations` queues the request when
 * `navigator.onLine === false`. The hook's `onSuccess` toasts with the
 * "will sync when online" suffix; we still navigate ON success of the
 * promise — but only when online (the queued return is `{}`, no run id).
 */

import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/hooks/useLanguage'
import { formatDate, formatPaise } from '@/lib/format'
import { usePayrollMutations } from '../usePayroll'
import type {
  PayrollFinalizeResult,
  PayrollPreviewResult,
  PayrollWizardState,
} from '../payroll.types'

interface PayrollFinalizeButtonProps {
  state: PayrollWizardState
  preview: PayrollPreviewResult
  /** Called once finalize promise resolves; arg may be `{}` if queued offline. */
  onFinalized: (result: PayrollFinalizeResult | Record<string, never>) => void
  disabled?: boolean
}

export function PayrollFinalizeButton({
  state,
  preview,
  onFinalized,
  disabled,
}: PayrollFinalizeButtonProps) {
  const { t } = useLanguage()
  const mutations = usePayrollMutations()
  const [confirmOpen, setConfirmOpen] = useState(false)

  function handleConfirm() {
    mutations.finalize.mutate(
      {
        fromDate: state.fromDate,
        toDate: state.toDate,
        employeeIds: state.employeeIds.length > 0 ? state.employeeIds : undefined,
        mode: state.mode,
      },
      {
        onSuccess: (result) => {
          setConfirmOpen(false)
          onFinalized(result)
        },
        onError: () => setConfirmOpen(false),
      },
    )
  }

  const description = (t.payrollFinalizeConfirmDescription as string)
    .replace('{from}', formatDate(state.fromDate))
    .replace('{to}', formatDate(state.toDate))
    .replace('{count}', String(preview.totals.count))
    .replace('{net}', formatPaise(preview.totals.netPaise))

  return (
    <>
      <Button
        variant="primary"
        size="lg"
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || mutations.finalize.isPending || preview.lines.length === 0}
        loading={mutations.finalize.isPending}
        className="w-full"
      >
        <CheckCircle2 size={18} aria-hidden="true" className="inline-block mr-1" />
        {t.payrollFinalizeCta as string}
      </Button>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => { if (!mutations.finalize.isPending) setConfirmOpen(false) }}
        onConfirm={handleConfirm}
        title={t.payrollFinalizeConfirmTitle as string}
        description={description}
        confirmLabel={t.payrollFinalizeCta as string}
        cancelLabel={t.cancel as string}
        isDanger={false}
        isLoading={mutations.finalize.isPending}
      />
    </>
  )
}
