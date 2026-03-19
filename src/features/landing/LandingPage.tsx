/** Landing Page — HisaabPro conversion flow: Hero → Social Proof → Features → How It Works → Pricing → Testimonials → FAQ → CTA */

import { useState, useLayoutEffect, useEffect } from 'react'
import { LandingSEO } from './components/LandingSEO'

import SaaSHero from '@/components/ui/saa-s-template'
import { SocialProofBar } from '@/components/ui/social-proof-bar'
import { FeaturesSection7 } from '@/components/ui/features-section-7'
import { FeaturesSectionWithBentoGrid } from '@/components/ui/feature-bento-grid'
import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-hover-effects'
import { PricingSection } from '@/components/ui/pricing-section'
import { TestimonialV2 } from '@/components/ui/testimonial-v2'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { CallToAction } from '@/components/ui/cta-section'
import { Footer } from '@/components/ui/footer-section'
import { StickyMobileCTA } from '@/components/ui/sticky-mobile-cta'

import './landing.css'

export default function LandingPage() {
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => setIsDark(prev => !prev)

  // Restore scroll position on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('landing-scroll')
    if (saved) window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' })

    const handleScroll = () => sessionStorage.setItem('landing-scroll', String(window.scrollY))
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Toggle dark class on <html> — useLayoutEffect to avoid flash
  useLayoutEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return () => {
      document.documentElement.classList.add('dark')
    }
  }, [isDark])

  return (
    <div className="landing-root">
      <LandingSEO />

      {/* 1. Hero + Nav */}
      <SaaSHero isDark={isDark} onToggleTheme={toggleTheme} />

      {/* 2. Social Proof — trust bar */}
      <SocialProofBar />

      {/* 3. Key Features — 4 pillars */}
      <FeaturesSection7 />

      {/* 4. Feature Deep-Dive — bento grid */}
      <div className="landing-section-tinted">
        <FeaturesSectionWithBentoGrid />
      </div>

      {/* 5. How It Works — hover steps */}
      <FeaturesSectionWithHoverEffects />

      {/* 6. Pricing — ₹INR, 3 tiers */}
      <div className="landing-section-tinted">
        <PricingSection />
      </div>

      {/* 7. Testimonials — Indian business owners */}
      <TestimonialV2 />

      {/* 8. FAQ — objection handling */}
      <div className="landing-section-tinted">
        <Feature197 />
      </div>

      {/* 9. Final CTA */}
      <div id="final-cta" style={{ paddingBottom: '5rem' }}>
        <CallToAction />
      </div>

      {/* Footer */}
      <Footer />

      {/* Sticky mobile CTA — appears when hero/final CTA scroll out of view */}
      <StickyMobileCTA />
    </div>
  )
}
