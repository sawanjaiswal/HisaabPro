/** HeroPage — reusable emerald-hero page shell.
 *
 * Generalizes the dashboard's "Home 2" pattern into a single primitive so
 * every hero-style screen reads identically:
 *   • the global <Header> is recoloured to the deep-emerald surface (via the
 *     `.hp-hero-page` marker + `:has()` in hero-page.css — no per-page hack),
 *   • `hero` content sits on the emerald field directly under the header,
 *   • `children` sit in a white rounded sheet that lifts off the emerald.
 *
 * Usage:
 *   <AppShell>
 *     <Header scrollCondense title={t.parties} />
 *     <HeroPage hero={<SummaryCards />}>
 *       …page content…
 *     </HeroPage>
 *   </AppShell>
 */

import type { ReactNode } from 'react'
import './hero-page.css'

interface HeroPageProps {
  /** Content rendered on the emerald field, directly beneath the header. */
  hero?: ReactNode
  /** Main page content — rendered inside the white rounded sheet. */
  children: ReactNode
  /** Extra classes for the white sheet (e.g. a PageContainer variant). */
  className?: string
}

export function HeroPage({ hero, children, className }: HeroPageProps) {
  return (
    <div className="hp-hero-page">
      {hero !== undefined && <div className="hp-hero-top">{hero}</div>}
      <div className={`hp-hero-sheet${className ? ` ${className}` : ''}`}>
        {children}
      </div>
    </div>
  )
}
