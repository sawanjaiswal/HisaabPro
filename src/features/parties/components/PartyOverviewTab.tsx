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
import { useLanguage } from '@/hooks/useLanguage'
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
    <span className="party-info-icon" aria-hidden="true">{icon}</span>
    <div>
      <span className="money-label">{label}</span>
      <span className="party-info-value">{value || '—'}</span>
    </div>
  </div>
)

export const PartyOverviewTab: React.FC<PartyOverviewTabProps> = ({ party }) => {
  const { t } = useLanguage()
  const hasContactInfo = party.phone || party.email || party.companyName
  const hasBusinessInfo = party.gstin || party.pan
  const creditLimitLabel = party.creditLimitMode === 'WARN' ? t.warn : t.blockLabel

  return (
    <div className="party-info-card">
      {hasContactInfo && (
        <div className="card" aria-label={t.contactInfo}>
          <h3 className="section-title py-0 section-title--mb-3">{t.contact}</h3>
          {party.phone && (
            <InfoRow icon={<Phone size={18} />} label={t.phone} value={party.phone} />
          )}
          {party.email && (
            <InfoRow icon={<Mail size={18} />} label={t.email} value={party.email} />
          )}
          {party.companyName && (
            <InfoRow icon={<Building2 size={18} />} label={t.company} value={party.companyName} />
          )}
        </div>
      )}

      {hasBusinessInfo && (
        <div className="card" aria-label={t.businessInfoLabel}>
          <h3 className="section-title py-0 section-title--mb-3">{t.business2}</h3>
          {party.gstin && (
            <div>
              <InfoRow icon={<FileText size={18} />} label={t.gstin} value={party.gstin} />
              {party.gstinVerified && (
                <span className="gstin-verified-badge">
                  <CheckCircle size={12} aria-hidden="true" />
                  {t.verified}{party.gstinLegalName ? ` — ${party.gstinLegalName}` : ''}
                </span>
              )}
            </div>
          )}
          {party.pan && (
            <InfoRow icon={<FileText size={18} />} label="PAN" value={party.pan} />
          )}
        </div>
      )}

      <div className="card" aria-label={t.creditInfo}>
        <h3 className="section-title py-0 section-title--mb-3">{t.credit}</h3>
        <InfoRow
          icon={<CreditCard size={18} />}
          label={t.creditLimit}
          value={party.creditLimit > 0 ? formatAmount(party.creditLimit) : t.noLimit}
        />
        <InfoRow
          icon={<CreditCard size={18} />}
          label={t.creditLimitModeValue}
          value={creditLimitLabel}
        />
        {party.openingBalance && (
          <InfoRow
            icon={<FileText size={18} />}
            label={t.openingBalance}
            value={`${formatAmount(party.openingBalance.amount)} (${party.openingBalance.type === 'RECEIVABLE' ? t.receivable : t.payable})`}
          />
        )}
      </div>

      {party.notes && (
        <div className="card" aria-label={t.notesSection}>
          <h3 className="section-title py-0 section-title--mb-3">
            <span className="section-title-icon">
              <StickyNote size={18} aria-hidden="true" />
              {t.notesSection}
            </span>
          </h3>
          <p className="party-info-notes">{party.notes}</p>
        </div>
      )}
    </div>
  )
}
