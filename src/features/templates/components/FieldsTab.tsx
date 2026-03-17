/** Fields tab — toggle visibility of invoice fields (business, customer, document, footer) */

import React from 'react'

import type { TemplateConfig } from '../template.types'

import { ToggleRow } from './ToggleRow'
import { Section } from './Section'

interface FieldsTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const FieldsTab: React.FC<FieldsTabProps> = ({ config, onChange }) => {
  const f = config.fields
  const patchFields = (patch: Partial<typeof f>) => onChange({ fields: { ...f, ...patch } })

  return (
    <>
      <Section title="Business Info">
        <ToggleRow label="GSTIN"            checked={f.businessGstin}   ariaLabel="Show business GSTIN"    onChange={(v) => patchFields({ businessGstin: v })} />
        <ToggleRow label="PAN"              checked={f.businessPan}     ariaLabel="Show business PAN"      onChange={(v) => patchFields({ businessPan: v })} />
        <ToggleRow label="Phone"            checked={f.businessPhone}   ariaLabel="Show business phone"    onChange={(v) => patchFields({ businessPhone: v })} />
        <ToggleRow label="Email"            checked={f.businessEmail}   ariaLabel="Show business email"    onChange={(v) => patchFields({ businessEmail: v })} />
        <ToggleRow label="Address"          checked={f.businessAddress} ariaLabel="Show business address"  onChange={(v) => patchFields({ businessAddress: v })} />
      </Section>

      <Section title="Customer Info">
        <ToggleRow label="Customer GSTIN"   checked={f.customerGstin}   ariaLabel="Show customer GSTIN"    onChange={(v) => patchFields({ customerGstin: v })} />
        <ToggleRow label="Customer Phone"   checked={f.customerPhone}   ariaLabel="Show customer phone"    onChange={(v) => patchFields({ customerPhone: v })} />
        <ToggleRow label="Billing Address"  checked={f.customerAddress} ariaLabel="Show billing address"   onChange={(v) => patchFields({ customerAddress: v })} />
        <ToggleRow label="Shipping Address" checked={f.shippingAddress} ariaLabel="Show shipping address"  onChange={(v) => patchFields({ shippingAddress: v })} />
        <ToggleRow label="Place of Supply"  checked={f.placeOfSupply}   ariaLabel="Show place of supply"   onChange={(v) => patchFields({ placeOfSupply: v })} />
      </Section>

      <Section title="Document Details">
        <ToggleRow label="Invoice Number"    checked={f.invoiceNumber}      ariaLabel="Show invoice number"     onChange={(v) => patchFields({ invoiceNumber: v })} />
        <ToggleRow label="Invoice Date"      checked={f.invoiceDate}        ariaLabel="Show invoice date"       onChange={(v) => patchFields({ invoiceDate: v })} />
        <ToggleRow label="Due Date"          checked={f.dueDate}            ariaLabel="Show due date"           onChange={(v) => patchFields({ dueDate: v })} />
        <ToggleRow label="PO Number"         checked={f.poNumber}           ariaLabel="Show PO number"          onChange={(v) => patchFields({ poNumber: v })} />
        <ToggleRow label="Vehicle Number"    checked={f.vehicleNumber}      ariaLabel="Show vehicle number"     onChange={(v) => patchFields({ vehicleNumber: v })} />
        <ToggleRow label="Transport Details" checked={f.transportDetails}   ariaLabel="Show transport details"  onChange={(v) => patchFields({ transportDetails: v })} />
      </Section>

      <Section title="Footer">
        <ToggleRow label="Bank Details"        checked={f.bankDetails}          ariaLabel="Show bank details"          onChange={(v) => patchFields({ bankDetails: v })} />
        <ToggleRow label="Signature"           checked={f.signature}            ariaLabel="Show signature block"       onChange={(v) => patchFields({ signature: v })} />
        <ToggleRow label="Terms & Conditions"  checked={f.termsAndConditions}   ariaLabel="Show terms and conditions"  onChange={(v) => patchFields({ termsAndConditions: v })} />
        <ToggleRow label="Notes"               checked={f.notes}                ariaLabel="Show notes"                 onChange={(v) => patchFields({ notes: v })} />
        <ToggleRow label="Total in Words"      checked={f.totalInWords}         ariaLabel="Show total in words"        onChange={(v) => patchFields({ totalInWords: v })} />
        <ToggleRow label="QR Code"             checked={f.qrCode}               ariaLabel="Show QR code"               onChange={(v) => patchFields({ qrCode: v })} />
        <ToggleRow label="Watermark"           checked={f.watermark}            ariaLabel="Show watermark"             onChange={(v) => patchFields({ watermark: v })} />
      </Section>
    </>
  )
}
