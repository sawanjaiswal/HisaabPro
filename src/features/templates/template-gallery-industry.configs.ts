/** Template Gallery — Industry + Compact & Special config overrides
 *
 * Extracted from template-gallery.configs.ts to keep files under limit.
 */

import type { BaseTemplate, DeepPartial, TemplateConfig } from './template.types'

export const INDUSTRY_AND_SPECIAL_CONFIGS: Partial<Record<BaseTemplate, DeepPartial<TemplateConfig>>> = {

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
