import React from 'react'
import { paisaToRupees } from '../party.utils'
import './PartySummaryBar.css'

interface PartySummaryBarProps {
  summary: {
    totalReceivable: number // paise
    totalPayable: number    // paise
    netOutstanding: number  // paise
    totalParties: number
  }
}

export const PartySummaryBar: React.FC<PartySummaryBarProps> = ({ summary }) => {
  const { totalReceivable, totalPayable, netOutstanding, totalParties } = summary

  return (
    <div className="card-primary party-summary-bar" aria-label="Outstanding summary">
      <p className="party-summary-parties">{totalParties} Parties</p>
      <div className="party-summary-grid">
        <div className="party-summary-col">
          <span className="money-label party-summary-label">Receivable</span>
          <span className="money-hero party-summary-receivable">Rs {paisaToRupees(totalReceivable)}</span>
        </div>
        <div className="party-summary-col">
          <span className="money-label party-summary-label">Payable</span>
          <span className="money-hero party-summary-payable">Rs {paisaToRupees(totalPayable)}</span>
        </div>
        <div className="party-summary-col">
          <span className="money-label party-summary-label">Net</span>
          <span className="money-hero party-summary-net">
            Rs {paisaToRupees(Math.abs(netOutstanding))}
          </span>
        </div>
      </div>
    </div>
  )
}
