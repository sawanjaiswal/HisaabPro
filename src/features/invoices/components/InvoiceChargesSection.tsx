/** Invoice Charges Section — shared between Create & Edit Invoice pages
 *
 * Renders: additional charge rows (name + amount) with add/remove.
 * All amounts in PAISE.
 */

import { Plus } from 'lucide-react'
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
  return (
    <div className="charges-section">
      {charges.map((charge, index) => (
        <div key={`charge-${charge.name || index}`} className="charge-row">
          <input
            type="text"
            className="input"
            placeholder="Charge name"
            value={charge.name}
            onChange={(e) => onUpdateCharge(index, { name: e.target.value })}
            aria-label={`Charge ${index + 1} name`}
            style={{ minHeight: '44px', flex: 1 }}
          />
          <input
            type="number"
            className="input"
            placeholder="Amount"
            value={charge.value || ''}
            onChange={(e) => onUpdateCharge(index, { value: parseFloat(e.target.value) || 0 })}
            aria-label={`Charge ${index + 1} value`}
            style={{ minHeight: '44px', width: '100px' }}
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
        aria-label="Add additional charge"
      >
        <Plus size={18} aria-hidden="true" />
        Add Charge
      </button>
    </div>
  )
}
