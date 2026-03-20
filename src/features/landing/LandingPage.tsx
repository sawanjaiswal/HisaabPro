/** Landing Page — HisaabPro conversion flow: Hero → Social Proof → Features → How It Works → Pricing → Testimonials → FAQ → CTA */

import { useState, useLayoutEffect, useEffect, lazy, Suspense } from 'react'
import { LandingSEO } from './components/LandingSEO'
import { LP_SECTIONS } from '@/config/landing-links.config'

/* Above-the-fold — eagerly loaded */
import SaaSHero from '@/components/ui/saa-s-template'
import { SocialProofBar } from '@/components/ui/social-proof-bar'

/* Below-the-fold — lazy loaded */
const LazyFeaturesSection7 = lazy(() => import('@/components/ui/features-section-7').then(m => ({ default: m.FeaturesSection7 })))
const LazyBentoGrid = lazy(() => import('@/components/ui/feature-bento-grid').then(m => ({ default: m.FeaturesSectionWithBentoGrid })))
const LazyHoverEffects = lazy(() => import('@/components/ui/feature-hover-effects').then(m => ({ default: m.FeaturesSectionWithHoverEffects })))
const LazyInvoiceTemplates = lazy(() => import('@/components/ui/invoice-templates-section').then(m => ({ default: m.InvoiceTemplatesSection })))
const LazyBeforeAfter = lazy(() => import('@/components/ui/before-after-section').then(m => ({ default: m.BeforeAfterSection })))
const LazyPricing = lazy(() => import('@/components/ui/pricing-section').then(m => ({ default: m.PricingSection })))
const LazyTestimonials = lazy(() => import('@/components/ui/testimonial-v2').then(m => ({ default: m.TestimonialV2 })))
const LazyFAQ = lazy(() => import('@/components/ui/accordion-feature-section').then(m => ({ default: m.Feature197 })))
const LazyCTA = lazy(() => import('@/components/ui/cta-section').then(m => ({ default: m.CallToAction })))
const LazyFooter = lazy(() => import('@/components/ui/footer-section').then(m => ({ default: m.Footer })))
const LazyStickyMobileCTA = lazy(() => import('@/components/ui/sticky-mobile-cta').then(m => ({ default: m.StickyMobileCTA })))

import './landing.css'

export default function LandingPage() {
  const [isDark, setIsDark] = useState(true)

  const toggleTheme = () => setIsDark(prev => !prev)

  // Restore scroll position on mount + throttled scroll save
  useEffect(() => {
    const saved = sessionStorage.getItem('landing-scroll')
    if (saved) window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' })

    let ticking = false
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          sessionStorage.setItem('landing-scroll', String(window.scrollY))
          ticking = false
        })
        ticking = true
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
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
      <Suspense fallback={null}>
        <LazyFeaturesSection7 />
      </Suspense>

      {/* 4. Feature Deep-Dive — bento grid */}
      <Suspense fallback={null}>
        <div className="landing-section-tinted">
          <LazyBentoGrid />
        </div>
      </Suspense>

      {/* 5. Invoice Templates — customization showcase */}
      <Suspense fallback={null}>
        <LazyInvoiceTemplates />
      </Suspense>

      {/* 6. How It Works — hover steps */}
      <Suspense fallback={null}>
        <LazyHoverEffects />
      </Suspense>

      {/* 7. Before/After — transformation proof */}
      <Suspense fallback={null}>
        <LazyBeforeAfter />
      </Suspense>

      {/* 8. Pricing — ₹INR, 3 tiers */}
      <Suspense fallback={null}>
        <div className="landing-section-tinted">
          <LazyPricing />
        </div>
      </Suspense>

      {/* 8. Testimonials — Indian business owners */}
      <Suspense fallback={null}>
        <LazyTestimonials />
      </Suspense>

      {/* 9. FAQ — objection handling */}
      <Suspense fallback={null}>
        <div className="landing-section-tinted">
          <LazyFAQ />
        </div>
      </Suspense>

      {/* 10. Final CTA + Download anchor */}
      <Suspense fallback={null}>
        <div id={LP_SECTIONS.FINAL_CTA} style={{ paddingBottom: '5rem' }}>
          <div id={LP_SECTIONS.DOWNLOAD} />
          <LazyCTA />
        </div>
      </Suspense>

      {/* Footer */}
      <Suspense fallback={null}>
        <LazyFooter />
      </Suspense>

      {/* Sticky mobile CTA — appears when hero/final CTA scroll out of view */}
      <Suspense fallback={null}>
        <LazyStickyMobileCTA />
      </Suspense>
    </div>
  )
}
