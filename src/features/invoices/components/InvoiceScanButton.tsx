/** InvoiceScanButton — barcode "add-and-return" loop for the invoice items.
 *
 * Reuses the canonical scanner primitive (<BarcodeScanner>) and the barcode→
 * product hook (useBarcodeLookup). Unlike the POS scan bar — which closes the
 * camera on every hit because its real input is a keyboard-wedge field — this
 * keeps the scanner open and RE-ARMS it after each found product (bump
 * `scanKey` to remount to a scan-ready state), so the seller scans item after
 * item without reopening. Close ("Done") ends the loop. Needs a real camera /
 * wedge, so it's verified by construction + tsc/enforce, not in this env.
 */

import { useState, useCallback, useEffect } from 'react'
import { ScanLine } from 'lucide-react'
import { BarcodeScanner } from '@/components/ui/BarcodeScanner'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { ProductPick } from '../invoice.types'
import { useBarcodeLookup } from '@/features/pos/useBarcodeLookup'
import './invoice-scan-button.css'

interface InvoiceScanButtonProps {
  /** Adds the scanned product as a line item (same signature as item-search). */
  onAdd: (pick: ProductPick) => void
}

export function InvoiceScanButton({ onAdd }: InvoiceScanButtonProps) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [scanKey, setScanKey] = useState(0)

  // onFound adds the line, then re-arms the scanner for the next code.
  const { lookup } = useBarcodeLookup((p) => {
    onAdd({
      productId: p.id,
      name: p.name,
      salePrice: p.salePrice,
      taxCategoryId: p.taxCategory?.id ?? null,
    })
    setScanKey((k) => k + 1)
  })

  const handleScan = useCallback((code: string) => lookup(code), [lookup])
  const handleOpen = useCallback(() => { setScanKey((k) => k + 1); setOpen(true) }, [])
  const handleClose = useCallback(() => setOpen(false), [])

  // F2 opens the scan loop (desktop barcode-gun / power-user chord).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') { e.preventDefault(); handleOpen() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleOpen])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="invoice-scan-btn"
        onClick={handleOpen}
        aria-label={t.scanToAdd}
      >
        <ScanLine size={16} aria-hidden="true" />
        {t.scanToAdd}
      </Button>
      {open && <BarcodeScanner key={scanKey} onScan={handleScan} onClose={handleClose} />}
    </>
  )
}
