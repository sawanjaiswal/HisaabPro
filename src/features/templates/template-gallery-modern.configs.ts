/** Template Gallery — Modern + Indian Business config overrides
 *
 * Extracted from template-gallery.configs.ts to keep files under limit.
 */

import type { BaseTemplate, DeepPartial, TemplateConfig } from './template.types'

export const MODERN_AND_INDIAN_CONFIGS: Partial<Record<BaseTemplate, DeepPartial<TemplateConfig>>> = {

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
    footerText: '\u0927\u0928\u094D\u092F\u0935\u093E\u0926! \u092B\u093F\u0930 \u0938\u0947 \u092A\u0927\u093E\u0930\u0947\u0902\u0964',
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
}
