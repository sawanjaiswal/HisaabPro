/** Invoice list — search + document type pill filter bar + status filter */

import React from 'react'
import { Search } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { DocumentType, DocumentStatus } from '../invoice.types'
import { DOCUMENT_TYPE_LABELS, DOCUMENT_STATUS_LABELS } from '../invoice.constants'

interface InvoiceFilterBarProps {
  search: string
  onSearchChange: (term: string) => void
  activeType: DocumentType | 'ALL'
  onTypeChange: (type: DocumentType | 'ALL') => void
  activeStatus: DocumentStatus | 'ALL'
  onStatusChange: (status: DocumentStatus | 'ALL') => void
}

const DOCUMENT_TYPES: DocumentType[] = [
  'SALE_INVOICE',
  'PURCHASE_INVOICE',
  'ESTIMATE',
  'PROFORMA',
  'SALE_ORDER',
  'PURCHASE_ORDER',
  'DELIVERY_CHALLAN',
]

/** Only the statuses meaningful on a live list */
const STATUS_VALUES: Array<{ value: DocumentStatus | 'ALL'; labelKey?: 'all' }> = [
  { value: 'ALL', labelKey: 'all' },
  { value: 'SAVED' },
  { value: 'SHARED' },
  { value: 'DRAFT' },
  { value: 'CONVERTED' },
]

export const InvoiceFilterBar: React.FC<InvoiceFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  activeStatus,
  onStatusChange,
}) => {
  const { t } = useLanguage()
  return (
    <div className="invoice-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={t.searchByPartyOrNumber}
          aria-label={t.searchInvoices}
        />
      </div>

      <div
        className="pill-tabs"
        role="group"
        aria-label={t.filterByDocType}
      >
        <button
          className={`pill-tab${activeType === 'ALL' ? ' active-tint' : ''}`}
          onClick={() => onTypeChange('ALL')}
          aria-pressed={activeType === 'ALL'}
        >
          {t.all}
        </button>
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type}
            className={`pill-tab${activeType === type ? ' active-tint' : ''}`}
            onClick={() => onTypeChange(type)}
            aria-pressed={activeType === type}
          >
            {DOCUMENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        className="pill-tabs"
        role="group"
        aria-label={t.filterByStatus}
      >
        {STATUS_VALUES.map(({ value, labelKey }) => (
          <button
            key={value}
            className={`pill-tab${activeStatus === value ? ' active' : ''}`}
            onClick={() => onStatusChange(value)}
            aria-pressed={activeStatus === value}
          >
            {labelKey === 'all' ? t.all : DOCUMENT_STATUS_LABELS[value as DocumentStatus]}
          </button>
        ))}
      </div>
    </div>
  )
}
