/** India-first features — horizontal card grid */

import { Text } from '@/components/ui/Text'
import {
  IndianRupee, Smartphone, Languages,
  Printer, Wifi, QrCode,
  type LucideIcon,
} from 'lucide-react'

import { INDIA_FEATURES } from '../landing.constants'
import { Heading } from '@/components/ui/Heading'

const ICON_MAP: Record<string, LucideIcon> = {
  IndianRupee, Smartphone, Languages, Printer, Wifi, QrCode,
}

export function LandingIndia() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-14 text-center">
          <Text className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Made for India
          </Text>
          <Heading level={2} className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Built specifically for Indian businesses
          </Heading>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDIA_FEATURES.map((f) => {
            const Icon = ICON_MAP[f.icon]
            return (
              <div
                key={f.title}
                className="flex items-start gap-4 rounded-xl border border-gray-800 bg-gray-900 p-5 transition-colors duration-200 hover:border-gray-700 hover:bg-gray-800/60"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-500/10">
                  {Icon && <Icon size={22} className="text-teal-400" aria-hidden="true" />}
                </div>
                <div>
                  <Heading level={3} className="text-base font-semibold text-white">{f.title}</Heading>
                  <Text className="mt-1 text-sm leading-relaxed text-gray-400">
                    {f.description}
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
