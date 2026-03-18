/** Template Gallery — Config overrides for 24 additional base templates
 *
 * Each template defines a Partial<TemplateConfig> that is merged on top of
 * DEFAULT_TEMPLATE_CONFIG via mergeTemplateConfig() in template.utils.ts.
 *
 * Only the DIFFERENCES from default are specified — everything else inherits.
 */

import type { BaseTemplate, TemplateConfig } from './template.types'

/** Partial config overrides per additional base template (beyond the original 6) */
export const TEMPLATE_CONFIG_OVERRIDES: Partial<Record<BaseTemplate, Partial<TemplateConfig>>> = {

  // ─── Modern Collection ───────────────────────────────────────────────────

  A4_ELEGANT: {
    layout: {
      logoPosition: 'center', logoMaxHeight: 48, headerStyle: 'stacked',
      itemTableStyle: 'minimal', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'poppins', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#92400E', headerBg: '#FFFBEB', headerText: '#92400E',
      tableBorderColor: '#D6D3D1', tableHeaderBg: '#FAFAF9', tableHeaderText: '#44403C',
    },
    fields: {
      businessGstin: false, businessPan: false, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: false, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
    footerText: 'Thank you for choosing us.',
  },

  A4_MINIMAL: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 40, headerStyle: 'minimal',
      itemTableStyle: 'minimal', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'inter', fontSize: 'small', headerFontSize: 'medium' },
    colors: {
      accent: '#18181B', headerBg: '#FFFFFF', headerText: '#18181B',
      tableBorderColor: '#F4F4F5', tableHeaderBg: '#FFFFFF', tableHeaderText: '#71717A',
    },
    footerText: '',
  },

  A4_BOLD: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 70, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'full-width', signaturePosition: 'right',
    },
    typography: { fontFamily: 'poppins', fontSize: 'large', headerFontSize: 'large' },
    colors: {
      accent: '#DC2626', headerBg: '#DC2626', headerText: '#FFFFFF',
      tableBorderColor: '#FECACA', tableHeaderBg: '#FEF2F2', tableHeaderText: '#991B1B',
    },
  },

  A4_CORPORATE: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'roboto', fontSize: 'medium', headerFontSize: 'medium' },
    colors: {
      accent: '#1E3A5F', headerBg: '#1E3A5F', headerText: '#FFFFFF',
      tableBorderColor: '#CBD5E1', tableHeaderBg: '#F1F5F9', tableHeaderText: '#1E293B',
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: true, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
  },

  A4_PROFESSIONAL: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'striped', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'inter', fontSize: 'medium', headerFontSize: 'medium' },
    colors: {
      accent: '#0D9488', headerBg: '#F0FDFA', headerText: '#134E4A',
      tableBorderColor: '#CCFBF1', tableHeaderBg: '#F0FDFA', tableHeaderText: '#134E4A',
    },
    fields: {
      businessGstin: false, businessPan: false, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: false, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: false, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
  },

  A4_CREATIVE: {
    layout: {
      logoPosition: 'right', logoMaxHeight: 60, headerStyle: 'stacked',
      itemTableStyle: 'minimal', summaryPosition: 'center', signaturePosition: 'center',
    },
    typography: { fontFamily: 'poppins', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#7C3AED', headerBg: '#F5F3FF', headerText: '#5B21B6',
      tableBorderColor: '#E9D5FF', tableHeaderBg: '#FAF5FF', tableHeaderText: '#6B21A8',
    },
  },

  // ─── Indian Business Collection ──────────────────────────────────────────

  A4_GST_STANDARD: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Item' },
      hsn: { visible: true, label: 'HSN/SAC' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'Rate' },
      discount: { visible: false, label: 'Disc %' }, discountAmount: { visible: false, label: 'Disc' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    fields: {
      businessGstin: true, businessPan: false, businessPhone: true, businessEmail: false,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: true, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: true, termsAndConditions: true, notes: false,
      totalInWords: true, qrCode: false, watermark: false,
    },
    colors: {
      accent: '#2563EB', headerBg: '#EFF6FF', headerText: '#1E40AF',
      tableBorderColor: '#BFDBFE', tableHeaderBg: '#EFF6FF', tableHeaderText: '#1E40AF',
    },
  },

  A4_GST_DETAILED: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Item Description' },
      hsn: { visible: true, label: 'HSN/SAC' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'Rate' },
      discount: { visible: true, label: 'Disc %' }, discountAmount: { visible: true, label: 'Disc Amt' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST Amt' },
      cessRate: { visible: true, label: 'Cess %' }, cessAmount: { visible: true, label: 'Cess Amt' },
      amount: { visible: true, label: 'Total' },
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: true, placeOfSupply: true, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: true, vehicleNumber: true, transportDetails: true,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: true, watermark: false,
    },
    typography: { fontFamily: 'roboto', fontSize: 'small', headerFontSize: 'medium' },
    colors: {
      accent: '#1D4ED8', headerBg: '#1D4ED8', headerText: '#FFFFFF',
      tableBorderColor: '#93C5FD', tableHeaderBg: '#DBEAFE', tableHeaderText: '#1E3A8A',
    },
  },

  A4_RETAIL: {
    layout: {
      logoPosition: 'center', logoMaxHeight: 50, headerStyle: 'stacked',
      itemTableStyle: 'bordered', summaryPosition: 'full-width', signaturePosition: 'right',
    },
    typography: { fontFamily: 'noto-sans', fontSize: 'large', headerFontSize: 'large' },
    colors: {
      accent: '#059669', headerBg: '#ECFDF5', headerText: '#065F46',
      tableBorderColor: '#A7F3D0', tableHeaderBg: '#ECFDF5', tableHeaderText: '#065F46',
    },
    footerText: 'Goods once sold will not be taken back.',
  },

  A4_WHOLESALE: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Item' },
      hsn: { visible: false, label: 'HSN' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'Rate' },
      discount: { visible: true, label: 'Disc %' }, discountAmount: { visible: true, label: 'Disc' },
      taxRate: { visible: false, label: 'Tax %' }, taxAmount: { visible: false, label: 'Tax' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    colors: {
      accent: '#B45309', headerBg: '#FFFBEB', headerText: '#92400E',
      tableBorderColor: '#FDE68A', tableHeaderBg: '#FEF3C7', tableHeaderText: '#78350F',
    },
  },

  A4_KIRANA: {
    layout: {
      logoPosition: 'none', logoMaxHeight: 40, headerStyle: 'stacked',
      itemTableStyle: 'bordered', summaryPosition: 'full-width', signaturePosition: 'left',
    },
    typography: { fontFamily: 'noto-sans', fontSize: 'large', headerFontSize: 'large' },
    colors: {
      accent: '#16A34A', headerBg: '#FFFFFF', headerText: '#166534',
      tableBorderColor: '#D1D5DB', tableHeaderBg: '#F9FAFB', tableHeaderText: '#111827',
    },
    footerText: 'धन्यवाद! फिर से पधारें।',
  },

  A4_MANUFACTURING: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Item Description' },
      hsn: { visible: true, label: 'HSN' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'Rate' },
      discount: { visible: false, label: 'Disc %' }, discountAmount: { visible: false, label: 'Disc' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: true, placeOfSupply: true, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: true, vehicleNumber: true, transportDetails: true,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
    colors: {
      accent: '#4338CA', headerBg: '#EEF2FF', headerText: '#3730A3',
      tableBorderColor: '#C7D2FE', tableHeaderBg: '#EEF2FF', tableHeaderText: '#3730A3',
    },
  },

  // ─── Industry Templates ──────────────────────────────────────────────────

  A4_SERVICES: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'striped', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Service Description' },
      hsn: { visible: true, label: 'SAC' }, quantity: { visible: true, label: 'Hours' },
      unit: { visible: false, label: 'Unit' }, rate: { visible: true, label: 'Rate/Hr' },
      discount: { visible: false, label: 'Disc %' }, discountAmount: { visible: false, label: 'Disc' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    colors: {
      accent: '#0891B2', headerBg: '#ECFEFF', headerText: '#155E75',
      tableBorderColor: '#A5F3FC', tableHeaderBg: '#ECFEFF', tableHeaderText: '#155E75',
    },
    fields: {
      businessGstin: true, businessPan: false, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: true, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: false, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
  },

  A4_FREELANCER: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 40, headerStyle: 'stacked',
      itemTableStyle: 'minimal', summaryPosition: 'right', signaturePosition: 'left',
    },
    typography: { fontFamily: 'poppins', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#EA580C', headerBg: '#FFFFFF', headerText: '#9A3412',
      tableBorderColor: '#FDBA74', tableHeaderBg: '#FFF7ED', tableHeaderText: '#9A3412',
    },
    fields: {
      businessGstin: false, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: false, customerGstin: false, customerPhone: true, customerAddress: false,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: false, termsAndConditions: false, notes: true,
      totalInWords: false, qrCode: false, watermark: false,
    },
  },

  A4_MEDICAL: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Medicine / Item' },
      hsn: { visible: true, label: 'HSN' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'MRP' },
      discount: { visible: true, label: 'Disc %' }, discountAmount: { visible: true, label: 'Disc' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Net Amt' },
    },
    colors: {
      accent: '#0E7490', headerBg: '#F0F9FF', headerText: '#0C4A6E',
      tableBorderColor: '#BAE6FD', tableHeaderBg: '#F0F9FF', tableHeaderText: '#0C4A6E',
    },
  },

  A4_RESTAURANT: {
    layout: {
      logoPosition: 'center', logoMaxHeight: 60, headerStyle: 'stacked',
      itemTableStyle: 'minimal', summaryPosition: 'full-width', signaturePosition: 'center',
    },
    columns: {
      serialNumber: { visible: false, label: '#' }, itemName: { visible: true, label: 'Item' },
      hsn: { visible: false, label: 'HSN' }, quantity: { visible: true, label: 'Qty' },
      unit: { visible: false, label: 'Unit' }, rate: { visible: true, label: 'Price' },
      discount: { visible: false, label: 'Disc %' }, discountAmount: { visible: false, label: 'Disc' },
      taxRate: { visible: false, label: 'Tax %' }, taxAmount: { visible: false, label: 'Tax' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    typography: { fontFamily: 'poppins', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#B91C1C', headerBg: '#FEF2F2', headerText: '#991B1B',
      tableBorderColor: '#FECACA', tableHeaderBg: '#FEF2F2', tableHeaderText: '#991B1B',
    },
    footerText: 'Thank you! Visit again.',
  },

  A4_TRANSPORT: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: true, placeOfSupply: true, invoiceNumber: true, invoiceDate: true,
      dueDate: false, poNumber: true, vehicleNumber: true, transportDetails: true,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
    colors: {
      accent: '#7E22CE', headerBg: '#FAF5FF', headerText: '#6B21A8',
      tableBorderColor: '#E9D5FF', tableHeaderBg: '#FAF5FF', tableHeaderText: '#6B21A8',
    },
  },

  A4_CONSTRUCTION: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    columns: {
      serialNumber: { visible: true, label: '#' }, itemName: { visible: true, label: 'Work Description' },
      hsn: { visible: true, label: 'SAC' }, quantity: { visible: true, label: 'Qty/Area' },
      unit: { visible: true, label: 'Unit' }, rate: { visible: true, label: 'Rate' },
      discount: { visible: false, label: 'Disc %' }, discountAmount: { visible: false, label: 'Disc' },
      taxRate: { visible: true, label: 'GST %' }, taxAmount: { visible: true, label: 'GST' },
      cessRate: { visible: false, label: 'Cess %' }, cessAmount: { visible: false, label: 'Cess' },
      amount: { visible: true, label: 'Amount' },
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: true, customerPhone: true, customerAddress: true,
      shippingAddress: true, placeOfSupply: true, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: true, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
    colors: {
      accent: '#CA8A04', headerBg: '#FEFCE8', headerText: '#854D0E',
      tableBorderColor: '#FDE68A', tableHeaderBg: '#FEFCE8', tableHeaderText: '#854D0E',
    },
  },

  // ─── Compact & Special ───────────────────────────────────────────────────

  A5_RECEIPT: {
    layout: {
      logoPosition: 'center', logoMaxHeight: 40, headerStyle: 'stacked',
      itemTableStyle: 'bordered', summaryPosition: 'full-width', signaturePosition: 'left',
    },
    typography: { fontFamily: 'noto-sans', fontSize: 'small', headerFontSize: 'medium' },
    colors: {
      accent: '#374151', headerBg: '#F9FAFB', headerText: '#111827',
      tableBorderColor: '#E5E7EB', tableHeaderBg: '#F3F4F6', tableHeaderText: '#374151',
    },
  },

  A5_PROFESSIONAL: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 40, headerStyle: 'side-by-side',
      itemTableStyle: 'striped', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'inter', fontSize: 'small', headerFontSize: 'medium' },
    colors: {
      accent: '#0D9488', headerBg: '#F0FDFA', headerText: '#134E4A',
      tableBorderColor: '#99F6E4', tableHeaderBg: '#F0FDFA', tableHeaderText: '#134E4A',
    },
    fields: {
      businessGstin: false, businessPan: false, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: false, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: false, termsAndConditions: false, notes: false,
      totalInWords: true, qrCode: false, watermark: false,
    },
  },

  A4_LETTERHEAD: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 70, headerStyle: 'side-by-side',
      itemTableStyle: 'striped', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'roboto', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#1E40AF', headerBg: '#1E40AF', headerText: '#FFFFFF',
      tableBorderColor: '#BFDBFE', tableHeaderBg: '#EFF6FF', tableHeaderText: '#1E3A8A',
    },
    fields: {
      businessGstin: true, businessPan: true, businessPhone: true, businessEmail: true,
      businessAddress: true, customerGstin: false, customerPhone: true, customerAddress: true,
      shippingAddress: false, placeOfSupply: false, invoiceNumber: true, invoiceDate: true,
      dueDate: true, poNumber: false, vehicleNumber: false, transportDetails: false,
      bankDetails: true, signature: true, termsAndConditions: true, notes: true,
      totalInWords: true, qrCode: false, watermark: false,
    },
  },

  A4_TWO_COLUMN: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'left',
    },
    typography: { fontFamily: 'inter', fontSize: 'medium', headerFontSize: 'medium' },
    colors: {
      accent: '#0F766E', headerBg: '#FFFFFF', headerText: '#0F766E',
      tableBorderColor: '#99F6E4', tableHeaderBg: '#F0FDFA', tableHeaderText: '#134E4A',
    },
  },

  A4_COLORFUL: {
    layout: {
      logoPosition: 'center', logoMaxHeight: 60, headerStyle: 'stacked',
      itemTableStyle: 'striped', summaryPosition: 'center', signaturePosition: 'center',
    },
    typography: { fontFamily: 'poppins', fontSize: 'medium', headerFontSize: 'large' },
    colors: {
      accent: '#D946EF', headerBg: '#FDF4FF', headerText: '#A21CAF',
      tableBorderColor: '#F0ABFC', tableHeaderBg: '#FAE8FF', tableHeaderText: '#86198F',
    },
    footerText: 'We appreciate your business!',
  },

  A4_DARK: {
    layout: {
      logoPosition: 'left', logoMaxHeight: 50, headerStyle: 'side-by-side',
      itemTableStyle: 'bordered', summaryPosition: 'right', signaturePosition: 'right',
    },
    typography: { fontFamily: 'inter', fontSize: 'medium', headerFontSize: 'medium' },
    colors: {
      accent: '#FFFFFF', headerBg: '#18181B', headerText: '#FAFAFA',
      tableBorderColor: '#3F3F46', tableHeaderBg: '#27272A', tableHeaderText: '#E4E4E7',
    },
  },
}
