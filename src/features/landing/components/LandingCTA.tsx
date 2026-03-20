/** Final CTA — dark section with teal radial glow */

import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { CTA_ROUTE } from '../landing.constants'

export function LandingCTA() {
  const navigate = useNavigate()

  return (
    <section className="relative overflow-hidden px-4 py-20 sm:py-28">
      {/* Radial teal glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(13,148,136,0.15), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <h2
          className="text-3xl font-medium sm:text-4xl lg:text-5xl"
          style={{
            background: 'linear-gradient(to bottom, #fff, rgba(255,255,255,0.6))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          Ready to upgrade your business?
        </h2>
        <p className="mt-4 max-w-lg text-[1rem] leading-relaxed text-gray-400">
          Join thousands of Indian businesses using HisaabPro. 14-day trial, no credit card required.
        </p>

        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-b from-white via-white/95 to-white/60 px-8 py-3 text-[1rem] font-medium text-black transition-all hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            onClick={() => navigate(CTA_ROUTE)}
            aria-label="Start using HisaabPro"
          >
            Get Started
          </button>
          <a
            href="#features"
            className="inline-flex items-center gap-1 text-[0.875rem] text-gray-400 transition-colors hover:text-white"
          >
            See all features
            <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  )
}
