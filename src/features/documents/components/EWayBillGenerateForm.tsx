/** EWayBillGenerateForm — transport details form for generating an e-way bill */

import React, { useState } from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { TransportMode, VehicleType, EWayBillGenerateInput } from '../ecompliance.types'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'
import { Input } from '@/components/ui/Input'

interface FormState {
  transportMode: TransportMode
  vehicleNumber: string
  vehicleType: VehicleType
  transporterName: string
  distance: string
  fromPincode: string
  toPincode: string
}

const DEFAULT: FormState = {
  transportMode: 'ROAD', vehicleNumber: '', vehicleType: 'REGULAR',
  transporterName: '', distance: '', fromPincode: '', toPincode: '',
}

interface EWayBillGenerateFormProps {
  generating: boolean
  onSubmit: (input: Omit<EWayBillGenerateInput, 'documentId'>) => Promise<void>
  onDismiss: () => void
}

export const EWayBillGenerateForm: React.FC<EWayBillGenerateFormProps> = ({
  generating, onSubmit, onDismiss,
}) => {
  const { t } = useLanguage()
  const [form, setForm] = useState<FormState>(DEFAULT)
  const [errors, setErrors] = useState<Partial<FormState>>({})
  const [actionError, setActionError] = useState('')

  const TRANSPORT_MODES: { value: TransportMode; label: string }[] = [
    { value: 'ROAD', label: t.transportRoad },
    { value: 'RAIL', label: t.transportRail },
    { value: 'AIR', label: t.transportAir },
    { value: 'SHIP', label: t.transportShip },
  ]

  const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
    { value: 'REGULAR', label: t.vehicleRegular },
    { value: 'ODC', label: t.vehicleOdc },
  ]

  const set = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validate = (): boolean => {
    const e: Partial<FormState> = {}
    if (!form.distance || Number(form.distance) <= 0) e.distance = t.enterDistanceKm
    if (form.fromPincode.length !== 6) e.fromPincode = t.sixDigitPincode
    if (form.toPincode.length !== 6) e.toPincode = t.sixDigitPincode
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setActionError('')
    try {
      await onSubmit({
        transportMode: form.transportMode,
        vehicleNumber: form.vehicleNumber || undefined,
        vehicleType: form.vehicleType,
        transporterName: form.transporterName || undefined,
        distance: Number(form.distance),
        fromPincode: form.fromPincode,
        toPincode: form.toPincode,
      })
      setForm(DEFAULT)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.failedGenerateEwb)
    }
  }

  return (
    <form className="ewb-form" onSubmit={handleSubmit} aria-label={t.ewbFormAria} noValidate>
      {actionError && <p className="compliance-inline-error" role="alert">{actionError}</p>}
      <div className="ewb-form-row">
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-mode">{t.transportMode}</label>
          <Select
            value={form.transportMode}
            onValueChange={(v) => set('transportMode', v as TransportMode)}
            ariaLabel={t.transportMode}
          >
            {TRANSPORT_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </Select>
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-vtype">{t.vehicleType}</label>
          <Select
            value={form.vehicleType}
            onValueChange={(v) => set('vehicleType', v as VehicleType)}
            ariaLabel={t.vehicleType}
          >
            {VEHICLE_TYPES.map(v => <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>)}
          </Select>
        </div>
      </div>
      <div className="ewb-form-row">
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-vehicle">{t.vehicleNo}</label>
          <Input id="ewb-vehicle" className="input" type="text" placeholder="MH12AB1234"
            value={form.vehicleNumber} maxLength={12}
            onChange={e => set('vehicleNumber', e.target.value.toUpperCase())} />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-dist">{t.distanceKm} *</label>
          <Input id="ewb-dist" className="input" type="number" inputMode="numeric" min="1"
            placeholder="150" value={form.distance}
            onChange={e => set('distance', e.target.value)}
            aria-describedby={errors.distance ? 'ewb-dist-err' : undefined} />
          {errors.distance && <span id="ewb-dist-err" className="input-error" role="alert">{errors.distance}</span>}
        </div>
      </div>
      <div className="ewb-form-row">
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-from">{t.fromPincode} *</label>
          <Input id="ewb-from" className="input" type="text" inputMode="numeric" placeholder="110001"
            maxLength={6} value={form.fromPincode}
            onChange={e => set('fromPincode', e.target.value.replace(/\D/g, ''))}
            aria-describedby={errors.fromPincode ? 'ewb-from-err' : undefined} />
          {errors.fromPincode && <span id="ewb-from-err" className="input-error" role="alert">{errors.fromPincode}</span>}
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="ewb-to">{t.toPincode} *</label>
          <Input id="ewb-to" className="input" type="text" inputMode="numeric" placeholder="400001"
            maxLength={6} value={form.toPincode}
            onChange={e => set('toPincode', e.target.value.replace(/\D/g, ''))}
            aria-describedby={errors.toPincode ? 'ewb-to-err' : undefined} />
          {errors.toPincode && <span id="ewb-to-err" className="input-error" role="alert">{errors.toPincode}</span>}
        </div>
      </div>
      <div className="input-group">
        <label className="input-label" htmlFor="ewb-transporter">{t.transporterNameOpt}</label>
        <Input id="ewb-transporter" className="input" type="text" placeholder="e.g. Blue Dart"
          value={form.transporterName} maxLength={100}
          onChange={e => set('transporterName', e.target.value)} />
      </div>
      <div className="compliance-actions">
        <Button type="button" variant="ghost" size="md" onClick={onDismiss} disabled={generating}>
          {t.dismiss}
        </Button>
        <Button type="submit" variant="primary" size="md" disabled={generating} aria-busy={generating}>
          {generating ? t.generatingEwb : t.generateEwb}
        </Button>
      </div>
    </form>
  )
}
