/** Invoice Charges Section — shared between Create & Edit Invoice pages
 *
 * Renders: additional charge rows (name + amount) with add/remove.
 * All amounts in PAISE.
 */

import { Plus } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { AdditionalChargeFormData } from '../invoice.types'

interface InvoiceChargesSectionProps {
  charges: AdditionalChargeFormData[]
  onUpdateCharge: (index: number, charge: Partial<AdditionalChargeFormData>) => void
  onRemoveCharge: (index: number) => void
  onAddCharge: (charge: AdditionalChargeFormData) => void
}

export function InvoiceChargesSection({
  charges,
  onUpdateCharge,
  onRemoveCharge,
  onAddCharge,
}: InvoiceChargesSectionProps) {
  const { t } = useLanguage()
  return (
    <div className="charges-section py-0">
      {charges.map((charge, index) => (
        <div key={`charge-${charge.name || index}`} className="charge-row">
          <input
            type="text"
            className="input min-h-[44px] flex-1"
            placeholder={t.chargeNamePlaceholder}
            value={charge.name}
            onChange={(e) => onUpdateCharge(index, { name: e.target.value })}
            aria-label={`Charge ${index + 1} name`}
          />
          <input
            type="number"
            className="input min-h-[44px] w-[100px]"
            placeholder={t.amount}
            value={charge.value || ''}
            onChange={(e) => onUpdateCharge(index, { value: parseFloat(e.target.value) || 0 })}
            aria-label={`Charge ${index + 1} value`}
          />
          <button
            type="button"
            className="charge-remove"
            onClick={() => onRemoveCharge(index)}
            aria-label={`Remove charge ${charge.name || index + 1}`}
          >
            &times;
          </button>
        </div>
      ))}

      <button
        type="button"
        className="add-item-btn"
        onClick={() => onAddCharge({ name: '', type: 'FIXED', value: 0 })}
        aria-label={t.addAdditionalCharge}
      >
        <Plus size={18} aria-hidden="true" />
        {t.addChargeLabel}
      </button>
    </div>
  )
}
