/**
 * Before/After Transformation Section
 *
 * Design: matches hero section's premium language —
 * gradient headings, badge pills, staggered motion, card elevation,
 * all --lp-* tokens, Poppins typography.
 */

import { useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { FileText, Wallet, Package, ArrowRight, AlertTriangle, CheckCircle } from 'lucide-react'

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

/* ─── Reusable reveal helper (matches hero's fade pattern) ─── */
function reveal(delay: number, y = 30) {
  return {
    initial: { opacity: 0, y } as const,
    whileInView: { opacity: 1, y: 0 } as const,
    viewport: { once: true, amount: 0.15 as const },
    transition: { duration: 0.6, delay, ease: EASE_OUT },
  }
}

/* ─── Tab data ─── */
interface TabData {
  id: string
  icon: typeof FileText
  label: string
  subtitle: string
  metric: { before: string; after: string; unit: string }
  painPoints: string[]
  gains: string[]
  beforeContent: React.ReactNode
  afterContent: React.ReactNode
}

/* ─── Before Photos (real photographs of manual bookkeeping) ─── */
function BeforePhoto({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div className="rounded-xl w-full h-full overflow-hidden relative" style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)', minHeight: 200 }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={800}
        height={450}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'sepia(0.15) saturate(0.6) brightness(0.8)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: 'var(--lp-before-icon)' }} className="shrink-0" />
        <span style={{ fontSize: '0.8125rem', color: 'var(--lp-text-body)', fontWeight: 500 }}>{caption}</span>
      </div>
    </div>
  )
}

function AfterInvoice() {
  return (
    <div className="rounded-xl w-full h-full overflow-hidden" style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}>
      <div className="h-1 w-full" style={{ background: 'var(--lp-accent)' }} />
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background: 'var(--lp-accent)' }}>
            <FileText size={12} className="text-white" />
          </div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--lp-text)' }}>INV-1042</span>
        </div>
        <span className="px-2 py-0.5 rounded-full" style={{ fontSize: '0.625rem', fontWeight: 600, background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)', color: 'var(--lp-mock-success)' }}>
          Paid
        </span>
      </div>
      <div className="px-5 py-2.5 border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <p style={{ color: 'var(--lp-text)', fontWeight: 500, fontSize: '0.8125rem' }}>Sharma Electronics</p>
        <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.6875rem' }}>Lajpat Nagar, New Delhi</p>
      </div>
      <div className="px-5 py-1" style={{ fontSize: '0.75rem' }}>
        {[
          { item: 'LED Panel Light x20', amt: '₹8,000' },
          { item: 'MCB Switch 32A x15', amt: '₹2,250' },
          { item: 'Wire Bundle 1.5mm x5', amt: '₹2,200' },
          { item: 'Ceiling Fan Cap. x50', amt: '₹3,500' },
          { item: 'LED Bulb 12W x100', amt: '₹7,500' },
        ].map((l) => (
          <div key={l.item} className="flex justify-between py-1.5" style={{ borderBottom: '1px dashed var(--lp-card-border)' }}>
            <span style={{ color: 'var(--lp-text-body)' }}>{l.item}</span>
            <span style={{ color: 'var(--lp-text)', fontWeight: 500 }}>{l.amt}</span>
          </div>
        ))}
      </div>
      <div className="px-5 py-2.5 flex justify-between border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
        <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem' }}>Total</span>
        <span style={{ color: 'var(--lp-text)', fontSize: '1rem', fontWeight: 700 }}>₹23,450</span>
      </div>
      <div className="px-5 py-2.5 flex items-center gap-2 justify-center border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
        <CheckCircle size={12} style={{ color: 'var(--lp-mock-success)' }} />
        <span style={{ fontSize: '0.6875rem', color: 'var(--lp-mock-success)' }}>Sent via WhatsApp + PDF downloaded</span>
      </div>
    </div>
  )
}


function AfterPayments() {
  return (
    <div className="rounded-xl w-full h-full overflow-hidden" style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}>
      <div className="h-1 w-full" style={{ background: 'var(--lp-accent)' }} />
      <div className="px-5 py-3 border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <p style={{ fontSize: '0.625rem', color: 'var(--lp-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Outstanding</p>
        <div className="flex items-baseline gap-2 mt-1">
          <span style={{ color: 'var(--lp-text)', fontSize: '1.25rem', fontWeight: 700 }}>₹1,14,400</span>
          <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.6875rem', fontWeight: 500 }}>5 parties</span>
        </div>
      </div>
      {[
        { name: 'Gupta Traders', amt: '₹45,200', days: '32d overdue', warn: true },
        { name: 'Patel & Sons', amt: '₹38,800', days: '18d overdue', warn: false },
        { name: 'Verma Stores', amt: '₹12,000', days: '7d overdue', warn: false },
        { name: 'Singh Enterprises', amt: '₹18,400', days: '45d overdue', warn: true },
      ].map((p) => (
        <div key={p.name} className="px-5 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <div>
            <p style={{ color: 'var(--lp-text)', fontSize: '0.75rem', fontWeight: 500 }}>{p.name}</p>
            <p style={{ color: p.warn ? 'var(--lp-mock-warning)' : 'var(--lp-text-muted)', fontSize: '0.625rem' }}>{p.days}</p>
          </div>
          <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.75rem', fontWeight: 600 }}>{p.amt}</span>
        </div>
      ))}
      <div className="px-5 py-2.5 flex items-center gap-2 justify-center border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
        <CheckCircle size={12} style={{ color: 'var(--lp-mock-success)' }} />
        <span style={{ fontSize: '0.6875rem', color: 'var(--lp-mock-success)' }}>WhatsApp reminders sent automatically</span>
      </div>
    </div>
  )
}


function AfterInventory() {
  return (
    <div className="rounded-xl w-full h-full overflow-hidden" style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}>
      <div className="h-1 w-full" style={{ background: 'var(--lp-accent)' }} />
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--lp-text)' }}>Stock Overview</span>
        <span className="px-2 py-0.5 rounded-full" style={{ fontSize: '0.5625rem', fontWeight: 600, background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)', color: 'var(--lp-mock-success)' }}>
          Live
        </span>
      </div>
      {[
        { item: 'Basmati Rice 5kg', qty: '250 bags', status: 'ok' },
        { item: 'Toor Dal 1kg', qty: '12 packs', status: 'low' },
        { item: 'Havells Wire 1.5mm', qty: '45 rolls', status: 'ok' },
        { item: 'Aashirvaad Atta 10kg', qty: '8 bags', status: 'low' },
        { item: 'Clinic Plus 175ml', qty: '320 pcs', status: 'ok' },
      ].map((p) => (
        <div key={p.item} className="px-5 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <div>
            <p style={{ color: 'var(--lp-text)', fontSize: '0.75rem', fontWeight: 500 }}>{p.item}</p>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem' }}>{p.qty}</p>
          </div>
          <span className="px-1.5 py-0.5 rounded-full" style={{ fontSize: '0.5625rem', fontWeight: 600, color: p.status === 'low' ? 'var(--lp-mock-warning)' : 'var(--lp-mock-success)', background: p.status === 'low' ? 'color-mix(in srgb, var(--lp-mock-warning) 15%, transparent)' : 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)' }}>
            {p.status === 'low' ? 'Low Stock' : 'In Stock'}
          </span>
        </div>
      ))}
      <div className="px-5 py-2.5 flex items-center gap-2 justify-center border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
        <CheckCircle size={12} style={{ color: 'var(--lp-mock-success)' }} />
        <span style={{ fontSize: '0.6875rem', color: 'var(--lp-mock-success)' }}>Auto-updated on every sale</span>
      </div>
    </div>
  )
}

const TABS: TabData[] = [
  {
    id: 'invoicing',
    icon: FileText,
    label: 'Invoicing',
    subtitle: 'Paper bills to professional invoices',
    metric: { before: '30 min', after: '2 min', unit: 'per invoice' },
    painPoints: ['Handwritten, no copies', 'Math errors, missing items', 'No GST compliance', 'Customer disputes'],
    gains: ['Professional PDF in seconds', 'Auto-calculated totals', 'GST compliant with HSN', 'WhatsApp delivery'],
    beforeContent: <BeforePhoto src="/images/before-after/before-invoicing.jpg" alt="Handwritten ledger book with manual entries and calculations" caption="No copy, no proof, no GST" />,
    afterContent: <AfterInvoice />,
  },
  {
    id: 'payments',
    icon: Wallet,
    label: 'Payments',
    subtitle: '"Yaad se" tracking to real-time dashboards',
    metric: { before: '₹50K+', after: '₹0', unit: 'forgotten dues' },
    painPoints: ['Udhaar in notebook', 'Forgotten payments', 'No reminder system', '"Kitna baaki hai?" guesswork'],
    gains: ['Real-time outstanding', 'Auto WhatsApp reminders', 'Payment history per party', 'Zero missed collections'],
    beforeContent: <BeforePhoto src="/images/before-after/before-payments.jpg" alt="Old handwritten account book tracking payments and dues" caption="No reminders, no tracking, money lost" />,
    afterContent: <AfterPayments />,
  },
  {
    id: 'inventory',
    icon: Package,
    label: 'Inventory',
    subtitle: 'Manual counting to auto-updating stock',
    metric: { before: '~70%', after: '100%', unit: 'stock accuracy' },
    painPoints: ['Stock register outdated', 'Unknown quantities', 'No low-stock alerts', 'End-of-day manual counting'],
    gains: ['Live stock dashboard', 'Auto-deduct on sale', 'Low-stock alerts', 'Party-wise pricing'],
    beforeContent: <BeforePhoto src="/images/before-after/before-inventory.jpg" alt="Manual pen-and-paper stock register for inventory counting" caption="Guessing stock, losing sales" />,
    afterContent: <AfterInventory />,
  },
]

export function BeforeAfterSection() {
  const [activeTab, setActiveTab] = useState(0)
  const reducedMotion = useReducedMotion()
  const tab = TABS[activeTab]

  const r = (delay: number, y?: number) =>
    reducedMotion ? {} : reveal(delay, y)

  return (
    <section className="py-20 md:py-28 px-6 landing-section-tinted">
      <div className="max-w-5xl mx-auto">
        {/* ── Section badge (hero badge style) ── */}
        <motion.div {...r(0.1, 20)} className="flex justify-center mb-6">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs backdrop-blur-sm"
            style={{
              borderColor: 'var(--lp-border-badge)',
              backgroundColor: 'var(--lp-bg-badge)',
              border: '1px solid var(--lp-border-badge)',
              color: 'var(--lp-text-muted)',
            }}
          >
            See it in action
            <ArrowRight size={12} />
          </span>
        </motion.div>

        {/* ── Heading (hero gradient style) ── */}
        <motion.div {...r(0.2)} className="text-center mb-10">
          <h2 className="text-center max-w-3xl mx-auto leading-tight mb-4 font-medium lp-heading-plain">
            <span className="text-3xl md:text-4xl lg:text-5xl">From Paper Chaos.</span>
            <br />
            <span className="text-3xl md:text-4xl lg:text-5xl">To Digital Clarity.</span>
          </h2>
          <p className="text-sm md:text-base lp-text-muted max-w-xl mx-auto">
            Real features, real impact — see how HisaabPro replaces manual work.
          </p>
        </motion.div>

        {/* ── Tab switcher (hero badge language) ── */}
        <motion.div {...r(0.3, 20)} className="flex justify-center mb-10">
          <div
            className="inline-flex items-center gap-1 p-1 rounded-full"
            style={{ background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-card-border)' }}
          >
            {TABS.map((t, i) => {
              const Icon = t.icon
              const isActive = i === activeTab
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(i)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-200"
                  style={{
                    background: isActive ? 'var(--lp-cta-bg)' : 'transparent',
                    color: isActive ? 'var(--lp-cta-text)' : 'var(--lp-text-muted)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.875rem',
                  }}
                >
                  <Icon size={15} />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              )
            })}
          </div>
        </motion.div>

        {/* ── Content area ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            initial={reducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {/* ── Metric strip ── */}
            <div
              className="rounded-xl mb-8 py-3 px-5 flex items-center justify-center gap-4 sm:gap-6"
              style={{ background: 'var(--lp-bg-surface)', border: '1px solid var(--lp-card-border)' }}
            >
              <span className="text-sm lp-text-muted hidden sm:inline">{tab.subtitle}</span>
              <span className="hidden sm:block w-px h-5" style={{ background: 'var(--lp-divider)' }} aria-hidden="true" />
              <div className="flex items-center gap-3">
                <span className="line-through lp-text-muted" style={{ fontSize: '0.875rem', opacity: 0.5 }}>{tab.metric.before}</span>
                <ArrowRight size={14} style={{ color: 'var(--lp-accent)' }} />
                <span style={{ color: 'var(--lp-mock-success)', fontSize: '1.125rem', fontWeight: 700 }}>{tab.metric.after}</span>
                <span className="text-xs lp-text-muted">{tab.metric.unit}</span>
              </div>
            </div>

            {/* ── Side-by-side comparison ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BEFORE column */}
              <div
                className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--lp-before-bg)', border: '1px solid var(--lp-card-border)' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'var(--lp-before-badge-bg)', color: 'var(--lp-before-badge-text)' }}
                  >
                    BEFORE
                  </span>
                  <span className="text-sm" style={{ color: 'var(--lp-text-muted)' }}>The old way</span>
                </div>
                <div className="flex-1 mb-4">{tab.beforeContent}</div>
                <div className="flex flex-col gap-2.5">
                  {tab.painPoints.map((point) => (
                    <div key={point} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--lp-before-badge-bg)' }}>
                        <AlertTriangle size={9} style={{ color: 'var(--lp-before-icon)' }} />
                      </span>
                      <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.8125rem' }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AFTER column */}
              <div
                className="rounded-xl p-4 flex flex-col"
                style={{ background: 'var(--lp-after-bg)', border: '1px solid var(--lp-card-border)' }}
              >
                <div className="flex items-center gap-2.5 mb-4">
                  <span
                    className="px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)', color: 'var(--lp-mock-success)' }}
                  >
                    AFTER
                  </span>
                  <span className="text-sm" style={{ color: 'var(--lp-mock-success)' }}>With HisaabPro</span>
                </div>
                <div className="flex-1 mb-4">{tab.afterContent}</div>
                <div className="flex flex-col gap-2.5">
                  {tab.gains.map((point) => (
                    <div key={point} className="flex items-start gap-2.5">
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)' }}>
                        <CheckCircle size={9} style={{ color: 'var(--lp-mock-success)' }} />
                      </span>
                      <span style={{ color: 'var(--lp-text-body)', fontSize: '0.8125rem' }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  )
}
