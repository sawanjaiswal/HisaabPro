/** TrialBalanceTable — Renders debit/credit table with totals row */

import { formatPaise } from '../accounting.utils'
import type { TrialBalanceRow, TrialBalanceTotals } from '../accounting.types'
import { useLanguage } from '@/hooks/useLanguage'

interface TrialBalanceTableProps {
  rows: TrialBalanceRow[]
  totals: TrialBalanceTotals
}

export function TrialBalanceTable({ rows, totals }: TrialBalanceTableProps) {
  const { t } = useLanguage()
  return (
    <div className="tb-table-wrap" role="region" aria-label={t.trialBalanceTableAria}>
      <table className="tb-table">
        <thead>
          <tr>
            <th className="tb-th tb-th-code" scope="col">{t.sku}</th>
            <th className="tb-th tb-th-name" scope="col">{t.accountNameLabel}</th>
            <th className="tb-th tb-th-num" scope="col">{t.debit2}</th>
            <th className="tb-th tb-th-num" scope="col">{t.credit2}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.accountId} className="tb-row">
              <td className="tb-td tb-code">{row.code}</td>
              <td className="tb-td tb-name">
                <span className="tb-name-text">{row.name}</span>
                {row.subType && (
                  <span className="tb-subtype">{row.subType}</span>
                )}
              </td>
              <td className="tb-td tb-num tb-debit">
                {row.totalDebit > 0 ? formatPaise(row.totalDebit) : '—'}
              </td>
              <td className="tb-td tb-num tb-credit">
                {row.totalCredit > 0 ? formatPaise(row.totalCredit) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="tb-totals-row">
            <td className="tb-td tb-totals-label" colSpan={2}>{t.total}</td>
            <td className="tb-td tb-num tb-debit tb-total">
              {formatPaise(totals.debit)}
            </td>
            <td className="tb-td tb-num tb-credit tb-total">
              {formatPaise(totals.credit)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
