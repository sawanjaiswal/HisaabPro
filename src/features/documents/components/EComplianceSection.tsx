/** EComplianceSection — container for e-invoice + e-way bill cards
 *
 * Shows EInvoiceCard and/or EWayBillCard based on document type and amount.
 * Only renders for SALE_INVOICE and PURCHASE_INVOICE documents.
 * E-way bill card renders only when invoice total exceeds EWAYBILL_THRESHOLD_PAISE.
 *
 * Export this component and mount it in the document detail view.
 * Do NOT modify the document detail page from this file.
 */

import React from 'react'
import { useECompliance } from '../hooks/useECompliance'
import { EInvoiceCard } from './EInvoiceCard'
import { EWayBillCard } from './EWayBillCard'
import type { EComplianceDocumentType } from '../ecompliance.types'
import { EWAYBILL_THRESHOLD_PAISE } from '../ecompliance.types'
import '../ecompliance.css'

interface EComplianceSectionProps {
  documentId: string
  /** Used by parent to gate rendering — only pass SALE_INVOICE or PURCHASE_INVOICE */
  documentType: EComplianceDocumentType
  /** Invoice total in paise */
  totalAmountPaise: number
}

export const EComplianceSection: React.FC<EComplianceSectionProps> = ({
  documentId,
  documentType: _documentType, // guards call-site — only SALE/PURCHASE_INVOICE allowed
  totalAmountPaise,
}) => {
  const {
    fetchState,
    fetchError,
    eInvoice,
    eWayBill,
    generatingInvoice,
    cancellingInvoice,
    generatingEwb,
    cancellingEwb,
    updatingPartB,
    generateInvoice,
    cancelInvoice,
    generateEwb,
    cancelEwb,
    updatePartB,
    refresh,
  } = useECompliance(documentId)

  const showEWayBill = totalAmountPaise >= EWAYBILL_THRESHOLD_PAISE

  if (fetchState === 'loading') {
    return (
      <div className="ecompliance-section" aria-busy="true">
        <p className="ecompliance-section-title">GST Compliance</p>
        <div className="compliance-card" aria-label="Loading compliance status">
          <div style={{ height: 80, background: 'var(--color-gray-100)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      </div>
    )
  }

  if (fetchState === 'error') {
    return (
      <div className="ecompliance-section">
        <p className="ecompliance-section-title">GST Compliance</p>
        <div className="compliance-card">
          <p className="compliance-inline-error" role="alert">
            {fetchError ?? 'Failed to load compliance status.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-md"
            onClick={refresh}
            aria-label="Retry loading compliance status"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="ecompliance-section">
      <p className="ecompliance-section-title">GST Compliance</p>

      <EInvoiceCard
        status={eInvoice}
        generating={generatingInvoice}
        cancelling={cancellingInvoice}
        onGenerate={generateInvoice}
        onCancel={cancelInvoice}
      />

      {showEWayBill && (
        <EWayBillCard
          status={eWayBill}
          generating={generatingEwb}
          cancelling={cancellingEwb}
          updatingPartB={updatingPartB}
          onGenerate={generateEwb}
          onCancel={cancelEwb}
          onUpdatePartB={updatePartB}
        />
      )}
    </div>
  )
}
