/** Invoice Template Preview Modal — full-size preview of a template */

import { useEffect, useCallback } from 'react'
import { motion } from 'motion/react'
import { FileText, X } from 'lucide-react'
import type { TemplateData } from './invoice-templates-section.data'
import { EASE_OUT } from './invoice-templates-section.data'

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
