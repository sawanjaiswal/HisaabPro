/** Comparison table — Us vs Vyapar vs BillBook (dark theme) */

import { Check, X } from 'lucide-react'

import { APP_NAME } from '@/config/app.config'
import { COMPARISON } from '../landing.constants.below'

function CellValue({ value }: { value: boolean | string }) {
  if (value === true)
    return <Check size={18} className="mx-auto text-emerald-400" aria-label="Yes" />
  if (value === false)
    return <X size={18} className="mx-auto text-red-400/60" aria-label="No" />
  return <span className="text-[0.8125rem] font-medium text-amber-400">{value}</span>
}

export function LandingComparison() {
  return (
    <section id="comparison" className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
            Compare
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See how we stack up
          </h2>
          <p className="mt-3 text-gray-400">
            Honest comparison — we show where competitors match us too.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="w-full min-w-[28rem] text-[0.875rem]" aria-label="Feature comparison">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="sticky left-0 z-10 bg-gray-900 px-4 py-3.5 text-left font-medium text-gray-500">
                  Feature
                </th>
                <th className="bg-teal-600 px-4 py-3.5 text-center font-semibold text-white">
                  {APP_NAME}
                </th>
                <th className="bg-gray-900 px-4 py-3.5 text-center font-medium text-gray-500">
                  Vyapar
                </th>
                <th className="bg-gray-900 px-4 py-3.5 text-center font-medium text-gray-500">
                  BillBook
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map((row, i) => (
                <tr
                  key={row.feature}
                  className={`border-b border-gray-800 transition-colors last:border-none hover:bg-gray-800/50 ${
                    i % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/60'
                  }`}
                >
                  <td className="sticky left-0 z-10 bg-inherit px-4 py-3 font-medium text-gray-300">
                    {row.feature}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellValue value={row.us} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellValue value={row.vyapar} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CellValue value={row.billbook} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
