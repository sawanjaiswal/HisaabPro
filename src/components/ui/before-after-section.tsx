/** Before/After Transformation — rich mockups that tell the story */

import React from "react"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, Send } from "lucide-react"

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

/* ─── Before: Paper register invoice ─── */
function PaperInvoiceMockup() {
  return (
    <div
      className="rounded-lg p-3 w-full"
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #d4a574',
        fontFamily: "'Caveat', cursive, sans-serif",
      }}
    >
      <div className="flex justify-between items-center mb-2 pb-1.5" style={{ borderBottom: '1px dashed #b8956a' }}>
        <span style={{ fontSize: '0.6875rem', color: '#78350f', fontWeight: 600 }}>Sharma Electr.</span>
        <span style={{ fontSize: '0.5625rem', color: '#92400e' }}>18/3/26</span>
      </div>
      {[
        { item: 'LED Panel x20', amt: '8000', ok: true },
        { item: 'MCB Switch x15', amt: '2250', ok: true },
        { item: 'Wire Bundle x5', amt: '2200', ok: false },
        { item: 'Fan Cap. x50', amt: '3500', ok: true },
        { item: 'Bulb 12W x??', amt: '???', ok: false },
      ].map((l) => (
        <div key={l.item} className="flex justify-between py-0.5" style={{ fontSize: '0.5625rem', color: l.ok ? '#78350f' : '#dc2626' }}>
          <span style={{ textDecoration: l.ok ? 'none' : 'line-through', opacity: l.ok ? 1 : 0.6 }}>{l.item}</span>
          <span>{l.amt}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1 flex justify-between" style={{ borderTop: '1px dashed #b8956a', fontSize: '0.625rem', color: '#78350f', fontWeight: 700 }}>
        <span>Total</span>
        <span>15,950 <span style={{ fontSize: '0.5rem', color: '#dc2626' }}>(approx)</span></span>
      </div>
    </div>
  )
}

/* ─── After: Clean digital invoice ─── */
function DigitalInvoiceMockup() {
  return (
    <div
      className="rounded-lg w-full overflow-hidden"
      style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <span style={{ fontSize: '0.625rem', fontWeight: 600, color: 'var(--lp-text)' }}>INV-1042</span>
        <span
          className="px-1.5 py-0.5 rounded-full"
          style={{ fontSize: '0.5rem', fontWeight: 600, background: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)', color: 'var(--lp-mock-success)' }}
        >
          Paid
        </span>
      </div>
      <div className="px-3 py-1.5" style={{ fontSize: '0.5rem' }}>
        <p style={{ color: 'var(--lp-text)', fontWeight: 500, fontSize: '0.5625rem' }}>Sharma Electronics</p>
        <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.4375rem' }}>Lajpat Nagar, New Delhi</p>
      </div>
      <div className="px-3" style={{ fontSize: '0.5rem' }}>
        {[
          { item: 'LED Panel Light x20', amt: '₹8,000' },
          { item: 'MCB Switch 32A x15', amt: '₹2,250' },
          { item: 'Wire Bundle 1.5mm x5', amt: '₹2,200' },
          { item: 'Ceiling Fan Cap. x50', amt: '₹3,500' },
          { item: 'LED Bulb 12W x100', amt: '₹7,500' },
        ].map((l) => (
          <div key={l.item} className="flex justify-between py-1" style={{ borderBottom: '1px dashed var(--lp-card-border)' }}>
            <span style={{ color: 'var(--lp-text-body)' }}>{l.item}</span>
            <span style={{ color: 'var(--lp-text)', fontWeight: 500 }}>{l.amt}</span>
          </div>
        ))}
      </div>
      <div className="px-3 py-1.5 flex justify-between border-t" style={{ borderColor: 'var(--lp-card-border)', fontSize: '0.5625rem' }}>
        <span style={{ color: 'var(--lp-text-muted)' }}>Total</span>
        <span style={{ color: 'var(--lp-text)', fontWeight: 700 }}>₹23,450</span>
      </div>
      <div className="px-3 py-2 flex gap-1.5 border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
        <div
          className="flex-1 flex items-center justify-center gap-1 py-1 rounded"
          style={{ background: 'var(--lp-whatsapp)', color: '#fff', fontSize: '0.4375rem', fontWeight: 500 }}
        >
          <Send size={7} /> WhatsApp
        </div>
        <div
          className="flex-1 flex items-center justify-center py-1 rounded border"
          style={{ borderColor: 'var(--lp-card-border)', color: 'var(--lp-text-muted)', fontSize: '0.4375rem' }}
        >
          PDF
        </div>
      </div>
    </div>
  )
}

/* ─── Before: Messy notebook payment tracking ─── */
function NotebookPaymentMockup() {
  return (
    <div
      className="rounded-lg p-3 w-full"
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #d4a574',
      }}
    >
      <div className="mb-2 pb-1" style={{ borderBottom: '1px dashed #b8956a', fontSize: '0.5625rem', color: '#78350f', fontWeight: 600 }}>
        Udhaar List
      </div>
      {[
        { name: 'Gupta ji', amt: '45,200', status: 'overdue' },
        { name: 'Patel', amt: '38,800', status: 'ok' },
        { name: 'Verma', amt: '???', status: 'unknown' },
        { name: 'Singh', amt: '18,400', status: 'overdue' },
        { name: 'Jain bhai', amt: '12,000', status: 'ok' },
      ].map((p) => (
        <div key={p.name} className="flex justify-between py-0.5" style={{ fontSize: '0.5625rem' }}>
          <span style={{ color: '#78350f' }}>{p.name}</span>
          <span style={{
            color: p.status === 'unknown' ? '#dc2626' : '#92400e',
            fontWeight: p.status === 'unknown' ? 600 : 400,
          }}>
            {p.amt}
          </span>
        </div>
      ))}
      <div className="mt-1.5 pt-1 text-center" style={{ borderTop: '1px dashed #b8956a', fontSize: '0.5rem', color: '#dc2626' }}>
        kitna total hai? 🤷
      </div>
    </div>
  )
}

/* ─── After: Clean payment tracker ─── */
function DigitalPaymentMockup() {
  return (
    <div
      className="rounded-lg w-full overflow-hidden"
      style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}
    >
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <p style={{ fontSize: '0.4375rem', color: 'var(--lp-text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Outstanding</p>
        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--lp-text)' }}>₹1,14,400</span>
      </div>
      {[
        { name: 'Gupta Traders', amt: '₹45,200', days: '32d', warn: true },
        { name: 'Patel & Sons', amt: '₹38,800', days: '18d', warn: false },
        { name: 'Verma Stores', amt: '₹12,000', days: '7d', warn: false },
        { name: 'Singh Enterprises', amt: '₹18,400', days: '45d', warn: true },
      ].map((p) => (
        <div key={p.name} className="px-3 py-1.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <div>
            <p style={{ color: 'var(--lp-text)', fontSize: '0.5rem', fontWeight: 500 }}>{p.name}</p>
            <p style={{ color: p.warn ? 'var(--lp-mock-warning)' : 'var(--lp-text-muted)', fontSize: '0.4375rem' }}>
              {p.warn && '⚠ '}{p.days} overdue
            </p>
          </div>
          <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.5625rem', fontWeight: 600 }}>{p.amt}</span>
        </div>
      ))}
      <div className="px-3 py-2">
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--lp-mock-bar-bg)' }}>
          <div className="rounded-full" style={{ width: '45%', background: 'var(--lp-accent)' }} />
          <div className="rounded-full" style={{ width: '30%', background: 'var(--lp-mock-success)' }} />
          <div className="rounded-full" style={{ width: '15%', background: 'var(--lp-text-muted)' }} />
        </div>
      </div>
    </div>
  )
}

/* ─── Before: Handwritten stock list ─── */
function PaperStockMockup() {
  return (
    <div
      className="rounded-lg p-3 w-full"
      style={{
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #d4a574',
      }}
    >
      <div className="mb-2 pb-1" style={{ borderBottom: '1px dashed #b8956a', fontSize: '0.5625rem', color: '#78350f', fontWeight: 600 }}>
        Stock Register
      </div>
      {[
        { item: 'Rice 5kg', qty: '250?', ok: false },
        { item: 'Dal 1kg', qty: '12', ok: true },
        { item: 'Wire 1.5mm', qty: '--', ok: false },
        { item: 'Atta 10kg', qty: '8', ok: true },
        { item: 'Shampoo', qty: '???', ok: false },
      ].map((p) => (
        <div key={p.item} className="flex justify-between py-0.5" style={{ fontSize: '0.5625rem' }}>
          <span style={{ color: '#78350f' }}>{p.item}</span>
          <span style={{ color: p.ok ? '#92400e' : '#dc2626', fontWeight: p.ok ? 400 : 600 }}>{p.qty}</span>
        </div>
      ))}
      <div className="mt-1.5 pt-1 text-center" style={{ borderTop: '1px dashed #b8956a', fontSize: '0.5rem', color: '#dc2626' }}>
        last counted: 3 days ago??
      </div>
    </div>
  )
}

/* ─── After: Digital inventory grid ─── */
function DigitalStockMockup() {
  return (
    <div
      className="rounded-lg w-full overflow-hidden"
      style={{ background: 'var(--lp-bg-card)', border: '1px solid var(--lp-card-border)' }}
    >
      <div className="px-3 py-2 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
        <span style={{ fontSize: '0.5rem', fontWeight: 600, color: 'var(--lp-text)' }}>Stock Overview</span>
        <span style={{ fontSize: '0.4375rem', color: 'var(--lp-text-muted)' }}>Live</span>
      </div>
      {[
        { item: 'Basmati Rice 5kg', qty: '250 bags', status: 'ok' },
        { item: 'Toor Dal 1kg', qty: '12 packs', status: 'low' },
        { item: 'Havells Wire 1.5mm', qty: '45 rolls', status: 'ok' },
        { item: 'Aashirvaad Atta', qty: '8 bags', status: 'low' },
        { item: 'Clinic Plus 175ml', qty: '320 pcs', status: 'ok' },
      ].map((p) => (
        <div key={p.item} className="px-3 py-1.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <div>
            <p style={{ color: 'var(--lp-text)', fontSize: '0.5rem', fontWeight: 500 }}>{p.item}</p>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.4375rem' }}>{p.qty}</p>
          </div>
          <span
            className="px-1 py-0.5 rounded-full"
            style={{
              fontSize: '0.375rem',
              fontWeight: 600,
              color: p.status === 'low' ? 'var(--lp-mock-warning)' : 'var(--lp-mock-success)',
              background: p.status === 'low'
                ? 'color-mix(in srgb, var(--lp-mock-warning) 15%, transparent)'
                : 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)',
            }}
          >
            {p.status === 'low' ? 'Low' : 'In Stock'}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ─── Main section ─── */
interface TransformationData {
  title: string
  tagline: string
  metric: { before: string; after: string; label: string }
  beforeMockup: React.ReactNode
  afterMockup: React.ReactNode
}

const TRANSFORMATIONS: TransformationData[] = [
  {
    title: "Invoicing",
    tagline: "Paper bills to professional PDFs in seconds",
    metric: { before: "30 min", after: "2 min", label: "per invoice" },
    beforeMockup: <PaperInvoiceMockup />,
    afterMockup: <DigitalInvoiceMockup />,
  },
  {
    title: "Payments",
    tagline: '"Yaad se" tracking to real-time outstanding',
    metric: { before: "₹50K+", after: "₹0", label: "forgotten dues" },
    beforeMockup: <NotebookPaymentMockup />,
    afterMockup: <DigitalPaymentMockup />,
  },
  {
    title: "Inventory",
    tagline: "Manual counting to auto-updating stock",
    metric: { before: "~70%", after: "100%", label: "stock accuracy" },
    beforeMockup: <PaperStockMockup />,
    afterMockup: <DigitalStockMockup />,
  },
]

function TransformationCard({ t, index }: { t: TransformationData; index: number }) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: index * 0.12, ease: EASE_OUT }}
      className="rounded-xl border overflow-hidden"
      style={{ borderColor: 'var(--lp-card-border)', background: 'var(--lp-bg-surface)' }}
    >
      {/* Side-by-side mockups */}
      <div className="p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
          {/* Before */}
          <div>
            <p className="text-center mb-2" style={{ fontSize: '0.5625rem', color: 'var(--lp-before-badge-text)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>Before</p>
            {t.beforeMockup}
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center pt-8">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--lp-bg-elevated)', border: '1px solid var(--lp-card-border)' }}
            >
              <ArrowRight size={14} style={{ color: 'var(--lp-accent)' }} />
            </div>
          </div>

          {/* After */}
          <div>
            <p className="text-center mb-2" style={{ fontSize: '0.5625rem', color: 'var(--lp-mock-success)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>After</p>
            {t.afterMockup}
          </div>
        </div>
      </div>

      {/* Footer: title + metric */}
      <div
        className="px-4 py-3 flex items-center justify-between border-t"
        style={{ borderColor: 'var(--lp-card-border)', background: 'var(--lp-bg-card)' }}
      >
        <div>
          <p style={{ color: 'var(--lp-text)', fontSize: '0.9375rem', fontWeight: 600 }}>{t.title}</p>
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.6875rem' }}>{t.tagline}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="line-through" style={{ color: 'var(--lp-text-muted)', fontSize: '0.8125rem', opacity: 0.5 }}>{t.metric.before}</span>
          <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem' }}>&rarr;</span>
          <span style={{ color: 'var(--lp-mock-success)', fontSize: '1rem', fontWeight: 700 }}>{t.metric.after}</span>
        </div>
      </div>
    </motion.div>
  )
}

export function BeforeAfterSection() {
  const reducedMotion = useReducedMotion()

  return (
    <section className="py-24 px-4 lp-heading-plain">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="text-center mb-14"
        >
          <h2 className="text-4xl font-semibold lg:text-5xl" style={{ color: 'var(--lp-text)' }}>
            Before &amp; after HisaabPro
          </h2>
          <p className="mt-4 text-lg lp-text-muted max-w-lg mx-auto">
            See the difference. Real transformations, real time savings.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TRANSFORMATIONS.map((t, i) => (
            <TransformationCard key={t.title} t={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
