/** Feature deep-dive accordion — left title + right expandable items */

import { useState, useCallback } from 'react'
import {
  WifiOff, FileText, IndianRupee, Package, ChevronDown,
  type LucideIcon,
} from 'lucide-react'

import { FEATURE_DEEP_DIVES } from '../landing.constants'

const ICON_MAP: Record<string, LucideIcon> = { WifiOff, FileText, IndianRupee, Package }

export function LandingAccordion() {
  const [openId, setOpenId] = useState<string>(FEATURE_DEEP_DIVES[0].id)

  const toggle = useCallback((id: string) => {
    setOpenId((prev) => (prev === id ? '' : id))
  }, [])

  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:gap-16">
        {/* Left — section intro */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Deep Dive
          </p>
          <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
            Built for how Indian businesses actually work
          </h2>
          <p className="mt-4 text-gray-400 leading-relaxed">
            Every feature is designed for real-world conditions — unreliable internet,
            small phone screens, thousands of daily transactions. No compromises.
          </p>
        </div>

        {/* Right — accordion */}
        <div className="space-y-3">
          {FEATURE_DEEP_DIVES.map((item) => {
            const Icon = ICON_MAP[item.icon]
            const isOpen = openId === item.id

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-colors duration-200 ${
                  isOpen
                    ? 'border-gray-700 bg-gray-900'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-center gap-4 p-5 text-left"
                  aria-expanded={isOpen}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                    {Icon && <Icon size={20} aria-hidden="true" />}
                  </div>
                  <span className="flex-1 font-semibold text-white">{item.title}</span>
                  <ChevronDown
                    size={20}
                    className={`shrink-0 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>

                <div
                  className={`grid transition-all duration-200 ${
                    isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-[0.9375rem] leading-relaxed text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
