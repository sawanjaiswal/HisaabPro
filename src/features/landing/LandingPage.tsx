/** Landing Page — HisaabPro story: Hero → Features → Deep-Dive → How It Works → FAQ → Pricing → Proof → CTA */

import { useState, useEffect } from 'react'
import { LandingSEO } from './components/LandingSEO'

import SaaSHero from '@/components/ui/saa-s-template'
import { FeaturesSection7 } from '@/components/ui/features-section-7'
import { FeaturesSectionWithBentoGrid } from '@/components/ui/feature-bento-grid'
import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-hover-effects'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { PricingSection } from '@/components/ui/pricing-section'
import { TestimonialV2 } from '@/components/ui/testimonial-v2'
import { CallToAction } from '@/components/ui/cta-section'
import { Footer } from '@/components/ui/footer-section'

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

  // Toggle dark class on <html>
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    return () => {
      // Restore dark on unmount (app default)
      document.documentElement.classList.add('dark')
    }
  }, [isDark])

  return (
    <div className="landing-root">
      <LandingSEO />
      {/* 1. Hero + Nav */}
      <SaaSHero isDark={isDark} onToggleTheme={toggleTheme} />
      {/* 2. Key Features — 4 pillars */}
      <FeaturesSection7 />
      {/* 3. Feature Deep-Dive — bento grid */}
      <FeaturesSectionWithBentoGrid />
      {/* 4. How It Works — hover steps */}
      <FeaturesSectionWithHoverEffects />
      {/* 5. FAQ — accordion */}
      <Feature197 />
      {/* 6. Pricing — ₹INR, 3 tiers, auto-recurring */}
      <PricingSection />
      {/* 7. Testimonials — Indian business owners */}
      <div style={{ paddingBottom: '4rem' }}>
        <TestimonialV2 />
      </div>
      {/* 8. Final CTA */}
      <div style={{ paddingBottom: '80px' }}>
        <CallToAction />
      </div>
      {/* Footer */}
      <Footer />
    </div>
  )
}
