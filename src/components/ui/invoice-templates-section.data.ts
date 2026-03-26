/** Invoice Templates Section — data, types, and constants */

import { FileText, Palette, Printer, Globe, Shield, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export { FileText, Sparkles }

export const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

/* ─── Per-template preview data ─── */
export interface TemplateData {
  name: string
  desc: string
  accent: string
  headerStyle: 'side-by-side' | 'stacked' | 'minimal'
  hasGst: boolean
  tableStyle: 'bordered' | 'striped' | 'minimal'
  /* Preview-specific data */
  business: { name: string; tagline?: string; address: string; phone: string; gstin?: string }
  customer: { name: string; address: string; gstin?: string }
  invoiceNo: string
  items: { name: string; hsn?: string; qty: number; unit: string; rate: number; amount: number }[]
  headerBg?: string
  headerTextColor?: string
  fontStyle?: 'serif' | 'sans'
  showSignature?: boolean
  showStamp?: boolean
  footerNote: string
}

export const TEMPLATES: TemplateData[] = [
  {
    name: 'GST Standard',
    desc: 'GSTIN, HSN codes, tax breakdowns',
    accent: '#3b82f6',
    headerStyle: 'side-by-side',
    hasGst: true,
    tableStyle: 'bordered',
    business: { name: 'Sharma Electronics', address: 'Lajpat Nagar, New Delhi - 110024', phone: '98765 43210', gstin: '07AABCS1429B1ZS' },
    customer: { name: 'Gupta Traders', address: 'Sadar Bazaar, Delhi - 110006', gstin: '07AABCG8765D1ZT' },
    invoiceNo: 'INV-1042',
    items: [
      { name: 'LED Panel Light 18W', hsn: '9405', qty: 20, unit: 'Pcs', rate: 400, amount: 8000 },
      { name: 'MCB Switch 32A', hsn: '8536', qty: 15, unit: 'Pcs', rate: 150, amount: 2250 },
      { name: 'Ceiling Fan Capacitor', hsn: '8532', qty: 50, unit: 'Pcs', rate: 70, amount: 3500 },
      { name: 'PVC Pipe 1"', hsn: '3917', qty: 25, unit: 'Mtr', rate: 150, amount: 3750 },
    ],
    showStamp: true,
    footerNote: 'E&OE. Subject to Delhi jurisdiction.',
  },
  {
    name: 'Elegant',
    desc: 'Serif headers, gold accent, premium feel',
    accent: '#8b5cf6',
    headerStyle: 'stacked',
    hasGst: false,
    tableStyle: 'minimal',
    business: { name: 'Kavita Joshi Boutique', tagline: 'Designer Wear & Accessories', address: 'MG Road, Pune - 411001', phone: '90123 45678' },
    customer: { name: 'Mrs. Anjali Deshmukh', address: 'Koregaon Park, Pune' },
    invoiceNo: 'KJB-0389',
    items: [
      { name: 'Silk Saree - Banarasi Weave', qty: 1, unit: 'Pc', rate: 12500, amount: 12500 },
      { name: 'Embroidered Kurti Set', qty: 2, unit: 'Set', rate: 3200, amount: 6400 },
      { name: 'Handcrafted Clutch Bag', qty: 1, unit: 'Pc', rate: 1800, amount: 1800 },
    ],
    fontStyle: 'serif',
    showSignature: true,
    footerNote: 'Thank you for shopping with us!',
  },
  {
    name: 'Kirana Store',
    desc: 'Optimized for daily retail billing',
    accent: '#14b8a6',
    headerStyle: 'minimal',
    hasGst: false,
    tableStyle: 'striped',
    business: { name: 'Balaji General Store', address: 'Main Market, Indore', phone: '87654 32109' },
    customer: { name: 'Walk-in Customer', address: '' },
    invoiceNo: 'BILL-4521',
    items: [
      { name: 'Toor Dal 1kg', qty: 2, unit: 'Pkt', rate: 185, amount: 370 },
      { name: 'Aashirvaad Atta 5kg', qty: 1, unit: 'Bag', rate: 295, amount: 295 },
      { name: 'Amul Butter 500g', qty: 1, unit: 'Pc', rate: 270, amount: 270 },
      { name: 'Sugar 1kg', qty: 3, unit: 'Pkt', rate: 48, amount: 144 },
      { name: 'Surf Excel 1kg', qty: 1, unit: 'Pkt', rate: 220, amount: 220 },
      { name: 'Parle-G Biscuit', qty: 5, unit: 'Pkt', rate: 10, amount: 50 },
    ],
    footerNote: 'Goods once sold will not be taken back.',
  },
  {
    name: 'Bold',
    desc: 'Large headers, strong colors, high-impact',
    accent: '#f97316',
    headerStyle: 'side-by-side',
    hasGst: true,
    tableStyle: 'bordered',
    headerBg: '#f97316',
    headerTextColor: '#ffffff',
    business: { name: 'Singh Enterprises', address: 'Industrial Area, Ludhiana - 141003', phone: '76543 21098', gstin: '03BPSFS4231K1ZJ' },
    customer: { name: 'Punjab Hardware Co.', address: 'GT Road, Jalandhar', gstin: '03AABCH9012E1ZV' },
    invoiceNo: 'SE-2026-178',
    items: [
      { name: 'MS Pipe 2" (6m)', hsn: '7306', qty: 100, unit: 'Pcs', rate: 850, amount: 85000 },
      { name: 'GI Sheet 22 Gauge', hsn: '7210', qty: 50, unit: 'Sht', rate: 1200, amount: 60000 },
      { name: 'TMT Bar 12mm', hsn: '7214', qty: 200, unit: 'Kg', rate: 65, amount: 13000 },
    ],
    showStamp: true,
    footerNote: 'Delivery within 3 working days. Transport charges extra.',
  },
]

/* More template names shown as tags */
export const MORE_TEMPLATES = [
  'A4 Classic', 'A4 Modern', 'A5 Compact', 'Corporate', 'Professional',
  'Creative', 'GST Detailed', 'Retail', 'Wholesale', 'Manufacturing',
  'Services', 'Freelancer', 'Medical', 'Restaurant', 'Transport',
  'Construction', '58mm Thermal', '80mm Thermal', 'Letterhead',
  'Two Column', 'Colorful', 'Dark', 'Minimal', 'A4 Detailed',
]

export interface Highlight {
  icon: LucideIcon
  title: string
  desc: string
}

export const HIGHLIGHTS: Highlight[] = [
  { icon: Palette, title: 'Your Brand, Your Invoice', desc: 'Add your logo, choose colors, pick a layout. Every bill looks like you hired a designer.' },
  { icon: Shield, title: 'GST Compliant', desc: 'GSTIN, HSN/SAC codes, tax breakdowns — all auto-calculated. File-ready for your CA.' },
  { icon: Printer, title: 'Thermal & A4 Print', desc: '58mm and 80mm thermal receipts for counter billing. A4 PDF for formal invoices.' },
  { icon: Globe, title: 'Multi-Language', desc: 'Invoices in English and Hindi. Your customers read their bill in the language they prefer.' },
]
