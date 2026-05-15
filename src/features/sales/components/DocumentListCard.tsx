/** Sales pipeline — shared list card for EST / SO / DC rows. */

import React, { useRef, useCallback } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentSummary } from '../../invoices/invoice.types'
import { formatInvoiceAmount, formatInvoiceDate } from '../../invoices/invoice-format.utils'
import {
  DOCUMENT_TYPE_CODES,
  DOCUMENT_STATUS_LABELS,
  STATUS_BADGE_VARIANTS,
} from '../../invoices/invoice.constants'
import { getStatusVariant } from '../sales.utils'

interface DocumentListCardProps {
  document: DocumentSummary
  onClick: (id: string) => void
  onLongPress?: (id: string) => void
}

const LONG_PRESS_MS = 500

// Type-specific colour accent for the code badge
const DOC_TYPE_CLASS: Record<string, string> = {
  ESTIMATE:         'doc-type-icon doc-type-icon--estimate',
  SALE_ORDER:       'doc-type-icon doc-type-icon--sale-order',
  DELIVERY_CHALLAN: 'doc-type-icon doc-type-icon--delivery-challan',
}

export const DocumentListCard: React.FC<DocumentListCardProps> = ({
  document,
  onClick,
  onLongPress,
}) => {
  const { t } = useLanguage()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLong = useRef(false)

  const typeCode    = DOCUMENT_TYPE_CODES[document.type] ?? document.type
  const statusLabel = DOCUMENT_STATUS_LABELS[document.status] ?? document.status
  const statusClass = `badge ${STATUS_BADGE_VARIANTS[document.status] ?? getStatusVariant(document.status)}`
  const iconClass   = DOC_TYPE_CLASS[document.type] ?? 'doc-type-icon'

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
    <div
      className="txn-row invoice-list-item"
      role="button"
      tabIndex={0}
      aria-label={`${t.viewDetailsFor ?? 'View'} ${statusLabel} ${document.documentNumber} – ${document.party.name}, ${formatInvoiceAmount(document.grandTotal)}`}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ cursor: 'pointer' }}
    >
      <div className={iconClass} aria-hidden="true">
        {typeCode}
      </div>

      <div className="txn-info">
        <div className="invoice-card-header">
          <span className="txn-name">{document.party.name}</span>
          <span className={statusClass} aria-label={`Status: ${statusLabel}`}>
            {statusLabel}
          </span>
        </div>
        <span className="txn-date">
          {document.documentNumber} · {formatInvoiceDate(document.documentDate)}
        </span>
      </div>

      <div className="invoice-card-right">
        <div className="txn-amount">{formatInvoiceAmount(document.grandTotal)}</div>
      </div>
    </div>
  )
}
