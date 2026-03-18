/** How it works — 3-step vertical timeline with teal accent */

import { FileText, Share2, IndianRupee, type LucideIcon } from 'lucide-react'

import { STEPS } from '../landing.constants'

const ICON_MAP: Record<string, LucideIcon> = { FileText, Share2, IndianRupee }

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            How It Works
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            From invoice to payment in 3 steps
          </h2>
        </div>

        {/* Vertical timeline */}
        <div className="relative mt-14 ml-6 border-l-2 border-gray-800 pl-10 sm:ml-0 sm:pl-12">
          {STEPS.map((step, i) => {
            const Icon = ICON_MAP[step.icon as keyof typeof ICON_MAP]
            const isLast = i === STEPS.length - 1

            return (
              <div key={step.step} className={`relative ${isLast ? '' : 'pb-14'}`}>
                {/* Timeline dot */}
                <div
                  className="absolute -left-[calc(2.5rem+1px)] flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#0B4F5E] bg-gray-900 shadow-[0_0_16px_rgba(11,79,94,0.4)] sm:-left-[calc(3rem+1px)]"
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-teal-400">{step.step}</span>
                </div>

                {/* Content */}
                <div>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
                    {Icon && <Icon size={22} className="text-teal-400" aria-hidden="true" />}
                  </div>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-1.5 max-w-md text-[0.9375rem] leading-relaxed text-gray-400">
                    {step.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
