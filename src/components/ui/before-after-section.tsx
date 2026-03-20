/**
 * Before/After Transformation Section
 *
 * Design strategy (from ui-ux-pro-max):
 * - Color contrast: muted/desaturated (before) vs vibrant (after)
 * - Large, readable mockups — one transformation at a time
 * - Tab-based navigation — user picks which transformation to view
 * - Specific metrics with dramatic visual contrast
 * - 45% higher conversion with visual proof of value
 */

import { useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'motion/react'
import { FileText, Wallet, Package, ArrowRight, Clock, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react'

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

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
    <div className="rounded-xl w-full h-full overflow-hidden relative" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', minHeight: 200 }}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        width={800}
        height={450}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ filter: 'sepia(0.2) saturate(0.7) brightness(0.85)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)' }} />
      <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-2">
        <AlertTriangle size={14} style={{ color: '#cd853f' }} className="shrink-0" />
        <span style={{ fontSize: '0.8125rem', color: '#d4c5a9', fontWeight: 500 }}>{caption}</span>
      </div>
    </div>
  )
}

function AfterInvoice() {
  return (
    <div className="rounded-xl w-full h-full overflow-hidden" style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}>
      {/* Accent bar */}
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

  return (
    <section className="py-20 md:py-28 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-semibold lg:text-5xl" style={{ color: 'var(--lp-text)' }}>
            See the transformation
          </h2>
          <p className="mt-4 text-base lg:text-lg lp-text-muted max-w-xl mx-auto">
            From paper chaos to digital clarity. Real features, real impact on your business.
          </p>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: 0.1, ease: EASE_OUT }}
          className="flex justify-center gap-2 mb-10"
        >
          {TABS.map((t, i) => {
            const Icon = t.icon
            const isActive = i === activeTab
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(i)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full cursor-pointer transition-all duration-200"
                style={{
                  background: isActive ? 'var(--lp-accent)' : 'var(--lp-bg-elevated)',
                  color: isActive ? '#ffffff' : 'var(--lp-text-muted)',
                  border: `1px solid ${isActive ? 'var(--lp-accent)' : 'var(--lp-card-border)'}`,
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.875rem',
                }}
              >
                <Icon size={16} />
                {t.label}
              </button>
            )
          })}
        </motion.div>

        {/* Content area */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab.id}
            initial={reducedMotion ? false : { opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.35, ease: EASE_OUT }}
          >
            {/* Metric banner */}
            <div
              className="rounded-xl mb-6 p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
              style={{ background: 'var(--lp-bg-surface)', border: '1px solid var(--lp-card-border)' }}
            >
              <p className="text-sm lp-text-muted">{tab.subtitle}</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} style={{ color: 'var(--lp-text-muted)' }} />
                  <span className="line-through" style={{ color: 'var(--lp-text-muted)', fontSize: '1rem', opacity: 0.5 }}>{tab.metric.before}</span>
                </div>
                <ArrowRight size={16} style={{ color: 'var(--lp-accent)' }} />
                <div className="flex items-center gap-1.5">
                  <TrendingUp size={14} style={{ color: 'var(--lp-mock-success)' }} />
                  <span style={{ color: 'var(--lp-mock-success)', fontSize: '1.25rem', fontWeight: 700 }}>{tab.metric.after}</span>
                </div>
                <span className="text-xs lp-text-muted">{tab.metric.unit}</span>
              </div>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BEFORE column */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: 'rgba(139, 69, 19, 0.15)', color: '#cd853f' }}>
                    BEFORE
                  </span>
                  <span className="text-sm" style={{ color: '#8b7355' }}>The old way</span>
                </div>
                {/* Mockup — flex-1 so photo fills same height as After UI */}
                <div className="flex-1">{tab.beforeContent}</div>
                {/* Pain points */}
                <div className="mt-4 flex flex-col gap-2">
                  {tab.painPoints.map((point) => (
                    <div key={point} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(139, 69, 19, 0.15)' }}>
                        <AlertTriangle size={10} style={{ color: '#cd853f' }} />
                      </span>
                      <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.8125rem' }}>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AFTER column */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)', color: 'var(--lp-mock-success)' }}>
                    AFTER
                  </span>
                  <span className="text-sm" style={{ color: 'var(--lp-mock-success)' }}>With HisaabPro</span>
                </div>
                {/* Mockup */}
                <div className="flex-1">{tab.afterContent}</div>
                {/* Gains */}
                <div className="mt-4 flex flex-col gap-2">
                  {tab.gains.map((point) => (
                    <div key={point} className="flex items-start gap-2">
                      <span className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)' }}>
                        <CheckCircle size={10} style={{ color: 'var(--lp-mock-success)' }} />
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
