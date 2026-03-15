/** Invoice list — hero summary card (Total / Received / Due) */

import React from 'react'
import { formatInvoiceAmount } from '../invoice.utils'
import type { DocumentListResponse } from '../invoice.types'
import './InvoiceSummaryBar.css'

interface InvoiceSummaryBarProps {
  summary: DocumentListResponse['summary']
}

export const InvoiceSummaryBar: React.FC<InvoiceSummaryBarProps> = ({ summary }) => {
  const { totalAmount, totalPaid, totalDue } = summary

  return (
    <div className="card-primary invoice-summary-bar-card" aria-label="Invoice summary">
      <p className="invoice-summary-bar-heading">Summary</p>
      <div className="invoice-summary-bar-grid">
        <div className="invoice-summary-bar-col">
          <span className="invoice-summary-bar-label">Total Amount</span>
          <span className="invoice-summary-bar-amount">
            {formatInvoiceAmount(totalAmount)}
          </span>
        </div>
        <div className="invoice-summary-bar-col">
          <span className="invoice-summary-bar-label">Received</span>
          <span className="invoice-summary-bar-amount invoice-summary-bar-amount--received">
            {formatInvoiceAmount(totalPaid)}
          </span>
        </div>
        <div className="invoice-summary-bar-col">
          <span className="invoice-summary-bar-label">Due</span>
          <span
            className={`invoice-summary-bar-amount${totalDue > 0 ? ' invoice-summary-bar-amount--due' : ''}`}
            aria-label={totalDue > 0 ? `Due amount: ${formatInvoiceAmount(totalDue)}` : `No amount due`}
          >
            {formatInvoiceAmount(totalDue)}
          </span>
        </div>
      </div>
    </div>
  )
}
