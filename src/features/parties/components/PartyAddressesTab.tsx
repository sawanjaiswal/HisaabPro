/** Party Detail — Addresses tab content */

import { MapPin } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { useLanguage } from '@/hooks/useLanguage'

interface Address {
  id: string
  label: string
  type: string
  isDefault: boolean
  line1: string
  line2?: string | null
  city: string
  state: string
  pincode: string
}

interface PartyAddressesTabProps {
  addresses: Address[]
}

export function PartyAddressesTab({ addresses }: PartyAddressesTabProps) {
  const { t } = useLanguage()

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={<MapPin size={40} aria-hidden="true" />}
        title={t.noAddresses}
        description={t.addAddressesDesc}
      />
    )
  }

  return (
    <div className="party-info-card">
      {addresses.map((address) => (
        <div key={address.id} className="card">
          <div className="party-address-card">
            <div className="party-address-label">
              <MapPin size={14} aria-hidden="true" />
              {address.label} — {address.type}
              {address.isDefault && (
                <span className="badge badge-info" style={{ marginInlineStart: 'var(--space-2)' }}>
                  {t.defaultLabel}
                </span>
              )}
            </div>
            <p className="party-address-line">
              {address.line1}
              {address.line2 && `, ${address.line2}`}
              <br />
              {address.city}, {address.state} — {address.pincode}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
