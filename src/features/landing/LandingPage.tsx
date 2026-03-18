/** Landing Page — 21st.dev components as-is, only text swapped for HisaabPro */

import { LandingSEO } from './components/LandingSEO'

/* All 21st.dev components — used as-is, only text content changed */
import SaaSHero from '@/components/ui/saa-s-template'
import { FeaturesSection7 } from '@/components/ui/features-section-7'
import { FeaturesSectionWithBentoGrid } from '@/components/ui/feature-bento-grid'
import { Feature197 } from '@/components/ui/accordion-feature-section'
import { FeaturesSection6 } from '@/components/ui/features-section-6'
import { FeaturesSection5 } from '@/components/ui/features-section-5'
import { Gallery4 } from '@/components/ui/gallery-section'
import { PricingSection } from '@/components/ui/pricing-section'
// import { TestimonialsSection } from '@/components/ui/testimonials-with-marquee'
import { CallToAction } from '@/components/ui/cta-section'
import { Footer } from '@/components/ui/footer-section'

/* New 21st.dev components — batch 2 */
import { FeatureSection } from '@/components/ui/feature-section'
import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-hover-effects'
import { FeaturesSection8 } from '@/components/ui/features-section-8'
import { Features as FeaturesSection10 } from '@/components/ui/features-section-10'
// import { FeaturesSection11 } from '@/components/ui/features-section-11'
import { CyberneticBentoGrid } from '@/components/ui/cybernetic-bento-grid'
import { RadialOrbitalTimeline } from '@/components/ui/radial-orbital-timeline'
import DatabaseWithRestApi from '@/components/ui/database-rest-api'
import { TestimonialV2 } from '@/components/ui/testimonial-v2'
import { BentoGrid } from '@/components/ui/bento-grid'
// import SectionWithMockup from '@/components/ui/section-with-mockup'

import './landing.css'

export default function LandingPage() {
  return (
    <div className="landing-root">
      <LandingSEO />
      <SaaSHero />
      <FeaturesSection7 />
      <FeaturesSectionWithBentoGrid />
      <FeatureSection />
      <Feature197 />
      <FeaturesSectionWithHoverEffects />
      <FeaturesSection8 />
      <Gallery4 />
      <CyberneticBentoGrid />
      <BentoGrid />
      <FeaturesSection10 />
      {/* <FeaturesSection11 /> */}
      <FeaturesSection6 />
      <FeaturesSection5 />
      <RadialOrbitalTimeline />
      <DatabaseWithRestApi />
      {/* <SectionWithMockup /> */}
      <PricingSection />
      {/* <TestimonialsSection /> */}
      <div style={{ paddingBottom: '4rem' }}>
        <TestimonialV2 />
      </div>
      <div style={{ paddingBottom: '80px' }}>
        <CallToAction />
      </div>
      <Footer />
    </div>
  )
}
