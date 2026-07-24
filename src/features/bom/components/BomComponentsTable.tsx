/** BomComponentsTable — read-only table on detail page */

import { formatQty } from '../bom.utils'
import { useLanguage } from '@/context/LanguageContext'
import type { BomComponentDTO } from '../bom.types'

interface BomComponentsTableProps {
  components: BomComponentDTO[]
  quantityProduced?: number
}

export function BomComponentsTable({ components, quantityProduced = 1 }: BomComponentsTableProps) {
  const { t } = useLanguage()
  if (components.length === 0) {
    return <p className="bom-components-empty">{t.bomNoComponents}</p>
  }

  return (
    <div className="bom-components-table-wrap">
      {/* Desktop table — hidden at mobile */}
      <table className="bom-components-table" role="table" aria-label={t.bomComponentsAria}>
        <thead>
          <tr>
            <th scope="col">{t.bomColComponent}</th>
            <th scope="col" className="bom-components-table__num">{t.bomColQtyPerUnit}</th>
            <th scope="col">{t.unit}</th>
            <th scope="col" className="bom-components-table__num">{t.bomColStock}</th>
          </tr>
        </thead>
        <tbody>
          {components.map((c) => (
            <tr key={c.id}>
              <td>{c.componentProductName}</td>
              <td className="bom-components-table__num">
                {formatQty(c.quantity * quantityProduced)}
              </td>
              <td>{c.unitName ?? '—'}</td>
              <td className="bom-components-table__num">
                <span
                  className={`bom-stock-badge ${
                    c.currentStock >= c.quantity * quantityProduced
                      ? 'bom-stock-badge--ok'
                      : c.currentStock > 0
                      ? 'bom-stock-badge--low'
                      : 'bom-stock-badge--insufficient'
                  }`}
                >
                  {formatQty(c.currentStock)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="bom-components-cards" aria-label={t.bomComponentsAria}>
        {components.map((c) => {
          const required = c.quantity * quantityProduced
          const stockOk = c.currentStock >= required
          const stockLow = !stockOk && c.currentStock > 0
          return (
            <div key={c.id} className="bom-component-card">
              <div className="bom-component-card__name">{c.componentProductName}</div>
              <div className="bom-component-card__meta">
                <span>{t.qty}: {formatQty(required)}{c.unitName ? ` ${c.unitName}` : ''}</span>
                <span
                  className={`bom-stock-badge ${
                    stockOk
                      ? 'bom-stock-badge--ok'
                      : stockLow
                      ? 'bom-stock-badge--low'
                      : 'bom-stock-badge--insufficient'
                  }`}
                >
                  {t.stock}: {formatQty(c.currentStock)}
                </span>
              </div>
              {c.notes && <div className="bom-component-card__notes">{c.notes}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
