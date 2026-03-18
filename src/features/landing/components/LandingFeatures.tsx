/** Features bento grid — varied card sizes, dark theme */

import {
  FileText, WifiOff, IndianRupee, Package,
  BarChart3, MessageCircle, Users, Shield, Palette,
  type LucideIcon,
} from 'lucide-react'

import { FEATURES, type LandingFeature } from '../landing.constants'

const ICON_MAP: Record<string, LucideIcon> = {
  FileText, WifiOff, IndianRupee, Package,
  BarChart3, MessageCircle, Users, Shield, Palette,
}

const SIZE_CLASSES: Record<LandingFeature['size'], string> = {
  large: 'col-span-1 sm:col-span-2 p-8',
  medium: 'col-span-1 p-6',
  small: 'col-span-1 p-5',
}

const ACCENT_GRADIENT =
  'bg-gradient-to-br from-teal-500/10 via-transparent to-transparent'

export function LandingFeatures() {
  return (
    <section id="features" className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Features
          </span>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Everything your business needs
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-gray-400">
            90+ features built for Indian MSMEs — from kirana shops to wholesale distributors
          </p>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = ICON_MAP[f.icon]
            const isLarge = f.size === 'large'

            return (
              <div
                key={f.id}
                className={`group rounded-2xl border border-gray-800 bg-gray-900 transition-all duration-300 hover:-translate-y-1 hover:border-gray-700 ${SIZE_CLASSES[f.size]} ${isLarge ? ACCENT_GRADIENT : ''}`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                  {Icon && <Icon size={isLarge ? 28 : 24} aria-hidden="true" />}
                </div>
                <h3
                  className={`mb-1 font-semibold text-white ${isLarge ? 'text-lg' : 'text-base'}`}
                >
                  {f.title}
                </h3>
                <p
                  className={`leading-relaxed text-gray-400 ${isLarge ? 'text-base' : 'text-sm'}`}
                >
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
