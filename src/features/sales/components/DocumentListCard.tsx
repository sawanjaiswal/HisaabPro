/** Sales pipeline — list row for EST / SO / DC (mockup #45).
 *
 * Tinted doc icon square, number over party over date, and the amount with
 * its view status underneath. Long-press is kept from the previous row so
 * bulk selection on the hub still works.
 */

import React, { useRef, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentSummary } from '../../invoices/invoice.types'
import { formatInvoiceAmount, formatInvoiceDate } from '../../invoices/invoice-format.utils'
import { getViewStatus, VIEW_STATUS_TONE, type DocumentViewStatus } from '../sales-status.utils'
import '../sales-doc-list.css'

interface DocumentListCardProps {
  document: DocumentSummary
  onClick: (id: string) => void
  onLongPress?: (id: string) => void
  /** Label per view status, supplied by the page so it stays translated. */
  statusLabels: Record<DocumentViewStatus, string>
}

const LONG_PRESS_MS = 500

export const DocumentListCard: React.FC<DocumentListCardProps> = ({
  document,
  onClick,
  onLongPress,
  statusLabels,
}) => {
  const { t } = useLanguage()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLong = useRef(false)

  const viewStatus = getViewStatus(document)
  const statusLabel = statusLabels[viewStatus]

  const handlePointerDown = useCallback(() => {
    if (!onLongPress) return
    didLong.current = false
    timerRef.current = setTimeout(() => {
      didLong.current = true
      onLongPress(document.id)
    }, LONG_PRESS_MS)
  }, [onLongPress, document.id])

  const handlePointerUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    if (didLong.current) {
      didLong.current = false
      return
    }
    onClick(document.id)
  }, [onClick, document.id])

  return (
    <Button
      variant="none"
      type="button"
      className="sales-doc-row"
      aria-label={`${t.viewDetailsFor} ${document.documentNumber} – ${document.party.name}, ${formatInvoiceAmount(document.grandTotal)}, ${statusLabel}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span className={`sales-doc-row__icon sales-doc-row__icon--${viewStatus.toLowerCase()}`} aria-hidden="true">
        <FileText size={20} />
      </span>

      <span className="sales-doc-row__info">
        <span className="sales-doc-row__number">{document.documentNumber}</span>
        <span className="sales-doc-row__party">{document.party.name}</span>
        <span className="sales-doc-row__date">{formatInvoiceDate(document.documentDate)}</span>
      </span>

      <span className="sales-doc-row__right">
        <span className="sales-doc-row__amount tabular-nums">
          {formatInvoiceAmount(document.grandTotal)}
        </span>
        <span className={`sales-doc-row__status sales-doc-row__status--${VIEW_STATUS_TONE[viewStatus]}`}>
          {statusLabel}
        </span>
      </span>
    </Button>
  )
}
