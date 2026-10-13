import { Text } from '@/components/ui/Text'
import { MapPin, Navigation } from 'lucide-react'
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

export function PartyAddressesTab({ addresses = [] }: PartyAddressesTabProps) {
  const { t } = useLanguage()
  const list = addresses || []

  return (
    <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--color-gray-100)]">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-[var(--color-primary-600)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">{t.addresses ?? 'Addresses'}</span>
        </div>
        {list.length > 0 && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
            {list.length}
          </span>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center mb-2 text-[var(--color-primary-600)]">
            <MapPin size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">{t.noAddresses}</p>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">{t.addAddressesDesc}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((address) => (
            <div key={address.id} className="p-3 rounded-lg border border-[var(--color-gray-100)] bg-[var(--color-gray-50)]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[var(--color-primary-600)]" />
                  {address.label} • {address.type}
                </span>
                {address.isDefault && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                    {t.defaultLabel}
                  </span>
                )}
              </div>
              <Text className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {address.line1}
                {address.line2 && `, ${address.line2}`}
                <br />
                {address.city}, {address.state} — {address.pincode}
              </Text>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
