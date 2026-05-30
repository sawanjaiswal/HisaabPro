/** VoucherShareBar — download / print actions for a payment voucher (#90/#91).
 *
 * Client-side React-PDF only (mirrors POS ReceiptShareBar). Download uses
 * <PDFDownloadLink>; print renders a blob and opens it in the OS PDF viewer.
 */

import { useState } from 'react'
import { Printer, Download, Loader2 } from 'lucide-react'
import { PDFDownloadLink, pdf } from '@react-pdf/renderer'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/context/AuthContext'
import { APP_NAME } from '@/config/app.config'
import { PAYMENT_MODE_LABELS } from '../payment-labels.constants'
import { buildVoucherData, voucherKindFor } from './voucher.utils'
import { PaymentVoucherDocument, type VoucherDocLabels } from './PaymentVoucherDocument'
import type { PaymentDetail } from '../payment-models.types'
import { Button } from '@/components/ui/Button'

const slug = (v: string) => v.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()

export function VoucherShareBar({ payment }: { payment: PaymentDetail }) {
  const { t } = useLanguage()
  const toast = useToast()
  const { activeBusiness } = useAuth()
  const [printing, setPrinting] = useState(false)

  const kind = voucherKindFor(payment.type)
  const title = kind === 'RECEIPT' ? t.receiptVoucher : t.paymentVoucher
  const businessName = activeBusiness?.name ?? APP_NAME
  const modeLabel = PAYMENT_MODE_LABELS[payment.mode]

  const data = buildVoucherData(payment, businessName, title, modeLabel)
  const labels: VoucherDocLabels = {
    receivedFrom: t.voucherReceivedFrom,
    paidTo: t.voucherPaidTo,
    amount: t.voucherAmount,
    inWords: t.voucherInWords,
    paymentMode: t.voucherPaymentMode,
    reference: t.voucherReference,
    date: t.voucherDate,
    appliedTo: t.voucherAppliedTo,
    unallocated: t.voucherUnallocated,
    notes: t.voucherNotes,
    generatedBy: `${t.voucherGeneratedBy} ${APP_NAME}`,
  }
  const doc = <PaymentVoucherDocument data={data} labels={labels} />
  const fileName = `${slug(title)}-${slug(payment.partyName)}-${payment.date}.pdf`

  const handlePrint = async () => {
    setPrinting(true)
    try {
      const blob = await pdf(doc).toBlob()
      const url = URL.createObjectURL(blob)
      const win = window.open(url, '_blank', 'noopener,noreferrer')
      if (!win) throw new Error('popup-blocked')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      toast.error(t.voucherActionFailed)
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="flex gap-3" role="group" aria-label={title}>
      <PDFDownloadLink
        document={doc}
        fileName={fileName}
        className="btn btn-outline btn-sm flex-1"
        aria-label={t.downloadVoucher}
      >
        {({ loading }) => (
          <>
            {loading
              ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              : <Download size={16} aria-hidden="true" />}
            <span>{t.downloadVoucher}</span>
          </>
        )}
      </PDFDownloadLink>

      <Button variant="none"
        type="button"
        className="btn btn-outline btn-sm flex-1"
        onClick={() => void handlePrint()}
        disabled={printing}
        aria-label={t.printVoucher}
        aria-busy={printing}
      >
        {printing
          ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          : <Printer size={16} aria-hidden="true" />}
        <span>{t.printVoucher}</span>
      </Button>
    </div>
  )
}
