"use client"

import { useState } from "react"
import { ArrowRight, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { APP_NAME } from "@/config/app.config"
import { motion, useReducedMotion } from "motion/react"
import { LP_APP } from "@/config/landing-links.config"

const EASE_OUT: [number, number, number, number] = [0.25, 1, 0.5, 1]

interface Feature {
  name: string
  description: string
  included: boolean
}

interface PricingTier {
  name: string
  price: {
    monthly: number
    yearly: number
  }
  originalPrice: {
    monthly: number
    yearly: number
  }
  yearlySavings: number
  description: string
  features: Feature[]
  highlight?: boolean
  badge?: string
  badgeColor?: string
}

interface PricingSectionProps {
  tiers?: PricingTier[]
  className?: string
}

const defaultTiers: PricingTier[] = [
  {
    name: "Starter",
    price: { monthly: 199, yearly: 1999 },
    originalPrice: { monthly: 399, yearly: 3999 },
    yearlySavings: 2000,
    description: "Everything a solo owner needs to look professional",
    highlight: false,
    badge: undefined,
    features: [
      { name: "1 user", description: "Owner access only", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "Works anywhere", description: "No internet required", included: true },
      { name: "WhatsApp sharing", description: "Send invoices instantly", included: true },
      { name: "Basic reports", description: "Sales and payment summaries", included: true },
      { name: "Staff roles", description: "Add team members", included: false },
      { name: "Advanced reports", description: "Detailed analytics", included: false },
      { name: "Custom branding", description: "Your logo on invoices", included: false },
    ],
  },
  {
    name: "Pro",
    price: { monthly: 499, yearly: 4999 },
    originalPrice: { monthly: 799, yearly: 7999 },
    yearlySavings: 3000,
    description: "For businesses ready to add staff and grow",
    highlight: true,
    badge: "Most Popular",
    badgeColor: "#0ea5e9",
    features: [
      { name: "3 users", description: "Owner + 2 staff members", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "Works anywhere", description: "No internet required", included: true },
      { name: "WhatsApp sharing", description: "Send invoices instantly", included: true },
      { name: "Advanced reports", description: "Detailed analytics & export", included: true },
      { name: "4 preset staff roles", description: "Admin, Manager, Salesperson, Viewer", included: true },
      { name: "Your logo on invoices", description: `Remove ${APP_NAME} branding`, included: true },
      { name: "Custom role builder", description: "Fine-grained permissions", included: false },
    ],
  },
  {
    name: "Business",
    price: { monthly: 999, yearly: 9999 },
    originalPrice: { monthly: 1499, yearly: 14999 },
    yearlySavings: 5000,
    description: "Unlimited everything — for serious operations",
    highlight: false,
    badge: "Best Value",
    badgeColor: "#8b5cf6",
    features: [
      { name: "Unlimited users", description: "No team size limit", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "Works anywhere", description: "No internet required", included: true },
      { name: "WhatsApp sharing", description: "Send invoices instantly", included: true },
      { name: "Advanced reports + export", description: "PDF, Excel, share with CA", included: true },
      { name: "Custom role builder", description: "Fine-grained permissions per user", included: true },
      { name: "Your logo + custom domain", description: "Full white-label branding", included: true },
      { name: "Priority WhatsApp support", description: "Response within 4 hours", included: true },
    ],
  },
]

function PricingSection({ tiers = defaultTiers, className }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false)
  const reducedMotion = useReducedMotion()

  return (
    <section
      id="pricing"
      className={cn(
        "relative lp-heading-plain",
        "py-12 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-6xl mx-auto">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className="flex flex-col items-center gap-4 mb-12"
        >
          <h2 className="text-3xl font-bold" style={{ color: 'var(--lp-text)' }}>
            Simple, transparent pricing
          </h2>
          <p className="text-base lp-text-muted">
            Start with a 14-day trial. No credit card required.
          </p>
          <div
            className="inline-flex items-center p-1.5 rounded-full border shadow-sm"
            style={{
              backgroundColor: 'var(--lp-toggle-track-bg)',
              borderColor: 'var(--lp-toggle-track-border)',
            }}
          >
            {["Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Yearly")}
                className="px-5 sm:px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: (period === "Yearly") === isYearly ? 'var(--lp-toggle-active-bg)' : 'transparent',
                  color: (period === "Yearly") === isYearly ? 'var(--lp-toggle-active-text)' : 'var(--lp-toggle-inactive-text)',
                  boxShadow: (period === "Yearly") === isYearly ? '0 4px 6px -1px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {period}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={reducedMotion ? false : { opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              whileHover={reducedMotion ? undefined : { y: -6, transition: { duration: 0.25, ease: EASE_OUT } }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.6, delay: i * 0.12, ease: EASE_OUT }}
            >
            <div
              className={cn(
                "relative group backdrop-blur-sm",
                "rounded-3xl transition-all duration-300",
                "flex flex-col border",
                "hover:shadow-lg",
              )}
              style={{
                backgroundColor: tier.highlight ? 'transparent' : 'var(--lp-price-card-bg)',
                backgroundImage: tier.highlight ? `linear-gradient(to bottom, var(--lp-price-highlight-from), transparent)` : undefined,
                borderColor: tier.highlight ? 'var(--lp-price-highlight-border)' : 'var(--lp-price-card-border)',
                boxShadow: tier.highlight ? '0 20px 25px -5px rgba(0,0,0,0.1)' : '0 4px 6px -1px rgba(0,0,0,0.05)',
              }}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-6">
                  <span
                    className="inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium border-none shadow-lg"
                    style={{
                      backgroundColor: tier.badgeColor ?? 'var(--lp-price-badge-bg)',
                      color: '#ffffff',
                    }}
                  >
                    {tier.badge}
                  </span>
                </div>
              )}

              <div className="p-5 sm:p-8 flex-1">
                <div className="mb-4">
                  <p className="text-xl font-semibold" style={{ color: 'var(--lp-price-included)' }}>
                    {tier.name}
                  </p>
                  <p className="mt-1 text-sm lp-text-muted">
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="line-through text-xl lp-text-muted">
                      ₹{isYearly ? tier.originalPrice.yearly : tier.originalPrice.monthly}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-bold" style={{ color: 'var(--lp-price-included)' }}>
                      ₹{isYearly ? tier.price.yearly : tier.price.monthly}
                    </span>
                    <span className="text-sm lp-text-muted">
                      /{isYearly ? "yr" : "mo"}
                    </span>
                  </div>
                  {isYearly && (
                    <p className="mt-1.5 text-sm font-medium" style={{ color: 'var(--lp-price-save)' }}>
                      Save ₹{tier.yearlySavings}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex gap-4">
                      <div
                        className="mt-0.5 shrink-0 p-0.5 rounded-full transition-colors duration-200"
                        style={{
                          color: feature.included ? 'var(--lp-price-save)' : 'var(--lp-price-excluded)',
                        }}
                      >
                        {feature.included ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div
                          className="text-sm font-medium"
                          style={{
                            color: feature.included ? 'var(--lp-price-included)' : 'var(--lp-price-excluded)',
                          }}
                        >
                          {feature.name}
                        </div>
                        <div className="text-sm" style={{ color: 'var(--lp-price-desc)' }}>
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-8 pt-0 mt-auto">
                <a href={LP_APP.REGISTER} className="block">
                  <button
                    className="w-full relative transition-all duration-300 rounded-lg flex items-center justify-center h-12 cursor-pointer"
                    style={{
                      backgroundColor: tier.highlight ? 'var(--lp-price-btn-hl-bg)' : 'var(--lp-price-btn-bg)',
                      color: tier.highlight ? 'var(--lp-price-btn-hl-text)' : 'var(--lp-price-btn-text)',
                      border: tier.highlight ? 'none' : `1px solid var(--lp-price-btn-border)`,
                      fontWeight: tier.highlight ? 600 : 500,
                      fontSize: tier.highlight ? 'var(--fs-base)' : 'var(--fs-sm)',
                    }}
                    onPointerEnter={e => {
                      e.currentTarget.style.backgroundColor = tier.highlight ? 'var(--lp-price-btn-hl-hover-bg)' : 'var(--lp-price-btn-hover-bg)'
                    }}
                    onPointerLeave={e => {
                      e.currentTarget.style.backgroundColor = tier.highlight ? 'var(--lp-price-btn-hl-bg)' : 'var(--lp-price-btn-bg)'
                    }}
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Get Started
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </button>
                </a>
              </div>
            </div>
          </motion.div>
          ))}
        </div>

        <p className="text-center text-sm lp-text-muted mt-8">
          Auto-renews. Cancel anytime from Settings.
        </p>
      </div>
    </section>
  )
}

export { PricingSection }
