/** Fields tab — toggle visibility of invoice fields (business, customer, document, footer) */

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'

import type { TemplateConfig } from '../template.types'

import { ToggleRow } from './ToggleRow'
import { Section } from './Section'

interface FieldsTabProps {
  config: TemplateConfig
  onChange: (patch: Partial<TemplateConfig>) => void
}

export const FieldsTab: React.FC<FieldsTabProps> = ({ config, onChange }) => {
  const { t } = useLanguage()
  const f = config.fields
  const patchFields = (patch: Partial<typeof f>) => onChange({ fields: { ...f, ...patch } })

  return (
    <>
      <Section title={t.businessInfoSection}>
        <ToggleRow label={t.gstin}               checked={f.businessGstin}   ariaLabel={t.showBusinessGstin}    onChange={(v) => patchFields({ businessGstin: v })} />
        <ToggleRow label={t.panLabel}             checked={f.businessPan}     ariaLabel={t.showBusinessPan}      onChange={(v) => patchFields({ businessPan: v })} />
        <ToggleRow label={t.phone}                checked={f.businessPhone}   ariaLabel={t.showBusinessPhone}    onChange={(v) => patchFields({ businessPhone: v })} />
        <ToggleRow label={t.email}                checked={f.businessEmail}   ariaLabel={t.showBusinessEmail}    onChange={(v) => patchFields({ businessEmail: v })} />
        <ToggleRow label={t.address}              checked={f.businessAddress} ariaLabel={t.showBusinessAddress}  onChange={(v) => patchFields({ businessAddress: v })} />
      </Section>

      <Section title={t.customerInfoSection}>
        <ToggleRow label={t.customerGstinLabel}   checked={f.customerGstin}   ariaLabel={t.showCustomerGstin}    onChange={(v) => patchFields({ customerGstin: v })} />
        <ToggleRow label={t.customerPhoneLabel}   checked={f.customerPhone}   ariaLabel={t.showCustomerPhone}    onChange={(v) => patchFields({ customerPhone: v })} />
        <ToggleRow label={t.billingAddressLabel}  checked={f.customerAddress} ariaLabel={t.showBillingAddress}   onChange={(v) => patchFields({ customerAddress: v })} />
        <ToggleRow label={t.shippingAddressLabel} checked={f.shippingAddress} ariaLabel={t.showShippingAddress}  onChange={(v) => patchFields({ shippingAddress: v })} />
        <ToggleRow label={t.placeOfSupplyLabel}   checked={f.placeOfSupply}   ariaLabel={t.showPlaceOfSupply}    onChange={(v) => patchFields({ placeOfSupply: v })} />
      </Section>

      <Section title={t.documentDetailsSection}>
        <ToggleRow label={t.invoiceNumber}         checked={f.invoiceNumber}      ariaLabel={t.showInvoiceNumber}     onChange={(v) => patchFields({ invoiceNumber: v })} />
        <ToggleRow label={t.invoiceDate}           checked={f.invoiceDate}        ariaLabel={t.showInvoiceDate}       onChange={(v) => patchFields({ invoiceDate: v })} />
        <ToggleRow label={t.dueDate}               checked={f.dueDate}            ariaLabel={t.showDueDate}           onChange={(v) => patchFields({ dueDate: v })} />
        <ToggleRow label={t.poNumberLabel}         checked={f.poNumber}           ariaLabel={t.showPoNumber}          onChange={(v) => patchFields({ poNumber: v })} />
        <ToggleRow label={t.vehicleNumber}         checked={f.vehicleNumber}      ariaLabel={t.showVehicleNumber}     onChange={(v) => patchFields({ vehicleNumber: v })} />
        <ToggleRow label={t.transportDetailsLabel} checked={f.transportDetails}   ariaLabel={t.showTransportDetails}  onChange={(v) => patchFields({ transportDetails: v })} />
      </Section>

      <Section title={t.statusComplianceSection}>
        <ToggleRow label={t.paymentStatusStampLabel} sublabel={t.paymentStatusStampDesc}   checked={f.paymentStatusStamp}  ariaLabel={t.showPaymentStatusStamp}    onChange={(v) => patchFields({ paymentStatusStamp: v })} />
        <ToggleRow label={t.udyamNumberLabel}        sublabel={t.udyamNumberDesc}           checked={f.udyamNumber}         ariaLabel={t.showUdyamNumber}            onChange={(v) => patchFields({ udyamNumber: v })} />
        <ToggleRow label={t.totalQuantityLabel}      sublabel={t.totalQuantityDesc}         checked={f.totalQuantity}       ariaLabel={t.showTotalQuantity}          onChange={(v) => patchFields({ totalQuantity: v })} />
        <ToggleRow label={t.copyLabelLabel}          sublabel={t.copyLabelDesc}             checked={f.copyLabel}           ariaLabel={t.showCopyLabel}              onChange={(v) => patchFields({ copyLabel: v })} />
      </Section>

      <Section title={t.footerSection}>
        <ToggleRow label={t.bankDetailsLabel}        checked={f.bankDetails}          ariaLabel={t.showBankDetails}          onChange={(v) => patchFields({ bankDetails: v })} />
        <ToggleRow label={t.signatureLabel}          checked={f.signature}            ariaLabel={t.showSignature}            onChange={(v) => patchFields({ signature: v })} />
        <ToggleRow label={t.termsConditionsLabel}    checked={f.termsAndConditions}   ariaLabel={t.showTermsConditions}      onChange={(v) => patchFields({ termsAndConditions: v })} />
        <ToggleRow label={t.notesToggleLabel}        checked={f.notes}                ariaLabel={t.showNotes}                onChange={(v) => patchFields({ notes: v })} />
        <ToggleRow label={t.totalInWordsLabel}       checked={f.totalInWords}         ariaLabel={t.showTotalInWords}         onChange={(v) => patchFields({ totalInWords: v })} />
        <ToggleRow label={t.qrCodeLabel}             checked={f.qrCode}               ariaLabel={t.showQrCode}               onChange={(v) => patchFields({ qrCode: v })} />
        <ToggleRow label={t.watermarkLabel}          checked={f.watermark}            ariaLabel={t.showWatermark}            onChange={(v) => patchFields({ watermark: v })} />
      </Section>
    </>
  )
}
