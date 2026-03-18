/** Footer — minimal with branding */

import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '@/config/app.config'
import { ShimmerButton } from '@/components/magicui/shimmer-button'
import { BlurFade } from '@/components/magicui/blur-fade'
import { CTA_ROUTE } from '../landing.constants'

export function LandingFooter() {
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  return (
    <>
      {/* Bottom CTA */}
      <section className="px-4 py-16 sm:py-24">
        <BlurFade delay={0}>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 rounded-3xl border border-neutral-100 bg-white p-8 text-center shadow-lg sm:p-12 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl dark:text-white">
              Ready to Go Pro?
            </h2>
            <p className="max-w-md text-neutral-500 dark:text-neutral-400">
              Join thousands of Indian businesses billing smarter. Free to start, no credit card needed.
            </p>
            <ShimmerButton
              background="var(--color-primary-500)"
              shimmerColor="var(--color-secondary-300)"
              className="px-8 py-3 text-base font-semibold"
              onClick={() => navigate(CTA_ROUTE)}
            >
              Start Free Now
              <ArrowRight size={18} className="ml-2" aria-hidden="true" />
            </ShimmerButton>
          </div>
        </BlurFade>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-100 px-4 py-8 dark:border-neutral-800">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <span className="text-lg font-bold text-neutral-900 dark:text-white">{APP_NAME}</span>
            <p className="text-xs text-neutral-400">Made with pride in India</p>
          </div>
          <div className="flex gap-6 text-sm text-neutral-500">
            <a href="#features" className="hover:text-neutral-900 dark:hover:text-white">Features</a>
            <a href="#comparison" className="hover:text-neutral-900 dark:hover:text-white">Compare</a>
            <a href="mailto:support@hisaabpro.in" className="hover:text-neutral-900 dark:hover:text-white">Contact</a>
          </div>
          <p className="text-xs text-neutral-400">&copy; {year} {APP_NAME}</p>
        </div>
      </footer>
    </>
  )
}
