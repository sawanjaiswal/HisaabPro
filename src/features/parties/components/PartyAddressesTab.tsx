import { Text } from '@/components/ui/Text'
import { useState } from 'react'
import { MapPin, Navigation, Plus, Pencil } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import { useToast } from '@/hooks/useToast'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { AddressFormDrawer } from './AddressFormDrawer'
import {
  addPartyAddress,
  updatePartyAddress,
  deletePartyAddress,
} from '../party.service'
import { invalidatePartyDetail } from '../party-cache'
import type { PartyAddress } from '../party.types'

interface PartyAddressesTabProps {
  partyId: string
  addresses: PartyAddress[]
  onPatched?: () => void
}

export function PartyAddressesTab({
  partyId,
  addresses = [],
  onPatched,
}: PartyAddressesTabProps) {
  const { t } = useLanguage()
  const toast = useToast()
  const queryClient = useQueryClient()
  const list = addresses || []

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<PartyAddress | null>(null)

  const handleOpenAdd = () => {
    setSelectedAddress(null)
    setDrawerOpen(true)
  }

  const handleOpenEdit = (addr: PartyAddress) => {
    setSelectedAddress(addr)
    setDrawerOpen(true)
  }

  const handleSaveAddress = async (
    data: Omit<PartyAddress, 'id'> & { id?: string }
  ) => {
    try {
      if (data.id) {
        await updatePartyAddress(partyId, data.id, {
          label: data.label,
          type: data.type,
          line1: data.line1,
          line2: data.line2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          isDefault: data.isDefault,
        })
        toast.success('Address updated successfully')
      } else {
        await addPartyAddress(partyId, {
          label: data.label,
          type: data.type,
          line1: data.line1,
          line2: data.line2,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
          isDefault: data.isDefault,
        })
        toast.success('Address added successfully')
      }

      invalidatePartyDetail(queryClient, partyId)
      onPatched?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save address'
      toast.error(message)
      throw err
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    try {
      await deletePartyAddress(partyId, addressId)
      toast.success('Address removed')
      invalidatePartyDetail(queryClient, partyId)
      onPatched?.()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete address'
      toast.error(message)
      throw err
    }
  }

  return (
    <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-[var(--color-gray-100)]">
        <div className="flex items-center gap-2">
          <Navigation size={15} className="text-[var(--color-primary-600)]" />
          <span className="text-sm font-bold text-[var(--text-primary)]">
            {t.addresses ?? 'Addresses'}
          </span>
          {list.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              {list.length}
            </span>
          )}
        </div>
        {list.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleOpenAdd}
            className="text-xs font-semibold text-[var(--color-primary-600)] hover:text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)] h-7 px-2"
          >
            <Plus size={14} className="mr-1" />
            Add Address
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="py-6 flex flex-col items-center justify-center text-center">
          <div className="w-10 h-10 rounded-full bg-[var(--color-primary-50)] flex items-center justify-center mb-2 text-[var(--color-primary-600)]">
            <MapPin size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {t.noAddresses}
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-xs mb-3">
            {t.addAddressesDesc}
          </p>
          <Button variant="primary" size="sm" onClick={handleOpenAdd}>
            <Plus size={14} className="mr-1" />
            Add Address
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((address) => (
            <div
              key={address.id}
              className="p-3 rounded-lg border border-[var(--color-gray-100)] bg-[var(--color-gray-50)]"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[var(--color-primary-600)]" />
                  {address.label} • {address.type}
                </span>
                <div className="flex items-center gap-2">
                  {address.isDefault && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--color-primary-100)] text-[var(--color-primary-700)]">
                      {t.defaultLabel}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => handleOpenEdit(address)}
                    className="h-6 w-6 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded hover:bg-[var(--color-gray-200)]"
                    aria-label={`Edit ${address.label}`}
                  >
                    <Pencil size={13} />
                  </Button>
                </div>
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

      <AddressFormDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initialAddress={selectedAddress}
        onSave={handleSaveAddress}
        onDelete={handleDeleteAddress}
      />
    </div>
  )
}
