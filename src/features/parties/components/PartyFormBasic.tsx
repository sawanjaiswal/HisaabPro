/** Create Party — Basic info section */

import { Input } from '@/components/ui/Input'
import { useLanguage } from '@/hooks/useLanguage'
import type { PartyFormData, PartyType } from '../party.types'
import { PartyFormPriceList } from './PartyFormPriceList'
import '@/styles/components.crm.css'

interface PartyFormBasicProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
  isEditMode?: boolean
}

export function PartyFormBasic({ form, errors, onUpdate, isEditMode = false }: PartyFormBasicProps) {
  const { t } = useLanguage()

  const PARTY_TYPE_OPTIONS: { value: PartyType; label: string }[] = [
    { value: 'CUSTOMER', label: t.customer },
    { value: 'SUPPLIER', label: t.supplier },
    { value: 'BOTH', label: t.both },
  ]

  return (
    <div className="create-party-section py-0">
      <Input
        label={t.partyName}
        id="party-name"
        value={form.name}
        onChange={e => onUpdate('name', e.target.value)}
        onBlur={() => {
          if (!form.name.trim()) {
            onUpdate('name', form.name) // trigger re-render so hook validates
          }
        }}
        error={errors.name}
        placeholder={t.partyNamePlaceholder}
        required
        autoComplete="off"
        aria-required="true"
      />

      <Input
        label={t.contactNumber}
        id="party-phone"
        type="tel"
        value={form.phone ?? ''}
        onChange={e => onUpdate('phone', e.target.value || undefined)}
        error={errors.phone}
        placeholder={t.phonePlaceholder}
        maxLength={10}
        inputMode="numeric"
        autoComplete="tel"
      />

      <div className="input-group">
        <span className="input-label" id="party-type-label">{t.partyType}</span>
        <div className="pill-tabs" role="group" aria-labelledby="party-type-label">
          {PARTY_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${form.type === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('type', option.value)}
              aria-pressed={form.type === option.value}
              aria-label={`${t.setPartyTypeTo} ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label={t.email}
        id="party-email"
        type="email"
        value={form.email ?? ''}
        onChange={e => onUpdate('email', e.target.value || undefined)}
        error={errors.email}
        placeholder={t.emailPlaceholder}
        autoComplete="email"
        inputMode="email"
      />

      <Input
        label={t.companyNameLabel}
        id="party-company"
        value={form.companyName ?? ''}
        onChange={e => onUpdate('companyName', e.target.value || undefined)}
        placeholder={t.companyPlaceholder}
        autoComplete="organization"
      />

      <PartyFormPriceList value={form.priceListId} isEditMode={isEditMode} onUpdate={onUpdate} />

      {/* CRM (#127) — opt-out toggle. UI-only in PR2 (loyaltyOptOut is a
          server-only field per M2 .strict()); wired live in the next CRM PR
          via the narrow PATCH /api/parties/:id route. */}
      <div className="party-form-opt-out">
        <label htmlFor="party-opt-out" className="party-form-opt-out__label">
          <input
            id="party-opt-out"
            type="checkbox"
            className="party-form-opt-out__input"
            disabled
            aria-describedby="party-opt-out-help"
          />
          <span>{t.crmLoyaltyOptOut}</span>
        </label>
        <p id="party-opt-out-help" className="party-form-opt-out__help">
          {t.crmLoyaltyOptOutHelp}
        </p>
      </div>
    </div>
  )
}
