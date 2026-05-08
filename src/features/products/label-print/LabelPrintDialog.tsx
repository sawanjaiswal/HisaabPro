/** Label Print Dialog — 4 UI states: loading | error | preview | empty
 *
 * Bottom sheet on 375px, centred modal on wider viewports.
 * Format/template/qty state extracted to LabelPrintOptions.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, Download, Printer, RefreshCw } from 'lucide-react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { useToast } from '@/hooks/useToast'
import { fetchLabelData } from './label-print.service'
import { LabelSheetPreview } from './LabelSheetPreview'
import { LabelPDF } from './LabelPDF'
import { LabelPrintOptions } from './LabelPrintOptions'
import { SHEETS, expandToCells, pageCount } from './label-layout'
import './label-print.css'
import type { LabelItem, LabelTemplate, SheetFormat } from './label-print.types'

interface LabelPrintDialogProps {
  productIds: string[]
  onClose: () => void
}

type DialogState = 'loading' | 'error' | 'preview' | 'empty'

export function LabelPrintDialog({ productIds, onClose }: LabelPrintDialogProps) {
  const toast = useToast()

  const [dialogState, setDialogState] = useState<DialogState>(
    productIds.length === 0 ? 'empty' : 'loading',
  )
  const [items, setItems]           = useState<LabelItem[]>([])
  const [sheetFormat, setSheet]     = useState<SheetFormat>('A4_3x8')
  const [templateOvr, setTemplate]  = useState<LabelTemplate | 'per-product'>('per-product')
  const [qtyMap, setQtyMap]         = useState<Record<string, number>>({})

  const loadLabels = useCallback(async () => {
    if (productIds.length === 0) { setDialogState('empty'); return }
    setDialogState('loading')
    try {
      const res = await fetchLabelData(productIds)
      if (!res?.labels?.length) { setDialogState('error'); return }
      setItems(res.labels)
      const init: Record<string, number> = {}
      res.labels.forEach((l) => { init[l.id] = 1 })
      setQtyMap(init)
      setDialogState('preview')
    } catch {
      setDialogState('error')
    }
  }, [productIds])

  useEffect(() => { loadLabels() }, [loadLabels])

  const updateQty = (id: string, delta: number) =>
    setQtyMap((prev) => ({ ...prev, [id]: Math.max(1, Math.min(99, (prev[id] ?? 1) + delta)) }))

  const cells  = useMemo(() => expandToCells(items, qtyMap), [items, qtyMap])
  const spec   = SHEETS[sheetFormat]
  const pages  = pageCount(cells.length, spec)

  const handlePrint = () => {
    document.body.classList.add('printing-labels')
    window.print()
    window.addEventListener('afterprint', () => {
      document.body.classList.remove('printing-labels')
    }, { once: true })
  }

  const today    = new Date().toISOString().slice(0, 10)
  const fileName = `labels-${today}.pdf`

  return (
    <div className="label-dialog-backdrop" role="dialog" aria-modal="true" aria-label="Print Labels">
      <div className="label-dialog label-print-root">
        {/* Header */}
        <div className="label-dialog-header">
          <h2 className="label-dialog-title">Print Labels</h2>
          <button type="button" className="label-dialog-close" onClick={onClose} aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* ── LOADING ─────────────────────────────────────────────────── */}
        {dialogState === 'loading' && (
          <div className="label-dialog-body" aria-live="polite">
            <p className="sr-only">Loading label data…</p>
            <div className="label-skeleton-list">
              {productIds.slice(0, 5).map((id) => (
                <div key={id} className="label-skeleton-row" aria-hidden="true" />
              ))}
            </div>
          </div>
        )}

        {/* ── ERROR ───────────────────────────────────────────────────── */}
        {dialogState === 'error' && (
          <div className="label-dialog-body label-dialog-error" role="alert">
            <p>Could not load label data.</p>
            <button type="button" className="btn btn-outline" onClick={loadLabels}>
              <RefreshCw size={16} aria-hidden="true" />
              Retry
            </button>
          </div>
        )}

        {/* ── EMPTY ───────────────────────────────────────────────────── */}
        {dialogState === 'empty' && (
          <div className="label-dialog-body label-dialog-empty">
            <p>No products selected.</p>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}

        {/* ── PREVIEW ─────────────────────────────────────────────────── */}
        {dialogState === 'preview' && (
          <>
            <div className="label-dialog-body">
              <LabelPrintOptions
                items={items}
                sheetFormat={sheetFormat}
                templateOvr={templateOvr}
                qtyMap={qtyMap}
                cellCount={cells.length}
                pageCount={pages}
                onSheetChange={setSheet}
                onTemplateChange={setTemplate}
                onQtyChange={updateQty}
              />
              <LabelSheetPreview
                items={items}
                qtyMap={qtyMap}
                sheetFormat={sheetFormat}
                templateOverride={templateOvr}
              />
            </div>

            <div className="label-dialog-footer">
              <PDFDownloadLink
                document={
                  <LabelPDF
                    items={items}
                    qtyMap={qtyMap}
                    sheetFormat={sheetFormat}
                    templateOverride={templateOvr}
                  />
                }
                fileName={fileName}
              >
                {({ loading }) => (
                  <button
                    type="button"
                    className="btn btn-outline label-footer-btn"
                    disabled={loading}
                    aria-label="Download PDF"
                    onClick={() => !loading && toast.success('Labels PDF downloaded.')}
                  >
                    <Download size={16} aria-hidden="true" />
                    {loading ? 'Preparing…' : 'Download PDF'}
                  </button>
                )}
              </PDFDownloadLink>
              <button
                type="button"
                className="btn btn-primary label-footer-btn"
                onClick={handlePrint}
                aria-label="Print"
              >
                <Printer size={16} aria-hidden="true" />
                Print
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
