/** Invoice Templates Section — showcases real HisaabPro templates (28 base templates) */

import { motion, useReducedMotion } from 'motion/react'
import { FileText, Palette, Printer, Globe, Shield, Sparkles } from 'lucide-react'

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

/* 4 featured templates from the real template system (28 total) */
const TEMPLATES = [
  {
    name: 'GST Standard',
    desc: 'GSTIN, HSN codes, tax breakdowns',
    accent: 'var(--lp-accent)',
    headerStyle: 'side-by-side' as const,
    hasGst: true,
    tableStyle: 'bordered' as const,
  },
  {
    name: 'Elegant',
    desc: 'Serif headers, gold accent, premium feel',
    accent: '#8b5cf6',
    headerStyle: 'stacked' as const,
    hasGst: false,
    tableStyle: 'minimal' as const,
  },
  {
    name: 'Kirana Store',
    desc: 'Optimized for daily retail billing',
    accent: '#14b8a6',
    headerStyle: 'minimal' as const,
    hasGst: false,
    tableStyle: 'striped' as const,
  },
  {
    name: 'Bold',
    desc: 'Large headers, strong colors, high-impact',
    accent: '#f97316',
    headerStyle: 'side-by-side' as const,
    hasGst: true,
    tableStyle: 'bordered' as const,
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

export function InvoiceTemplatesSection() {
  const reducedMotion = useReducedMotion()

  const fade = (delay: number, y = 25) => ({
    initial: reducedMotion ? false : ({ opacity: 0, y } as const),
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: { once: true, margin: '-80px' as const },
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
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.08, ease: EASE_OUT }}
              className="group rounded-xl border overflow-hidden cursor-pointer"
              style={{
                borderColor: 'var(--lp-card-border)',
                backgroundColor: 'var(--lp-bg-card)',
              }}
            >
              {/* Template header bar */}
              <div className="h-1.5 w-full" style={{ backgroundColor: tpl.accent }} />

              {/* Mini invoice preview */}
              <div className="p-4">
                {/* Logo + name */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: tpl.accent }}
                    >
                      <FileText size={10} className="text-white" />
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--lp-text)', fontSize: '0.6875rem' }}>
                      {tpl.name}
                    </span>
                  </div>
                  {tpl.hasGst && (
                    <span
                      className="px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        fontSize: '0.5rem',
                        backgroundColor: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)',
                        color: 'var(--lp-mock-success)',
                      }}
                    >
                      GST
                    </span>
                  )}
                </div>

                {/* Header style preview */}
                <div className="mb-3">
                  {tpl.headerStyle === 'side-by-side' && (
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <div className="h-1.5 rounded-full mb-1" style={{ backgroundColor: tpl.accent, width: '60%' }} />
                        <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: '80%' }} />
                      </div>
                      <div className="text-right">
                        <div className="h-1 rounded-full mb-1 ml-auto" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: 40 }} />
                        <div className="h-1 rounded-full ml-auto" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: 30 }} />
                      </div>
                    </div>
                  )}
                  {tpl.headerStyle === 'stacked' && (
                    <div className="text-center">
                      <div className="h-1.5 rounded-full mx-auto mb-1" style={{ backgroundColor: tpl.accent, width: '40%' }} />
                      <div className="h-1 rounded-full mx-auto" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: '60%' }} />
                    </div>
                  )}
                  {tpl.headerStyle === 'minimal' && (
                    <div>
                      <div className="h-1.5 rounded-full mb-1" style={{ backgroundColor: tpl.accent, width: '35%' }} />
                    </div>
                  )}
                </div>

                {/* Table style preview */}
                <div
                  className="space-y-0 rounded overflow-hidden"
                  style={{
                    border: tpl.tableStyle === 'bordered' ? '1px solid var(--lp-bg-elevated)' : 'none',
                  }}
                >
                  {[100, 85, 70, 55].map((w, j) => (
                    <div
                      key={j}
                      className="flex gap-2 py-1 px-1.5"
                      style={{
                        backgroundColor: tpl.tableStyle === 'striped' && j % 2 === 0
                          ? 'color-mix(in srgb, var(--lp-bg-elevated) 50%, transparent)'
                          : 'transparent',
                        borderBottom: tpl.tableStyle === 'bordered' ? '1px solid var(--lp-bg-elevated)' : 'none',
                      }}
                    >
                      <div className="h-1 rounded-full flex-1" style={{ backgroundColor: 'var(--lp-bg-elevated)', maxWidth: `${w}%` }} />
                      <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: 20 }} />
                    </div>
                  ))}
                </div>

                {/* Total bar */}
                <div className="mt-2 flex justify-between items-center">
                  <div className="h-1 rounded-full" style={{ backgroundColor: 'var(--lp-bg-elevated)', width: 30 }} />
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: tpl.accent, width: 40 }} />
                </div>
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
              viewport={{ once: true, margin: '-60px' }}
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
    </section>
  )
}
