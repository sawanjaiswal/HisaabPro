/** Estimate Details — identity card + amount + info rows (mockup #46).
 *
 * The mockup shows the party's city under the name; it comes from the billing
 * address, which is optional, so the line is dropped rather than padded when
 * no address was recorded.
 */

import React from 'react'
import { PartyAvatar } from '@/components/ui/PartyAvatar'
import { useLanguage } from '@/hooks/useLanguage'
import { formatInvoiceAmount, formatInvoiceDate } from '../../invoices/invoice-format.utils'
import type { DocumentDetail } from '../../invoices/invoice.types'
import { getViewStatus, VIEW_STATUS_TONE, type DocumentViewStatus } from '../sales-status.utils'
import '../estimate-detail.css'

interface EstimateDetailHeroProps {
  document: DocumentDetail
  /** Label per view status, supplied by the page so it stays translated. */
  statusLabels: Record<DocumentViewStatus, string>
  /** "Estimate amount" / "Order amount" — depends on the document type. */
  amountLabel: string
}

export const EstimateDetailHero: React.FC<EstimateDetailHeroProps> = ({
  document,
  statusLabels,
  amountLabel,
}) => {
  const { t } = useLanguage()
  const viewStatus = getViewStatus(document)
  const city = document.party.billingAddress?.city ?? null
  const itemCount = document.lineItems.length

  return (
    <div className="estimate-detail-card">
      <div className="estimate-detail-identity">
        <PartyAvatar name={document.party.name} size="md" />

        <div className="estimate-detail-identity__main">
          <div className="estimate-detail-identity__party">{document.party.name}</div>
          {city && <div className="estimate-detail-identity__city">{city}</div>}
        </div>

        <span className={`estimate-detail-status estimate-detail-status--${VIEW_STATUS_TONE[viewStatus]}`}>
          {statusLabels[viewStatus]}
        </span>
      </div>

      <div className="estimate-detail-amount">
        <span className="estimate-detail-amount__value tabular-nums">
          {formatInvoiceAmount(document.grandTotal)}
        </span>
        <span className="estimate-detail-amount__label">{amountLabel}</span>
      </div>

      <div className="estimate-detail-rows">
        <div className="estimate-detail-row">
          <span className="estimate-detail-row__label">{t.dateInfoLabel}</span>
          <span className="estimate-detail-row__value">{formatInvoiceDate(document.documentDate)}</span>
        </div>

        <div className="estimate-detail-row">
          <span className="estimate-detail-row__label">{t.validTillLabel}</span>
          <span className="estimate-detail-row__value">
            {document.dueDate ? formatInvoiceDate(document.dueDate) : '—'}
          </span>
        </div>

        <div className="estimate-detail-row">
          <span className="estimate-detail-row__label">{t.itemsLabel}</span>
          <span className="estimate-detail-row__value">
            {itemCount} {itemCount === 1 ? t.itemSingular : t.itemPlural}
          </span>
        </div>

        <div className="estimate-detail-row">
          <span className="estimate-detail-row__label">{t.createdByLabel}</span>
          <span className="estimate-detail-row__value">{document.createdBy.name}</span>
        </div>
      </div>
    </div>
  )
}
