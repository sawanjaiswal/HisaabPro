/** Aging report — loading state.
 *
 * Mirrors the real layout (chip row · five party rows · footer card) so the
 * page does not jump when data lands. The page had no skeleton before this
 * reskin — it flashed an empty container.
 */

export function AgingSkeleton() {
  return (
    <div className="aging-skeleton animate-pulse" aria-busy="true">
      <div className="aging-skeleton__chips">
        {['c1', 'c2', 'c3', 'c4', 'c5'].map((key) => (
          <div key={key} className="aging-skeleton__chip" />
        ))}
      </div>

      <div className="aging-skeleton__rows">
        {['r1', 'r2', 'r3', 'r4', 'r5'].map((key) => (
          <div key={key} className="aging-skeleton__row">
            <div className="aging-skeleton__avatar" />
            <div className="aging-skeleton__lines">
              <div className="aging-skeleton__line aging-skeleton__line--wide" />
              <div className="aging-skeleton__line aging-skeleton__line--narrow" />
            </div>
            <div className="aging-skeleton__amount" />
          </div>
        ))}
      </div>

      <div className="aging-skeleton__footer" />
    </div>
  )
}
