/** GST report — one taxable-total card (mockup #31).
 *
 * Headline taxable value, then the CGST / SGST / IGST split across three
 * columns. Used for sales, purchases, and the credit/debit note totals so all
 * four read identically.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { TaxTotals } from '../report-tax.types'

interface TaxTotalsCardProps {
  title: string
  totals: TaxTotals
  /** Shown under the title — "12 invoices" in the mockup. */
  countLabel?: string
}

export function TaxTotalsCard({ title, totals, countLabel }: TaxTotalsCardProps) {
  const { t } = useLanguage()

  const components = [
    { key: 'cgst', label: t.cgst, amount: totals.cgst },
    { key: 'sgst', label: t.sgst, amount: totals.sgst },
    { key: 'igst', label: t.igst, amount: totals.igst },
  ]

  return (
    <section className="tax-card py-0">
      <header className="tax-card__head">
        <h2 className="tax-card__title">{title}</h2>
        {countLabel && <span className="tax-card__count">{countLabel}</span>}
      </header>

      <p className="tax-card__amount">{formatPaise(totals.taxableValue)}</p>

      <dl className="tax-card__split">
        {components.map((component) => (
          <div key={component.key} className="tax-card__component">
            <dt className="tax-card__component-label">{component.label}</dt>
            <dd className="tax-card__component-amount">{formatPaise(component.amount)}</dd>
          </div>
        ))}
      </dl>

      {totals.cess > 0 && (
        <p className="tax-card__cess">
          {t.cess}: {formatPaise(totals.cess)}
        </p>
      )}
    </section>
  )
}
