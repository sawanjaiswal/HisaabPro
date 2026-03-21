/** Invoice Templates Section — showcases real HisaabPro templates (28 base templates) */

import { useState, useEffect, useCallback } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { FileText, Palette, Printer, Globe, Shield, Sparkles, X } from 'lucide-react'

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

/* ─── Per-template preview data ─── */
interface TemplateData {
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
  headerBg?: string       // full-width colored header
  headerTextColor?: string
  fontStyle?: 'serif' | 'sans'
  showSignature?: boolean
  showStamp?: boolean
  footerNote: string
}

const TEMPLATES: TemplateData[] = [
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
const MORE_TEMPLATES = [
  'A4 Classic', 'A4 Modern', 'A5 Compact', 'Corporate', 'Professional',
  'Creative', 'GST Detailed', 'Retail', 'Wholesale', 'Manufacturing',
  'Services', 'Freelancer', 'Medical', 'Restaurant', 'Transport',
  'Construction', '58mm Thermal', '80mm Thermal', 'Letterhead',
  'Two Column', 'Colorful', 'Dark', 'Minimal', 'A4 Detailed',
]

const HIGHLIGHTS = [
  { icon: Palette, title: 'Your Brand, Your Invoice', desc: 'Add your logo, choose colors, pick a layout. Every bill looks like you hired a designer.' },
  { icon: Shield, title: 'GST Compliant', desc: 'GSTIN, HSN/SAC codes, tax breakdowns — all auto-calculated. File-ready for your CA.' },
  { icon: Printer, title: 'Thermal & A4 Print', desc: '58mm and 80mm thermal receipts for counter billing. A4 PDF for formal invoices.' },
  { icon: Globe, title: 'Multi-Language', desc: 'Invoices in English and Hindi. Your customers read their bill in the language they prefer.' },
]

/* ─── Template Preview Modal ─── */
function TemplatePreviewModal({ template: t, onClose }: { template: TemplateData; onClose: () => void }) {
  const subtotal = t.items.reduce((s, item) => s + item.amount, 0)
  const taxAmount = t.hasGst ? Math.round(subtotal * 0.18) : 0
  const total = subtotal + taxAmount
  const isSerif = t.fontStyle === 'serif'

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const border = '#e5e7eb'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${t.name} template preview`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{
          backgroundColor: '#ffffff',
          color: '#111827',
          fontFamily: isSerif ? 'Georgia, "Times New Roman", serif' : 'Inter, system-ui, sans-serif',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
          style={{
            backgroundColor: t.headerBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
            color: t.headerBg ? '#fff' : '#111827',
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = t.headerBg ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = t.headerBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)'}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>

        {/* PAID stamp overlay */}
        {t.showStamp && (
          <div
            className="absolute top-20 right-8 rotate-[-15deg] px-4 py-1 rounded-md border-2 font-bold tracking-widest opacity-20 pointer-events-none"
            style={{ color: '#059669', borderColor: '#059669', fontSize: '1.5rem' }}
          >
            PAID
          </div>
        )}

        {/* ─── HEADER — each style is visually unique ─── */}

        {/* BOLD: Full-width colored header */}
        {t.headerBg && (
          <div className="rounded-t-xl px-6 py-6" style={{ backgroundColor: t.headerBg, color: t.headerTextColor }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xl font-extrabold tracking-tight">{t.business.name}</p>
                <p className="text-xs mt-0.5 opacity-80">{t.business.address}</p>
                <p className="text-xs opacity-80">Ph: {t.business.phone}</p>
                {t.business.gstin && <p className="text-xs font-semibold mt-1 opacity-90">GSTIN: {t.business.gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-lg font-black tracking-wider">TAX INVOICE</p>
                <p className="text-xs mt-1 opacity-80">{t.invoiceNo}</p>
                <p className="text-xs opacity-80">20 Mar 2026</p>
              </div>
            </div>
          </div>
        )}

        {/* GST STANDARD: Side-by-side with accent bar */}
        {!t.headerBg && t.headerStyle === 'side-by-side' && (
          <>
            <div className="h-1.5 w-full rounded-t-xl" style={{ backgroundColor: t.accent }} />
            <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: `1px solid ${border}` }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: t.accent }}>
                    <FileText size={16} className="text-white" />
                  </div>
                  <span className="text-base font-bold">{t.business.name}</span>
                </div>
                <p className="text-xs" style={{ color: '#6b7280' }}>{t.business.address}</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>Ph: {t.business.phone}</p>
                {t.business.gstin && <p className="text-xs font-medium mt-1" style={{ color: t.accent }}>GSTIN: {t.business.gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: t.accent }}>TAX INVOICE</p>
                <p className="text-xs mt-1" style={{ color: '#6b7280' }}>{t.invoiceNo}</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>20 Mar 2026</p>
                <p className="text-xs" style={{ color: '#6b7280' }}>Due: 19 Apr 2026</p>
              </div>
            </div>
          </>
        )}

        {/* ELEGANT: Centered, serif, decorative divider */}
        {t.headerStyle === 'stacked' && !t.headerBg && (
          <>
            <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: t.accent }} />
            <div className="px-6 pt-6 pb-4 text-center" style={{ borderBottom: `1px solid ${border}` }}>
              <p className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>{t.business.name}</p>
              {t.business.tagline && (
                <p className="text-xs italic mt-0.5" style={{ color: t.accent }}>{t.business.tagline}</p>
              )}
              <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>{t.business.address} | {t.business.phone}</p>
              {/* Decorative divider */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-px flex-1" style={{ backgroundColor: border }} />
                <span className="text-xs font-semibold tracking-widest" style={{ color: t.accent }}>INVOICE</span>
                <div className="h-px flex-1" style={{ backgroundColor: border }} />
              </div>
              <p className="text-xs mt-2" style={{ color: '#9ca3af' }}>{t.invoiceNo} | 20 Mar 2026</p>
            </div>
          </>
        )}

        {/* KIRANA: Minimal compact header */}
        {t.headerStyle === 'minimal' && !t.headerBg && (
          <>
            <div className="h-1.5 w-full rounded-t-xl" style={{ backgroundColor: t.accent }} />
            <div className="px-6 py-3 flex items-center justify-between" style={{ borderBottom: `2px solid ${t.accent}` }}>
              <div>
                <span className="text-sm font-bold">{t.business.name}</span>
                <p className="text-xs" style={{ color: '#9ca3af' }}>{t.business.address} | {t.business.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold" style={{ color: t.accent }}>{t.invoiceNo}</span>
                <p className="text-xs" style={{ color: '#9ca3af' }}>20 Mar 2026</p>
              </div>
            </div>
          </>
        )}

        {/* ─── BILL TO ─── */}
        <div className="px-6 py-3" style={{ borderBottom: `1px solid ${border}`, backgroundColor: t.headerStyle === 'stacked' ? '#ffffff' : '#fafafa' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.625rem' }}>Bill To</p>
          <p className="text-sm font-medium">{t.customer.name}</p>
          {t.customer.address && <p className="text-xs" style={{ color: '#6b7280' }}>{t.customer.address}</p>}
          {t.customer.gstin && <p className="text-xs" style={{ color: '#6b7280' }}>GSTIN: {t.customer.gstin}</p>}
        </div>

        {/* ─── LINE ITEMS TABLE ─── */}
        <div className="px-6 py-3">
          <table className="w-full" style={{ fontSize: '0.75rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                backgroundColor: t.tableStyle === 'minimal' ? 'transparent' : t.tableStyle === 'bordered' ? '#f3f4f6' : 'transparent',
                borderBottom: t.tableStyle === 'minimal' ? `1px solid ${border}` : `2px solid ${t.accent}`,
              }}>
                <th className="text-left py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>#</th>
                <th className="text-left py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>Item</th>
                {t.hasGst && <th className="text-left py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>HSN</th>}
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>Qty</th>
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>Rate</th>
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: '#374151' }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: t.tableStyle === 'bordered' ? `1px solid ${border}` : 'none',
                    backgroundColor: t.tableStyle === 'striped' && idx % 2 === 0 ? '#f9fafb' : 'transparent',
                  }}
                >
                  <td className="py-2 px-1.5" style={{ color: '#9ca3af' }}>{idx + 1}</td>
                  <td className="py-2 px-1.5">{item.name}</td>
                  {t.hasGst && <td className="py-2 px-1.5" style={{ color: '#9ca3af' }}>{item.hsn}</td>}
                  <td className="py-2 px-1.5 text-right">{item.qty} {item.unit}</td>
                  <td className="py-2 px-1.5 text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-1.5 text-right font-medium">₹{item.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ─── TOTALS ─── */}
        <div className="px-6 py-3" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex flex-col items-end gap-1" style={{ fontSize: '0.8125rem' }}>
            <div className="flex justify-between w-40 sm:w-48">
              <span style={{ color: '#9ca3af' }}>Subtotal</span>
              <span style={{ fontWeight: 500 }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {t.hasGst && (
              <>
                <div className="flex justify-between w-40 sm:w-48">
                  <span style={{ color: '#9ca3af' }}>CGST (9%)</span>
                  <span style={{ fontWeight: 500 }}>₹{Math.round(taxAmount / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between w-40 sm:w-48">
                  <span style={{ color: '#9ca3af' }}>SGST (9%)</span>
                  <span style={{ fontWeight: 500 }}>₹{Math.round(taxAmount / 2).toLocaleString('en-IN')}</span>
                </div>
              </>
            )}
            <div className="flex justify-between w-48 pt-1.5 mt-1" style={{ borderTop: `2px solid ${t.accent}` }}>
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ color: t.accent, fontWeight: 700, fontSize: '1rem' }}>₹{total.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* ─── SIGNATURE (Elegant only) ─── */}
        {t.showSignature && (
          <div className="px-6 py-3 flex justify-end" style={{ borderTop: `1px solid ${border}` }}>
            <div className="text-center">
              <div className="w-32 border-b mb-1" style={{ borderColor: '#d1d5db', height: 30 }} />
              <p className="text-xs" style={{ color: '#9ca3af' }}>Authorized Signature</p>
            </div>
          </div>
        )}

        {/* ─── FOOTER ─── */}
        <div className="px-6 py-3 rounded-b-xl" style={{ borderTop: `1px solid ${border}`, backgroundColor: '#fafafa' }}>
          <p className="text-xs" style={{ color: '#d1d5db' }}>{t.footerNote}</p>
          <p className="text-center text-xs mt-2" style={{ color: '#e5e7eb' }}>Generated with HisaabPro</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ─── Main Section ─── */
export function InvoiceTemplatesSection() {
  const reducedMotion = useReducedMotion()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null)

  const fade = (delay: number, y = 25) => ({
    initial: reducedMotion ? false : ({ opacity: 0, y } as const),
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: { once: true, margin: '-20px' as const },
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  })

  return (
    <section className="py-16 md:py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div {...fade(0)} className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--lp-accent) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--lp-accent) 20%, transparent)',
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--lp-accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--lp-accent)' }}>
              28 invoice templates
            </span>
          </div>
          <h2 className="text-4xl font-semibold lg:text-5xl mb-4">
            Professional invoices, your way
          </h2>
          <p className="text-base lg:text-lg lp-text-muted max-w-2xl mx-auto">
            28 templates for every Indian business — GST Standard, Kirana Store, Wholesale,
            Freelancer, Medical, and more. Add your logo, pick your colors.
          </p>
        </motion.div>

        {/* Template previews — 4 featured */}
        <motion.div {...fade(0.15)} className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
          {TEMPLATES.map((tpl, i) => (
            <motion.div
              key={tpl.name}
              initial={reducedMotion ? false : { opacity: 0, y: 20, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: EASE_OUT }}
              className="group rounded-xl border overflow-hidden cursor-pointer"
              style={{
                borderColor: 'var(--lp-card-border)',
                backgroundColor: 'var(--lp-bg-card)',
                transition: 'border-color 0.3s, box-shadow 0.3s',
              }}
              onClick={() => setSelectedTemplate(tpl)}
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = tpl.accent
                e.currentTarget.style.boxShadow = `0 8px 24px ${tpl.accent}22`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--lp-card-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Mini real invoice preview — white background like a real document */}
              <div className="p-3" style={{ backgroundColor: '#ffffff', color: '#111827', height: 220, overflow: 'hidden' }}>
                {/* Accent bar */}
                <div className="h-1 w-full rounded-full mb-2.5" style={{ backgroundColor: tpl.accent }} />

                {/* Header — varies by style */}
                {tpl.headerBg ? (
                  /* Bold: colored header block */
                  <div className="rounded px-2 py-1.5 mb-2" style={{ backgroundColor: tpl.headerBg, color: tpl.headerTextColor }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>{tpl.business.name}</span>
                      <span style={{ fontSize: '0.375rem', fontWeight: 700 }}>TAX INVOICE</span>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span style={{ fontSize: '0.3125rem', opacity: 0.8 }}>{tpl.business.address.split(',')[0]}</span>
                      <span style={{ fontSize: '0.3125rem', opacity: 0.8 }}>{tpl.invoiceNo}</span>
                    </div>
                  </div>
                ) : tpl.headerStyle === 'stacked' ? (
                  /* Elegant: centered */
                  <div className="text-center mb-2">
                    <p style={{ fontSize: '0.5rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{tpl.business.name}</p>
                    {tpl.business.tagline && <p style={{ fontSize: '0.3125rem', color: tpl.accent, fontStyle: 'italic' }}>{tpl.business.tagline}</p>}
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="h-px flex-1" style={{ backgroundColor: '#e5e7eb' }} />
                      <span style={{ fontSize: '0.3125rem', color: tpl.accent, fontWeight: 600, letterSpacing: '0.08em' }}>INVOICE</span>
                      <div className="h-px flex-1" style={{ backgroundColor: '#e5e7eb' }} />
                    </div>
                  </div>
                ) : tpl.headerStyle === 'minimal' ? (
                  /* Kirana: compact */
                  <div className="flex justify-between items-center mb-2 pb-1.5" style={{ borderBottom: `1px solid ${tpl.accent}` }}>
                    <span style={{ fontSize: '0.5rem', fontWeight: 700 }}>{tpl.business.name}</span>
                    <span style={{ fontSize: '0.3125rem', color: tpl.accent, fontWeight: 600 }}>{tpl.invoiceNo}</span>
                  </div>
                ) : (
                  /* GST Standard: side-by-side */
                  <div className="flex items-start justify-between mb-2 pb-1.5" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3.5 h-3.5 rounded flex items-center justify-center" style={{ backgroundColor: tpl.accent }}>
                        <FileText size={7} className="text-white" />
                      </div>
                      <div>
                        <p style={{ fontSize: '0.4375rem', fontWeight: 700 }}>{tpl.business.name}</p>
                        <p style={{ fontSize: '0.3125rem', color: '#9ca3af' }}>{tpl.business.address.split(',')[0]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p style={{ fontSize: '0.3125rem', color: tpl.accent, fontWeight: 600 }}>TAX INVOICE</p>
                      <p style={{ fontSize: '0.25rem', color: '#9ca3af' }}>{tpl.invoiceNo}</p>
                    </div>
                  </div>
                )}

                {/* Bill To */}
                <div className="mb-1.5">
                  <p style={{ fontSize: '0.25rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Bill To</p>
                  <p style={{ fontSize: '0.375rem', fontWeight: 500 }}>{tpl.customer.name}</p>
                </div>

                {/* Line items — real data */}
                <div
                  className="rounded overflow-hidden mb-1.5"
                  style={{ border: tpl.tableStyle === 'bordered' ? '1px solid #e5e7eb' : 'none' }}
                >
                  {/* Table header */}
                  <div
                    className="flex justify-between px-1 py-0.5"
                    style={{
                      fontSize: '0.25rem',
                      fontWeight: 600,
                      color: '#6b7280',
                      backgroundColor: tpl.tableStyle === 'bordered' ? '#f3f4f6' : 'transparent',
                      borderBottom: `1px solid ${tpl.tableStyle === 'minimal' ? '#e5e7eb' : tpl.accent}`,
                    }}
                  >
                    <span>Item</span>
                    <span>Amt</span>
                  </div>
                  {/* Rows */}
                  {tpl.items.slice(0, 4).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between px-1 py-0.5"
                      style={{
                        fontSize: '0.3125rem',
                        backgroundColor: tpl.tableStyle === 'striped' && idx % 2 === 0 ? '#f9fafb' : 'transparent',
                        borderBottom: tpl.tableStyle === 'bordered' ? '1px solid #f3f4f6' : 'none',
                      }}
                    >
                      <span style={{ color: '#374151' }}>{item.name.length > 22 ? item.name.slice(0, 22) + '...' : item.name}</span>
                      <span style={{ fontWeight: 500 }}>₹{item.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="flex justify-between items-center pt-1" style={{ borderTop: `1.5px solid ${tpl.accent}` }}>
                  <span style={{ fontSize: '0.3125rem', fontWeight: 600, color: '#6b7280' }}>Total</span>
                  <span style={{ fontSize: '0.4375rem', fontWeight: 700, color: tpl.accent }}>
                    ₹{tpl.items.reduce((s, item) => s + item.amount, 0).toLocaleString('en-IN')}
                  </span>
                </div>

                {tpl.hasGst && (
                  <div className="flex items-center gap-1 mt-1">
                    <span
                      className="px-1 py-0.5 rounded-sm"
                      style={{ fontSize: '0.25rem', fontWeight: 600, backgroundColor: '#f0fdf4', color: '#059669' }}
                    >
                      GST Included
                    </span>
                  </div>
                )}
              </div>

              {/* Template label + desc */}
              <div className="px-4 py-2.5 border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
                <span className="font-medium block" style={{ color: 'var(--lp-text)', fontSize: '0.6875rem' }}>
                  {tpl.name}
                </span>
                <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.5625rem' }}>
                  {tpl.desc}
                </span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* All template names as tags */}
        <motion.div {...fade(0.25)} className="flex flex-wrap justify-center gap-2 mb-16">
          {MORE_TEMPLATES.map((name) => (
            <span
              key={name}
              className="px-3 py-1 rounded-full text-xs font-medium border"
              style={{
                borderColor: 'var(--lp-card-border)',
                color: 'var(--lp-text-muted)',
                backgroundColor: 'var(--lp-bg-card)',
              }}
            >
              {name}
            </span>
          ))}
        </motion.div>

        {/* Feature highlights grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HIGHLIGHTS.map((h, i) => (
            <motion.div
              key={h.title}
              initial={reducedMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-20px' }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: EASE_OUT }}
              className="flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <h.icon className="size-5" style={{ color: 'var(--lp-brand)' }} />
                <p className="text-sm font-semibold lp-text">{h.title}</p>
              </div>
              <p className="text-sm lp-text-muted">{h.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Template Preview Modal */}
      <AnimatePresence>
        {selectedTemplate && (
          <TemplatePreviewModal
            template={selectedTemplate}
            onClose={() => setSelectedTemplate(null)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
