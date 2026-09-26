/** Invoice Charges Section — shared between Create & Edit Invoice pages
 *
 * Renders: additional charge rows (name + amount) with add/remove.
 */

import { Plus, Trash2, IndianRupee } from 'lucide-react'
import { useLanguage } from '@/hooks/useLanguage'
import type { AdditionalChargeFormData } from '../invoice.types'
import { Button } from '@/components/ui/Button'

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
    <div className="space-y-3">
      {charges.length > 0 && (
        <div className="space-y-2.5">
          {charges.map((charge, index) => (
            <div key={`charge-${charge.name || index}`} className="flex items-center gap-2">
              <input
                type="text"
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3.5 py-2 text-sm font-medium text-slate-900 min-h-[44px] focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20 outline-none transition-colors"
                placeholder={t.chargeNamePlaceholder || 'Charge name (e.g. Delivery, Discount)'}
                value={charge.name}
                onChange={(e) => onUpdateCharge(index, { name: e.target.value })}
                aria-label={`Charge ${index + 1} name`}
              />
              <div className="relative w-32 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <IndianRupee size={14} />
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  className="w-full bg-white border border-gray-200 rounded-xl pl-8 pr-3 py-2 text-sm font-semibold tabular-nums text-slate-900 min-h-[44px] focus:bg-white focus:border-[#026F39] focus:ring-2 focus:ring-[#026F39]/20 outline-none transition-colors"
                  placeholder="0"
                  value={charge.value || ''}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0
                    onUpdateCharge(index, { value: val })
                  }}
                  aria-label={`Charge ${index + 1} value`}
                />
              </div>
              <Button
                variant="none"
                type="button"
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                onClick={() => onRemoveCharge(index)}
                aria-label={`Remove charge ${charge.name || index + 1}`}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="none"
        type="button"
        className="w-full py-2.5 px-4 bg-[#F8F9FA] hover:bg-emerald-50 text-[#026F39] hover:text-[#025a2e] border border-dashed border-emerald-300/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
        onClick={() => onAddCharge({ name: '', type: 'FIXED', value: 0 })}
        aria-label={t.addAdditionalCharge || 'Add Additional Charge'}
      >
        <Plus size={15} />
        <span>{t.addChargeLabel || 'Add Charge / Discount'}</span>
      </Button>
    </div>
  )
}
