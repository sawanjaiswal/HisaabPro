/** Create Party — Basic info section */

import { Input } from '@/components/ui/Input'
import type { PartyFormData, PartyType } from '../party.types'

interface PartyFormBasicProps {
  form: PartyFormData
  errors: Record<string, string>
  onUpdate: <K extends keyof PartyFormData>(key: K, value: PartyFormData[K]) => void
}

const PARTY_TYPE_OPTIONS: { value: PartyType; label: string }[] = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'SUPPLIER', label: 'Supplier' },
  { value: 'BOTH', label: 'Both' },
]

export function PartyFormBasic({ form, errors, onUpdate }: PartyFormBasicProps) {
  return (
    <div className="create-party-section">
      <Input
        label="Party Name"
        id="party-name"
        value={form.name}
        onChange={e => onUpdate('name', e.target.value)}
        onBlur={() => {
          if (!form.name.trim()) {
            onUpdate('name', form.name) // trigger re-render so hook validates
          }
        }}
        error={errors.name}
        placeholder="e.g. Raju Traders"
        required
        autoComplete="off"
        aria-required="true"
      />

      <Input
        label="Contact Number"
        id="party-phone"
        type="tel"
        value={form.phone ?? ''}
        onChange={e => onUpdate('phone', e.target.value || undefined)}
        error={errors.phone}
        placeholder="9876543210"
        maxLength={10}
        inputMode="numeric"
        autoComplete="tel"
      />

      <div className="input-group">
        <span className="input-label" id="party-type-label">Party Type</span>
        <div className="pill-tabs" role="group" aria-labelledby="party-type-label">
          {PARTY_TYPE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`pill-tab${form.type === option.value ? ' active' : ''}`}
              onClick={() => onUpdate('type', option.value)}
              aria-pressed={form.type === option.value}
              aria-label={`Set party type to ${option.label}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <Input
        label="Email"
        id="party-email"
        type="email"
        value={form.email ?? ''}
        onChange={e => onUpdate('email', e.target.value || undefined)}
        error={errors.email}
        placeholder="raju@example.com"
        autoComplete="email"
        inputMode="email"
      />

      <Input
        label="Company Name"
        id="party-company"
        value={form.companyName ?? ''}
        onChange={e => onUpdate('companyName', e.target.value || undefined)}
        placeholder="e.g. Raju Traders Pvt Ltd"
        autoComplete="organization"
      />
    </div>
  )
}
