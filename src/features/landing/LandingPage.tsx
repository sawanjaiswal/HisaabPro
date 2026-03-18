/** Landing Page — public marketing page for HisaabPro */

import { DotPattern } from '@/components/magicui/dot-pattern'
import { LandingHero } from './components/LandingHero'
import { LandingFeatures } from './components/LandingFeatures'
import { LandingComparison } from './components/LandingComparison'
import { LandingFooter } from './components/LandingFooter'

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-neutral-950">
      {/* Dot pattern background */}
      <DotPattern
        className="opacity-[0.15] [mask-image:radial-gradient(600px_circle_at_center,white,transparent)] dark:opacity-[0.08]"
        cr={1.2}
        width={20}
        height={20}
      />

      {/* Gradient overlay at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-[var(--color-primary-50)]/30 to-transparent dark:from-[var(--color-primary-900)]/20" />

      <div className="relative z-10">
        <LandingHero />
        <LandingFeatures />
        <LandingComparison />
        <LandingFooter />
      </div>
    </div>
  )
}
