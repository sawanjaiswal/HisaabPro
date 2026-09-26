/** How it works — 3-step vertical timeline with teal accent */

import { Text } from '@/components/ui/Text'
import { FileText, Share2, IndianRupee, type LucideIcon } from 'lucide-react'

import { STEPS } from '../landing.constants'
import { Heading } from '@/components/ui/Heading'

const ICON_MAP: Record<string, LucideIcon> = { FileText, Share2, IndianRupee }

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <Text className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            How It Works
          </Text>
          <Heading level={2} className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            From invoice to payment in 3 steps
          </Heading>
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
                  className="absolute -left-[calc(2.5rem+1px)] flex h-12 w-12 items-center justify-center rounded-full border-2 border-primary-500 bg-gray-900 shadow-[0_0_16px_rgba(11,79,94,0.4)] sm:-left-[calc(3rem+1px)]"
                  aria-hidden="true"
                >
                  <span className="text-sm font-bold text-teal-400">{step.step}</span>
                </div>

                {/* Content */}
                <div>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10">
                    {Icon && <Icon size={22} className="text-teal-400" aria-hidden="true" />}
                  </div>
                  <Heading level={3} className="text-lg font-bold text-white">{step.title}</Heading>
                  <Text className="mt-1.5 max-w-md text-base leading-relaxed text-gray-400">
                    {step.description}
                  </Text>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
