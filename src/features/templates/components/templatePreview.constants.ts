/** Shared sample data and renderers for the template preview components */

import type React from 'react'

// ─── Sample data ────────────────────────────────────────────────────────────

export const SAMPLE_BUSINESS = {
  name: 'Sharma Traders',
  phone: '+91 98765 43210',
  address: '12 Main Market, Lajpat Nagar, New Delhi 110024',
  udyamNumber: 'UDYAM-MP-09-0012345',
}

export const SAMPLE_PARTY = {
  name: 'Raju Enterprises',
  phone: '+91 99001 12345',
  address: '5 Industrial Area, Phase-II, Gurugram 122001',
}

export const SAMPLE_INVOICE = {
  number: 'INV-0042',
  date: '15 Mar 2026',
  dueDate: '30 Mar 2026',
}

export interface SampleLineItem {
  name: string
  qty: number
  unit: string
  rate: number
  amount: number
}

export const SAMPLE_ITEMS: SampleLineItem[] = [
  { name: 'Basmati Rice (5 kg)', qty: 10, unit: 'Bag',  rate: 42000, amount: 420000 },
  { name: 'Toor Dal (1 kg)',     qty: 25, unit: 'Pkt',  rate:  9500, amount: 237500 },
  { name: 'Sunflower Oil (1 L)', qty: 15, unit: 'Btl',  rate: 14000, amount: 210000 },
]

export const SAMPLE_SUBTOTAL = 867500   // paise
export const SAMPLE_TOTAL    = 867500   // paise (no GST in MVP)

// ─── Formatting ─────────────────────────────────────────────────────────────

export function paise(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount / 100)
}

// ─── Column renderers ───────────────────────────────────────────────────────

/** Column keys that map to the sample line item fields */
export const COL_RENDER: Record<string, (item: SampleLineItem, idx: number) => React.ReactNode> = {
  serialNumber:   (_item, idx) => idx + 1,
  itemName:       (item)       => item.name,
  quantity:       (item)       => item.qty,
  unit:           (item)       => item.unit,
  rate:           (item)       => paise(item.rate),
  amount:         (item)       => paise(item.amount),
  hsn:            ()           => '—',
  discount:       ()           => '—',
  discountAmount: ()           => '—',
  taxRate:        ()           => '—',
  taxAmount:      ()           => '—',
  cessRate:       ()           => '—',
  cessAmount:     ()           => '—',
}
