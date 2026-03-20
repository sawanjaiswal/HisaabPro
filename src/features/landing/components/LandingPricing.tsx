/** Pricing section — monthly vs annual with feature checklist */

import { Check } from 'lucide-react'

import { CTA_ROUTE, PRICING } from '../landing.constants'

export function LandingPricing() {
  const { monthly, annual, features } = PRICING

  return (
    <section id="pricing" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-gray-400">
            14-day trial. Upgrade when you&apos;re ready. No hidden fees.
          </p>
        </div>

        <div className="grid items-center gap-6 sm:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-7">
            <p className="text-[0.875rem] font-semibold uppercase tracking-wider text-gray-400">
              {monthly.label}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">&#8377;{monthly.price}</span>
              <span className="text-gray-500">/{monthly.period}</span>
            </div>
            <p className="mt-2 text-[0.875rem] text-gray-500">Pay as you go</p>
            <a
              href={CTA_ROUTE}
              className="mt-6 block rounded-xl bg-gray-800 py-3 text-center text-[0.875rem] font-semibold text-white transition-colors duration-200 hover:bg-gray-700"
            >
              Get Started
            </a>
            <FeatureList features={features} />
          </div>

          {/* Annual — highlighted */}
          <div className="relative rounded-2xl border-2 border-teal-500 bg-gray-900 p-7 shadow-lg shadow-teal-500/10 sm:scale-[1.03]">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-500 px-4 py-1 text-[0.75rem] font-bold uppercase tracking-wider text-black">
              {annual.badge}
            </span>
            <p className="text-[0.875rem] font-semibold uppercase tracking-wider text-teal-400">
              {annual.label}
            </p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-bold text-white">&#8377;{annual.price}</span>
              <span className="text-gray-500">/{annual.period}</span>
            </div>
            <p className="mt-2 text-[0.875rem] text-teal-400">
              Save &#8377;{annual.savings} per year
            </p>
            <a
              href={CTA_ROUTE}
              className="mt-6 block rounded-xl bg-teal-500 py-3 text-center text-[0.875rem] font-bold text-black transition-colors duration-200 hover:bg-teal-400"
            >
              Get Started
            </a>
            <FeatureList features={features} />
          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureList({ features }: { features: readonly string[] }) {
  return (
    <ul className="mt-7 space-y-2.5">
      {features.map((feat) => (
        <li key={feat} className="flex items-start gap-2.5 text-[0.8125rem] text-gray-300">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
          {feat}
        </li>
      ))}
    </ul>
  )
}
