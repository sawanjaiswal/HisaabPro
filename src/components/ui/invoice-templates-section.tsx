/** Invoice Templates Section — showcases real HisaabPro templates (28 base templates) */

import { useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import {
  EASE_OUT, TEMPLATES, MORE_TEMPLATES, HIGHLIGHTS,
  FileText, Sparkles,
} from './invoice-templates-section.data'
import type { TemplateData } from './invoice-templates-section.data'
import { TemplatePreviewModal } from './invoice-templates-section-modal'

/* ─── Main Section ─── */
export function InvoiceTemplatesSection() {
  const reducedMotion = useReducedMotion()
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateData | null>(null)

  const fade = (delay: number, y = 25) => ({
    initial: reducedMotion ? false : ({ opacity: 0, y } as const),
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: { once: true, amount: 0.15 as const },
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
              viewport={{ once: true, amount: 0.15 }}
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
              onPointerEnter={e => {
                e.currentTarget.style.borderColor = tpl.accent
                e.currentTarget.style.boxShadow = `0 8px 24px ${tpl.accent}22`
              }}
              onPointerLeave={e => {
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
                      <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{tpl.business.name}</span>
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
                    <p style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{tpl.business.name}</p>
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
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700 }}>{tpl.business.name}</span>
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
                <span style={{ color: 'var(--lp-text-muted)', fontSize: 'var(--fs-xs)' }}>
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
              viewport={{ once: true, amount: 0.15 }}
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
