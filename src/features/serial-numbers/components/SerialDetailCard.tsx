import { Package, Warehouse, FileText, User, Hash } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { SerialStatusBadge } from './SerialStatusBadge'
import { formatSerialDate } from '../serial-number.utils'
import type { SerialNumberDetail } from '../serial-number.types'

interface SerialDetailCardProps {
  serial: SerialNumberDetail
}

export function SerialDetailCard({ serial }: SerialDetailCardProps) {
  const { t } = useLanguage()

  return (
    <div className="serial-detail-card">
      <div className="serial-detail-card__header">
        <h2 className="serial-detail-card__number">
          <Hash size={16} aria-hidden="true" />
          {serial.serialNumber}
        </h2>
        <SerialStatusBadge status={serial.status} />
      </div>

      <dl className="serial-detail-card__info">
        {serial.product && (
          <div className="serial-detail-card__row">
            <dt><Package size={14} aria-hidden="true" /> {t.productLabel}</dt>
            <dd>{serial.product.name}{serial.product.sku ? ` (${serial.product.sku})` : ''}</dd>
          </div>
        )}

        {serial.batch && (
          <div className="serial-detail-card__row">
            <dt><FileText size={14} aria-hidden="true" /> {t.batchLabel}</dt>
            <dd>{serial.batch.batchNumber}{serial.batch.expiryDate ? ` — ${t.expLabel} ${formatSerialDate(serial.batch.expiryDate)}` : ''}</dd>
          </div>
        )}

        {serial.godown && (
          <div className="serial-detail-card__row">
            <dt><Warehouse size={14} aria-hidden="true" /> {t.godownLabel}</dt>
            <dd>{serial.godown.name}</dd>
          </div>
        )}

        {serial.soldInDocument && (
          <div className="serial-detail-card__row">
            <dt><FileText size={14} aria-hidden="true" /> {t.invoiceLabel}</dt>
            <dd>
              {serial.soldInDocument.documentNumber} — {formatSerialDate(serial.soldInDocument.documentDate)}
            </dd>
          </div>
        )}

        {serial.soldInDocument?.party && (
          <div className="serial-detail-card__row">
            <dt><User size={14} aria-hidden="true" /> {t.soldTo}</dt>
            <dd>
              {serial.soldInDocument.party.name}
              {serial.soldInDocument.party.phone
                ? ` (***${serial.soldInDocument.party.phone.slice(-4)})`
                : ''}
            </dd>
          </div>
        )}

        {serial.notes && (
          <div className="serial-detail-card__row">
            <dt>{t.notesLabel}</dt>
            <dd className="serial-detail-card__notes">{serial.notes}</dd>
          </div>
        )}
      </dl>

      <p className="serial-detail-card__meta">
        {t.addedLabel} {formatSerialDate(serial.createdAt)}
        {serial.soldAt ? ` — ${t.sold} ${formatSerialDate(serial.soldAt)}` : ''}
      </p>
    </div>
  )
}
