/** CustomOrderForm — shared by CustomOrderNewPage and CustomOrderEditPage */

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/Button'
import { Select, SelectItem } from '@/components/ui/Select'

const ANY = '__any__' as const
import { Plus } from 'lucide-react'
import { PartySearchInput } from '@/features/invoices/components/PartySearchInput'
import { formatPaise, totalsFromItems } from '../custom-orders.utils'
import { CustomOrderItemEditor } from './CustomOrderItemEditor'
import type { CreateCustomOrderInput, CreateCustomOrderItemInput } from '../api/custom-orders.api.types'
import type { CustomOrderDetail } from '../custom-orders.types'
import { Textarea } from '@/components/ui/Textarea'
import { Input } from '@/components/ui/Input'
import { DateField } from '@/components/ui/DateField'
import { useLanguage } from '@/context/LanguageContext'

interface CustomOrderFormProps {
  initialData?: CustomOrderDetail
  onSubmit: (data: CreateCustomOrderInput) => void
  isSubmitting: boolean
  submitLabel?: string
}

interface FormItem extends CreateCustomOrderItemInput {
  _key: string
}

function makeItem(): FormItem {
  return { _key: crypto.randomUUID(), description: '', quantity: '1.000', ratePaise: 0, discountPaise: 0, productId: null, spec: null }
}

function fromDetail(d: CustomOrderDetail): {
  partyId: string; title: string; notes: string; deliveryAt: string; deliverySlot: string
  deliveryAddress: string; discountPaise: number; items: FormItem[]
} {
  return {
    partyId: d.partyId, title: d.title, notes: d.notes ?? '', deliveryAt: d.deliveryAt ? d.deliveryAt.slice(0, 16) : '',
    deliverySlot: d.deliverySlot ?? '', deliveryAddress: d.deliveryAddress ?? '', discountPaise: d.discountPaise,
    items: d.items.map((it) => ({ _key: it.id, description: it.description, quantity: it.quantity, ratePaise: it.ratePaise, discountPaise: it.discountPaise, productId: it.productId, spec: it.spec })),
  }
}

export function CustomOrderForm({ initialData, onSubmit, isSubmitting, submitLabel }: CustomOrderFormProps) {
  const { t } = useLanguage()
  const resolvedSubmitLabel = submitLabel ?? t.coSaveOrder
  const init = initialData ? fromDetail(initialData) : { partyId: '', title: '', notes: '', deliveryAt: '', deliverySlot: '', deliveryAddress: '', discountPaise: 0, items: [makeItem()] }

  const [partyId, setPartyId]               = useState(init.partyId)
  const [title, setTitle]                   = useState(init.title)
  const [notes, setNotes]                   = useState(init.notes)
  const [deliveryAt, setDeliveryAt]         = useState(init.deliveryAt)
  const [deliverySlot, setDeliverySlot]     = useState(init.deliverySlot)
  const [deliveryAddress, setDeliveryAddress] = useState(init.deliveryAddress)
  const [discountRs, setDiscountRs]         = useState(String(init.discountPaise / 100))
  const [items, setItems]                   = useState<FormItem[]>(init.items)
  const [errors, setErrors]                 = useState<Record<string, string>>({})

  const handlePartyChange = useCallback((id: string) => {
    setPartyId(id)
    if (id) setErrors((prev) => { const n = { ...prev }; delete n.partyId; return n })
  }, [])

  const updateItem = useCallback((key: string, field: keyof CreateCustomOrderItemInput, value: string | number | null) => {
    setItems((prev) => prev.map((it) => it._key === key ? { ...it, [field]: value } : it))
  }, [])

  const addItem = useCallback(() => setItems((prev) => [...prev, makeItem()]), [])
  const removeItem = useCallback((key: string) => setItems((prev) => prev.filter((it) => it._key !== key)), [])

  const totals = totalsFromItems(items.map((it) => ({ ...it, discountPaise: it.discountPaise ?? 0 })))
  const orderDiscountPaise = Math.round(parseFloat(discountRs || '0') * 100)
  const grandTotal = Math.max(0, totals.subtotalPaise - orderDiscountPaise)

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!partyId) errs.partyId = t.coErrCustomer
    if (!title.trim()) errs.title = t.coErrTitle
    if (items.length === 0) errs.items = t.coErrItemsMin
    for (const it of items) { if (!it.description.trim()) { errs.items = t.coErrItemDesc; break } }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ partyId, title: title.trim(), notes: notes.trim() || null, deliveryAt: deliveryAt || null, deliverySlot: deliverySlot || null, deliveryAddress: deliveryAddress.trim() || null, discountPaise: orderDiscountPaise, items: items.map(({ _key: _, ...rest }) => rest) })
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <PartySearchInput value={partyId} onChange={handlePartyChange} error={errors.partyId} />
      </div>

      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="order-title">{t.coOrderTitle} *</label>
        <Input id="order-title" type="text" className="input" value={title} onChange={(e) => { setTitle(e.target.value); if (e.target.value) setErrors((p) => { const n = { ...p }; delete n.title; return n }) }} placeholder={t.coTitlePlaceholder} maxLength={200} aria-required="true" aria-invalid={Boolean(errors.title)} />
        {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
      </div>

      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="order-notes">{t.coNotesOptional}</label>
        <Textarea id="order-notes" className="input resize-y min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t.coNotesPlaceholder} rows={2} maxLength={5000} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px] flex flex-col gap-1">
          <label className="label" htmlFor="order-delivery">{t.coDeliveryDateTime}</label>
          <DateField id="order-delivery" type="datetime-local" className="input" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} />
        </div>
        <div className="flex-1 min-w-[120px] flex flex-col gap-1">
          <label className="label" htmlFor="order-slot">{t.coSlot}</label>
          <Select
            value={deliverySlot || ANY}
            onValueChange={(v) => setDeliverySlot(v === ANY ? '' : v)}
            ariaLabel={t.coSlot}
          >
            <SelectItem value={ANY}>{t.coSlotAny}</SelectItem>
            <SelectItem value="morning">{t.coSlotMorning}</SelectItem>
            <SelectItem value="afternoon">{t.coSlotAfternoon}</SelectItem>
            <SelectItem value="evening">{t.coSlotEvening}</SelectItem>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="order-addr">{t.coDeliveryAddress}</label>
        <Input id="order-addr" type="text" className="input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} maxLength={500} />
      </div>

      {/* Line items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="label m-0">{t.coItemsRequired} *</span>
          {errors.items && <span className="field-error" role="alert">{errors.items}</span>}
        </div>
        {items.map((item, idx) => (
          <CustomOrderItemEditor key={item._key} item={item} index={idx} showRemove={items.length > 1} onUpdate={updateItem} onRemove={removeItem} />
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addItem} className="self-start min-h-[44px]">
          <Plus size={16} aria-hidden="true" /> {t.coAddItem}
        </Button>
      </div>

      {/* Order-level discount */}
      <div className="flex flex-col gap-1">
        <label className="label" htmlFor="order-discount">{t.coOrderDiscount}</label>
        <Input id="order-discount" type="number" className="input max-w-[160px]" value={discountRs} min="0" step="0.01" onChange={(e) => setDiscountRs(e.target.value)} />
      </div>

      {/* Totals summary */}
      <div className="border-t-2 border-[var(--color-border)] pt-3 flex flex-col gap-1 items-end">
        <div className="flex gap-4 text-sm text-[var(--color-text-secondary)]">
          <span>{t.coSubtotal}:</span><span>₹{formatPaise(totals.subtotalPaise)}</span>
        </div>
        {orderDiscountPaise > 0 && (
          <div className="flex gap-4 text-sm text-red-600">
            <span>{t.coDiscount}:</span><span>-₹{formatPaise(orderDiscountPaise)}</span>
          </div>
        )}
        <div className="flex gap-4 text-base font-bold text-[var(--color-text)]">
          <span>{t.coTotal}:</span><span>₹{formatPaise(grandTotal)}</span>
        </div>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="min-h-[48px] w-full">
        {isSubmitting ? t.saving : resolvedSubmitLabel}
      </Button>
    </form>
  )
}
