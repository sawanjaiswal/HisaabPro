/** Party Detail — Overview tab: contact, business, credit, notes */

import { Text } from '@/components/ui/Text'
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
  Tag,
  ListChecks,
} from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartyDetail } from '../party.types'
import { formatAmount } from '../party.utils'
import { Heading } from '@/components/ui/Heading'

interface PartyOverviewTabProps {
  party: PartyDetail
}

interface InfoRowProps {
  icon: React.ReactNode
  label: string
  value: string | undefined | null
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-[var(--color-gray-100)] last:border-b-0 gap-3">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-600)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
        {icon}
      </span>
      <span className="text-xs font-medium text-[var(--text-muted)] truncate">{label}</span>
    </div>
    <span className="text-sm font-semibold text-[var(--text-primary)] text-right truncate">
      {value || '—'}
    </span>
  </div>
)

export const PartyOverviewTab: React.FC<PartyOverviewTabProps> = ({ party }) => {
  const { t } = useLanguage()
  const hasContactInfo = party.phone || party.email || party.companyName
  const hasBusinessInfo = party.gstin || party.pan
  const creditLimitLabel = party.creditLimitMode === 'WARN' ? t.warn : t.blockLabel
  const priceListName = party.priceList?.name
  const customFieldRows = (party.customFieldValues ?? [])
    .filter(cv => cv.value != null && cv.value.trim() !== '')
    .sort((a, b) => ((a.field?.sortOrder ?? 0) - (b.field?.sortOrder ?? 0)))

  return (
    <div className="space-y-4">
      {hasContactInfo && (
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.contactInfo}>
          <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
            <Phone size={15} className="text-[var(--color-primary-600)]" />
            {t.contact}
          </Heading>
          <div className="divide-y divide-[var(--color-gray-100)]">
            {party.phone && (
              <InfoRow icon={<Phone size={15} />} label={t.phone} value={party.phone} />
            )}
            {party.email && (
              <InfoRow icon={<Mail size={15} />} label={t.email} value={party.email} />
            )}
            {party.companyName && (
              <InfoRow icon={<Building2 size={15} />} label={t.company} value={party.companyName} />
            )}
          </div>
        </div>
      )}

      {hasBusinessInfo && (
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.businessInfoLabel}>
          <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
            <Building2 size={15} className="text-[var(--color-primary-600)]" />
            {t.business2}
          </Heading>
          <div className="divide-y divide-[var(--color-gray-100)]">
            {party.gstin && (
              <div className="py-2.5 border-b border-[var(--color-gray-100)] last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-[var(--color-primary-50)] text-[var(--color-primary-600)] flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <FileText size={15} />
                    </span>
                    <span className="text-xs font-medium text-[var(--text-muted)] truncate">{t.gstin}</span>
                  </div>
                  <span className="text-sm font-semibold text-[var(--text-primary)] text-right font-mono">
                    {party.gstin}
                  </span>
                </div>
                {party.gstinVerified && (
                  <div className="mt-1.5 ml-10 flex items-center gap-1.5 text-xs text-[var(--color-success-600)] font-medium">
                    <CheckCircle size={13} aria-hidden="true" />
                    <span>{t.verified}{party.gstinLegalName ? ` — ${party.gstinLegalName}` : ''}</span>
                  </div>
                )}
              </div>
            )}
            {party.pan && (
              <InfoRow icon={<FileText size={15} />} label="PAN" value={party.pan} />
            )}
          </div>
        </div>
      )}

      <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.creditInfo}>
        <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
          <CreditCard size={15} className="text-[var(--color-primary-600)]" />
          {t.credit}
        </Heading>
        <div className="divide-y divide-[var(--color-gray-100)]">
          <InfoRow
            icon={<CreditCard size={15} />}
            label={t.creditLimit}
            value={party.creditLimit > 0 ? formatAmount(party.creditLimit) : t.noLimit}
          />
          <InfoRow
            icon={<CreditCard size={15} />}
            label={t.creditLimitModeValue}
            value={creditLimitLabel}
          />
          {party.openingBalance && (
            <InfoRow
              icon={<FileText size={15} />}
              label={t.openingBalance}
              value={`${formatAmount(party.openingBalance.amount)} (${party.openingBalance.type === 'RECEIVABLE' ? t.receivable : t.payable})`}
            />
          )}
        </div>
      </div>

      {priceListName && (
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.partyPriceListChip}>
          <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
            <Tag size={15} className="text-[var(--color-primary-600)]" />
            {t.priceListLabel}
          </Heading>
          <InfoRow
            icon={<Tag size={15} />}
            label={t.partyPriceListChip}
            value={priceListName + (party.priceList?.isDefault ? ` (${t.priceListDefaultBadge})` : '')}
          />
        </div>
      )}

      {customFieldRows.length > 0 && (
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.customFields}>
          <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
            <ListChecks size={15} className="text-[var(--color-primary-600)]" />
            {t.customFields}
          </Heading>
          <div className="divide-y divide-[var(--color-gray-100)]">
            {customFieldRows.map(cv => (
              <InfoRow
                key={cv.id}
                icon={<FileText size={15} />}
                label={cv.field.name}
                value={cv.value}
              />
            ))}
          </div>
        </div>
      )}

      {party.notes && (
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs" aria-label={t.notesSection}>
          <Heading level={3} className="text-sm font-bold text-[var(--text-primary)] mb-3 pb-2 border-b border-[var(--color-gray-100)] flex items-center gap-2">
            <StickyNote size={15} className="text-[var(--color-primary-600)]" />
            {t.notesSection}
          </Heading>
          <Text className="text-sm text-[var(--text-secondary)] leading-relaxed bg-[var(--color-gray-50)] p-3 rounded-lg border border-[var(--color-gray-100)]">
            {party.notes}
          </Text>
        </div>
      )}
    </div>
  )
}
