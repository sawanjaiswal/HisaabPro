/** Use cases by business type — dark card gallery */

import { Text } from '@/components/ui/Text'
import { Store, Truck, Briefcase, Check } from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

import { USE_CASES } from '../landing.constants'
import { Heading } from '@/components/ui/Heading'

const ICON_MAP: Record<string, LucideIcon> = { Store, Truck, Briefcase }

const ICON_COLORS = ['text-emerald-400', 'text-blue-400', 'text-amber-400'] as const
const BG_COLORS = ['bg-emerald-500/10', 'bg-blue-500/10', 'bg-amber-500/10'] as const

export function LandingUseCases() {
  return (
    <section id="use-cases" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <Text className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            For Your Business
          </Text>
          <Heading level={2} className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built for every type of Indian business
          </Heading>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc, i) => {
            const Icon = ICON_MAP[uc.icon]
            return (
              <div
                key={uc.id}
                className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 transition-all duration-300 hover:-translate-y-1 hover:border-gray-700 hover:shadow-lg hover:shadow-black/40"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${BG_COLORS[i]}`}>
                  {Icon && <Icon className={`h-6 w-6 ${ICON_COLORS[i]}`} aria-hidden="true" />}
                </div>

                <Heading level={3} className="mt-5 text-lg font-bold text-white">{uc.title}</Heading>
                <Text className="mt-2 text-sm leading-relaxed text-gray-400">
                  {uc.description}
                </Text>

                <ul className="mt-5 space-y-2.5">
                  {uc.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm text-gray-300">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
