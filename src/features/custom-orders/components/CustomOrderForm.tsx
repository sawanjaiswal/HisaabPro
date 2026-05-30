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

export function CustomOrderForm({ initialData, onSubmit, isSubmitting, submitLabel = 'Save Order' }: CustomOrderFormProps) {
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
    if (!partyId) errs.partyId = 'Customer is required'
    if (!title.trim()) errs.title = 'Order title is required'
    if (items.length === 0) errs.items = 'At least one item is required'
    for (const it of items) { if (!it.description.trim()) { errs.items = 'All items need a description'; break } }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ partyId, title: title.trim(), notes: notes.trim() || null, deliveryAt: deliveryAt || null, deliverySlot: deliverySlot || null, deliveryAddress: deliveryAddress.trim() || null, discountPaise: orderDiscountPaise, items: items.map(({ _key: _, ...rest }) => rest) })
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div>
        <PartySearchInput value={partyId} onChange={handlePartyChange} error={errors.partyId} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="order-title">Order Title *</label>
        <Input id="order-title" type="text" className="input" value={title} onChange={(e) => { setTitle(e.target.value); if (e.target.value) setErrors((p) => { const n = { ...p }; delete n.title; return n }) }} placeholder="e.g. 1 kg Vanilla Cake, Wedding Lehenga" maxLength={200} aria-required="true" aria-invalid={Boolean(errors.title)} />
        {errors.title && <span className="field-error" role="alert">{errors.title}</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="order-notes">Notes (optional)</label>
        <Textarea id="order-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Special instructions, customer preferences..." rows={2} maxLength={5000} style={{ resize: 'vertical', minHeight: 64 }} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label className="label" htmlFor="order-delivery">Delivery Date &amp; Time</label>
          <Input id="order-delivery" type="datetime-local" className="input" value={deliveryAt} onChange={(e) => setDeliveryAt(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          <label className="label" htmlFor="order-slot">Slot</label>
          <Select
            value={deliverySlot || ANY}
            onValueChange={(v) => setDeliverySlot(v === ANY ? '' : v)}
            ariaLabel="Slot"
          >
            <SelectItem value={ANY}>Any</SelectItem>
            <SelectItem value="morning">Morning</SelectItem>
            <SelectItem value="afternoon">Afternoon</SelectItem>
            <SelectItem value="evening">Evening</SelectItem>
          </Select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="order-addr">Delivery Address (optional)</label>
        <Input id="order-addr" type="text" className="input" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} maxLength={500} />
      </div>

      {/* Line items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="label" style={{ margin: 0 }}>Items *</span>
          {errors.items && <span className="field-error" role="alert">{errors.items}</span>}
        </div>
        {items.map((item, idx) => (
          <CustomOrderItemEditor key={item._key} item={item} index={idx} showRemove={items.length > 1} onUpdate={updateItem} onRemove={removeItem} />
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={addItem} style={{ alignSelf: 'flex-start', minHeight: 44 }}>
          <Plus size={16} aria-hidden="true" /> Add Item
        </Button>
      </div>

      {/* Order-level discount */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
        <label className="label" htmlFor="order-discount">Order Discount (₹, optional)</label>
        <Input id="order-discount" type="number" className="input" value={discountRs} min="0" step="0.01" onChange={(e) => setDiscountRs(e.target.value)} style={{ maxWidth: 160 }} />
      </div>

      {/* Totals summary */}
      <div style={{ borderTop: '2px solid var(--color-border)', paddingTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-secondary)' }}>
          <span>Subtotal:</span><span>₹{formatPaise(totals.subtotalPaise)}</span>
        </div>
        {orderDiscountPaise > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-sm)', color: 'var(--color-error-600)' }}>
            <span>Discount:</span><span>-₹{formatPaise(orderDiscountPaise)}</span>
          </div>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--fs-md)', fontWeight: 700, color: 'var(--color-text)' }}>
          <span>Total:</span><span>₹{formatPaise(grandTotal)}</span>
        </div>
      </div>

      <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} style={{ minHeight: 48, width: '100%' }}>
        {isSubmitting ? 'Saving...' : submitLabel}
      </Button>
    </form>
  )
}
