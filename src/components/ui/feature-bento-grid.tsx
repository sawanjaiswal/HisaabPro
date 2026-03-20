import React from "react"
import { cn } from "@/lib/utils"
import { Check, Send, Download, AlertTriangle, TrendingUp, Package } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

export function FeaturesSectionWithBentoGrid() {
  const features = [
    {
      title: "Smart Invoicing",
      description:
        "Sale, Purchase, Estimate, Proforma, Challan, Credit Note, Debit Note — 7 document types, auto-numbered, WhatsApp-ready. Your CA will thank you.",
      skeleton: <SkeletonOne />,
      className:
        "col-span-1 md:col-span-4 lg:col-span-4 border-b md:border-r",
    },
    {
      title: "Payment Tracking",
      description:
        "See who owes you at a glance. Send WhatsApp reminders in one tap. Cash, UPI, cheque, bank transfer \u2014 every rupee tracked.",
      skeleton: <SkeletonTwo />,
      className:
        "col-span-1 md:col-span-2 lg:col-span-2 border-b",
    },
    {
      title: "Inventory Management",
      description:
        "Real-time stock with low-stock alerts and party-wise pricing. Every sale auto-updates inventory. No more end-of-day counting.",
      skeleton: <SkeletonThree />,
      className:
        "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-r",
    },
    {
      title: "Reports & Insights",
      description:
        "Sales, stock, party statements, profit/loss \u2014 one tap each. Download the PDF or share it with your CA on WhatsApp.",
      skeleton: <SkeletonFour />,
      className:
        "col-span-1 md:col-span-3 lg:col-span-3 border-b md:border-none",
    },
  ]
  const reducedMotion = useReducedMotion()

  return (
    <div className="relative z-20 py-10 lg:py-40 max-w-7xl mx-auto">
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
        className="px-8"
      >
        <h2 className="text-4xl font-semibold lg:text-5xl max-w-5xl mx-auto text-center">
          One app, complete business control
        </h2>

        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-center font-normal lp-text-body">
          Invoicing, inventory, payments, reports — all connected, all offline.
        </p>
      </motion.div>

      <div className="relative">
        <div
          className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 mt-12 xl:border rounded-md"
          style={{ borderColor: 'var(--lp-card-border)' }}
        >
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={reducedMotion ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: EASE_OUT }}
              className={feature.className}
              style={{ borderColor: 'var(--lp-card-border)' }}
            >
              <div className="p-4 sm:p-8 relative overflow-hidden">
                <FeatureTitle>{feature.title}</FeatureTitle>
                <FeatureDescription>{feature.description}</FeatureDescription>
                <div className="h-full w-full">{feature.skeleton}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}


const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className="max-w-5xl mx-auto text-left tracking-tight text-xl md:text-2xl md:leading-snug lp-text">
      {children}
    </p>
  )
}

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base max-w-4xl text-left mx-auto",
        "text-center font-normal lp-text-muted",
        "text-left max-w-sm mx-0 md:text-sm my-2"
      )}
    >
      {children}
    </p>
  )
}

/* ─── Shared mockup wrapper with gradient fade ─── */
const MockCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div
    className={cn("rounded-lg border overflow-hidden", className)}
    style={{
      backgroundColor: 'var(--lp-bg-card)',
      borderColor: 'var(--lp-card-border)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    }}
  >
    {children}
  </div>
)

/* ─────────────────────────────────────────────────
   SkeletonOne — Invoice Card (Smart Invoicing)
   ───────────────────────────────────────────────── */
export const SkeletonOne = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full mx-auto">
        <MockCard>
          {/* Invoice header */}
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: 'var(--lp-text)', fontSize: '0.875rem' }}>
                INV-1042
              </span>
              <span
                className="px-2 py-0.5 rounded-full font-medium"
                style={{
                  fontSize: '0.6875rem',
                  backgroundColor: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)',
                  color: 'var(--lp-mock-success)',
                }}
              >
                Paid
              </span>
            </div>
            <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem' }}>18 Mar 2026</span>
          </div>

          {/* Party name */}
          <div className="px-4 py-2.5 border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
            <p style={{ color: 'var(--lp-text)', fontSize: '0.8125rem', fontWeight: 500 }}>Sharma Electronics</p>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.6875rem' }}>Lajpat Nagar, New Delhi</p>
          </div>

          {/* Line items */}
          <div className="px-4 py-2" style={{ fontSize: '0.75rem' }}>
            {[
              { item: 'LED Panel Light × 20', amount: '₹8,000' },
              { item: 'MCB Switch 32A × 15', amount: '₹2,250' },
              { item: 'Wire Bundle 1.5mm × 5', amount: '₹2,200' },
              { item: 'Ceiling Fan Capacitor × 50', amount: '₹3,500' },
              { item: 'Switch Board 8-way × 10', amount: '₹4,200' },
              { item: 'LED Bulb 12W × 100', amount: '₹7,500' },
              { item: 'PVC Pipe 1" × 25', amount: '₹3,750' },
            ].map((line) => (
              <div key={line.item} className="flex justify-between py-1.5" style={{ borderBottom: '1px dashed var(--lp-card-border)' }}>
                <span style={{ color: 'var(--lp-text-body)' }}>{line.item}</span>
                <span style={{ color: 'var(--lp-text)', fontWeight: 500 }}>{line.amount}</span>
              </div>
            ))}
          </div>

          {/* Subtotal + Tax + Total */}
          <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--lp-card-border)', fontSize: '0.75rem' }}>
            <div className="flex justify-between py-1">
              <span style={{ color: 'var(--lp-text-muted)' }}>Subtotal</span>
              <span style={{ color: 'var(--lp-text)', fontWeight: 500 }}>₹31,400</span>
            </div>
            <div className="flex justify-between py-1">
              <span style={{ color: 'var(--lp-text-muted)' }}>Discount (5%)</span>
              <span style={{ color: 'var(--lp-mock-success)', fontWeight: 500 }}>-₹1,570</span>
            </div>
          </div>
          <div className="px-4 py-2.5 flex justify-between items-center border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
            <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>Total</span>
            <span style={{ color: 'var(--lp-text)', fontSize: '1.125rem', fontWeight: 700 }}>₹29,830</span>
          </div>

          {/* Action buttons */}
          <div className="px-4 py-3 flex gap-2 border-t" style={{ borderColor: 'var(--lp-card-border)' }}>
            <div
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md"
              style={{
                backgroundColor: 'var(--lp-whatsapp)',
                color: 'var(--lp-whatsapp-text)',
                fontSize: '0.6875rem',
                fontWeight: 500,
              }}
            >
              <Send size={11} /> WhatsApp
            </div>
            <div
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md border"
              style={{
                borderColor: 'var(--lp-card-border)',
                color: 'var(--lp-text-secondary)',
                fontSize: '0.6875rem',
                fontWeight: 500,
              }}
            >
              <Download size={11} /> PDF
            </div>
          </div>
        </MockCard>
      </div>

      <div className="absolute bottom-0 z-40 inset-x-0 h-40 w-full pointer-events-none" style={{ background: `linear-gradient(to top, var(--lp-bg-fade), transparent)` }} />
    </div>
  )
}

/* ─────────────────────────────────────────────────
   SkeletonTwo — Payment Outstanding Widget
   ───────────────────────────────────────────────── */
export const SkeletonTwo = () => {
  const parties = [
    { name: "Gupta Traders", amount: "₹45,200", days: "32d" },
    { name: "Patel & Sons", amount: "₹38,800", days: "18d" },
    { name: "Verma Stores", amount: "₹22,100", days: "7d" },
    { name: "Singh Enterprises", amount: "₹18,400", days: "45d" },
  ]

  return (
    <div className="relative flex flex-col items-start py-8 gap-4 h-full overflow-hidden">
      <MockCard className="w-full">
        {/* Outstanding header */}
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.6875rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Outstanding
          </p>
          <div className="flex items-baseline gap-2 mt-1">
            <span style={{ color: 'var(--lp-text)', fontSize: '1.5rem', fontWeight: 700 }}>₹1,24,500</span>
            <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.6875rem', fontWeight: 500 }}>4 parties</span>
          </div>
        </div>

        {/* Party list */}
        <div>
          {parties.map((p) => (
            <div
              key={p.name}
              className="px-4 py-2.5 flex items-center justify-between border-b"
              style={{ borderColor: 'var(--lp-card-border)' }}
            >
              <div>
                <p style={{ color: 'var(--lp-text)', fontSize: '0.75rem', fontWeight: 500 }}>{p.name}</p>
                <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem' }}>{p.days} overdue</p>
              </div>
              <span style={{ color: 'var(--lp-mock-warning)', fontSize: '0.8125rem', fontWeight: 600 }}>{p.amount}</span>
            </div>
          ))}
        </div>

        {/* Payment modes bar */}
        <div className="px-4 py-3">
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem', fontWeight: 500, marginBottom: 8 }}>
            Received This Month
          </p>
          <div className="flex gap-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--lp-mock-bar-bg)' }}>
            <div className="rounded-full" style={{ width: '45%', backgroundColor: 'var(--lp-accent)' }} />
            <div className="rounded-full" style={{ width: '30%', backgroundColor: 'var(--lp-mock-success)' }} />
            <div className="rounded-full" style={{ width: '15%', backgroundColor: 'var(--lp-text-muted)' }} />
          </div>
          <div className="flex gap-4 mt-2" style={{ fontSize: '0.5625rem', color: 'var(--lp-text-muted)' }}>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-accent)' }} /> UPI
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-mock-success)' }} /> Cash
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: 'var(--lp-text-muted)' }} /> Cheque
            </span>
          </div>
        </div>
      </MockCard>

      <div className="absolute bottom-0 z-40 inset-x-0 h-20 w-full pointer-events-none" style={{ background: `linear-gradient(to top, var(--lp-bg-fade), transparent)` }} />
    </div>
  )
}

/* ─────────────────────────────────────────────────
   SkeletonThree — Inventory Stock Cards
   ───────────────────────────────────────────────── */
export const SkeletonThree = () => {
  const products = [
    { name: "Basmati Rice 5kg", qty: 250, unit: "bags", unitSingular: "bag", price: "₹425", status: "ok" },
    { name: "Toor Dal 1kg", qty: 12, unit: "packs", unitSingular: "pack", price: "₹185", status: "low" },
    { name: "Havells Wire 1.5mm", qty: 45, unit: "rolls", unitSingular: "roll", price: "₹1,850", status: "ok" },
    { name: "Aashirvaad Atta 10kg", qty: 8, unit: "bags", unitSingular: "bag", price: "₹510", status: "low" },
    { name: "Clinic Plus 175ml", qty: 320, unit: "pieces", unitSingular: "pc", price: "₹95", status: "ok" },
    { name: "Amul Butter 500g", qty: 5, unit: "boxes", unitSingular: "box", price: "₹270", status: "low" },
  ]

  return (
    <div className="relative flex gap-10 h-full py-6">
      <div className="w-full mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {products.map((p) => (
            <MockCard key={p.name} className="p-3">
              <div className="flex items-start justify-between mb-2">
                <Package size={14} style={{ color: 'var(--lp-text-muted)' }} aria-hidden="true" />
                {p.status === "low" && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 600,
                      backgroundColor: 'color-mix(in srgb, var(--lp-mock-warning) 15%, transparent)',
                      color: 'var(--lp-mock-warning)',
                    }}
                  >
                    <AlertTriangle size={9} /> Low
                  </span>
                )}
                {p.status === "ok" && (
                  <span
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                    style={{
                      fontSize: '0.5625rem',
                      fontWeight: 600,
                      backgroundColor: 'color-mix(in srgb, var(--lp-mock-success) 15%, transparent)',
                      color: 'var(--lp-mock-success)',
                    }}
                  >
                    <Check size={9} /> In Stock
                  </span>
                )}
              </div>
              <p style={{ color: 'var(--lp-text)', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1.3 }}>{p.name}</p>
              <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem', marginTop: 2 }}>
                {p.qty} {p.unit}
              </p>
              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--lp-card-border)' }}>
                <span style={{ color: 'var(--lp-text)', fontSize: '0.8125rem', fontWeight: 700 }}>{p.price}</span>
                <span style={{ color: 'var(--lp-text-muted)', fontSize: '0.5625rem' }}>per {p.unitSingular}</span>
              </div>
            </MockCard>
          ))}
        </div>
      </div>

      <div className="absolute bottom-0 z-40 inset-x-0 h-24 w-full pointer-events-none" style={{ background: `linear-gradient(to top, var(--lp-bg-fade), transparent)` }} />
    </div>
  )
}

/* ─────────────────────────────────────────────────
   SkeletonFour — Sales Report & Chart
   ───────────────────────────────────────────────── */
export const SkeletonFour = () => {
  const months = [
    { label: "Oct", pct: 52 },
    { label: "Nov", pct: 68 },
    { label: "Dec", pct: 85 },
    { label: "Jan", pct: 60 },
    { label: "Feb", pct: 78 },
    { label: "Mar", pct: 92 },
  ]

  const topParties = [
    { name: "Sharma Electronics", amount: "₹1,85,000" },
    { name: "Gupta Traders", amount: "₹1,24,000" },
    { name: "Verma Stores", amount: "₹98,500" },
  ]

  return (
    <div className="h-auto flex flex-col items-center relative bg-transparent mt-6 overflow-hidden">
      <MockCard className="w-full">
        {/* Revenue header */}
        <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--lp-card-border)' }}>
          <div>
            <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.6875rem', fontWeight: 500 }}>Monthly Sales</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span style={{ color: 'var(--lp-text)', fontSize: '1.25rem', fontWeight: 700 }}>₹2,85,000</span>
              <span className="flex items-center gap-0.5" style={{ color: 'var(--lp-mock-success)', fontSize: '0.6875rem', fontWeight: 600 }}>
                <TrendingUp size={12} /> 12%
              </span>
            </div>
          </div>
          <div
            className="px-2 py-1 rounded-md"
            style={{ backgroundColor: 'var(--lp-bg-elevated)', fontSize: '0.625rem', color: 'var(--lp-text-muted)' }}
          >
            Mar 2026
          </div>
        </div>

        {/* Bar chart */}
        <div className="px-4 py-4">
          <div className="flex items-end justify-between gap-3" style={{ height: 120 }}>
            {months.map((m) => {
              const barHeight = Math.round((m.pct / 100) * 100)
              return (
                <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full">
                  <div
                    className="w-full rounded-t-md"
                    style={{
                      height: barHeight,
                      backgroundColor: m.label === "Mar" ? 'var(--lp-accent)' : 'var(--lp-mock-bar-bg)',
                      minHeight: 6,
                    }}
                  />
                  <span className="mt-2" style={{ fontSize: '0.5625rem', color: 'var(--lp-text-muted)' }}>{m.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top parties */}
        <div className="px-4 pb-3">
          <p style={{ color: 'var(--lp-text-muted)', fontSize: '0.625rem', fontWeight: 500, marginBottom: 6 }}>
            Top Parties
          </p>
          {topParties.map((p, i) => (
            <div
              key={p.name}
              className="flex items-center justify-between py-1.5"
              style={{ borderTop: i > 0 ? '1px solid var(--lp-card-border)' : 'none' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: 'var(--lp-bg-elevated)',
                    fontSize: '0.5rem',
                    color: 'var(--lp-text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ color: 'var(--lp-text)', fontSize: '0.6875rem' }}>{p.name}</span>
              </div>
              <span style={{ color: 'var(--lp-text)', fontSize: '0.6875rem', fontWeight: 600 }}>{p.amount}</span>
            </div>
          ))}
        </div>
      </MockCard>
    </div>
  )
}
