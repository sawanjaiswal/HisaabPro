/** Invoice list — search + document type pill filter bar + status filter */

import React from 'react'
import { Search } from 'lucide-react'
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
const FILTER_STATUSES: Array<{ value: DocumentStatus | 'ALL'; label: string }> = [
  { value: 'ALL',       label: 'All' },
  { value: 'SAVED',     label: DOCUMENT_STATUS_LABELS.SAVED },
  { value: 'SHARED',    label: DOCUMENT_STATUS_LABELS.SHARED },
  { value: 'DRAFT',     label: DOCUMENT_STATUS_LABELS.DRAFT },
  { value: 'CONVERTED', label: DOCUMENT_STATUS_LABELS.CONVERTED },
]

export const InvoiceFilterBar: React.FC<InvoiceFilterBarProps> = ({
  search,
  onSearchChange,
  activeType,
  onTypeChange,
  activeStatus,
  onStatusChange,
}) => {
  return (
    <div className="invoice-filter-bar">
      <div className="search-bar">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by party, number..."
          aria-label="Search invoices by party name or document number"
        />
      </div>

      <div
        className="invoice-type-pills"
        role="group"
        aria-label="Filter by document type"
      >
        <button
          className={`invoice-type-pill${activeType === 'ALL' ? ' invoice-type-pill--active' : ''}`}
          onClick={() => onTypeChange('ALL')}
          aria-pressed={activeType === 'ALL'}
          aria-label="Show all document types"
        >
          All
        </button>
        {DOCUMENT_TYPES.map((type) => (
          <button
            key={type}
            className={`invoice-type-pill${activeType === type ? ' invoice-type-pill--active' : ''}`}
            onClick={() => onTypeChange(type)}
            aria-pressed={activeType === type}
            aria-label={`Show ${DOCUMENT_TYPE_LABELS[type]}`}
          >
            {DOCUMENT_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div
        className="pill-tabs"
        role="group"
        aria-label="Filter by document status"
      >
        {FILTER_STATUSES.map(({ value, label }) => (
          <button
            key={value}
            className={`pill-tab${activeStatus === value ? ' active' : ''}`}
            onClick={() => onStatusChange(value)}
            aria-pressed={activeStatus === value}
            aria-label={`Show ${label} documents`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
