/** POS — Receipt preview with size selector */

import { useState } from 'react'
import { PDFViewer } from '@react-pdf/renderer'
import { Receipt58mm } from './Receipt58mm'
import { Receipt80mm } from './Receipt80mm'
import { ReceiptA5 } from './ReceiptA5'
import { ReceiptShareBar } from './ReceiptShareBar'
import { useLanguage } from '@/hooks/useLanguage'
import { RECEIPT_WIDTHS } from '../../utils/pos.constants'
import type { PosSaleDTO, ReceiptWidth } from '../../types/pos.types'
import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import { Button } from '@/components/ui/Button'

interface BusinessInfo {
  name:        string
  address?:    string
  gstin?:      string
  gstEnabled?: boolean
}

interface ReceiptPreviewProps {
  sale:         PosSaleDTO
  businessInfo: BusinessInfo
  defaultWidth?: ReceiptWidth
}

export function ReceiptPreview({
  sale,
  businessInfo,
  defaultWidth = '80mm',
}: ReceiptPreviewProps) {
  const { t }  = useLanguage()
  const [width, setWidth] = useState<ReceiptWidth>(defaultWidth)

  const docProps = {
    sale,
    businessName: businessInfo.name,
    address:      businessInfo.address,
    gstin:        businessInfo.gstin,
    gstEnabled:   businessInfo.gstEnabled,
  }

  const doc: ReactElement<DocumentProps> =
    width === '58mm' ? <Receipt58mm {...docProps} /> :
    width === 'A5'   ? <ReceiptA5   {...docProps} /> :
                       <Receipt80mm {...docProps} />

  const fileName = `${sale.receiptNumber}-${width}.pdf`

  return (
    <div className="pos-receipt-preview">
      {/* Size selector */}
      <div
        className="pos-receipt-selector"
        role="radiogroup"
        aria-label={t.posReceiptSize ?? 'Receipt size'}
      >
        {RECEIPT_WIDTHS.map((rw) => (
          <Button variant="none"
            key={rw.value}
            type="button"
            role="radio"
            aria-checked={width === rw.value}
            className={`pos-receipt-tab${width === rw.value ? ' pos-receipt-tab--active' : ''}`}
            onClick={() => setWidth(rw.value)}
          >
            {rw.label}
          </Button>
        ))}
      </div>

      {/* PDF Viewer */}
      <div className="pos-receipt-viewer-wrap">
        <PDFViewer
          width="100%"
          height={500}
          showToolbar={false}
          className="pos-receipt-viewer"
        >
          {doc}
        </PDFViewer>
      </div>

      {/* Share bar */}
      <ReceiptShareBar sale={sale} pdfDocument={doc} fileName={fileName} />
    </div>
  )
}
