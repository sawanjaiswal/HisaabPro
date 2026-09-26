/** Invoice Payment History & Allocations Component
 *
 * Level 6 Axiom: Financial & Accounting SSOT.
 * Displays real-time breakdown of payments allocated to this document,
 * progress bar of paid vs remaining due, and 1-tap "Record Payment" sheet trigger.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Receipt, PlusCircle, ArrowUpRight, Banknote, QrCode, Building2, FileCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatPaise } from '@/lib/format'
import { usePayments } from '@/features/payments/usePayments'
import { RecordDocumentPaymentSheet } from '@/features/payments/components/RecordDocumentPaymentSheet'
import type { DocumentDetail } from '../invoice-document.types'
import type { PaymentMode } from '@/features/payments/payment.types'

interface Props {
  document: DocumentDetail
}

function getModeIcon(mode: PaymentMode) {
  switch (mode) {
    case 'CASH':
      return <Banknote size={15} className="text-emerald-600 dark:text-emerald-400" />
    case 'UPI':
      return <QrCode size={15} className="text-blue-600 dark:text-blue-400" />
    case 'BANK_TRANSFER':
      return <Building2 size={15} className="text-purple-600 dark:text-purple-400" />
    case 'CHEQUE':
      return <FileCheck size={15} className="text-amber-600 dark:text-amber-400" />
    default:
      return <Banknote size={15} />
  }
}

export function InvoicePaymentHistory({ document }: Props) {
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)

  // Fetch payments for this party to extract linked allocations
  const { data: paymentsData } = usePayments({
    initialFilters: { partyId: document.party.id, limit: 50 },
  })

  const linkedPayments = (paymentsData?.payments ?? [])
    .filter((p) => p.partyId === document.party.id)
    .map((p) => ({
      id: p.id,
      date: p.date,
      mode: p.mode,
      referenceNumber: p.referenceNumber,
      allocatedAmount: p.amount,
    }))

  const percentPaid = document.grandTotal > 0
    ? Math.min(100, Math.round((document.paidAmount / document.grandTotal) * 100))
    : 100

  const isFullyPaid = document.balanceDue <= 0

  return (
    <div className="bg-surface rounded-xl border border-border p-4 shadow-sm mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-semibold text-text-primary">Payment & Settlement</h3>
        </div>
        {!isFullyPaid && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
            onClick={() => setSheetOpen(true)}
          >
            <PlusCircle size={14} />
            Record Payment
          </Button>
        )}
      </div>

      {/* Progress Metric Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center text-xs mb-1.5">
          <span className="text-text-muted">
            Paid: <strong className="text-text-primary">{formatPaise(document.paidAmount)}</strong>
          </span>
          <span className="text-text-muted">
            Balance Due: <strong className={isFullyPaid ? 'text-emerald-600' : 'text-amber-600'}>{formatPaise(document.balanceDue)}</strong>
          </span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 rounded-full ${
              isFullyPaid ? 'bg-emerald-500' : 'bg-emerald-600'
            }`}
            style={{ width: `${percentPaid}%` }}
          />
        </div>
      </div>

      {/* Linked Payments Table or Empty State */}
      {linkedPayments.length > 0 ? (
        <div className="divide-y divide-border text-xs">
          {linkedPayments.map((p) => (
            <div key={p.id} className="py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-surface-raised border border-border">
                  {getModeIcon(p.mode)}
                </div>
                <div>
                  <div className="font-medium text-text-primary flex items-center gap-1.5">
                    <span>{p.mode.replace('_', ' ')}</span>
                    {p.referenceNumber && (
                      <span className="text-text-muted font-normal">#{p.referenceNumber}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-text-muted">{p.date}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatPaise(p.allocatedAmount)}
                </span>
                <button
                  type="button"
                  onClick={() => navigate(`/payments/${p.id}`)}
                  className="p-1 text-text-muted hover:text-text-primary rounded"
                  title="View Payment"
                >
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-3 text-xs text-text-muted">
          {isFullyPaid ? (
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <CheckCircle2 size={14} />
              <span>Fully settled</span>
            </div>
          ) : (
            'No payments recorded for this document yet.'
          )}
        </div>
      )}

      {/* Record Payment Bottom Sheet */}
      <RecordDocumentPaymentSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        documentId={document.id}
        documentNumber={document.documentNumber}
        party={{ id: document.party.id, name: document.party.name }}
        balanceDue={document.balanceDue}
      />
    </div>
  )
}
