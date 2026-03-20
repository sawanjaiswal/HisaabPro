/** Hero section — dark SaaS template (wisedev/saa-s-template from 21st.dev) */

import { memo } from 'react'
import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { HERO, CTA_ROUTE } from '../landing.constants'

export const LandingHero = memo(function LandingHero() {
  const navigate = useNavigate()

  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-start px-6 py-20 md:py-24"
      style={{ animation: 'fadeIn 0.6s ease-out' }}
    >
      {/* Announcement badge */}
      <aside className="mb-8 inline-flex flex-wrap items-center justify-center gap-2 px-4 py-2 rounded-full border border-gray-700 bg-gray-800/50 backdrop-blur-sm max-w-full">
        <span className="text-xs text-center whitespace-nowrap text-gray-400">
          {HERO.badge}
        </span>
        <a
          href="#features"
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-all active:scale-95 whitespace-nowrap"
          aria-label="See all features"
        >
          Learn more
          <ArrowRight size={12} />
        </a>
      </aside>

      {/* Headline with gradient text */}
      <h1
        className="text-4xl md:text-5xl lg:text-6xl font-medium text-center max-w-3xl px-6 leading-tight mb-6"
        style={{
          background: 'linear-gradient(to bottom, var(--lp-heading-from), var(--lp-heading-mid), var(--lp-heading-to))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.05em',
        }}
      >
        {HERO.headline}
        <br />
        {HERO.headlineAccent}
      </h1>

      {/* Subtext */}
      <p className="text-sm md:text-base text-center max-w-2xl px-6 mb-10 text-gray-400">
        {HERO.subtext}
      </p>

      {/* CTA button — gradient white */}
      <div className="flex items-center gap-4 relative z-10 mb-16">
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-12 px-8 text-base bg-gradient-to-b from-white via-white/95 to-white/60 text-black hover:scale-105 active:scale-95"
          onClick={() => navigate(CTA_ROUTE)}
          aria-label="Get started with HisaabPro"
        >
          {HERO.cta}
        </button>
      </div>

      {/* Dashboard mockup with glow */}
      <div className="w-full max-w-5xl relative pb-20">
        {/* Glow overlay */}
        <div
          className="absolute left-1/2 w-[90%] pointer-events-none z-0"
          style={{ top: '-23%', transform: 'translateX(-50%)' }}
          aria-hidden="true"
        >
          <img
            src="https://i.postimg.cc/Ss6yShGy/glows.png"
            alt=""
            className="w-full h-auto"
            loading="eager"
          />
        </div>

        {/* Dashboard placeholder — we'll replace with real screenshot */}
        <div className="relative z-10">
          <div className="w-full aspect-video rounded-lg shadow-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border border-gray-700/50 flex items-center justify-center overflow-hidden">
            {/* Mock dashboard UI */}
            <div className="w-full h-full p-4 md:p-8 flex flex-col gap-4">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center">
                    <div className="w-4 h-4 rounded bg-teal-500" />
                  </div>
                  <div className="h-3 w-24 rounded bg-gray-700" />
                </div>
                <div className="flex gap-2">
                  <div className="h-8 w-20 rounded-md bg-gray-700/50" />
                  <div className="h-8 w-8 rounded-md bg-gray-700/50" />
                </div>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mt-2">
                <div className="rounded-lg bg-gray-800/80 border border-gray-700/30 p-3 md:p-4">
                  <div className="h-2 w-16 rounded bg-gray-600 mb-2" />
                  <div className="h-5 w-20 rounded bg-teal-500/30" />
                </div>
                <div className="rounded-lg bg-gray-800/80 border border-gray-700/30 p-3 md:p-4">
                  <div className="h-2 w-16 rounded bg-gray-600 mb-2" />
                  <div className="h-5 w-20 rounded bg-green-500/30" />
                </div>
                <div className="rounded-lg bg-gray-800/80 border border-gray-700/30 p-3 md:p-4">
                  <div className="h-2 w-16 rounded bg-gray-600 mb-2" />
                  <div className="h-5 w-20 rounded bg-amber-500/30" />
                </div>
              </div>
              {/* Table rows */}
              <div className="flex-1 rounded-lg bg-gray-800/50 border border-gray-700/30 p-3 md:p-4 flex flex-col gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-teal-500/40" />
                    <div className="h-2 flex-1 rounded bg-gray-700/60" />
                    <div className="h-2 w-16 rounded bg-gray-700/40" />
                    <div className="h-5 w-14 rounded-md bg-green-500/20" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
})
