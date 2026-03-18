"use client"

import { useState } from "react"
import { ArrowRight, Check, X } from "lucide-react"
import { cn } from "@/lib/utils"

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
    description: "Perfect for solo business owners",
    highlight: false,
    badge: undefined,
    features: [
      { name: "1 user", description: "Owner access only", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "100% offline", description: "Works without internet", included: true },
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
    description: "For growing businesses with a team",
    highlight: true,
    badge: "Most Popular",
    features: [
      { name: "3 users", description: "Owner + 2 staff members", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "100% offline", description: "Works without internet", included: true },
      { name: "WhatsApp sharing", description: "Send invoices instantly", included: true },
      { name: "Advanced reports", description: "Detailed analytics & export", included: true },
      { name: "4 preset staff roles", description: "Admin, Manager, Salesperson, Viewer", included: true },
      { name: "Your logo on invoices", description: "Remove HisaabPro branding", included: true },
      { name: "Custom role builder", description: "Fine-grained permissions", included: false },
    ],
  },
  {
    name: "Business",
    price: { monthly: 999, yearly: 9999 },
    originalPrice: { monthly: 1499, yearly: 14999 },
    yearlySavings: 5000,
    description: "For multi-location businesses",
    highlight: false,
    badge: "Best Value",
    features: [
      { name: "Unlimited users", description: "No team size limit", included: true },
      { name: "Unlimited invoices", description: "No cap on billing", included: true },
      { name: "100% offline", description: "Works without internet", included: true },
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

  const buttonStyles = {
    default: cn(
      "h-12 bg-white dark:bg-zinc-900",
      "hover:bg-zinc-50 dark:hover:bg-zinc-800",
      "text-zinc-900 dark:text-zinc-100",
      "border border-zinc-200 dark:border-zinc-800",
      "hover:border-zinc-300 dark:hover:border-zinc-700",
      "shadow-sm hover:shadow-md",
      "text-sm font-medium",
    ),
    highlight: cn(
      "h-12 bg-zinc-900 dark:bg-zinc-100",
      "hover:bg-zinc-800 dark:hover:bg-zinc-300",
      "text-white dark:text-zinc-900",
      "shadow-[0_1px_15px_rgba(0,0,0,0.1)]",
      "hover:shadow-[0_1px_20px_rgba(0,0,0,0.15)]",
      "font-semibold text-base",
    ),
  }

  const badgeStyles = cn(
    "px-4 py-1.5 text-sm font-medium",
    "bg-zinc-900 dark:bg-zinc-100",
    "text-white dark:text-zinc-900",
    "border-none shadow-lg",
  )

  return (
    <section
      id="pricing"
      className={cn(
        "relative bg-background text-foreground",
        "py-12 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-6xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12">
          <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            Simple, transparent pricing
          </h2>
          <p className="text-base text-zinc-500 dark:text-zinc-400">
            Start with a 14-day free trial. No credit card required.
          </p>
          <div className="inline-flex items-center p-1.5 bg-white dark:bg-zinc-800/50 rounded-full border border-zinc-200 dark:border-zinc-700 shadow-sm">
            {["Monthly", "Yearly"].map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Yearly")}
                className={cn(
                  "px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300",
                  (period === "Yearly") === isYearly
                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-lg"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative group backdrop-blur-sm",
                "rounded-3xl transition-all duration-300",
                "flex flex-col",
                tier.highlight
                  ? "bg-gradient-to-b from-zinc-100/80 to-transparent dark:from-zinc-400/[0.15]"
                  : "bg-white dark:bg-zinc-800/50",
                "border",
                tier.highlight
                  ? "border-zinc-400/50 dark:border-zinc-400/20 shadow-xl"
                  : "border-zinc-200 dark:border-zinc-700 shadow-md",
                "hover:translate-y-0 hover:shadow-lg",
              )}
            >
              {tier.badge && (
                <div className="absolute -top-4 left-6">
                  <span className={cn("inline-flex items-center rounded-full", badgeStyles)}>
                    {tier.badge}
                  </span>
                </div>
              )}

              <div className="p-8 flex-1">
                <div className="mb-4">
                  <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                    {tier.name}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {tier.description}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="line-through text-muted-foreground text-xl">
                      ₹{isYearly ? tier.originalPrice.yearly : tier.originalPrice.monthly}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
                      ₹{isYearly ? tier.price.yearly : tier.price.monthly}
                    </span>
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                      /{isYearly ? "yr" : "mo"}
                    </span>
                  </div>
                  {isYearly && (
                    <p className="mt-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      Save ₹{tier.yearlySavings}
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {tier.features.map((feature) => (
                    <div key={feature.name} className="flex gap-4">
                      <div
                        className={cn(
                          "mt-0.5 shrink-0 p-0.5 rounded-full transition-colors duration-200",
                          feature.included
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-zinc-300 dark:text-zinc-600",
                        )}
                      >
                        {feature.included ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <X className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            feature.included
                              ? "text-zinc-900 dark:text-zinc-100"
                              : "text-zinc-400 dark:text-zinc-500",
                          )}
                        >
                          {feature.name}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400">
                          {feature.description}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 pt-0 mt-auto">
                <button
                  className={cn(
                    "w-full relative transition-all duration-300 rounded-lg flex items-center justify-center",
                    tier.highlight
                      ? buttonStyles.highlight
                      : buttonStyles.default,
                  )}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Start Free Trial
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Auto-renews. Cancel anytime from Settings. •{" "}
          <a href="#" className="underline">
            Have a coupon code?
          </a>
        </p>
      </div>
    </section>
  )
}

export { PricingSection }
