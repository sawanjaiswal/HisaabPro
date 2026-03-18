/** Party Detail — Overview tab: contact, business, credit, notes */

import React from 'react'
import '../party-detail-header.css'
import {
  Phone,
  Mail,
  Building2,
  FileText,
  CreditCard,
  StickyNote,
  CheckCircle,
} from 'lucide-react'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'

interface PartyOverviewTabProps {
  party: PartyDetail
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string | undefined | null
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => (
  <div className="party-info-row">
    <span style={{ color: 'var(--color-gray-400)', flexShrink: 0 }} aria-hidden="true">
      {icon}
    </span>
    <div>
      <span className="money-label">{label}</span>
      <span style={{ display: 'block', fontWeight: 500, color: 'var(--color-gray-800)' }}>
        {value || '—'}
      </span>
    </div>
  </div>
)

export const PartyOverviewTab: React.FC<PartyOverviewTabProps> = ({ party }) => {
  const hasContactInfo = party.phone || party.email || party.companyName
  const hasBusinessInfo = party.gstin || party.pan
  const creditLimitLabel = party.creditLimitMode === 'WARN' ? 'Warn' : 'Block'

  return (
    <div className="party-info-card">
      {hasContactInfo && (
        <div className="card" aria-label="Contact information">
          <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>Contact</h3>
          {party.phone && (
            <InfoRow
              icon={<Phone size={18} />}
              label="Phone"
              value={party.phone}
            />
          )}
          {party.email && (
            <InfoRow
              icon={<Mail size={18} />}
              label="Email"
              value={party.email}
            />
          )}
          {party.companyName && (
            <InfoRow
              icon={<Building2 size={18} />}
              label="Company"
              value={party.companyName}
            />
          )}
        </div>
      )}

      {hasBusinessInfo && (
        <div className="card" aria-label="Business information">
          <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>Business</h3>
          {party.gstin && (
            <div>
              <InfoRow
                icon={<FileText size={18} />}
                label="GSTIN"
                value={party.gstin}
              />
              {party.gstinVerified && (
                <span className="gstin-verified-badge">
                  <CheckCircle size={12} aria-hidden="true" />
                  Verified{party.gstinLegalName ? ` — ${party.gstinLegalName}` : ''}
                </span>
              )}
            </div>
          )}
          {party.pan && (
            <InfoRow
              icon={<FileText size={18} />}
              label="PAN"
              value={party.pan}
            />
          )}
        </div>
      )}

      <div className="card" aria-label="Credit information">
        <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>Credit</h3>
        <InfoRow
          icon={<CreditCard size={18} />}
          label="Credit Limit"
          value={party.creditLimit > 0 ? formatAmount(party.creditLimit) : 'No limit'}
        />
        <InfoRow
          icon={<CreditCard size={18} />}
          label="Credit Limit Mode"
          value={creditLimitLabel}
        />
        {party.openingBalance && (
          <InfoRow
            icon={<FileText size={18} />}
            label="Opening Balance"
            value={`${formatAmount(party.openingBalance.amount)} (${party.openingBalance.type === 'RECEIVABLE' ? 'Receivable' : 'Payable'})`}
          />
        )}
      </div>

      {party.notes && (
        <div className="card" aria-label="Notes">
          <h3 className="section-title" style={{ marginBottom: 'var(--space-3)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <StickyNote size={18} aria-hidden="true" />
              Notes
            </span>
          </h3>
          <p style={{ color: 'var(--color-gray-600)', lineHeight: 1.6 }}>{party.notes}</p>
        </div>
      )}
    </div>
  )
}
