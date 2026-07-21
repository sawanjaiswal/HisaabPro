/** GST report — net output tax liability (mockup #31, emerald block).
 *
 * Sales tax less credit notes, per component. Shares the `.tax-card__split`
 * grid with `TaxTotalsCard` so the columns line up between the cards; cess
 * only appears when the business actually charges it.
 */

import { useLanguage } from '@/hooks/useLanguage'
import { formatPaise } from '@/lib/format'
import type { NetTaxLiability } from '../report-tax.types'

interface TaxNetLiabilityCardProps {
  liability: NetTaxLiability
}

export function TaxNetLiabilityCard({ liability }: TaxNetLiabilityCardProps) {
  const { t } = useLanguage()

  const total = liability.cgst + liability.sgst + liability.igst + liability.cess

  const components = [
    { key: 'cgst', label: t.cgst, amount: liability.cgst },
    { key: 'sgst', label: t.sgst, amount: liability.sgst },
    { key: 'igst', label: t.igst, amount: liability.igst },
    ...(liability.cess > 0 ? [{ key: 'cess', label: t.cess, amount: liability.cess }] : []),
  ]

  return (
    <section className="tax-liability py-0">
      <span className="tax-liability__label">{t.netTaxLiability}</span>
      <p className="tax-liability__amount">{formatPaise(total)}</p>

      <dl className="tax-card__split tax-liability__split">
        {components.map((component) => (
          <div key={component.key} className="tax-card__component">
            <dt className="tax-card__component-label">{component.label}</dt>
            <dd className="tax-card__component-amount">{formatPaise(component.amount)}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
