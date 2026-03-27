/** Invoice Template Preview Modal — full-size preview of a template */
import { useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { FileText, X } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import type { TemplateData } from './invoice-templates-section.data'
import { EASE_OUT } from './invoice-templates-section.data'

/* Document-rendering color constants (not design tokens — only used in this file) */
const DOC_COLORS = {
  TEXT_PRIMARY: '#111827', TEXT_BODY: '#374151', TEXT_MUTED: '#6b7280',
  TEXT_LIGHT: '#9ca3af', TEXT_FAINT: '#d1d5db', TEXT_WHITE: '#fff',
  BG_WHITE: '#ffffff', BG_SUBTLE: '#fafafa', BG_STRIPE: '#f9fafb', BG_TABLE_HEADER: '#f3f4f6',
  BORDER: '#e5e7eb', BORDER_SIGNATURE: '#d1d5db',
  STAMP_GREEN: '#059669', WATERMARK: '#e5e7eb',
} as const

export function TemplatePreviewModal({ template: t, onClose }: { template: TemplateData; onClose: () => void }) {
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
          backgroundColor: DOC_COLORS.BG_WHITE,
          color: DOC_COLORS.TEXT_PRIMARY,
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
            color: t.headerBg ? DOC_COLORS.TEXT_WHITE : DOC_COLORS.TEXT_PRIMARY,
          }}
          onPointerEnter={e => e.currentTarget.style.backgroundColor = t.headerBg ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)'}
          onPointerLeave={e => e.currentTarget.style.backgroundColor = t.headerBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)'}
          aria-label="Close preview"
        >
          <X size={16} />
        </button>
        {/* PAID stamp overlay */}
        {t.showStamp && (
          <div
            className="absolute top-20 right-8 rotate-[-15deg] px-4 py-1 rounded-md border-2 font-bold tracking-widest opacity-20 pointer-events-none"
            style={{ color: DOC_COLORS.STAMP_GREEN, borderColor: DOC_COLORS.STAMP_GREEN, fontSize: '1.5rem' }}
          >
            PAID
          </div>
        )}
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
        {/* STANDARD: Side-by-side with accent bar */}
        {!t.headerBg && t.headerStyle === 'side-by-side' && (
          <>
            <div className="h-1.5 w-full rounded-t-xl" style={{ backgroundColor: t.accent }} />
            <div className="px-6 py-5 flex items-start justify-between" style={{ borderBottom: `1px solid ${DOC_COLORS.BORDER}` }}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: t.accent }}>
                    <FileText size={16} className="text-white" />
                  </div>
                  <span className="text-base font-bold">{t.business.name}</span>
                </div>
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>{t.business.address}</p>
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>Ph: {t.business.phone}</p>
                {t.business.gstin && <p className="text-xs font-medium mt-1" style={{ color: t.accent }}>GSTIN: {t.business.gstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm font-bold" style={{ color: t.accent }}>TAX INVOICE</p>
                <p className="text-xs mt-1" style={{ color: DOC_COLORS.TEXT_MUTED }}>{t.invoiceNo}</p>
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>20 Mar 2026</p>
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>Due: 19 Apr 2026</p>
              </div>
            </div>
          </>
        )}
        {/* ELEGANT: Centered serif with decorative divider */}
        {t.headerStyle === 'stacked' && !t.headerBg && (
          <>
            <div className="h-1 w-full rounded-t-xl" style={{ backgroundColor: t.accent }} />
            <div className="px-6 pt-6 pb-4 text-center" style={{ borderBottom: `1px solid ${DOC_COLORS.BORDER}` }}>
              <p className="text-xl font-bold tracking-tight" style={{ fontFamily: 'Georgia, serif' }}>{t.business.name}</p>
              {t.business.tagline && (
                <p className="text-xs italic mt-0.5" style={{ color: t.accent }}>{t.business.tagline}</p>
              )}
              <p className="text-xs mt-1" style={{ color: DOC_COLORS.TEXT_LIGHT }}>{t.business.address} | {t.business.phone}</p>
              {/* Decorative divider */}
              <div className="flex items-center justify-center gap-3 mt-4">
                <div className="h-px flex-1" style={{ backgroundColor: DOC_COLORS.BORDER }} />
                <span className="text-xs font-semibold tracking-widest" style={{ color: t.accent }}>INVOICE</span>
                <div className="h-px flex-1" style={{ backgroundColor: DOC_COLORS.BORDER }} />
              </div>
              <p className="text-xs mt-2" style={{ color: DOC_COLORS.TEXT_LIGHT }}>{t.invoiceNo} | 20 Mar 2026</p>
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
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_LIGHT }}>{t.business.address} | {t.business.phone}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold" style={{ color: t.accent }}>{t.invoiceNo}</span>
                <p className="text-xs" style={{ color: DOC_COLORS.TEXT_LIGHT }}>20 Mar 2026</p>
              </div>
            </div>
          </>
        )}
        {/* Bill To */}
        <div className="px-6 py-3" style={{ borderBottom: `1px solid ${DOC_COLORS.BORDER}`, backgroundColor: t.headerStyle === 'stacked' ? DOC_COLORS.BG_WHITE : DOC_COLORS.BG_SUBTLE }}>
          <p className="text-xs font-semibold mb-1" style={{ color: DOC_COLORS.TEXT_LIGHT, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.625rem' }}>Bill To</p>
          <p className="text-sm font-medium">{t.customer.name}</p>
          {t.customer.address && <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>{t.customer.address}</p>}
          {t.customer.gstin && <p className="text-xs" style={{ color: DOC_COLORS.TEXT_MUTED }}>GSTIN: {t.customer.gstin}</p>}
        </div>
        {/* Line Items */}
        <div className="px-6 py-3">
          <table className="w-full" style={{ fontSize: '0.75rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{
                backgroundColor: t.tableStyle === 'minimal' ? 'transparent' : t.tableStyle === 'bordered' ? DOC_COLORS.BG_TABLE_HEADER : 'transparent',
                borderBottom: t.tableStyle === 'minimal' ? `1px solid ${DOC_COLORS.BORDER}` : `2px solid ${t.accent}`,
              }}>
                <th className="text-left py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>#</th>
                <th className="text-left py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>Item</th>
                {t.hasGst && <th className="text-left py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>HSN</th>}
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>Qty</th>
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>Rate</th>
                <th className="text-right py-2 px-1.5 font-semibold" style={{ color: DOC_COLORS.TEXT_BODY }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {t.items.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: t.tableStyle === 'bordered' ? `1px solid ${DOC_COLORS.BORDER}` : 'none',
                    backgroundColor: t.tableStyle === 'striped' && idx % 2 === 0 ? DOC_COLORS.BG_STRIPE : 'transparent',
                  }}
                >
                  <td className="py-2 px-1.5" style={{ color: DOC_COLORS.TEXT_LIGHT }}>{idx + 1}</td>
                  <td className="py-2 px-1.5">{item.name}</td>
                  {t.hasGst && <td className="py-2 px-1.5" style={{ color: DOC_COLORS.TEXT_LIGHT }}>{item.hsn}</td>}
                  <td className="py-2 px-1.5 text-right">{item.qty} {item.unit}</td>
                  <td className="py-2 px-1.5 text-right">₹{item.rate.toLocaleString('en-IN')}</td>
                  <td className="py-2 px-1.5 text-right font-medium">₹{item.amount.toLocaleString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Totals */}
        <div className="px-6 py-3" style={{ borderTop: `1px solid ${DOC_COLORS.BORDER}` }}>
          <div className="flex flex-col items-end gap-1" style={{ fontSize: '0.8125rem' }}>
            <div className="flex justify-between w-40 sm:w-48">
              <span style={{ color: DOC_COLORS.TEXT_LIGHT }}>Subtotal</span>
              <span style={{ fontWeight: 500 }}>₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            {t.hasGst && (
              <>
                <div className="flex justify-between w-40 sm:w-48">
                  <span style={{ color: DOC_COLORS.TEXT_LIGHT }}>CGST (9%)</span>
                  <span style={{ fontWeight: 500 }}>₹{Math.round(taxAmount / 2).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between w-40 sm:w-48">
                  <span style={{ color: DOC_COLORS.TEXT_LIGHT }}>SGST (9%)</span>
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
        {/* Signature (Elegant only) */}
        {t.showSignature && (
          <div className="px-6 py-3 flex justify-end" style={{ borderTop: `1px solid ${DOC_COLORS.BORDER}` }}>
            <div className="text-center">
              <div className="w-32 border-b mb-1" style={{ borderColor: DOC_COLORS.BORDER_SIGNATURE, height: 30 }} />
              <p className="text-xs" style={{ color: DOC_COLORS.TEXT_LIGHT }}>Authorized Signature</p>
            </div>
          </div>
        )}
        {/* Footer */}
        <div className="px-6 py-3 rounded-b-xl" style={{ borderTop: `1px solid ${DOC_COLORS.BORDER}`, backgroundColor: DOC_COLORS.BG_SUBTLE }}>
          <p className="text-xs" style={{ color: DOC_COLORS.TEXT_FAINT }}>{t.footerNote}</p>
          <p className="text-center text-xs mt-2" style={{ color: DOC_COLORS.WATERMARK }}>Generated with {APP_NAME}</p>
        </div>
      </motion.div>
    </motion.div>
  )
}
