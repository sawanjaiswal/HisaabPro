/** Hero section — animated headline, stats, shimmer CTA */

import { ArrowRight, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { APP_TAGLINE } from '@/config/app.config'
import { AnimatedShinyText } from '@/components/magicui/animated-shiny-text'
import { ShimmerButton } from '@/components/magicui/shimmer-button'
import { NumberTicker } from '@/components/magicui/number-ticker'
import { BlurFade } from '@/components/magicui/blur-fade'
import { CTA_ROUTE } from '../landing.constants'

const STATS = [
  { value: 90, suffix: '+', label: 'Features' },
  { value: 7, suffix: '', label: 'Doc Types' },
  { value: 100, suffix: '%', label: 'Offline' },
  { value: 0, suffix: '', label: 'Data Loss', static: true },
]

export function LandingHero() {
  const navigate = useNavigate()

  return (
    <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center">
      <BlurFade delay={0}>
        <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-1.5 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/80">
          <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
          <AnimatedShinyText className="text-sm font-medium">
            Free for Indian Businesses
          </AnimatedShinyText>
        </div>
      </BlurFade>

      <BlurFade delay={0.1}>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl md:text-6xl dark:text-white">
          Run Your Business
          <br />
          <span className="bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-300)] bg-clip-text text-transparent">
            Like a Pro
          </span>
        </h1>
      </BlurFade>

      <BlurFade delay={0.2}>
        <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-500 dark:text-neutral-400">
          {APP_TAGLINE}. The only billing app that works{' '}
          <strong className="text-neutral-700 dark:text-neutral-200">100% offline</strong> with zero data loss.
        </p>
      </BlurFade>

      <BlurFade delay={0.3}>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <ShimmerButton
            background="var(--color-primary-500)"
            shimmerColor="var(--color-secondary-300)"
            className="px-8 py-3 text-base font-semibold"
            onClick={() => navigate(CTA_ROUTE)}
          >
            Start Free
            <ArrowRight size={18} className="ml-2" aria-hidden="true" />
          </ShimmerButton>
          <a
            href="#features"
            className="rounded-full border border-neutral-200 px-6 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            See Features
          </a>
        </div>
      </BlurFade>

      {/* Stats strip */}
      <BlurFade delay={0.4}>
        <div className="mt-16 grid grid-cols-4 gap-6 sm:gap-12">
          {STATS.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
                {stat.static ? '0' : <NumberTicker value={stat.value} delay={0.5} />}
                {stat.suffix}
              </span>
              <span className="text-xs font-medium text-neutral-500 sm:text-sm">{stat.label}</span>
            </div>
          ))}
        </div>
      </BlurFade>
    </section>
  )
}
