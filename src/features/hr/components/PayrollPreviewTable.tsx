/** PayrollPreviewTable — Phase 6 PR6 FE
 *
 * Tabular view of payroll lines. Used in BOTH:
 *   - PayrollWizardPage  (pre-finalize preview — editable nothing, view-only)
 *   - PayrollRunDetailPage (post-finalize view — same shape, frozen rows)
 *
 * Layout strategy:
 *   <md  → stacked cards (one card per employee — readable on 320px)
 *   ≥md  → real <table> with sticky head + tabular-nums for alignment
 *
 * Money is paise on the wire; we format via `formatPaise()` per cell. All
 * column heads are i18n keys; all colors are tokens.
 *
 * Empty state is owned by the PARENT (this component renders nothing when
 * `lines.length === 0`) — the wizard distinguishes "no preview yet" vs
 * "preview returned zero employees".
 */

import { formatPaise } from '@/lib/format'
import { useLanguage } from '@/hooks/useLanguage'
import type { PayrollLine, PayrollPreviewTotals } from '../payroll.types'
import { Heading } from '@/components/ui/Heading'

interface PayrollPreviewTableProps {
  lines: PayrollLine[]
  totals: PayrollPreviewTotals
}

export function PayrollPreviewTable({ lines, totals }: PayrollPreviewTableProps) {
  const { t } = useLanguage()

  if (lines.length === 0) return null

  return (
    <div>
      {/* Mobile <md — stacked cards */}
      <ul className="md:hidden space-y-3 list-none p-0 m-0">
        {lines.map((line) => (
          <li key={line.employeeId}>
            <article
              className="rounded-lg bg-surface border border-border p-3"
              aria-label={line.employeeName}
            >
              <header className="flex items-baseline justify-between gap-2 mb-2">
                <Heading level={3} className="text-base font-medium text-text-primary truncate">
                  {line.employeeName}
                </Heading>
                <span className="text-base font-semibold text-text-primary tabular-nums whitespace-nowrap">
                  {formatPaise(line.netPaise)}
                </span>
              </header>

              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-text-secondary">{t.payrollColPresent as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{line.presentDays}</dd>

                <dt className="text-text-secondary">{t.payrollColHalf as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{line.halfDays}</dd>

                <dt className="text-text-secondary">{t.payrollColOvertimeMin as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{line.overtimeMin}</dd>

                <dt className="text-text-secondary">{t.payrollColGross as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{formatPaise(line.grossPaise)}</dd>

                <dt className="text-text-secondary">{t.payrollColAdvance as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{formatPaise(line.advanceTotalPaise)}</dd>

                <dt className="text-text-secondary">{t.payrollColDeductions as string}</dt>
                <dd className="tabular-nums text-right text-text-primary">{formatPaise(line.deductionsPaise)}</dd>
              </dl>
            </article>
          </li>
        ))}
      </ul>

      {/* Desktop ≥md — table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-subtle">
            <tr>
              <th scope="col" className="text-left p-2 text-text-secondary font-medium">
                {t.payrollColEmployee as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColPresent as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColHalf as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColOvertimeMin as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColGross as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColAdvance as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColDeductions as string}
              </th>
              <th scope="col" className="text-right p-2 text-text-secondary font-medium">
                {t.payrollColNet as string}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.employeeId} className="border-t border-border">
                <td className="p-2 text-text-primary">{line.employeeName}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{line.presentDays}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{line.halfDays}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{line.overtimeMin}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{formatPaise(line.grossPaise)}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{formatPaise(line.advanceTotalPaise)}</td>
                <td className="p-2 text-right tabular-nums text-text-primary">{formatPaise(line.deductionsPaise)}</td>
                <td className="p-2 text-right tabular-nums font-semibold text-text-primary">{formatPaise(line.netPaise)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface-subtle">
            <tr className="border-t border-border">
              <th scope="row" className="p-2 text-left text-text-primary font-semibold">
                {t.payrollTotalsLabel as string}
              </th>
              <td colSpan={3} />
              <td className="p-2 text-right tabular-nums font-semibold text-text-primary">{formatPaise(totals.grossPaise)}</td>
              <td colSpan={2} />
              <td className="p-2 text-right tabular-nums font-semibold text-text-primary">{formatPaise(totals.netPaise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile totals — outside the cards (always visible) */}
      <div
        className="md:hidden mt-3 rounded-lg bg-surface-subtle border border-border p-3"
        aria-label={t.payrollTotalsLabel as string}
      >
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-secondary">{t.payrollColGross as string}</dt>
          <dd className="tabular-nums text-right font-medium text-text-primary">{formatPaise(totals.grossPaise)}</dd>

          <dt className="text-base text-text-primary font-semibold">{t.payrollColNet as string}</dt>
          <dd className="tabular-nums text-right text-base font-semibold text-text-primary">{formatPaise(totals.netPaise)}</dd>
        </dl>
      </div>
    </div>
  )
}
