/** Comparison table — Us vs Vyapar vs BillBook */

import { Check, X } from 'lucide-react'
import { APP_NAME } from '@/config/app.config'
import { BlurFade } from '@/components/magicui/blur-fade'
import { COMPARISON } from '../landing.constants'

function CellValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check size={18} className="text-emerald-500" aria-label="Yes" />
  if (value === false) return <X size={18} className="text-neutral-300 dark:text-neutral-600" aria-label="No" />
  return <span className="text-xs font-medium text-amber-500">{value}</span>
}

export function LandingComparison() {
  return (
    <section id="comparison" className="px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <BlurFade delay={0}>
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-white">
              Why {APP_NAME}?
            </h2>
            <p className="mt-3 text-neutral-500 dark:text-neutral-400">
              We built what Vyapar and BillBook couldn&apos;t
            </p>
          </div>
        </BlurFade>

        <BlurFade delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-neutral-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <table className="w-full text-sm" aria-label="Feature comparison">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-800/50">
                  <th className="px-4 py-3 text-left font-medium text-neutral-500">Feature</th>
                  <th className="px-4 py-3 text-center font-semibold text-[var(--color-primary-500)]">{APP_NAME}</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-400">Vyapar</th>
                  <th className="px-4 py-3 text-center font-medium text-neutral-400">BillBook</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-neutral-50 last:border-none dark:border-neutral-800/50">
                    <td className="px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">{row.feature}</td>
                    <td className="px-4 py-3 text-center"><CellValue value={row.us} /></td>
                    <td className="px-4 py-3 text-center"><CellValue value={row.vyapar} /></td>
                    <td className="px-4 py-3 text-center"><CellValue value={row.billbook} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </BlurFade>
      </div>
    </section>
  )
}
