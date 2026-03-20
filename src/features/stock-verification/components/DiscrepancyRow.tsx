import type { VerificationItem } from '../stock-verification.types'
import { formatDiscrepancy, getDiscrepancyColor } from '../stock-verification.utils'

interface DiscrepancyRowProps {
  item: VerificationItem
}

export function DiscrepancyRow({ item }: DiscrepancyRowProps) {
  const unit = item.product?.unit?.symbol ?? 'pcs'
  const diffColor = getDiscrepancyColor(item.discrepancy)

  return (
    <div className="sv-discrepancy-row">
      <div className="sv-discrepancy-row__product">
        <span className="sv-discrepancy-row__name">{item.product?.name ?? 'Unknown'}</span>
        {item.product?.sku && <span className="sv-discrepancy-row__sku">{item.product.sku}</span>}
      </div>
      <div className="sv-discrepancy-row__values">
        <div className="sv-discrepancy-row__col">
          <span className="sv-discrepancy-row__label">Expected</span>
          <span>{item.expectedQuantity} {unit}</span>
        </div>
        <div className="sv-discrepancy-row__col">
          <span className="sv-discrepancy-row__label">Actual</span>
          <span>{item.actualQuantity ?? '-'} {unit}</span>
        </div>
        <div className="sv-discrepancy-row__col">
          <span className="sv-discrepancy-row__label">Diff</span>
          <span style={{ color: diffColor, fontWeight: 600 }}>
            {formatDiscrepancy(item.discrepancy)}
          </span>
        </div>
      </div>
    </div>
  )
}
