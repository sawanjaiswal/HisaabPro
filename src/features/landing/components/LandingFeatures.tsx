/** Features grid — 8 features with blur-fade entrance */

import {
  FileText, IndianRupee, Package, WifiOff,
  BarChart3, MessageCircle, Users, Shield,
  type LucideIcon,
} from 'lucide-react'
import { BlurFade } from '@/components/magicui/blur-fade'
import { FEATURES } from '../landing.constants'

const ICON_MAP: Record<string, LucideIcon> = {
  FileText, IndianRupee, Package, WifiOff,
  BarChart3, MessageCircle, Users, Shield,
}

export function LandingFeatures() {
  return (
    <section id="features" className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <BlurFade delay={0}>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
              Everything You Need
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-neutral-500 dark:text-neutral-400">
              90+ features built for Indian MSMEs — from kirana shops to wholesale distributors
            </p>
          </div>
        </BlurFade>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => {
            const Icon = ICON_MAP[f.icon]
            return (
              <BlurFade key={f.id} delay={0.05 * i}>
                <div className="group rounded-2xl border border-neutral-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary-50)] text-[var(--color-primary-500)] transition-colors group-hover:bg-[var(--color-primary-500)] group-hover:text-white">
                    {Icon && <Icon size={24} aria-hidden="true" />}
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-white">
                    {f.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                    {f.description}
                  </p>
                </div>
              </BlurFade>
            )
          })}
        </div>
      </div>
    </section>
  )
}
