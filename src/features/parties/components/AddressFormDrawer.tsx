import React, { useState, useEffect, useMemo } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { useLanguage } from '@/hooks/useLanguage'
import { MapPin, Trash2 } from 'lucide-react'
import { INDIAN_STATES } from '../party.constants'
import type { PartyAddress, AddressType } from '../party.types'

interface AddressFormDrawerProps {
  open: boolean
  onClose: () => void
  initialAddress?: PartyAddress | null
  onSave?: (data: Omit<PartyAddress, 'id'> & { id?: string }) => Promise<void> | void
  onDelete?: (addressId: string) => Promise<void> | void
}

interface FormErrors {
  line1?: string
  city?: string
  pincode?: string
}

export function AddressFormDrawer({
  open,
  onClose,
  initialAddress,
  onSave,
  onDelete,
}: AddressFormDrawerProps) {
  const { t } = useLanguage()

  const [label, setLabel] = useState('Office')
  const [type, setType] = useState<AddressType>('BILLING')
  const [line1, setLine1] = useState('')
  const [line2, setLine2] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [pincode, setPincode] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const stateOptions = useMemo(
    () => INDIAN_STATES.map((s) => ({ value: s, label: s })),
    []
  )

  useEffect(() => {
    if (open) {
      setLabel(initialAddress?.label ?? 'Office')
      setType(initialAddress?.type ?? 'BILLING')
      setLine1(initialAddress?.line1 ?? '')
      setLine2(initialAddress?.line2 ?? '')
      setCity(initialAddress?.city ?? '')
      setState(initialAddress?.state ?? '')
      setPincode(initialAddress?.pincode ?? '')
      setIsDefault(initialAddress?.isDefault ?? false)
      setErrors({})
      setIsSaving(false)
      setIsDeleting(false)
    }
  }, [open, initialAddress])

  const validate = (): boolean => {
    const nextErrors: FormErrors = {}

    if (!line1.trim()) {
      nextErrors.line1 = 'Address line 1 is required'
    }

    if (!city.trim()) {
      nextErrors.city = 'City is required'
    }

    if (pincode.trim() && !/^\d{6}$/.test(pincode.trim())) {
      nextErrors.pincode = 'Pincode must be 6 digits'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!validate()) return

    try {
      setIsSaving(true)
      if (onSave) {
        await onSave({
          id: initialAddress?.id,
          label: label.trim() || 'Address',
          type,
          line1: line1.trim(),
          line2: line2.trim() || undefined,
          city: city.trim(),
          state: state.trim(),
          pincode: pincode.trim(),
          isDefault,
        })
      }
      onClose()
    } catch (err) {
      console.error('Failed to save address:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initialAddress?.id || !onDelete) return
    try {
      setIsDeleting(true)
      await onDelete(initialAddress.id)
      onClose()
    } catch (err) {
      console.error('Failed to delete address:', err)
    } finally {
      setIsDeleting(false)
    }
  }

  const footer = (
    <div className="flex items-center justify-between w-full">
      {initialAddress?.id && onDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isSaving || isDeleting}
          loading={isDeleting}
          onClick={handleDelete}
          className="text-xs font-semibold text-[var(--color-error-600)] hover:text-[var(--color-error-700)] hover:bg-[var(--color-error-50)]"
        >
          <Trash2 size={14} className="mr-1" />
          Delete
        </Button>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={isSaving || isDeleting}
          onClick={onClose}
        >
          {t.cancel ?? 'Cancel'}
        </Button>
        <Button
          type="button"
          variant="primary"
          loading={isSaving}
          disabled={isSaving || isDeleting}
          onClick={() => handleSave()}
        >
          {initialAddress ? (t.save ?? 'Save') : 'Add Address'}
        </Button>
      </div>
    </div>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={initialAddress ? 'Edit Address' : 'Add Address'}
      size="md"
      footer={footer}
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div className="card p-4 rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-surface)] shadow-xs space-y-4">
          {/* Address Purpose & Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
              Address Purpose & Type
            </label>
            <div className="pill-tabs" role="group">
              <Button
                variant="none"
                type="button"
                className={`pill-tab${type === 'BILLING' ? ' active' : ''}`}
                onClick={() => setType('BILLING')}
              >
                Billing
              </Button>
              <Button
                variant="none"
                type="button"
                className={`pill-tab${type === 'SHIPPING' ? ' active' : ''}`}
                onClick={() => setType('SHIPPING')}
              >
                Shipping
              </Button>
            </div>
          </div>

          {/* Label / Name */}
          <FormField label="Address Tag / Label" htmlFor="addr-label">
            <Input
              id="addr-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Main Office, Shop, Godown"
            />
          </FormField>

          {/* Location details */}
          <div className="pt-2 border-t border-[var(--color-gray-100)] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              <MapPin size={14} className="text-[var(--color-primary-600)]" />
              <span>Location Details</span>
            </div>

            <FormField
              label="Address Line 1"
              htmlFor="addr-line1"
              required
              error={errors.line1}
            >
              <Input
                id="addr-line1"
                className={`input${errors.line1 ? ' input-error-border' : ''}`}
                value={line1}
                onChange={(e) => {
                  setLine1(e.target.value)
                  if (errors.line1) setErrors((prev) => ({ ...prev, line1: undefined }))
                }}
                placeholder="Building / Shop number, Street"
                aria-invalid={Boolean(errors.line1)}
                required
              />
            </FormField>

            <FormField label="Address Line 2 (Optional)" htmlFor="addr-line2">
              <Input
                id="addr-line2"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
                placeholder="Area, Landmark"
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                label="City"
                htmlFor="addr-city"
                required
                error={errors.city}
              >
                <Input
                  id="addr-city"
                  className={`input${errors.city ? ' input-error-border' : ''}`}
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value)
                    if (errors.city) setErrors((prev) => ({ ...prev, city: undefined }))
                  }}
                  placeholder="City"
                  aria-invalid={Boolean(errors.city)}
                  required
                />
              </FormField>

              <FormField label="State" htmlFor="addr-state">
                <Select
                  options={stateOptions}
                  value={state}
                  onValueChange={setState}
                  placeholder="Select State"
                  searchable
                />
              </FormField>

              <FormField
                label="Pincode"
                htmlFor="addr-pincode"
                error={errors.pincode}
              >
                <Input
                  id="addr-pincode"
                  className={`input${errors.pincode ? ' input-error-border' : ''}`}
                  value={pincode}
                  onChange={(e) => {
                    setPincode(e.target.value)
                    if (errors.pincode) setErrors((prev) => ({ ...prev, pincode: undefined }))
                  }}
                  placeholder="6 digits"
                  maxLength={6}
                  aria-invalid={Boolean(errors.pincode)}
                />
              </FormField>
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--color-gray-100)]">
            <Checkbox
              checked={isDefault}
              onCheckedChange={(checked) => setIsDefault(Boolean(checked))}
              label="Set as default address"
              description="Used automatically as default shipping/billing address on invoices."
            />
          </div>
        </div>
      </form>
    </Drawer>
  )
}
