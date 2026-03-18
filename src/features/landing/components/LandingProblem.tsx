/** Problem statement — 3 pain point cards on dark bg */

import { NotebookPen, AlertTriangle, WifiOff, type LucideIcon } from 'lucide-react'

import { PROBLEMS } from '../landing.constants'

const ICON_MAP: Record<string, LucideIcon> = { NotebookPen, CircleAlert: AlertTriangle, WifiOff }

export function LandingProblem() {
  return (
    <section className="px-4 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-400">
          The Problem
        </p>
        <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">
          Sound familiar?
        </h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {PROBLEMS.map((problem) => {
            const Icon = ICON_MAP[problem.icon]
            return (
              <div
                key={problem.title}
                className="group rounded-2xl border border-gray-800 bg-gray-900 p-6 text-left transition-all duration-300 hover:-translate-y-1 hover:border-gray-700"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 transition-colors group-hover:bg-teal-500/20">
                  {Icon && <Icon size={24} aria-hidden="true" />}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">
                  {problem.title}
                </h3>
                <p className="mt-2 text-[0.9375rem] leading-relaxed text-gray-400">
                  {problem.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
